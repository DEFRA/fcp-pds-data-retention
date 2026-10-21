const { getSitiAgriSchemeIds } = require('ffc-pay-schemes')
const { retentionData } = require('../database')
const { processingConfig } = require('../config')

const retentionYears = 7
const publishingLimit = 1000

const getPendingRetentionData = async () => {
  const retentionYearsAgo = new Date()
  retentionYearsAgo.setFullYear(retentionYearsAgo.getFullYear() - retentionYears)
  const sitiAgriSchemes = processingConfig.sendSitiAgriRetention ? null : await getSitiAgriSchemeIds()

  return retentionData()
    .where('endDate', '<', retentionYearsAgo)
    .modify(query => {
      if (sitiAgriSchemes) {
        query.whereNotIn('schemeId', sitiAgriSchemes)
      }
    })
    .limit(publishingLimit)
    .forUpdate()
}

module.exports = {
  getPendingRetentionData
}
