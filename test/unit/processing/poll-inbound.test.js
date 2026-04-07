const storage = require('../../../app/storage')
const processDataRetentionFile = require('../../../app/processing/process-data-retention-file')
const pollInbound = require('../../../app/processing/poll-inbound')

jest.mock('../../../app/storage')
jest.mock('../../../app/processing/process-data-retention-file')

describe('pollInbound', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    storage.getInboundFile.mockResolvedValue(null)
    processDataRetentionFile.mockResolvedValue(undefined)
  })

  test('should call storage.getInboundFile', async () => {
    await pollInbound()

    expect(storage.getInboundFile).toHaveBeenCalledTimes(1)
  })

  test('should call processDataRetentionFile when inboundFile exists', async () => {
    const inboundFile = { name: 'retention-data.csv', path: '/inbound/retention-data.csv' }
    storage.getInboundFile.mockResolvedValueOnce(inboundFile)

    await pollInbound()

    expect(processDataRetentionFile).toHaveBeenCalledWith(inboundFile)
  })

  test('should not call processDataRetentionFile when inboundFile is null', async () => {
    storage.getInboundFile.mockResolvedValueOnce(null)

    await pollInbound()

    expect(processDataRetentionFile).not.toHaveBeenCalled()
  })

  test('should not call processDataRetentionFile when inboundFile is undefined', async () => {
    storage.getInboundFile.mockResolvedValueOnce(undefined)

    await pollInbound()

    expect(processDataRetentionFile).not.toHaveBeenCalled()
  })

  test('should handle processDataRetentionFile rejection', async () => {
    const inboundFile = { name: 'retention-data.csv' }
    const error = new Error('Processing failed')
    storage.getInboundFile.mockResolvedValueOnce(inboundFile)
    processDataRetentionFile.mockRejectedValueOnce(error)

    await expect(pollInbound()).rejects.toThrow('Processing failed')
  })

  test('should handle storage.getInboundFile rejection', async () => {
    const error = new Error('Storage error')
    storage.getInboundFile.mockRejectedValueOnce(error)

    await expect(pollInbound()).rejects.toThrow('Storage error')
  })

  test('should process file with correct reference', async () => {
    const inboundFile = { id: 123, name: 'file.csv' }
    storage.getInboundFile.mockResolvedValueOnce(inboundFile)

    await pollInbound()

    expect(processDataRetentionFile).toHaveBeenCalledWith(inboundFile)
  })

  test('should handle empty string file name', async () => {
    const inboundFile = ''
    storage.getInboundFile.mockResolvedValueOnce(inboundFile)

    await pollInbound()

    expect(processDataRetentionFile).not.toHaveBeenCalled()
  })

  test('should handle file with empty object', async () => {
    const inboundFile = {}
    storage.getInboundFile.mockResolvedValueOnce(inboundFile)

    await pollInbound()

    expect(processDataRetentionFile).toHaveBeenCalledWith(inboundFile)
  })

  test('should handle zero as file value', async () => {
    storage.getInboundFile.mockResolvedValueOnce(0)

    await pollInbound()

    expect(processDataRetentionFile).not.toHaveBeenCalled()
  })

  test('should complete without errors when file processed successfully', async () => {
    const inboundFile = { name: 'retention-data.csv' }
    storage.getInboundFile.mockResolvedValueOnce(inboundFile)
    processDataRetentionFile.mockResolvedValueOnce(undefined)

    const result = await pollInbound()

    expect(result).toBeUndefined()
  })
})
