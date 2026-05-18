const getRetentionDataFromFile = require('./get-retention-data-from-file')
const { mapRetentionData } = require('./map-retention-data')
const { handleParsedRetentionData } = require('./handle-parsed-retention-data')
const sendFileErrorEvent = require('../messaging/send-file-error-event')

const parseRetentionFile = async (filename, fileStream) => {
  try {
    const parsedRetentionData = await getRetentionDataFromFile(fileStream)
    const mappedRetentionData = mapRetentionData(parsedRetentionData)
    await handleParsedRetentionData(mappedRetentionData)
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
