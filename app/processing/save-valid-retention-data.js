const db = require('../data')

const saveValidRetentionData = async (validRetentionData) => {
  await db.retentionData.bulkCreate(validRetentionData)
}

module.exports = {
  saveValidRetentionData
}
