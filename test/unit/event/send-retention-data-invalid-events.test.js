const { EventPublisher } = require('ffc-pay-event-publisher')
const sendRetentionDataInvalidEvents = require('../../../app/event/send-retention-data-invalid-events')
const messageConfig = require('../../../app/config/message')
const { RETENTION_DATA_REJECTED } = require('../../../app/constants/events')
const { SOURCE } = require('../../../app/constants/source')

jest.mock('ffc-pay-event-publisher')
jest.mock('../../../app/config/message')
jest.spyOn(console, 'log').mockImplementation()

describe('sendRetentionDataInvalidEvents', () => {
  let mockEventPublisher
  let mockPublishEvents

  beforeEach(() => {
    jest.clearAllMocks()
    mockPublishEvents = jest.fn().mockResolvedValue(undefined)
    mockEventPublisher = {
      publishEvents: mockPublishEvents
    }
    EventPublisher.mockImplementation(() => mockEventPublisher)
  })

  describe('sendRetentionDataInvalidEvents', () => {
    test('should not publish events when retentionData is empty array', async () => {
      await sendRetentionDataInvalidEvents([])

      expect(EventPublisher).not.toHaveBeenCalled()
      expect(mockPublishEvents).not.toHaveBeenCalled()
    })

    test('should not publish events when retentionData is null', async () => {
      await sendRetentionDataInvalidEvents(null)

      expect(EventPublisher).not.toHaveBeenCalled()
      expect(mockPublishEvents).not.toHaveBeenCalled()
    })

    test('should not publish events when retentionData is undefined', async () => {
      await sendRetentionDataInvalidEvents(undefined)

      expect(EventPublisher).not.toHaveBeenCalled()
      expect(mockPublishEvents).not.toHaveBeenCalled()
    })

    test('should publish events when retentionData contains items', async () => {
      const retentionData = [
        { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' },
        { frn: 789012, schemeId: 2, agreementNumber: 'AG002', endDate: '2026-12-31' }
      ]

      messageConfig.eventsTopic = 'test-topic'

      await sendRetentionDataInvalidEvents(retentionData)

      expect(EventPublisher).toHaveBeenCalledWith('test-topic')
      expect(mockPublishEvents).toHaveBeenCalledTimes(1)
      expect(mockPublishEvents).toHaveBeenCalledWith([
        {
          source: SOURCE,
          type: RETENTION_DATA_REJECTED,
          data: {
            message: 'A scheme provided was not recognised by the retention service',
            frn: 123456,
            schemeId: 1,
            agreementNumber: 'AG001',
            endDate: '2025-12-31'
          }
        },
        {
          source: SOURCE,
          type: RETENTION_DATA_REJECTED,
          data: {
            message: 'A scheme provided was not recognised by the retention service',
            frn: 789012,
            schemeId: 2,
            agreementNumber: 'AG002',
            endDate: '2026-12-31'
          }
        }
      ])
    })

    test('should log the retention data being published', async () => {
      const retentionData = [{ frn: 123456 }]
      messageConfig.eventsTopic = 'test-topic'

      await sendRetentionDataInvalidEvents(retentionData)

      expect(console.log).toHaveBeenCalledWith(
        'Publishing events for invalid retention data',
        expect.any(String)
      )
    })

    test('should handle publishEvents rejection', async () => {
      const retentionData = [{ frn: 123456 }]
      const error = new Error('Publication failed')
      mockPublishEvents.mockRejectedValueOnce(error)
      messageConfig.eventsTopic = 'test-topic'

      await expect(sendRetentionDataInvalidEvents(retentionData)).rejects.toThrow('Publication failed')
    })

    test('should publish event for single retention data item', async () => {
      const retentionData = [{ frn: 111111, schemeId: 5 }]
      messageConfig.eventsTopic = 'test-topic'

      await sendRetentionDataInvalidEvents(retentionData)

      expect(mockPublishEvents).toHaveBeenCalledWith([
        {
          source: SOURCE,
          type: RETENTION_DATA_REJECTED,
          data: {
            message: 'A scheme provided was not recognised by the retention service',
            frn: 111111,
            schemeId: 5
          }
        }
      ])
    })
  })
})
