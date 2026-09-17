jest.mock('../../../app/messaging/service-bus')
jest.mock('../../../app/config')

const { getSender, sendMessage: sendServiceBusMessage } = require('../../../app/messaging/service-bus')
const { messageConfig } = require('../../../app/config')
const sendPublishMessage = require('../../../app/messaging/send-publish-message')
const { SOURCE } = require('../../../app/constants/source')
const { RETENTION_DATA_EXPIRED } = require('../../../app/constants/events')

describe('sendPublishMessage', () => {
  let mockSender

  beforeEach(() => {
    jest.clearAllMocks()
    mockSender = {
      sendMessages: jest.fn()
    }
    getSender.mockReturnValue(mockSender)
    messageConfig.retentionTopic = {
      host: 'test-host.servicebus.windows.net',
      address: 'test-topic'
    }
  })

  test('should send a message with correct structure', async () => {
    const testBody = { id: 123, data: 'test' }

    await sendPublishMessage(testBody)

    expect(getSender).toHaveBeenCalledWith(messageConfig.retentionTopic)
    expect(sendServiceBusMessage).toHaveBeenCalledWith(
      mockSender,
      expect.objectContaining({
        body: testBody,
        type: RETENTION_DATA_EXPIRED,
        source: SOURCE
      })
    )
  })

  test('should throw error when sendMessage fails', async () => {
    const testError = new Error('Send failed')
    sendServiceBusMessage.mockRejectedValue(testError)

    await expect(sendPublishMessage({ test: 'data' })).rejects.toThrow('Send failed')
  })

  test('should log error when sendMessage throws', async () => {
    const testError = new Error('Send error')
    sendServiceBusMessage.mockRejectedValue(testError)
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    try {
      await sendPublishMessage({ test: 'data' })
    } catch (e) {

    }

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error sending publish message:',
      testError
    )
    consoleSpy.mockRestore()
  })
})
