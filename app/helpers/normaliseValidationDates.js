const validationDates = require('../constants/validation-dates')

const YEAR_DIGITS = 4
const MONTH_DIGITS = 2
const DAY_DIGITS = 2
const MONTH_INDEX_OFFSET = 1
const MINIMUM_SUPPORTED_YEAR = 1
const EPOCH_TIMESTAMP = 0
const DATE_SEPARATOR = '-'

const ISO_DATE_PATTERN = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/
const DAY_FIRST_DATE_PATTERN = /^(?<day>\d{2})\/(?<month>\d{2})\/(?<year>\d{4})$/
const YEAR_FIRST_DATE_PATTERN = /^(?<year>\d{4})\/(?<day>\d{2})\/(?<month>\d{2})$/
const DATE_PATTERNS = [ISO_DATE_PATTERN, DAY_FIRST_DATE_PATTERN, YEAR_FIRST_DATE_PATTERN]

const normaliseValidationDate = (value) => {
  const dateParts = getDateParts(value)
  if (!dateParts) {
    return null
  }

  const { year, month, day } = dateParts
  if (!isValidCalendarDate(year, month, day)) {
    return null
  }

  return [
    String(year).padStart(YEAR_DIGITS, '0'),
    String(month).padStart(MONTH_DIGITS, '0'),
    String(day).padStart(DAY_DIGITS, '0')
  ].join(DATE_SEPARATOR)
}

const validatedDate = (scheme, value) => {
  if (!Object.hasOwn(validationDates, scheme)) {
    return { isValid: false, reason: 'unknown-scheme', date: null, minimumDate: null }
  }

  const minimumDate = validationDates[scheme]
  const date = normaliseValidationDate(value)
  if (!date) {
    return { isValid: false, reason: 'invalid-date', date: null, minimumDate }
  }

  if (date < minimumDate) {
    return { isValid: false, reason: 'before-minimum-date', date, minimumDate }
  }

  return { isValid: true, reason: null, date, minimumDate }
}

const getDateParts = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null
    }

    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + MONTH_INDEX_OFFSET,
      day: value.getUTCDate()
    }
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmedValue = value.trim()
  const matchingPattern = DATE_PATTERNS.find(pattern => pattern.test(trimmedValue))
  if (!matchingPattern) {
    return null
  }

  const { year, month, day } = trimmedValue.match(matchingPattern).groups
  return { year: Number(year), month: Number(month), day: Number(day) }
}

const isValidCalendarDate = (year, month, day) => {
  if (year < MINIMUM_SUPPORTED_YEAR) {
    return false
  }

  const date = new Date(EPOCH_TIMESTAMP)
  date.setUTCHours(EPOCH_TIMESTAMP, EPOCH_TIMESTAMP, EPOCH_TIMESTAMP, EPOCH_TIMESTAMP)
  date.setUTCFullYear(year, month - MONTH_INDEX_OFFSET, day)

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + MONTH_INDEX_OFFSET === month &&
    date.getUTCDate() === day
}

module.exports = {
  normaliseValidationDate,
  validatedDate
}
