const { retentionData } = require('../database')

const saveValidRetentionData = async (validRetentionData) => {
  if (validRetentionData.length === 0) {
    return []
  }

  const transformedData = validRetentionData.map(data => {
    return {
      frn: Number(data.frn),
      schemeId: data.schemeId,
      agreementNumber: data.agreementNumber,
      endDate: data.endDate,
      addedBy: 'DWH',
      addedTime: new Date()
    }
  })
  return retentionData()
    .insert(transformedData)
    .onConflict(['frn', 'schemeId', 'agreementNumber'])
    .merge(['endDate'])
}

module.exports = {
  saveValidRetentionData
}
