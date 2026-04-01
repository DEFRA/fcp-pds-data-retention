const { EventPublisher } = require('ffc-pay-event-publisher')
const util = require('node:util')
const messageConfig = require('../config/message')
const { SOURCE } = require('../constants/source')
const { RETENTION_DATA_REJECTED } = require('../constants/events')

const sendRetentionDataInvalidEvents = async (retentionData) => {
  console.log('Publishing events for invalid retention data', util.inspect(retentionData, false, null, true))
  if (retentionData?.length) {
    const events = retentionData.map(createEvent)
    const eventPublisher = new EventPublisher(messageConfig.eventsTopic)
    await eventPublisher.publishEvents(events)
  }
}

const createEvent = (retentionData) => {
  return {
    source: SOURCE,
    type: RETENTION_DATA_REJECTED,
    data: {
      message: 'A scheme provided was not recognised by the retention service',
      ...retentionData
    }
  }
}

module.exports = sendRetentionDataInvalidEvents
