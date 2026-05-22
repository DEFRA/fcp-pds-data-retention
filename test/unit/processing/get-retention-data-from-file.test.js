const csv = require('csv-parser')
const getRetentionDataFromFile = require('../../../app/processing/get-retention-data-from-file')

jest.mock('csv-parser')

describe('getRetentionDataFromFile', () => {
  let mockFileStream
  let mockCsvParser
  let mockPipe
  let pauseMock
  let resumeMock

  beforeEach(() => {
    jest.clearAllMocks()

    pauseMock = jest.fn()
    resumeMock = jest.fn()

    mockCsvParser = {
      on: jest.fn(),
      pipe: jest.fn(),
      pause: pauseMock,
      resume: resumeMock,
    }

    mockPipe = jest.fn().mockReturnValue(mockCsvParser)

    mockFileStream = {
      pipe: mockPipe,
      pause: jest.fn(),
      resume: jest.fn()
    }

    csv.mockReturnValue(mockCsvParser)
  })

  test('should process each CSV row by calling onRow callback', async () => {
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

    const processedRows = []
    const onRow = jest.fn(async (row) => {
      processedRows.push(row)
    })

    const promise = getRetentionDataFromFile(mockFileStream, onRow)

    await dataHandler({ FRN: '123456', SCHEME: 'BPS', APP_REF: 'AG001', APP_END_DATE: '12/31/2025 23:59:59' })
    await dataHandler({ FRN: '789012', SCHEME: 'LUMP', APP_REF: 'AG002', APP_END_DATE: '06/30/2026 00:00:00' })

    endHandler()

    await promise

    expect(onRow).toHaveBeenCalledTimes(2)

    expect(processedRows[0]).toMatchObject({
      frn: '123456',
      scheme: 'BPS',
      agreementNumber: 'AG001'
    })
    expect(processedRows[0].endDate).toBeInstanceOf(Date)
    expect(processedRows[0].endDate.toISOString()).toBe('2025-12-31T23:59:59.000Z')

    expect(processedRows[1]).toMatchObject({
      frn: '789012',
      scheme: 'LUMP',
      agreementNumber: 'AG002'
    })
    expect(processedRows[1].endDate).toBeInstanceOf(Date)
    expect(processedRows[1].endDate.toISOString()).toBe('2026-06-30T00:00:00.000Z')
  })

  test('should handle invalid or missing APP_END_DATE with null endDate', async () => {
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

    const processedRows = []
    const onRow = jest.fn(async (row) => {
      processedRows.push(row)
    })

    const promise = getRetentionDataFromFile(mockFileStream, onRow)

    await dataHandler({ FRN: '111', SCHEME: 'SFP', APP_REF: 'REF123', APP_END_DATE: null })
    await dataHandler({ FRN: '222', SCHEME: 'SFP', APP_REF: 'REF124', APP_END_DATE: '' })
    await dataHandler({ FRN: '333', SCHEME: 'SFP', APP_REF: 'REF125', APP_END_DATE: '01/15/2024' })
    await dataHandler({ FRN: '444', SCHEME: 'SFP', APP_REF: 'REF126', APP_END_DATE: '15/01/2024 12:00:00' })
    await dataHandler({ FRN: '555', SCHEME: 'SFP', APP_REF: 'REF127', APP_END_DATE: 'not a date' })

    endHandler()

    await promise

    expect(processedRows).toHaveLength(5)
    processedRows.forEach(({ endDate }) => {
      expect(endDate).toBeNull()
    })
  })

  test('should reject promise on error event', async () => {
    let errorHandler

    mockCsvParser.on.mockImplementation((event, handler) => {
      if (event === 'error') {
        errorHandler = handler
      }
      return mockCsvParser
    })

    const onRow = jest.fn()

    const promise = getRetentionDataFromFile(mockFileStream, onRow)

    const error = new Error('CSV parsing failed')
    errorHandler(error)

    await expect(promise).rejects.toThrow('CSV parsing failed')
  })

  test('should pause and resume parser around onRow call', async () => {
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

    const callOrder = []

    const onRow = jest.fn(async () => {
      callOrder.push('onRow')
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    const promise = getRetentionDataFromFile(mockFileStream, onRow)

    expect(pauseMock).not.toHaveBeenCalled()
    expect(resumeMock).not.toHaveBeenCalled()

    const p1 = dataHandler({ FRN: '1', SCHEME: 'A', APP_REF: 'R1', APP_END_DATE: '01/01/2021 00:00:00' })

    expect(pauseMock).toHaveBeenCalledTimes(1)

    await p1

    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))

    expect(resumeMock).toHaveBeenCalledTimes(1)

    endHandler()
    await promise

    expect(onRow).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['onRow'])
  })
})
