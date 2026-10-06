const { getSitiAgriSchemeIds } = require('ffc-pay-schemes')
const db = require('../data')
const { processingConfig } = require('../config')

const retentionYears = 7
const publishingLimit = 1000

const getPendingRetentionData = async () => {
  const retentionYearsAgo = new Date()
  retentionYearsAgo.setFullYear(retentionYearsAgo.getFullYear() - retentionYears)
  const where = {
    endDate: { [db.Sequelize.Op.lt]: retentionYearsAgo }
  }

  if (!processingConfig.sendSitiAgriRetention) {
    const sitiAgriSchemes = await getSitiAgriSchemeIds()
    where.schemeId = { [db.Sequelize.Op.notIn]: sitiAgriSchemes }
  }

  return db.retentionData.findAll({
    where,
    limit: publishingLimit,
    raw: true,
    lock: true
  })
}

module.exports = {
  getPendingRetentionData
}
