const { MessageSender } = require('ffc-messaging')
const { messageConfig } = require('../../config')
const { RETENTION_DATA_EXPIRED } = require('../constants/events')
const { SOURCE } = require('../constants/source')

const sendPublishMessage = async (body) => {
  let sender
  try {
    const message = {
      body,
      type: RETENTION_DATA_EXPIRED,
      source: SOURCE
    }

    sender = new MessageSender(messageConfig.retentionTopic)
    await sender.sendMessage(message)
  } catch (error) {
    console.error('Error sending publish message:', error)
    throw error
  } finally {
    if (sender) {
      try {
        await sender.closeConnection()
      } catch (closeError) {
        console.error('Error closing message sender connection:', closeError)
      }
    }
  }
}

module.exports = sendPublishMessage
