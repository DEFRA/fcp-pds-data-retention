const sendRetentionDataInvalidEvents = require('../event/send-retention-data-invalid-events')
const { saveValidRetentionData } = require('./save-valid-retention-data')

const handleParsedRetentionData = async (parsedRetentionData) => {
  try {
    await saveValidRetentionData(parsedRetentionData.successful)
    await sendRetentionDataInvalidEvents(parsedRetentionData.unsuccessful)
  } catch (err) {
    console.error(`One or more payment requests could not be sent: ${err}`)
  }
  return true
}

module.exports = {
  handleParsedRetentionData
}
