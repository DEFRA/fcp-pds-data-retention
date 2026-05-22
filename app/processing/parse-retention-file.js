const getRetentionDataFromFile = require('./get-retention-data-from-file')
const { mapRetentionData } = require('./map-retention-data')
const { handleParsedRetentionData } = require('./handle-parsed-retention-data')
const sendFileErrorEvent = require('../messaging/send-file-error-event')

const BATCH_SIZE = 1000

const parseRetentionFile = async (filename, fileStream) => {
  try {
    const successfulBatch = []
    const unsuccessfulBatch = []

    await getRetentionDataFromFile(fileStream, async (row) => {
      const mapped = mapRetentionData([row])
      successfulBatch.push(...mapped.successful)
      unsuccessfulBatch.push(...mapped.unsuccessful)
      console.log(`Parsed row with frn ${row.frn}`)
      if (successfulBatch.length + unsuccessfulBatch.length >= BATCH_SIZE) {
        await handleParsedRetentionData({
          successful: successfulBatch.splice(0),
          unsuccessful: unsuccessfulBatch.splice(0)
        })
      }
    })

    if (successfulBatch.length > 0 || unsuccessfulBatch.length > 0) {
      await handleParsedRetentionData({
        successful: successfulBatch,
        unsuccessful: unsuccessfulBatch
      })
    }

    return true
  } catch (err) {
    await sendFileErrorEvent(filename, err)
    console.error(`Error thrown processing ${filename}`)
    console.error(err)
    return false
  }
}

module.exports = {
  parseRetentionFile
}
