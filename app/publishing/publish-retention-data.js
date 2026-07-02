const { getPendingRetentionData } = require('./get-pending-retention-data')
const sendPublishMessage = require('../messaging/send-publish-message')
const db = require('../data')
const { getMappedAgreementNumber } = require('./get-mapped-agreement-number')
const { SFI_PILOT, CS } = require('../constants/schemes')

const publishRetentionData = async () => {
  const pendingRetentionData = await getPendingRetentionData()

  if (!pendingRetentionData || pendingRetentionData.length === 0) {
    return
  }

  const messages = pendingRetentionData.map(pending => {
    console.log(`Data passed 7 year retention for frn: ${pending.frn}, agreement number: ${pending.agreementNumber}`)
    pending.simplifiedAgreementNumber = pending.agreementNumber
    pending.agreementNumber = getMappedAgreementNumber(pending.schemeId, pending.agreementNumber)
    pending.usesContractNumber = [SFI_PILOT, CS].includes(pending.schemeId)
    return pending
  })

  await Promise.all(messages.map(m => sendPublishMessage(m)))

  await db.retentionData.destroy({
    where: {
      retentionDataId: messages.map(m => m.retentionDataId)
    }
  })

  console.log('Notifications supplied to downstream systems')
}

module.exports = {
  publishRetentionData
}
