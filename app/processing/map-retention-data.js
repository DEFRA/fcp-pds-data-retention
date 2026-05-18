const schemeNames = require('../constants/scheme-names')
const schemeIds = require('../constants/schemes')

const mapRetentionData = (retentionData) => {
  const mappedData = { successful: [], unsuccessful: [] }

  for (const data of retentionData) {
    const matchingSchemeKeys = Object.keys(schemeNames).filter(
      key => schemeNames[key] === data.scheme
    )
    const validSchemeKeys = matchingSchemeKeys.filter(
      key => schemeIds[key]
    )

    if (validSchemeKeys.length > 0) {
      const { scheme, ...rest } = data
      for (const key of validSchemeKeys) {
        mappedData.successful.push({
          ...rest,
          schemeId: schemeIds[key]
        })
      }
    } else {
      mappedData.unsuccessful.push(data)
    }
  }

  return mappedData
}

module.exports = {
  mapRetentionData
}
