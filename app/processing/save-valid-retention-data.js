const { getSitiAgriSchemeIds } = require('ffc-pay-schemes')
const { processingConfig } = require('../config')
const { retentionData } = require('../database')

const saveValidRetentionData = async (validRetentionData) => {
  if (validRetentionData.length === 0) {
    return []
  }

  const sitiAgriSchemes = processingConfig.sendSitiAgriRetention ? null : getSitiAgriSchemeIds()

  const filteredData = sitiAgriSchemes
    ? validRetentionData.filter(({ schemeId }) =>
      !sitiAgriSchemes.some(sitiSchemeId => Number(sitiSchemeId) === Number(schemeId))
    )
    : validRetentionData

  if (filteredData.length === 0) {
    return []
  }

  const transformedData = filteredData.map(data => {
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
