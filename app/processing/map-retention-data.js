const schemeNames = require('../constants/scheme-names')
const schemeIds = require('../constants/schemes')

const mapRetentionData = (retentionData) => {
  const mappedData = { successful: [], unsuccessful: [] }
  for (const data in retentionData) {
    const schemeKey = Object.keys(schemeNames).find(key => schemeNames[key] === data.scheme)
    if (schemeKey && schemeIds[schemeKey]) {
      const { scheme, ...rest } = data
      mappedData.successfulRetentionData.push({
        ...rest,
        schemeId: schemeIds[schemeKey]
      })
    } else {
      mappedData.unsuccessfulRetentionData.push(data)
    }
  }
}

module.exports = {
  mapRetentionData
}
