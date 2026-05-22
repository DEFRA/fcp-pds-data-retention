const getRetentionDataFromFile = require('../../../app/processing/get-retention-data-from-file')
const { mapRetentionData } = require('../../../app/processing/map-retention-data')
const { handleParsedRetentionData } = require('../../../app/processing/handle-parsed-retention-data')
const sendFileErrorEvent = require('../../../app/messaging/send-file-error-event')
const { parseRetentionFile } = require('../../../app/processing/parse-retention-file')

jest.mock('../../../app/processing/get-retention-data-from-file')
jest.mock('../../../app/processing/map-retention-data')
jest.mock('../../../app/processing/handle-parsed-retention-data')
jest.mock('../../../app/messaging/send-file-error-event')

describe('parseRetentionFile', () => {
  const filename = 'test-file.csv'
  let mockFileStream

  beforeEach(() => {
    jest.clearAllMocks()
    mockFileStream = {}
    mapRetentionData.mockReturnValue({ successful: [], unsuccessful: [] })
    handleParsedRetentionData.mockResolvedValue(true)
    sendFileErrorEvent.mockResolvedValue(undefined)
  })

  test('should process all rows and call map and handleParsedRetentionData accordingly', async () => {
    getRetentionDataFromFile.mockImplementation(async (fileStream, onRow) => {
      await onRow({ frn: '1', scheme: 'A', agreementNumber: 'R1', endDate: new Date() })
      await onRow({ frn: '2', scheme: 'B', agreementNumber: 'R2', endDate: new Date() })
      await onRow({ frn: '3', scheme: 'C', agreementNumber: 'R3', endDate: new Date() })
    })

    mapRetentionData.mockReturnValue({
      successful: [{ frn: '1', schemeId: 1 }],
      unsuccessful: [{ frn: '2' }]
    })

    handleParsedRetentionData.mockResolvedValue(true)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(result).toBe(true)
    expect(getRetentionDataFromFile).toHaveBeenCalledWith(mockFileStream, expect.any(Function))
    expect(mapRetentionData).toHaveBeenCalledTimes(3)
    expect(handleParsedRetentionData).toHaveBeenCalled()
  })

  test('should return false and call sendFileErrorEvent if getRetentionDataFromFile rejects', async () => {
    const error = new Error('fail')
    getRetentionDataFromFile.mockRejectedValue(error)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, error)
    expect(result).toBe(false)
  })

  test('should return false and call sendFileErrorEvent if mapRetentionData throws', async () => {
    getRetentionDataFromFile.mockImplementation(async (fileStream, onRow) => {
      await onRow({ frn: '1', scheme: 'A', agreementNumber: 'R1', endDate: new Date() })
    })

    const error = new Error('map error')
    mapRetentionData.mockImplementation(() => {
      throw error
    })

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, error)
    expect(result).toBe(false)
  })

  test('should return false and call sendFileErrorEvent if handleParsedRetentionData rejects', async () => {
    getRetentionDataFromFile.mockImplementation(async (fileStream, onRow) => {
      await onRow({ frn: '1', scheme: 'A', agreementNumber: 'R1', endDate: new Date() })
    })

    mapRetentionData.mockReturnValue({
      successful: [{ frn: '1', schemeId: 1 }],
      unsuccessful: []
    })

    const error = new Error('handle error')
    handleParsedRetentionData.mockRejectedValue(error)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, error)
    expect(result).toBe(false)
  })

  test('should batch and call handleParsedRetentionData when BATCH_SIZE reached', async () => {
    const BATCH_SIZE = 1000
    const totalRows = BATCH_SIZE + 10
    let callCount = 0

    getRetentionDataFromFile.mockImplementation(async (fileStream, onRow) => {
      for (let i = 0; i < totalRows; i++) {
        await onRow({ frn: `${i}`, scheme: 'A', agreementNumber: `R${i}`, endDate: new Date() })
      }
    })

    mapRetentionData.mockImplementation(() => {
      return {
        successful: [{ frn: `x${callCount}`, schemeId: 1 }],
        unsuccessful: []
      }
    })

    handleParsedRetentionData.mockImplementation(async ({ successful, unsuccessful }) => {
      callCount++
      return true
    })

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(result).toBe(true)
    expect(handleParsedRetentionData).toHaveBeenCalledTimes(2)
    expect(sendFileErrorEvent).not.toHaveBeenCalled()
  })

  test('should call handleParsedRetentionData once if no rows processed (empty file)', async () => {
    getRetentionDataFromFile.mockImplementation(async (fileStream, onRow) => { })

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(result).toBe(true)
    expect(handleParsedRetentionData).not.toHaveBeenCalled()
    expect(sendFileErrorEvent).not.toHaveBeenCalled()
  })

  test('should handle rows with only unsuccessful mapped data', async () => {
    getRetentionDataFromFile.mockImplementation(async (fileStream, onRow) => {
      await onRow({ frn: '1', scheme: 'A', agreementNumber: 'R1', endDate: new Date() })
    })

    mapRetentionData.mockReturnValue({
      successful: [],
      unsuccessful: [{ frn: '1' }]
    })

    handleParsedRetentionData.mockResolvedValue(true)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(result).toBe(true)
    expect(handleParsedRetentionData).toHaveBeenCalledWith({
      successful: [],
      unsuccessful: [{ frn: '1' }]
    })
  })

  test('should handle rows with only successful mapped data', async () => {
    getRetentionDataFromFile.mockImplementation(async (fileStream, onRow) => {
      await onRow({ frn: '1', scheme: 'A', agreementNumber: 'R1', endDate: new Date() })
    })

    mapRetentionData.mockReturnValue({
      successful: [{ frn: '1', schemeId: 1 }],
      unsuccessful: []
    })

    handleParsedRetentionData.mockResolvedValue(true)

    const result = await parseRetentionFile(filename, mockFileStream)

    expect(result).toBe(true)
    expect(handleParsedRetentionData).toHaveBeenCalledWith({
      successful: [{ frn: '1', schemeId: 1 }],
      unsuccessful: []
    })
  })
})
