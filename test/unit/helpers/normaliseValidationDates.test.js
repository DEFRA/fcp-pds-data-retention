const {
  normaliseValidationDate,
  validatedDate
} = require('../../../app/helpers/normaliseValidationDates')

describe('normaliseValidationDate', () => {
  test.each([
    ['31/12/2024', '2024-12-31'],
    ['2024/31/12', '2024-12-31'],
    ['2024-12-31', '2024-12-31'],
    [new Date('2024-12-31T00:00:00.000Z'), '2024-12-31']
  ])('normalises %s to %s', (value, expected) => {
    expect(normaliseValidationDate(value)).toBe(expected)
  })

  test.each([
    '31/02/2024',
    '2023/29/02',
    '2024-13-01',
    'not-a-date',
    '',
    null,
    new Date('invalid')
  ])('returns null for invalid date %s', (value) => {
    expect(normaliseValidationDate(value)).toBeNull()
  })
})

describe('validatedDate', () => {
  test('accepts a date equal to the scheme minimum', () => {
    expect(validatedDate('BPS', '01/01/2015')).toEqual({
      isValid: true,
      reason: null,
      date: '2015-01-01',
      minimumDate: '2015-01-01'
    })
  })

  test('rejects a date before the scheme minimum with a reason', () => {
    expect(validatedDate('BPS', '2014/31/12')).toEqual({
      isValid: false,
      reason: 'before-minimum-date',
      date: '2014-12-31',
      minimumDate: '2015-01-01'
    })
  })

  test('rejects an unknown scheme', () => {
    expect(validatedDate('UNKNOWN', '2024-12-31')).toEqual({
      isValid: false,
      reason: 'unknown-scheme',
      date: null,
      minimumDate: null
    })
  })

  test('rejects an invalid date and returns the known minimum', () => {
    expect(validatedDate('BPS', '31/02/2024')).toEqual({
      isValid: false,
      reason: 'invalid-date',
      date: null,
      minimumDate: '2015-01-01'
    })
  })
})
