jest.mock('../../../app/data')
jest.mock('../../../app/config', () => ({
  ...jest.requireActual('../../../app/config'),
  processingConfig: {
    sendSitiAgriRetention: false
  }
}))
jest.mock('ffc-pay-schemes', () => ({
  getSitiAgriSchemeIds: jest.fn().mockResolvedValue([1, 2, 3, 5, 6, 12, 13, 14, 15, 16, 19])
}))

const db = require('../../../app/data')
const { processingConfig } = require('../../../app/config')
const { getSitiAgriSchemeIds } = require('ffc-pay-schemes')
const { getPendingRetentionData } = require('../../../app/publishing/get-pending-retention-data')

describe('getPendingRetentionData', () => {
  let mockFindAll

  beforeEach(() => {
    jest.clearAllMocks()
    processingConfig.sendSitiAgriRetention = false
    getSitiAgriSchemeIds.mockResolvedValue([1, 2, 3, 5, 6, 12, 13, 14, 15, 16, 19])
    mockFindAll = jest.fn()
    db.retentionData = {
      findAll: mockFindAll
    }
    db.Sequelize = {
      Op: {
        lt: jest.fn(val => ({ [Symbol.for('lt')]: val })),
        notIn: jest.fn(val => ({ [Symbol.for('notIn')]: val }))
      }
    }
  })

  test('should return pending retention data', async () => {
    const mockData = [
      { id: 1, endDate: new Date('2019-01-01') },
      { id: 2, endDate: new Date('2019-06-01') }
    ]
    mockFindAll.mockResolvedValue(mockData)

    const result = await getPendingRetentionData()

    expect(result).toEqual(mockData)
  })

  test('should query retention data with correct limit', async () => {
    mockFindAll.mockResolvedValue([])

    await getPendingRetentionData()

    const callArgs = mockFindAll.mock.calls[0][0]
    expect(callArgs.limit).toBe(1000)
  })

  test('should set lock to true', async () => {
    mockFindAll.mockResolvedValue([])

    await getPendingRetentionData()

    const callArgs = mockFindAll.mock.calls[0][0]
    expect(callArgs.lock).toBe(true)
  })

  test('should filter records older than 7 years', async () => {
    mockFindAll.mockResolvedValue([])
    const now = new Date(2026, 3, 7)
    jest.useFakeTimers()
    jest.setSystemTime(now)

    await getPendingRetentionData()

    const callArgs = mockFindAll.mock.calls[0][0]
    const filterDate = callArgs.where.endDate[db.Sequelize.Op.lt]

    const expectedDate = new Date(now)
    expectedDate.setFullYear(expectedDate.getFullYear() - 7)

    expect(filterDate.getFullYear()).toBe(expectedDate.getFullYear())
    expect(filterDate.getMonth()).toBe(expectedDate.getMonth())
    expect(filterDate.getDate()).toBe(expectedDate.getDate())

    jest.useRealTimers()
  })

  test('should throw error when database query fails', async () => {
    const testError = new Error('Database connection failed')
    mockFindAll.mockRejectedValue(testError)

    await expect(getPendingRetentionData()).rejects.toThrow('Database connection failed')
  })

  test('should return empty array when no data found', async () => {
    mockFindAll.mockResolvedValue([])

    const result = await getPendingRetentionData()

    expect(result).toEqual([])
  })

  test('should use lt operator for date comparison', async () => {
    mockFindAll.mockResolvedValue([])

    await getPendingRetentionData()

    const callArgs = mockFindAll.mock.calls[0][0]
    expect(callArgs.where.endDate[db.Sequelize.Op.lt]).toBeDefined()
  })

  test('should exclude Siti Agri schemes when publishing is disabled', async () => {
    mockFindAll.mockResolvedValue([])

    await getPendingRetentionData()

    const callArgs = mockFindAll.mock.calls[0][0]

    expect(callArgs.where.schemeId[db.Sequelize.Op.notIn]).toEqual([1, 2, 3, 5, 6, 12, 13, 14, 15, 16, 19])
    expect(getSitiAgriSchemeIds).toHaveBeenCalledTimes(1)
  })

  test('should throw error when Siti Agri scheme lookup fails', async () => {
    const testError = new Error('Scheme lookup failed')
    getSitiAgriSchemeIds.mockRejectedValue(testError)

    await expect(getPendingRetentionData()).rejects.toThrow('Scheme lookup failed')
    expect(mockFindAll).not.toHaveBeenCalled()
  })

  test('should include Siti Agri schemes when publishing is enabled', async () => {
    processingConfig.sendSitiAgriRetention = true
    mockFindAll.mockResolvedValue([])

    await getPendingRetentionData()

    const callArgs = mockFindAll.mock.calls[0][0]

    expect(callArgs.where.schemeId).toBeUndefined()
    expect(getSitiAgriSchemeIds).not.toHaveBeenCalled()
  })

  test('should call db.retentionData.findAll once per invocation', async () => {
    mockFindAll.mockResolvedValue([])

    await getPendingRetentionData()
    await getPendingRetentionData()

    expect(mockFindAll).toHaveBeenCalledTimes(2)
  })
})
