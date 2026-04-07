const getRetentionDataFromFile = require('../../../app/processing/get-retention-data-from-file')
const { mapRetentionData } = require('../../../app/processing/map-retention-data')
const { handleParsedRetentionData } = require('../../../app/processing/handle-parsed-retention-data')
const { parseRetentionFile } = require('../../../app/processing/parse-retention-file')

jest.mock('../../../app/processing/get-retention-data-from-file')
jest.mock('../../../app/processing/map-retention-data')
jest.mock('../../../app/processing/handle-parsed-retention-data')

describe('parseRetentionFile', () => {
  let mockFileStream

  beforeEach(() => {
    jest.clearAllMocks()
    mockFileStream = {}
    getRetentionDataFromFile.mockResolvedValue([])
    mapRetentionData.mockReturnValue({ successful: [], unsuccessful: [] })
    handleParsedRetentionData.mockResolvedValue(true)
  })

  test('should call getRetentionDataFromFile with fileStream', async () => {
    await parseRetentionFile(mockFileStream)

    expect(getRetentionDataFromFile).toHaveBeenCalledWith(mockFileStream)
  })

  test('should call mapRetentionData with parsed data', async () => {
    const parsedData = [
      { frn: 123456, scheme: 'BPS', agreementNumber: 'AG001', endDate: '2025-12-31' }
    ]
    getRetentionDataFromFile.mockResolvedValueOnce(parsedData)

    await parseRetentionFile(mockFileStream)

    expect(mapRetentionData).toHaveBeenCalledWith(parsedData)
  })

  test('should call handleParsedRetentionData with mapped data', async () => {
    const mappedData = {
      successful: [{ frn: 123456, schemeId: 1 }],
      unsuccessful: []
    }
    mapRetentionData.mockReturnValueOnce(mappedData)

    await parseRetentionFile(mockFileStream)

    expect(handleParsedRetentionData).toHaveBeenCalledWith(mappedData)
  })

  test('should return true on success', async () => {
    const result = await parseRetentionFile(mockFileStream)

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

    await parseRetentionFile(mockFileStream)

    expect(callOrder).toEqual([
      'getRetentionDataFromFile',
      'mapRetentionData',
      'handleParsedRetentionData'
    ])
  })

  test('should return false when getRetentionDataFromFile fails', async () => {
    getRetentionDataFromFile.mockRejectedValueOnce(new Error('File read failed'))

    const result = await parseRetentionFile(mockFileStream)

    expect(result).toBe(false)
  })

  test('should return false when mapRetentionData fails', async () => {
    getRetentionDataFromFile.mockResolvedValueOnce([{ frn: 123456 }])
    mapRetentionData.mockImplementationOnce(() => {
      throw new Error('Mapping failed')
    })

    const result = await parseRetentionFile(mockFileStream)

    expect(result).toBe(false)
  })

  test('should return false when handleParsedRetentionData fails', async () => {
    handleParsedRetentionData.mockRejectedValueOnce(new Error('Handler failed'))

    const result = await parseRetentionFile(mockFileStream)

    expect(result).toBe(false)
  })

  test('should not call mapRetentionData if getRetentionDataFromFile fails', async () => {
    getRetentionDataFromFile.mockRejectedValueOnce(new Error('File read failed'))

    await parseRetentionFile(mockFileStream)

    expect(mapRetentionData).not.toHaveBeenCalled()
  })

  test('should not call handleParsedRetentionData if mapRetentionData fails', async () => {
    mapRetentionData.mockImplementationOnce(() => {
      throw new Error('Mapping failed')
    })

    await parseRetentionFile(mockFileStream)

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

    const result = await parseRetentionFile(mockFileStream)

    expect(result).toBe(true)
    expect(mapRetentionData).toHaveBeenCalledWith(parsedData)
    expect(handleParsedRetentionData).toHaveBeenCalledWith(mappedData)
  })

  test('should handle empty parsed data', async () => {
    getRetentionDataFromFile.mockResolvedValueOnce([])
    mapRetentionData.mockReturnValueOnce({ successful: [], unsuccessful: [] })

    const result = await parseRetentionFile(mockFileStream)

    expect(result).toBe(true)
  })

  test('should handle mixed successful and unsuccessful data', async () => {
    const mappedData = {
      successful: [{ frn: 111111, schemeId: 1 }],
      unsuccessful: [{ frn: 222222, scheme: 'INVALID' }]
    }
    mapRetentionData.mockReturnValueOnce(mappedData)

    const result = await parseRetentionFile(mockFileStream)

    expect(result).toBe(true)
    expect(handleParsedRetentionData).toHaveBeenCalledWith(mappedData)
  })

  test('should handle different error types', async () => {
    getRetentionDataFromFile.mockRejectedValueOnce(new TypeError('Type error'))

    const result = await parseRetentionFile(mockFileStream)

    expect(result).toBe(false)
  })
})
