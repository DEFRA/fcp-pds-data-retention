const csv = require('csv-parser')
const getRetentionDataFromFile = require('../../../app/processing/get-retention-data-from-file')

jest.mock('csv-parser')

describe('getRetentionDataFromFile', () => {
  let mockFileStream
  let mockCsvParser
  let mockPipe

  beforeEach(() => {
    jest.clearAllMocks()

    mockCsvParser = {
      on: jest.fn()
    }

    mockPipe = jest.fn().mockReturnValue(mockCsvParser)

    mockFileStream = {
      pipe: mockPipe
    }

    csv.mockReturnValue(mockCsvParser)
  })

  test('should parse CSV and return array of retention data with valid dates', async () => {
    let dataHandler
    let endHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        dataHandler = handler
      }
      if (event === 'end') {
        endHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)

    dataHandler({ FRN: '123456', SCHEME: 'BPS', APP_REF: 'AG001', APP_END_DATE: '12/31/2025 23:59:59' })
    dataHandler({ FRN: '789012', SCHEME: 'LUMP', APP_REF: 'AG002', APP_END_DATE: '06/30/2026 00:00:00' })
    endHandler()

    const result = await promise

    expect(result).toHaveLength(2)

    expect(result[0]).toMatchObject({
      frn: '123456',
      scheme: 'BPS',
      agreementNumber: 'AG001'
    })
    expect(result[0].endDate).toBeInstanceOf(Date)
    expect(result[0].endDate.toISOString()).toBe('2025-12-31T23:59:59.000Z')

    expect(result[1]).toMatchObject({
      frn: '789012',
      scheme: 'LUMP',
      agreementNumber: 'AG002'
    })
    expect(result[1].endDate).toBeInstanceOf(Date)
    expect(result[1].endDate.toISOString()).toBe('2026-06-30T00:00:00.000Z')
  })

  test('should return null endDate for invalid or missing APP_END_DATE', async () => {
    let dataHandler
    let endHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        dataHandler = handler
      }
      if (event === 'end') {
        endHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)

    dataHandler({ FRN: '111', SCHEME: 'SFP', APP_REF: 'REF123', APP_END_DATE: null })
    dataHandler({ FRN: '222', SCHEME: 'SFP', APP_REF: 'REF124', APP_END_DATE: '' })
    dataHandler({ FRN: '333', SCHEME: 'SFP', APP_REF: 'REF125', APP_END_DATE: '01/15/2024' })
    dataHandler({ FRN: '444', SCHEME: 'SFP', APP_REF: 'REF126', APP_END_DATE: '15/01/2024 12:00:00' }) // wrong format MM/DD vs DD/MM
    dataHandler({ FRN: '555', SCHEME: 'SFP', APP_REF: 'REF127', APP_END_DATE: 'not a date' })

    endHandler()

    const result = await promise

    expect(result).toHaveLength(5)
    result.forEach(({ endDate }) => {
      expect(endDate).toBeNull()
    })
  })

  test('should correctly map CSV columns to object properties', async () => {
    let dataHandler
    let endHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        dataHandler = handler
      }
      if (event === 'end') {
        endHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)

    dataHandler({ FRN: '111111', SCHEME: 'SFP', APP_REF: 'REF123', APP_END_DATE: '01/15/2024 12:34:56' })
    endHandler()

    const result = await promise

    expect(result[0]).toHaveProperty('frn', '111111')
    expect(result[0]).toHaveProperty('scheme', 'SFP')
    expect(result[0]).toHaveProperty('agreementNumber', 'REF123')
    expect(result[0].endDate).toBeInstanceOf(Date)
    expect(result[0].endDate.toISOString()).toBe('2024-01-15T12:34:56.000Z')
  })

  test('should return empty array when no data rows', async () => {
    let endHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'end') {
        endHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)
    endHandler()

    const result = await promise

    expect(result).toEqual([])
  })

  test('should reject promise on error event', async () => {
    let errorHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'error') {
        errorHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)
    const error = new Error('CSV parsing failed')
    errorHandler(error)

    await expect(promise).rejects.toThrow('CSV parsing failed')
  })

  test('should pipe fileStream through csv parser', async () => {
    let endHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'end') {
        endHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)
    endHandler()

    await promise

    expect(mockFileStream.pipe).toHaveBeenCalledWith(mockCsvParser)
  })

  test('should call csv() function', async () => {
    let endHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'end') {
        endHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)
    endHandler()

    await promise

    expect(csv).toHaveBeenCalled()
  })

  test('should handle multiple data rows in order', async () => {
    let dataHandler
    let endHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        dataHandler = handler
      }
      if (event === 'end') {
        endHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)

    for (let i = 1; i <= 5; i++) {
      dataHandler({
        FRN: `${i}00000`,
        SCHEME: `SCHEME${i}`,
        APP_REF: `REF${i}`,
        APP_END_DATE: `01/01/202${i} 00:00:00`
      })
    }
    endHandler()

    const result = await promise

    expect(result).toHaveLength(5)
    expect(result[0].frn).toBe('100000')
    expect(result[4].frn).toBe('500000')

    expect(result[0].endDate).toBeInstanceOf(Date)
    expect(result[0].endDate.getFullYear()).toBe(2021)
    expect(result[4].endDate.getFullYear()).toBe(2025)
  })
})
