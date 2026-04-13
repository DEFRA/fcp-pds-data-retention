const db = require('../data')

const saveValidRetentionData = async (validRetentionData) => {
  const transformedData = validRetentionData.map(retentionData => {
    return {
      ...retentionData,
      frn: Number(retentionData.frn)
    }
  })
  return db.retentionData.bulkCreate(transformedData)
}

module.exports = {
  saveValidRetentionData
}
