const { getMappedAgreementNumber } = require('../../../app/publishing/get-mapped-agreement-number')
const {
  SFI,
  CS,
  COHT_CAPITAL,
  COHT_REVENUE,
  DELINKED,
  LUMP_SUMS,
  SFI_PILOT,
  SFI23,
  SFI_EXPANDED
} = require('../../../app/constants/schemes')

describe('getMappedAgreementNumber', () => {
  test('pads agreement number to 8 digits with leading zeros for SFI', () => {
    expect(getMappedAgreementNumber(SFI, 123456)).toBe('00123456')
    expect(getMappedAgreementNumber(SFI, '789')).toBe('00000789')
  })

  test('prepends C and pads to total length 8 for CS', () => {
    expect(getMappedAgreementNumber(CS, 123456)).toBe('C0123456')
    expect(getMappedAgreementNumber(CS, '789')).toBe('C0000789')
  })

  test('prepends E and pads to total length 8 for COHT_REVENUE and SFI_EXPANDED', () => {
    expect(getMappedAgreementNumber(COHT_REVENUE, 123456)).toBe('E0123456')
    expect(getMappedAgreementNumber(SFI_EXPANDED, 789)).toBe('E0000789')
  })

  test('prepends H and pads to total length 8 for COHT_CAPITAL', () => {
    expect(getMappedAgreementNumber(COHT_CAPITAL, 123456)).toBe('H0123456')
    expect(getMappedAgreementNumber(COHT_CAPITAL, '789')).toBe('H0000789')
  })

  test('prepends Z and pads to total length 8 for DELINKED and SFI23', () => {
    expect(getMappedAgreementNumber(DELINKED, 123456)).toBe('Z0123456')
    expect(getMappedAgreementNumber(SFI23, '789')).toBe('Z0000789')
  })

  test('prepends L and pads to total length 8 for LUMP_SUMS', () => {
    expect(getMappedAgreementNumber(LUMP_SUMS, 123456)).toBe('L0123456')
    expect(getMappedAgreementNumber(LUMP_SUMS, '789')).toBe('L0000789')
  })

  test('prepends S and pads to total length 8 for SFI_PILOT', () => {
    expect(getMappedAgreementNumber(SFI_PILOT, 123456)).toBe('S0123456')
    expect(getMappedAgreementNumber(SFI_PILOT, '789')).toBe('S0000789')
  })

  test('returns stringified agreement number unchanged for unrecognized scheme', () => {
    expect(getMappedAgreementNumber('UNKNOWN_SCHEME', 123456)).toBe('123456')
    expect(getMappedAgreementNumber(null, '789')).toBe('789')
    expect(getMappedAgreementNumber(undefined, 0)).toBe('0')
  })

  test('handles numeric zero agreement number correctly', () => {
    expect(getMappedAgreementNumber(SFI, 0)).toBe('00000000')
    expect(getMappedAgreementNumber(CS, 0)).toBe('C0000000')
  })
})
