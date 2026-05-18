const processingConfig = require('../config/processing')
const pollInbound = require('./poll-inbound')

const start = async () => {
  try {
    await pollInbound()
  } catch (err) {
    console.log(err)
  } finally {
    setTimeout(start, processingConfig.pollingInterval)
  }
}

module.exports = {
  start
}
