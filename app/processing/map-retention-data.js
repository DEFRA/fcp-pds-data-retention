const schemeNames = require('../constants/scheme-names')
const schemeIds = require('../constants/schemes')
const { validatedDate } = require('../helpers/normaliseValidationDates')

const FRN_PATTERN = /^\d{10}$/

const mapRetentionData = (retentionData) => {
  const mappedData = { successful: [], unsuccessful: [] }

  for (const data of retentionData) {
    mapRetentionDataRow(mappedData, data)
  }

  return mappedData
}

const mapRetentionDataRow = (mappedData, data) => {
  const schemeKeys = getValidSchemeKeys(data.scheme)
  const validationError = getValidationError(data, schemeKeys)

  if (schemeKeys.length === 0 || validationError || !data.agreementNumber) {
    mappedData.unsuccessful.push({
      ...data,
      ...(validationError && { validationError })
    })
    return
  }

  const { scheme, ...rest } = data
  mappedData.successful.push(...schemeKeys.map(key => ({
    ...rest,
    schemeId: schemeIds[key]
  })))
}

const getValidSchemeKeys = (scheme) => {
  return Object.keys(schemeNames).filter(key => schemeNames[key] === scheme && schemeIds[key])
}

const getValidationError = (data, schemeKeys) => {
  if (typeof data.frn !== 'string' || !FRN_PATTERN.test(data.frn)) {
    return { reason: 'invalid-frn' }
  }

  const invalidDate = schemeKeys
    .map(schemeKey => validatedDate(schemeKey, data.endDate))
    .find(result => !result.isValid)

  if (!invalidDate) {
    return null
  }

  return {
    reason: invalidDate.reason,
    date: invalidDate.date,
    minimumDate: invalidDate.minimumDate
  }
}

module.exports = {
  mapRetentionData
}
