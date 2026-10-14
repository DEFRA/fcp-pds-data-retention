const { retentionData } = require('../database')

const retentionYears = 7
const publishingLimit = 1000

const getPendingRetentionData = async () => {
  const retentionYearsAgo = new Date()
  retentionYearsAgo.setFullYear(retentionYearsAgo.getFullYear() - retentionYears)
  return retentionData()
    .where('endDate', '<', retentionYearsAgo)
    .limit(publishingLimit)
    .forUpdate()
}

module.exports = {
  getPendingRetentionData
}
