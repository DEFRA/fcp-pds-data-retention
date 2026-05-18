const { processingConfig } = require('../config')
const { publishRetentionData } = require('./publish-retention-data')

const start = async () => {
  try {
    await publishRetentionData()
  } catch (err) {
    console.error(err)
  } finally {
    setTimeout(start, processingConfig.publishingInterval)
  }
}

module.exports = {
  start
}
