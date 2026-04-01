const storage = require('../storage')
const processDataRetentionFile = require('./process-data-retention-file')

const pollInbound = async () => {
  const inboundFile = await storage.getInboundFile()
  if (inboundFile) {
    await processDataRetentionFile(inboundFile)
  }
}

module.exports = pollInbound
