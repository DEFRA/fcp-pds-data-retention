const { saveValidRetentionData } = require('./save-valid-retention-data')

const handleParsedRetentionData = async (parsedRetentionData) => {
  try {
    await saveValidRetentionData(parsedRetentionData.successful)
  } catch (err) {
    console.error(`Retention data could not be sent: ${err}`)
  }
  return true
}

module.exports = {
  handleParsedRetentionData
}
