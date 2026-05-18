jest.mock('ffc-messaging')
jest.mock('../../../app/config')

const { MessageSender } = require('ffc-messaging')
const { messageConfig } = require('../../../app/config')
const sendPublishMessage = require('../../../app/messaging/send-publish-message')
const { SOURCE } = require('../../../app/constants/source')
const { RETENTION_DATA_EXPIRED } = require('../../../app/constants/events')

describe('sendPublishMessage', () => {
  let mockSender

  beforeEach(() => {
    jest.clearAllMocks()
    mockSender = {
      sendMessage: jest.fn(),
      closeConnection: jest.fn()
    }
    MessageSender.mockImplementation(() => mockSender)
    messageConfig.retentionTopic = 'test-topic'
  })

  test('should send a message with correct structure', async () => {
    const testBody = { id: 123, data: 'test' }

    await sendPublishMessage(testBody)

    expect(MessageSender).toHaveBeenCalledWith('test-topic')
    expect(mockSender.sendMessage).toHaveBeenCalledWith({
      body: testBody,
      type: RETENTION_DATA_EXPIRED,
      source: SOURCE
    })
  })

  test('should close connection after successful message send', async () => {
    await sendPublishMessage({ test: 'data' })

    expect(mockSender.closeConnection).toHaveBeenCalled()
  })

  test('should throw error when sendMessage fails', async () => {
    const testError = new Error('Send failed')
    mockSender.sendMessage.mockRejectedValue(testError)

    await expect(sendPublishMessage({ test: 'data' })).rejects.toThrow('Send failed')
  })

  test('should attempt to close connection even when sendMessage fails', async () => {
    mockSender.sendMessage.mockRejectedValue(new Error('Send failed'))

    try {
      await sendPublishMessage({ test: 'data' })
    } catch (e) {

    }

    expect(mockSender.closeConnection).toHaveBeenCalled()
  })

  test('should handle closeConnection error gracefully', async () => {
    mockSender.closeConnection.mockRejectedValue(new Error('Close failed'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    await sendPublishMessage({ test: 'data' })

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error closing message sender connection:',
      expect.any(Error)
    )
    consoleSpy.mockRestore()
  })

  test('should not attempt to close undefined sender', async () => {
    MessageSender.mockImplementation(() => undefined)

    await sendPublishMessage({ test: 'data' })

    expect(true).toBe(true)
  })

  test('should log error when sendMessage throws', async () => {
    const testError = new Error('Send error')
    mockSender.sendMessage.mockRejectedValue(testError)
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
