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
      message: getRejectionMessage(retentionData.validationError),
      ...retentionData
    }
  }
}

const getRejectionMessage = (validationError) => {
  if (validationError?.reason === 'before-minimum-date') {
    return `End date ${validationError.date} is earlier than the minimum date ${validationError.minimumDate}`
  }

  if (validationError?.reason === 'invalid-date') {
    return 'End date is invalid'
  }

  return 'Scheme was not recognised for the supplied retention data'
}

module.exports = {
  sendInvalidRetentionData
}
