const { EventPublisher } = require('ffc-pay-event-publisher')
const messageConfig = require('../config/message')
const { SOURCE } = require('../constants/source')
const { RETENTION_FILE_REJECTED } = require('../constants/events')

const sendFileErrorEvent = async (filename, error) => {
  const event = {
    source: SOURCE,
    type: RETENTION_FILE_REJECTED,
    subject: filename,
    data: {
      message: error.message,
      filename
    }
  }
  const eventPublisher = new EventPublisher(messageConfig.alertTopic)
  await eventPublisher.publishEvent(event)
}

module.exports = sendFileErrorEvent
