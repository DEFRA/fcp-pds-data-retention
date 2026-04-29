const getRetentionDataFromFile = require('../../../app/processing/get-retention-data-from-file')
const { mapRetentionData } = require('../../../app/processing/map-retention-data')
const { handleParsedRetentionData } = require('../../../app/processing/handle-parsed-retention-data')
const { parseRetentionFile } = require('../../../app/processing/parse-retention-file')
const sendFileErrorEvent = require('../../../app/messaging/send-file-error-event')

jest.mock('../../../app/processing/get-retention-data-from-file')
jest.mock('../../../app/processing/map-retention-data')
jest.mock('../../../app/processing/handle-parsed-retention-data')
jest.mock('../../../app/messaging/send-file-error-event')

describe('parseRetentionFile', () => {
  let mockFileStream
  const filename = 'test-file.csv'

  beforeEach(() => {
    jest.clearAllMocks()
    mockFileStream = {}
    getRetentionDataFromFile.mockResolvedValue([])
    mapRetentionData.mockReturnValue({ successful: [], unsuccessful: [] })
    handleParsedRetentionData.mockResolvedValue(true)
    sendFileErrorEvent.mockResolvedValue(undefined)
    jest.spyOn(console, 'error').mockImplementation(() => { })
  })

  afterEach(() => {
    console.error.mockRestore()
  })

  test('should call getRetentionDataFromFile with fileStream', async () => {
    await parseRetentionFile(filename, mockFileStream)

    expect(getRetentionDataFromFile).toHaveBeenCalledWith(mockFileStream)
  })

  test('should call mapRetentionData with parsed data', async () => {
    const parsedData = [
      { frn: 123456, scheme: 'BPS', agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    getRetentionDataFromFile.mockResolvedValueOnce(parsedData)

    await parseRetentionFile(filename, mockFileStream)

    expect(mapRetentionData).toHaveBeenCalledWith(parsedData)
  })

  test('should call handleParsedRetentionData with mapped data', async () => {
    const mappedData = {
      successful: [{ frn: 123456, schemeId: 1 }],
      unsuccessful: []
    }
    mapRetentionData.mockReturnValueOnce(mappedData)

    await parseRetentionFile(filename, mockFileStream)

    expect(handleParsedRetentionData).toHaveBeenCalledWith(mappedData)
  })

  test('should return true on success', async () => {
    const result = await parseRetentionFile(filename, mockFileStream)

    expect(result).toBe(true)
  })

  test('should execute functions in correct order', async () => {
    const callOrder = []

    getRetentionDataFromFile.mockImplementation(() => {
      callOrder.push('getRetentionDataFromFile')
      return Promise.resolve([])
    })

    mapRetentionData.mockImplementation(() => {
      callOrder.push('mapRetentionData')
      return { successful: [], unsuccessful: [] }
    })

    handleParsedRetentionData.mockImplementation(() => {
      callOrder.push('handleParsedRetentionData')
      return Promise.resolve(true)
    })

    await parseRetentionFile(filename, mockFileStream)

    expect(callOrder).toEqual([
      'getRetentionDataFromFile',
      'mapRetentionData',
      'handleParsedRetentionData'
    ])
  })

  test('should return false and call sendFileErrorEvent when getRetentionDataFromFile fails', async () => {
    const err = new Error('File read failed')
    getRetentionDataFromFile.mockRejectedValueOnce(err)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, err)
    expect(console.error).toHaveBeenCalledWith(`Error thrown processing ${filename}`)
    expect(console.error).toHaveBeenCalledWith(err)
    expect(result).toBe(false)
  })

  test('should return false and call sendFileErrorEvent when mapRetentionData throws', async () => {
    getRetentionDataFromFile.mockResolvedValueOnce([{ frn: 123456 }])
    const err = new Error('Mapping failed')
    mapRetentionData.mockImplementationOnce(() => {
      throw err
    })

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, err)
    expect(console.error).toHaveBeenCalledWith(`Error thrown processing ${filename}`)
    expect(console.error).toHaveBeenCalledWith(err)
    expect(result).toBe(false)
  })

  test('should return false and call sendFileErrorEvent when handleParsedRetentionData rejects', async () => {
    const err = new Error('Handler failed')
    handleParsedRetentionData.mockRejectedValueOnce(err)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, err)
    expect(console.error).toHaveBeenCalledWith(`Error thrown processing ${filename}`)
    expect(console.error).toHaveBeenCalledWith(err)
    expect(result).toBe(false)
  })

  test('should not call mapRetentionData if getRetentionDataFromFile fails', async () => {
    getRetentionDataFromFile.mockRejectedValueOnce(new Error('File read failed'))

    await parseRetentionFile(filename, mockFileStream)

    expect(mapRetentionData).not.toHaveBeenCalled()
  })

  test('should not call handleParsedRetentionData if mapRetentionData throws', async () => {
    mapRetentionData.mockImplementationOnce(() => {
      throw new Error('Mapping failed')
    })

    await parseRetentionFile(filename, mockFileStream)

    expect(handleParsedRetentionData).not.toHaveBeenCalled()
  })

  test('should handle multiple retention data items', async () => {
    const parsedData = [
      { frn: 111111, scheme: 'BPS', agreementNumber: 'AG001', endDate: '2025-12-31' },
      { frn: 222222, scheme: 'LUMP', agreementNumber: 'AG002', endDate: '2026-12-31' }
    ]
    getRetentionDataFromFile.mockResolvedValueOnce(parsedData)

    const mappedData = {
      successful: [
        { frn: 111111, schemeId: 1 },
        { frn: 222222, schemeId: 2 }
      ],
      unsuccessful: []
    }
    mapRetentionData.mockReturnValueOnce(mappedData)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(result).toBe(true)
    expect(mapRetentionData).toHaveBeenCalledWith(parsedData)
    expect(handleParsedRetentionData).toHaveBeenCalledWith(mappedData)
  })

  test('should handle empty parsed data', async () => {
    getRetentionDataFromFile.mockResolvedValueOnce([])
    mapRetentionData.mockReturnValueOnce({ successful: [], unsuccessful: [] })

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(result).toBe(true)
  })

  test('should handle mixed successful and unsuccessful data', async () => {
    const mappedData = {
      successful: [{ frn: 111111, schemeId: 1 }],
      unsuccessful: [{ frn: 222222, scheme: 'INVALID' }]
    }
    mapRetentionData.mockReturnValueOnce(mappedData)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(result).toBe(true)
    expect(handleParsedRetentionData).toHaveBeenCalledWith(mappedData)
  })

  test('should handle different error types', async () => {
    const err = new TypeError('Type error')
    getRetentionDataFromFile.mockRejectedValueOnce(err)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, err)
    expect(result).toBe(false)
  })
})
