const db = require('../data')

const retentionYears = 7
const publishingLimit = 1000

const getPendingRetentionData = async () => {
  const retentionYearsAgo = new Date()
  retentionYearsAgo.setFullYear(retentionYearsAgo.getFullYear() - retentionYears)
  return db.retentionData.findAll({
    where: {
      endDate: { [db.Sequelize.Op.lt]: retentionYearsAgo }
    },
    limit: publishingLimit,
    raw: true,
    lock: true
  })
}

module.exports = {
  getPendingRetentionData
}
