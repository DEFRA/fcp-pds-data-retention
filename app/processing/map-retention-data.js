const schemeNames = require('../constants/scheme-names')
const schemeIds = require('../constants/schemes')

const mapRetentionData = (retentionData) => {
  const mappedData = { successful: [], unsuccessful: [] }
  for (const data of retentionData) {
    const schemeKey = Object.keys(schemeNames).find(key => schemeNames[key] === data.scheme)
    if (schemeKey && schemeIds[schemeKey]) {
      const { scheme, ...rest } = data
      mappedData.successful.push({
        ...rest,
        schemeId: schemeIds[schemeKey]
      })
    } else {
      mappedData.unsuccessful.push(data)
    }
  }
  return mappedData
}

module.exports = {
  mapRetentionData
}
