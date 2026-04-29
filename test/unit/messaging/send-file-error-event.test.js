jest.mock('ffc-pay-event-publisher')
jest.mock('../../../app/config/message')

const { EventPublisher } = require('ffc-pay-event-publisher')
const messageConfig = require('../../../app/config/message')
const sendFileErrorEvent = require('../../../app/messaging/send-file-error-event')
const { SOURCE } = require('../../../app/constants/source')
const { RETENTION_FILE_REJECTED } = require('../../../app/constants/events')

describe('sendFileErrorEvent', () => {
  let mockEventPublisher

  beforeEach(() => {
    jest.clearAllMocks()

    mockEventPublisher = {
      publishEvent: jest.fn()
    }

    EventPublisher.mockImplementation(() => mockEventPublisher)
    messageConfig.alertTopic = 'test-alert-topic'
  })

  test('should create EventPublisher with correct topic', async () => {
    await sendFileErrorEvent('file.txt', new Error('Something went wrong'))

    expect(EventPublisher).toHaveBeenCalledWith('test-alert-topic')
  })

  test('should publish event with correct structure', async () => {
    const filename = 'error-file.csv'
    const error = new Error('File parse error')

    await sendFileErrorEvent(filename, error)

    expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
      source: SOURCE,
      type: RETENTION_FILE_REJECTED,
      subject: filename,
      data: {
        message: error.message,
        filename
      }
    })
  })

  test('should throw error if publishEvent fails', async () => {
    const err = new Error('Publish failed')
    mockEventPublisher.publishEvent.mockRejectedValue(err)

    await expect(sendFileErrorEvent('file.txt', new Error('Error message'))).rejects.toThrow('Publish failed')
  })
})
