const schemeNames = require('../constants/scheme-names')
const schemeIds = require('../constants/schemes')
const { validatedDate } = require('../helpers/normaliseValidationDates')

const mapRetentionData = (retentionData) => {
  const mappedData = { successful: [], unsuccessful: [] }

  for (const data of retentionData) {
    const matchingSchemeKeys = Object.keys(schemeNames).filter(
      key => schemeNames[key] === data.scheme
    )
    const validSchemeKeys = matchingSchemeKeys.filter(key => schemeIds[key])
    const dateValidationResults = validSchemeKeys.map(schemeKey => ({
      schemeKey,
      result: validatedDate(schemeKey, data.endDate)
    }))
    const invalidDateValidation = dateValidationResults.find(({ result }) => !result.isValid)

    if (validSchemeKeys.length > 0 && !invalidDateValidation && data.frn && data.agreementNumber) {
      const { scheme, ...rest } = data
      for (const key of validSchemeKeys) {
        mappedData.successful.push({
          ...rest,
          schemeId: schemeIds[key]
        })
      }
    } else {
      mappedData.unsuccessful.push({
        ...data,
        ...(invalidDateValidation && {
          validationError: {
            reason: invalidDateValidation.result.reason,
            date: invalidDateValidation.result.date,
            minimumDate: invalidDateValidation.result.minimumDate
          }
        })
      })
    }
  }

  return mappedData
}

module.exports = {
  mapRetentionData
}
