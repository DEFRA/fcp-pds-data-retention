const db = require('../data')

const retentionYears = 7
const publishingLimit = 500

const getPendingRetentionData = async () => {
  const retentionYearsAgo = new Date()
  retentionYearsAgo.setFullYear(retentionYearsAgo.getFullYear() - retentionYears)

  return db.retentionData.findAll({
    where: {
      startProcessing: { [db.Sequelize.Op.lt]: retentionYearsAgo }
    },
    limit: publishingLimit,
    lock: true
  })
}

module.exports = {
  getPendingRetentionData
}
