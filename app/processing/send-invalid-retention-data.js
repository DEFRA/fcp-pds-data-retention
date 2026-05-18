const { EventPublisher } = require('ffc-pay-event-publisher')
const messageConfig = require('../config/message')
const { RETENTION_DATA_REJECTED } = require('../constants/events')
const { SOURCE } = require('../constants/source')

const sendInvalidRetentionData = async (invalidRetentionData) => {
  if (invalidRetentionData?.length) {
    const events = invalidRetentionData.map(createEvent)
    const eventPublisher = new EventPublisher(messageConfig.alertTopic)
    await eventPublisher.publishEvents(events)
  }
}

const createEvent = (retentionData) => {
  return {
    source: SOURCE,
    type: RETENTION_DATA_REJECTED,
    data: {
      message: 'Scheme was not recognised for the supplied retention data',
      ...retentionData
    }
  }
}

module.exports = {
  sendInvalidRetentionData
}
