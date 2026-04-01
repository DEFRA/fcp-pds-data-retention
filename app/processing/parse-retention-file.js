const getRetentionDataFromFile = require('./get-retention-data-from-file')
const { mapRetentionData } = require('./map-retention-data')
const { handleParsedRetentionData } = require('./handle-parsed-retention-data')

const parseRetentionFile = async (fileStream) => {
  try {
    const parsedRetentionData = await getRetentionDataFromFile(fileStream)
    const mappedRetentionData = mapRetentionData(parsedRetentionData)
    await handleParsedRetentionData(mappedRetentionData)
    return true
  } catch {
    return false
  }
}

module.exports = {
  parseRetentionFile
}
