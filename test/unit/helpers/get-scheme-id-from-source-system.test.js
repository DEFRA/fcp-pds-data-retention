const { getSchemeIdFromSourceSystem } = require('../../../app/helpers/get-scheme-id-from-source-system')
const schemes = require('../../../app/constants/schemes')
const sourceSystems = require('../../../app/constants/source-systems')

describe('getSchemeIdFromSourceSystem', () => {
  test('should return correct scheme ID when source system matches', () => {
    Object.keys(sourceSystems).forEach((schemeKey) => {
      const sourceSystemValue = sourceSystems[schemeKey]
      const expectedSchemeId = schemes[schemeKey]

      const result = getSchemeIdFromSourceSystem(sourceSystemValue)
      expect(result).toBe(expectedSchemeId)
    })
  })

  test('should return null for unknown source system values', () => {
    const unknownSourceSystems = [
      'non-existent-system',
      '',
      null,
      undefined,
      123,
      {},
      []
    ]

    unknownSourceSystems.forEach((value) => {
      expect(getSchemeIdFromSourceSystem(value)).toBeNull()
    })
  })

  test('should return null when source system is undefined', () => {
    expect(getSchemeIdFromSourceSystem(undefined)).toBeNull()
  })

  test('should return null when source system is null', () => {
    expect(getSchemeIdFromSourceSystem(null)).toBeNull()
  })
})
