const { messageConfig } = require('../config')
const { getSender, sendMessage: sendServiceBusMessage } = require('./service-bus')
const { RETENTION_DATA_EXPIRED } = require('../constants/events')
const { SOURCE } = require('../constants/source')

const sendPublishMessage = async (body) => {
  try {
    const message = {
      body,
      type: RETENTION_DATA_EXPIRED,
      source: SOURCE
    }
    const sender = getSender(messageConfig.retentionTopic)
    await sendServiceBusMessage(sender, message)
  } catch (error) {
    console.error('Error sending publish message:', error)
    throw error
  }
}

module.exports = sendPublishMessage
