const { saveValidRetentionData } = require('./save-valid-retention-data')
const { sendInvalidRetentionData } = require('./send-invalid-retention-data')

const handleParsedRetentionData = async (parsedRetentionData) => {
  try {
    await saveValidRetentionData(parsedRetentionData.successful)
    await sendInvalidRetentionData(parsedRetentionData.unsuccessful)
  } catch (err) {
    console.error(`Retention data could not be sent: ${err}`)
  }
  return true
}

module.exports = {
  handleParsedRetentionData
}
