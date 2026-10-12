const schemeNames = require('../constants/scheme-names')
const schemeIds = require('../constants/schemes')
const { validatedDate } = require('../helpers/normaliseValidationDates')

const FRN_PATTERN = /^\d{10}$/

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
    const isValidFrn = typeof data.frn === 'string' && FRN_PATTERN.test(data.frn)
    const validationError = !isValidFrn
      ? { reason: 'invalid-frn' }
      : invalidDateValidation && {
        reason: invalidDateValidation.result.reason,
        date: invalidDateValidation.result.date,
        minimumDate: invalidDateValidation.result.minimumDate
      }

    if (validSchemeKeys.length > 0 && !invalidDateValidation && isValidFrn && data.agreementNumber) {
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
        ...(validationError && { validationError })
      })
    }
  }

  return mappedData
}

module.exports = {
  mapRetentionData
}
