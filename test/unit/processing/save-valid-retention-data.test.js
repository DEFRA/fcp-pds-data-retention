const db = require('../../../app/data')
const { saveValidRetentionData } = require('../../../app/processing/save-valid-retention-data')

jest.mock('../../../app/data')

describe('saveValidRetentionData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    db.retentionData = {
      bulkCreate: jest.fn().mockResolvedValue([])
    }
  })

  test('should call bulkCreate with retention data', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    await saveValidRetentionData(validRetentionData)

    expect(db.retentionData.bulkCreate).toHaveBeenCalledWith(validRetentionData, { updateOnDuplicate: ['endDate'] })
  })

  test('should save single retention data record', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    await saveValidRetentionData(validRetentionData)

    expect(db.retentionData.bulkCreate).toHaveBeenCalledTimes(1)
    expect(db.retentionData.bulkCreate).toHaveBeenCalledWith(validRetentionData, { updateOnDuplicate: ['endDate'] })
  })

  test('should save multiple retention data records', async () => {
    const validRetentionData = [
      { frn: 111111, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' },
      { frn: 222222, schemeId: 2, agreementNumber: 'AG002', endDate: '2026-06-30' },
      { frn: 333333, schemeId: 3, agreementNumber: 'AG003', endDate: '2026-12-31' }
    ]

    await saveValidRetentionData(validRetentionData)

    expect(db.retentionData.bulkCreate).toHaveBeenCalledWith(validRetentionData, { updateOnDuplicate: ['endDate'] })
  })

  test('should save empty array', async () => {
    const validRetentionData = []

    await saveValidRetentionData(validRetentionData)

    expect(db.retentionData.bulkCreate).toHaveBeenCalledWith([], { updateOnDuplicate: ['endDate'] })
  })

  test('should return created records', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    const createdData = [
      { retentionDataId: 1, frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    db.retentionData.bulkCreate.mockResolvedValueOnce(createdData)

    const result = await saveValidRetentionData(validRetentionData)

    expect(result).toEqual(createdData)
  })

  test('should handle database error', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    const error = new Error('Database connection failed')
    db.retentionData.bulkCreate.mockRejectedValueOnce(error)

    await expect(saveValidRetentionData(validRetentionData)).rejects.toThrow(
      'Database connection failed'
    )
  })

  test('should handle validation error from database', async () => {
    const validRetentionData = [
      { frn: 'invalid', schemeId: 'not-a-number', agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    const error = new Error('Validation error: invalid data type')
    db.retentionData.bulkCreate.mockRejectedValueOnce(error)

    await expect(saveValidRetentionData(validRetentionData)).rejects.toThrow(
      'Validation error: invalid data type'
    )
  })

  test('should handle integrity constraint error', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    const error = new Error('Foreign key constraint failed')
    db.retentionData.bulkCreate.mockRejectedValueOnce(error)

    await expect(saveValidRetentionData(validRetentionData)).rejects.toThrow(
      'Foreign key constraint failed'
    )
  })

  test('should preserve order of records', async () => {
    const validRetentionData = [
      { frn: 111111, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' },
      { frn: 222222, schemeId: 2, agreementNumber: 'AG002', endDate: '2026-06-30' },
      { frn: 333333, schemeId: 3, agreementNumber: 'AG003', endDate: '2026-12-31' }
    ]
    const createdData = [
      { retentionDataId: 1, frn: 111111, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' },
      { retentionDataId: 2, frn: 222222, schemeId: 2, agreementNumber: 'AG002', endDate: '2026-06-30' },
      { retentionDataId: 3, frn: 333333, schemeId: 3, agreementNumber: 'AG003', endDate: '2026-12-31' }
    ]
    db.retentionData.bulkCreate.mockResolvedValueOnce(createdData)

    await saveValidRetentionData(validRetentionData)

    expect(db.retentionData.bulkCreate).toHaveBeenCalledWith(validRetentionData, { updateOnDuplicate: ['endDate'] })
  })

  test('should handle large dataset', async () => {
    const validRetentionData = Array.from({ length: 1000 }, (_, i) => ({
      frn: 100000 + i,
      schemeId: (i % 5) + 1,
      agreementNumber: `AG${String(i).padStart(5, '0')}`,
      endDate: '2025-12-31'
    }))

    await saveValidRetentionData(validRetentionData)

    expect(db.retentionData.bulkCreate).toHaveBeenCalledWith(validRetentionData, { updateOnDuplicate: ['endDate'] })
  })

  test('should pass all properties to bulkCreate', async () => {
    const validRetentionData = [
      {
        frn: 123456,
        schemeId: 1,
        agreementNumber: 'AG001',
        endDate: '2025-12-31'
      }
    ]

    await saveValidRetentionData(validRetentionData)

    const callArgs = db.retentionData.bulkCreate.mock.calls[0][0]
    expect(callArgs[0]).toHaveProperty('frn', 123456)
    expect(callArgs[0]).toHaveProperty('schemeId', 1)
    expect(callArgs[0]).toHaveProperty('agreementNumber', 'AG001')
    expect(callArgs[0]).toHaveProperty('endDate', '2025-12-31')
  })

  test('should handle null values in data', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: null, endDate: '2025-12-31' }
    ]

    await saveValidRetentionData(validRetentionData)

    expect(db.retentionData.bulkCreate).toHaveBeenCalledWith(validRetentionData, { updateOnDuplicate: ['endDate'] })
  })

  test('should handle concurrent saves', async () => {
    const data1 = [{ frn: 111111, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }]
    const data2 = [{ frn: 222222, schemeId: 2, agreementNumber: 'AG002', endDate: '2026-06-30' }]

    db.retentionData.bulkCreate
      .mockResolvedValueOnce([{ retentionDataId: 1, ...data1[0] }])
      .mockResolvedValueOnce([{ retentionDataId: 2, ...data2[0] }])

    await Promise.all([
      saveValidRetentionData(data1),
      saveValidRetentionData(data2)
    ])

    expect(db.retentionData.bulkCreate).toHaveBeenCalledTimes(2)
  })
})
