const { getPendingRetentionData } = require('./get-pending-retention-data')
const sendPublishMessage = require('../messaging/send-publish-message')
const db = require('../data')

const publishStatements = async () => {
  const pendingRetentionData = await getPendingRetentionData()
  for (const pending of pendingRetentionData) {
    console.log(`Data passed 7 year retention for frn: ${pending.frn}, agreement number: ${pending.agreementNumber}`)
    await sendPublishMessage(pending)
    await db.retentionData.destroy({
      where: { dataRetentionId: pending.dataRetentionId }
    })
    console.log('Notification supplied to downstream systems')
  }
}

module.exports = {
  publishStatements
}
