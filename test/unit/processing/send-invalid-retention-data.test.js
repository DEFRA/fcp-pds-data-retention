jest.mock('ffc-pay-event-publisher')
jest.mock('../../../app/config/message')

const { EventPublisher } = require('ffc-pay-event-publisher')
const messageConfig = require('../../../app/config/message')
const { SOURCE } = require('../../../app/constants/source')
const { RETENTION_DATA_REJECTED } = require('../../../app/constants/events')
const { sendInvalidRetentionData } = require('../../../app/processing/send-invalid-retention-data')

describe('sendInvalidRetentionData', () => {
  let mockEventPublisher

  beforeEach(() => {
    jest.clearAllMocks()

    mockEventPublisher = {
      publishEvents: jest.fn()
    }

    EventPublisher.mockImplementation(() => mockEventPublisher)
    messageConfig.alertTopic = 'test-alert-topic'
  })

  test('should not publish events if invalidRetentionData is undefined', async () => {
    await sendInvalidRetentionData(undefined)

    expect(EventPublisher).not.toHaveBeenCalled()
    expect(mockEventPublisher.publishEvents).not.toHaveBeenCalled()
  })

  test('should not publish events if invalidRetentionData is empty array', async () => {
    await sendInvalidRetentionData([])

    expect(EventPublisher).not.toHaveBeenCalled()
    expect(mockEventPublisher.publishEvents).not.toHaveBeenCalled()
  })

  test('should create events and publish them when invalidRetentionData is provided', async () => {
    const invalidData = [
      { frn: 123, scheme: 'UNKNOWN', errorCode: 'E001' },
      { frn: 456, scheme: 'INVALID', errorCode: 'E002' }
    ]

    const expectedEvents = invalidData.map(data => ({
      source: SOURCE,
      type: RETENTION_DATA_REJECTED,
      data: {
        message: 'Scheme was not recognised for the supplied retention data',
        ...data
      }
    }))

    await sendInvalidRetentionData(invalidData)

    expect(EventPublisher).toHaveBeenCalledWith('test-alert-topic')
    expect(mockEventPublisher.publishEvents).toHaveBeenCalledWith(expectedEvents)
  })

  test('should await publishEvents call', async () => {
    const invalidData = [{ frn: 789 }]
    let published = false

    mockEventPublisher.publishEvents.mockImplementation(async () => {
      published = true
    })

    await sendInvalidRetentionData(invalidData)

    expect(published).toBe(true)
  })

  test('should throw if publishEvents rejects', async () => {
    const invalidData = [{ frn: 101 }]
    const error = new Error('Publish failed')
    mockEventPublisher.publishEvents.mockRejectedValueOnce(error)

    await expect(sendInvalidRetentionData(invalidData)).rejects.toThrow('Publish failed')
  })
})
