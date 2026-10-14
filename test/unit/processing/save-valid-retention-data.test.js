const { createKnexMock } = require('../../helpers/mock-knex')

const mockDb = createKnexMock(['retentionData'])

jest.mock('../../../app/database', () => ({
  client: mockDb.knex,
  transaction: mockDb.transaction,
  close: mockDb.close,
  ...mockDb.tables
}))

const { saveValidRetentionData } = require('../../../app/processing/save-valid-retention-data')

describe('saveValidRetentionData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDb.builder.resolves()
  })

  const withAddedProps = (data) => {
    return data.map(record => ({
      ...record,
      addedBy: 'DWH',
      addedTime: expect.any(Date)
    }))
  }

  test('should insert retention data including addedBy and addedTime', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    await saveValidRetentionData(validRetentionData)

    expect(mockDb.tables.retentionData).toHaveBeenCalledWith()
    expect(mockDb.builder.insert).toHaveBeenCalledTimes(1)
    expect(mockDb.builder.insert).toHaveBeenCalledWith(withAddedProps(validRetentionData))
  })

  test('should update endDate when frn, schemeId and agreementNumber already exist', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    await saveValidRetentionData(validRetentionData)

    expect(mockDb.builder.onConflict).toHaveBeenCalledWith(['frn', 'schemeId', 'agreementNumber'])
    expect(mockDb.builder.merge).toHaveBeenCalledWith(['endDate'])
  })

  test('should save multiple retention data records with addedBy and addedTime', async () => {
    const validRetentionData = [
      { frn: 111111, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' },
      { frn: 222222, schemeId: 2, agreementNumber: 'AG002', endDate: '2026-06-30' },
      { frn: 333333, schemeId: 3, agreementNumber: 'AG003', endDate: '2026-12-31' }
    ]

    await saveValidRetentionData(validRetentionData)

    expect(mockDb.builder.insert).toHaveBeenCalledWith(withAddedProps(validRetentionData))
  })

  test('should not query the database when there are no records', async () => {
    const result = await saveValidRetentionData([])

    expect(result).toEqual([])
    expect(mockDb.tables.retentionData).not.toHaveBeenCalled()
    expect(mockDb.builder.insert).not.toHaveBeenCalled()
  })

  test('should convert frn to a number', async () => {
    const validRetentionData = [
      { frn: '1234567890', schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]

    await saveValidRetentionData(validRetentionData)

    const [rows] = mockDb.builder.insert.mock.calls[0]
    expect(rows[0].frn).toBe(1234567890)
  })

  test('should only insert retentionData columns', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31', scheme: 'SFI', unexpected: 'value' }
    ]

    await saveValidRetentionData(validRetentionData)

    const [rows] = mockDb.builder.insert.mock.calls[0]
    expect(Object.keys(rows[0]).sort()).toEqual(['addedBy', 'addedTime', 'agreementNumber', 'endDate', 'frn', 'schemeId'])
  })

  test('should return the insert result', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    const insertResult = { rowCount: 1 }
    mockDb.builder.resolves(insertResult)

    const result = await saveValidRetentionData(validRetentionData)

    expect(result).toEqual(insertResult)
  })

  test('should handle database error', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    mockDb.builder.rejects(new Error('Database connection failed'))

    await expect(saveValidRetentionData(validRetentionData)).rejects.toThrow(
      'Database connection failed'
    )
  })

  test('should handle integrity constraint error', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    mockDb.builder.rejects(Object.assign(new Error('Foreign key constraint failed'), { code: '23503' }))

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

    await saveValidRetentionData(validRetentionData)

    const [rows] = mockDb.builder.insert.mock.calls[0]
    expect(rows.map(row => row.frn)).toEqual([111111, 222222, 333333])
  })

  test('should handle large dataset with addedBy and addedTime', async () => {
    const validRetentionData = Array.from({ length: 1000 }, (_, i) => ({
      frn: 100000 + i,
      schemeId: (i % 5) + 1,
      agreementNumber: `AG${String(i).padStart(5, '0')}`,
      endDate: '2025-12-31'
    }))

    await saveValidRetentionData(validRetentionData)

    expect(mockDb.builder.insert).toHaveBeenCalledWith(withAddedProps(validRetentionData))
  })

  test('should pass all properties to insert with addedBy and addedTime', async () => {
    const validRetentionData = [
      {
        frn: 123456,
        schemeId: 1,
        agreementNumber: 'AG001',
        endDate: '2025-12-31'
      }
    ]

    await saveValidRetentionData(validRetentionData)

    const [rows] = mockDb.builder.insert.mock.calls[0]
    expect(rows[0]).toHaveProperty('frn', 123456)
    expect(rows[0]).toHaveProperty('schemeId', 1)
    expect(rows[0]).toHaveProperty('agreementNumber', 'AG001')
    expect(rows[0]).toHaveProperty('endDate', '2025-12-31')
    expect(rows[0]).toHaveProperty('addedBy', 'DWH')
    expect(rows[0].addedTime).toBeInstanceOf(Date)
  })

  test('should handle null values in data with addedBy and addedTime', async () => {
    const validRetentionData = [
      { frn: 123456, schemeId: 1, agreementNumber: null, endDate: '2025-12-31' }
    ]

    await saveValidRetentionData(validRetentionData)

    expect(mockDb.builder.insert).toHaveBeenCalledWith(withAddedProps(validRetentionData))
  })

  test('should handle concurrent saves with addedBy and addedTime', async () => {
    const data1 = [{ frn: 111111, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }]
    const data2 = [{ frn: 222222, schemeId: 2, agreementNumber: 'AG002', endDate: '2026-06-30' }]

    await Promise.all([
      saveValidRetentionData(data1),
      saveValidRetentionData(data2)
    ])

    expect(mockDb.builder.insert).toHaveBeenCalledTimes(2)
    expect(mockDb.builder.insert).toHaveBeenNthCalledWith(1, withAddedProps(data1))
    expect(mockDb.builder.insert).toHaveBeenNthCalledWith(2, withAddedProps(data2))
  })
})
