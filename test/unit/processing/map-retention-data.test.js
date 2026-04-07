const { mapRetentionData } = require('./map-retention-data')
const { BPS, LUMP_SUMS } = require('../../../app/constants/scheme-names')
const { BPS: BPS_ID } = require('../../../app/constants/schemes')

jest.mock('../constants/scheme-names')
jest.mock('../constants/schemes')

describe('mapRetentionData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should return object with successful and unsuccessful arrays', () => {
    const retentionData = [
      { frn: 123456, scheme: BPS, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result).toHaveProperty('successful')
    expect(result).toHaveProperty('unsuccessful')
    expect(Array.isArray(result.successful)).toBe(true)
    expect(Array.isArray(result.unsuccessful)).toBe(true)
  })

  test('should map recognized scheme to schemeId', () => {
    const retentionData = [
      { frn: 123456, scheme: BPS, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful[0]).toHaveProperty('schemeId', 1)
  })

  test('should remove scheme property from successful data', () => {
    const retentionData = [
      { frn: 123456, scheme: BPS, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful[0]).not.toHaveProperty('scheme')
  })

  test('should preserve all other properties in successful data', () => {
    const retentionData = [
      { frn: 123456, scheme: BPS, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful[0]).toHaveProperty('frn', 123456)
    expect(result.successful[0]).toHaveProperty('agreementNumber', 'AG001')
    expect(result.successful[0]).toHaveProperty('endDate', '2025-12-31')
  })

  test('should classify unrecognized scheme as unsuccessful', () => {
    const retentionData = [
      { frn: 789012, scheme: 'UNKNOWN', agreementNumber: 'AG002', endDate: '2026-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.unsuccessful).toHaveLength(1)
    expect(result.unsuccessful[0]).toEqual(
      { frn: 789012, scheme: 'UNKNOWN', agreementNumber: 'AG002', endDate: '2026-12-31' }
    )
  })

  test('should handle multiple successful items', () => {
    const retentionData = [
      { frn: 111111, scheme: BPS, agreementNumber: 'AG001', endDate: '2025-12-31' },
      { frn: 222222, scheme: LUMP_SUMS, agreementNumber: 'AG002', endDate: '2026-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful).toHaveLength(2)
    expect(result.successful[0].schemeId).toBe(1)
    expect(result.successful[1].schemeId).toBe(2)
  })

  test('should handle mixed successful and unsuccessful data', () => {
    const retentionData = [
      { frn: 111111, scheme: BPS, agreementNumber: 'AG001' },
      { frn: 222222, scheme: 'INVALID', agreementNumber: 'AG002' },
      { frn: 333333, scheme: BPS, agreementNumber: 'AG003' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful).toHaveLength(2)
    expect(result.unsuccessful).toHaveLength(1)
  })

  test('should find scheme key by matching scheme name value', () => {
    const retentionData = [
      { frn: 123456, scheme: BPS, agreementNumber: 'AG001' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful[0].schemeId).toBe(BPS_ID)
  })

  test('should handle empty retention data array', () => {
    const retentionData = []

    const result = mapRetentionData(retentionData)

    expect(result.successful).toHaveLength(0)
    expect(result.unsuccessful).toHaveLength(0)
  })

  test('should handle all unsuccessful data', () => {
    const retentionData = [
      { frn: 111111, scheme: 'INVALID1', agreementNumber: 'AG001' },
      { frn: 222222, scheme: 'INVALID2', agreementNumber: 'AG002' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful).toHaveLength(0)
    expect(result.unsuccessful).toHaveLength(2)
  })
})
