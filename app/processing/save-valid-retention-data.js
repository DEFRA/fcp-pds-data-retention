const db = require('../data')

const saveValidRetentionData = async (validRetentionData) => {
  return db.retentionData.bulkCreate(validRetentionData)
}

module.exports = {
  saveValidRetentionData
}
