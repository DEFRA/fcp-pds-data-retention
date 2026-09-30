const { createKnexMock } = require('../../helpers/mock-knex')

const mockDb = createKnexMock(['retentionData'])

jest.mock('../../../app/database', () => ({
  client: mockDb.knex,
  transaction: mockDb.transaction,
  close: mockDb.close,
  ...mockDb.tables
}))

const { getPendingRetentionData } = require('../../../app/publishing/get-pending-retention-data')

describe('getPendingRetentionData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDb.builder.resolves([])
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should return pending retention data', async () => {
    const mockData = [
      { id: 1, endDate: new Date('2019-01-01') },
      { id: 2, endDate: new Date('2019-06-01') }
    ]
    mockDb.builder.resolves(mockData)

    const result = await getPendingRetentionData()

    expect(result).toEqual(mockData)
  })

  test('should query the retentionData table on the pool', async () => {
    await getPendingRetentionData()

    expect(mockDb.tables.retentionData).toHaveBeenCalledWith()
  })

  test('should query retention data with correct limit', async () => {
    await getPendingRetentionData()

    expect(mockDb.builder.limit).toHaveBeenCalledWith(1000)
  })

  test('should lock the selected rows for update', async () => {
    await getPendingRetentionData()

    expect(mockDb.builder.forUpdate).toHaveBeenCalledTimes(1)
  })

  test('should filter records with an end date older than 7 years', async () => {
    const now = new Date(2026, 3, 7)
    jest.useFakeTimers()
    jest.setSystemTime(now)

    await getPendingRetentionData()

    const expectedDate = new Date(now)
    expectedDate.setFullYear(expectedDate.getFullYear() - 7)

    expect(mockDb.builder.where).toHaveBeenCalledWith('endDate', '<', expectedDate)
  })

  test('should throw error when database query fails', async () => {
    mockDb.builder.rejects(new Error('Database connection failed'))

    await expect(getPendingRetentionData()).rejects.toThrow('Database connection failed')
  })

  test('should return empty array when no data found', async () => {
    const result = await getPendingRetentionData()

    expect(result).toEqual([])
  })

  test('should query the database once per invocation', async () => {
    await getPendingRetentionData()
    await getPendingRetentionData()

    expect(mockDb.tables.retentionData).toHaveBeenCalledTimes(2)
  })
})
