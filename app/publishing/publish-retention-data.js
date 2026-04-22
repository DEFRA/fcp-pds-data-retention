const { getPendingRetentionData } = require('./get-pending-retention-data')
const sendPublishMessage = require('../messaging/send-publish-message')
const db = require('../data')
const { getMappedAgreementNumber } = require('./get-mapped-agreement-number')
const { SFI_PILOT, CS } = require('../constants/schemes')

const publishRetentionData = async () => {
  const pendingRetentionData = await getPendingRetentionData()
  for (const pending of pendingRetentionData) {
    console.log(`Data passed 7 year retention for frn: ${pending.frn}, agreement number: ${pending.agreementNumber}`)
    pending.simplifiedAgreementNumber = pending.agreementNumber
    pending.agreementNumber = getMappedAgreementNumber(pending.schemeId, pending.agreementNumber)
    pending.usesContractNumber = [SFI_PILOT, CS].includes(pending.schemeId)
    await sendPublishMessage(pending)
    await db.retentionData.destroy({
      where: { retentionDataId: pending.retentionDataId }
    })
    console.log('Notification supplied to downstream systems')
  }
}

module.exports = {
  publishRetentionData
}
