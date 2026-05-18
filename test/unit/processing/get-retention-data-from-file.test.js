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

  test('should parse CSV and return array of retention data', async () => {
    let dataHandler
    let endHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        dataHandler = handler
      } else if (event === 'end') {
        endHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)

    dataHandler({ FRN: '123456', SCHEME: 'BPS', APP_REF: 'AG001', APP_END_DATE: '2025-12-31' })
    dataHandler({ FRN: '789012', SCHEME: 'LUMP', APP_REF: 'AG002', APP_END_DATE: '2026-06-30' })
    endHandler()

    const result = await promise

    expect(result).toEqual([
      {
        frn: '123456',
        scheme: 'BPS',
        agreementNumber: 'AG001',
        endDate: '2025-12-31'
      },
      {
        frn: '789012',
        scheme: 'LUMP',
        agreementNumber: 'AG002',
        endDate: '2026-06-30'
      }
    ])
  })

  test('should correctly map CSV columns to object properties', async () => {
    let dataHandler
    let endHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'data') {
        dataHandler = handler
      } else if (event === 'end') {
        endHandler = handler
      }
      return mockCsvParser
    })

    const promise = getRetentionDataFromFile(mockFileStream)

    dataHandler({ FRN: '111111', SCHEME: 'SFP', APP_REF: 'REF123', APP_END_DATE: '2024-01-15' })
    endHandler()

    const result = await promise

    expect(result[0]).toHaveProperty('frn', '111111')
    expect(result[0]).toHaveProperty('scheme', 'SFP')
    expect(result[0]).toHaveProperty('agreementNumber', 'REF123')
    expect(result[0]).toHaveProperty('endDate', '2024-01-15')
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
      } else if (event === 'end') {
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
        APP_END_DATE: `202${i}-01-01`
      })
    }
    endHandler()

    const result = await promise

    expect(result).toHaveLength(5)
    expect(result[0].frn).toBe('100000')
    expect(result[4].frn).toBe('500000')
  })
})
