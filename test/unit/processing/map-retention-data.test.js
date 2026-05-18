const { mapRetentionData } = require('../../../app/processing/map-retention-data')
const schemeNames = require('../../../app/constants/scheme-names')
const schemeIds = require('../../../app/constants/schemes')

describe('mapRetentionData', () => {
  test('should return object with successful and unsuccessful arrays', () => {
    const retentionData = [
      { frn: 123456, scheme: schemeNames.BPS, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    const result = mapRetentionData(retentionData)
    expect(result).toHaveProperty('successful')
    expect(result).toHaveProperty('unsuccessful')
    expect(Array.isArray(result.successful)).toBe(true)
    expect(Array.isArray(result.unsuccessful)).toBe(true)
  })

  test('should map recognized scheme to schemeId', () => {
    const retentionData = [
      { frn: 123456, scheme: schemeNames.BPS, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful).toHaveLength(1)
    expect(result.successful[0]).toHaveProperty('schemeId', schemeIds.BPS)
  })

  test('should handle multiple schemeKeys matching the same scheme name', () => {
    const retentionData = [
      { frn: 789012, scheme: 'CS HT', agreementNumber: 'AG002', endDate: '2026-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful).toHaveLength(2)

    const schemeIdsMapped = result.successful.map(item => item.schemeId).sort((a, b) => a - b)
    expect(schemeIdsMapped).toEqual([schemeIds.COHT_CAPITAL, schemeIds.COHT_REVENUE].sort((a, b) => a - b))

    for (const item of result.successful) {
      expect(item).not.toHaveProperty('scheme')
    }
  })

  test('should remove scheme property from successful data', () => {
    const retentionData = [
      { frn: 123456, scheme: schemeNames.BPS, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    for (const item of result.successful) {
      expect(item).not.toHaveProperty('scheme')
    }
  })

  test('should preserve all other properties in successful data', () => {
    const retentionData = [
      { frn: 123456, scheme: schemeNames.BPS, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    for (const item of result.successful) {
      expect(item).toHaveProperty('frn', 123456)
      expect(item).toHaveProperty('agreementNumber', 'AG001')
      expect(item).toHaveProperty('endDate', '2025-12-31')
    }
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
      { frn: 111111, scheme: schemeNames.BPS, agreementNumber: 'AG001', endDate: '2025-12-31' },
      { frn: 222222, scheme: schemeNames.LUMP_SUMS, agreementNumber: 'AG002', endDate: '2026-12-31' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful.filter(item => item.frn === 111111)).toHaveLength(1)
    expect(result.successful.filter(item => item.frn === 222222)).toHaveLength(1)

    expect(result.successful.find(item => item.frn === 111111).schemeId).toBe(schemeIds.BPS)
    expect(result.successful.find(item => item.frn === 222222).schemeId).toBe(schemeIds.LUMP_SUMS)
  })

  test('should handle mixed successful and unsuccessful data', () => {
    const retentionData = [
      { frn: 111111, scheme: schemeNames.BPS, agreementNumber: 'AG001' },
      { frn: 222222, scheme: 'INVALID', agreementNumber: 'AG002' },
      { frn: 333333, scheme: schemeNames.BPS, agreementNumber: 'AG003' }
    ]

    const result = mapRetentionData(retentionData)

    expect(result.successful.filter(item => item.frn === 111111)).toHaveLength(1)
    expect(result.successful.filter(item => item.frn === 333333)).toHaveLength(1)
    expect(result.unsuccessful).toHaveLength(1)
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
