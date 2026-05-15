jest.mock('../../../app/storage', () => ({
  downloadFileAsStream: jest.fn(),
  deleteFile: jest.fn(),
  archiveFile: jest.fn(),
  quarantineFile: jest.fn()
}))

jest.mock('../../../app/processing/parse-retention-file')
jest.mock('../../../app/processing/unzip-and-upload')
jest.mock('../../../app/messaging/send-file-error-event')

const storage = require('../../../app/storage')
const { parseRetentionFile } = require('../../../app/processing/parse-retention-file')
const { unzipAndUpload } = require('../../../app/processing/unzip-and-upload')
const sendFileErrorEvent = require('../../../app/messaging/send-file-error-event')
const processDataRetentionFile = require('../../../app/processing/process-data-retention-file')

jest.spyOn(console, 'log').mockImplementation()
jest.spyOn(console, 'error').mockImplementation()

describe('processDataRetentionFile', () => {
  let mockStream

  beforeEach(() => {
    jest.clearAllMocks()
    mockStream = {}
    storage.downloadFileAsStream.mockResolvedValue(mockStream)
    storage.deleteFile.mockResolvedValue(undefined)
    storage.archiveFile.mockResolvedValue(undefined)
    storage.quarantineFile.mockResolvedValue(undefined)
    unzipAndUpload.mockResolvedValue([])
    parseRetentionFile.mockResolvedValue(true)
    sendFileErrorEvent.mockResolvedValue(undefined)
  })

  test('should download zip file as stream', async () => {
    const filename = 'retention-data.zip'

    await processDataRetentionFile(filename)

    expect(storage.downloadFileAsStream).toHaveBeenCalledWith(filename)
  })

  test('should unzip and upload downloaded stream', async () => {
    const filename = 'retention-data.zip'

    await processDataRetentionFile(filename)

    expect(unzipAndUpload).toHaveBeenCalledWith(mockStream)
  })

  test('should delete original zip file after unzip', async () => {
    const filename = 'retention-data.zip'

    await processDataRetentionFile(filename)

    expect(storage.deleteFile).toHaveBeenCalledWith(filename)
  })

  test('should process each uploaded file', async () => {
    const filename = 'retention-data.zip'
    const uploadedFiles = ['file1.csv', 'file2.csv']
    unzipAndUpload.mockResolvedValueOnce(uploadedFiles)

    await processDataRetentionFile(filename)

    expect(storage.downloadFileAsStream).toHaveBeenCalledWith('file1.csv')
    expect(storage.downloadFileAsStream).toHaveBeenCalledWith('file2.csv')
  })

  test('should archive file when parse is successful', async () => {
    const filename = 'retention-data.zip'
    const uploadedFile = 'retention-data.csv'
    unzipAndUpload.mockResolvedValueOnce([uploadedFile])
    parseRetentionFile.mockResolvedValueOnce(true)

    await processDataRetentionFile(filename)

    expect(storage.archiveFile).toHaveBeenCalledWith(uploadedFile, uploadedFile)
  })

  test('should quarantine file when parse fails', async () => {
    const filename = 'retention-data.zip'
    const uploadedFile = 'retention-data.csv'
    unzipAndUpload.mockResolvedValueOnce([uploadedFile])
    parseRetentionFile.mockResolvedValueOnce(false)

    await processDataRetentionFile(filename)

    expect(storage.quarantineFile).toHaveBeenCalledWith(uploadedFile, uploadedFile)
  })

  test('should not archive file when parse fails', async () => {
    const filename = 'retention-data.zip'
    const uploadedFile = 'retention-data.csv'
    unzipAndUpload.mockResolvedValueOnce([uploadedFile])
    parseRetentionFile.mockResolvedValueOnce(false)

    await processDataRetentionFile(filename)

    expect(storage.archiveFile).not.toHaveBeenCalled()
  })

  test('should handle multiple files with mixed success and failure', async () => {
    const filename = 'retention-data.zip'
    const uploadedFiles = ['file1.csv', 'file2.csv', 'file3.csv']
    unzipAndUpload.mockResolvedValueOnce(uploadedFiles)
    parseRetentionFile
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    await processDataRetentionFile(filename)

    expect(storage.archiveFile).toHaveBeenCalledTimes(2)
    expect(storage.quarantineFile).toHaveBeenCalledTimes(1)
  })

  test('should log processing start', async () => {
    const filename = 'retention-data.zip'

    await processDataRetentionFile(filename)

    expect(console.log).toHaveBeenCalledWith(`Processing zip file: ${filename}`)
  })

  test('should log completion after deletion', async () => {
    const filename = 'retention-data.zip'

    await processDataRetentionFile(filename)

    expect(console.log).toHaveBeenCalledWith(`Processed and deleted zip file: ${filename}`)
  })

  test('should log when file is archived', async () => {
    const filename = 'retention-data.zip'
    const uploadedFile = 'retention-data.csv'
    unzipAndUpload.mockResolvedValueOnce([uploadedFile])
    parseRetentionFile.mockResolvedValueOnce(true)

    await processDataRetentionFile(filename)

    expect(console.log).toHaveBeenCalledWith(
      `Archiving ${uploadedFile}, successfully parsed file`
    )
  })

  test('should log when file is quarantined', async () => {
    const filename = 'retention-data.zip'
    const uploadedFile = 'retention-data.csv'
    unzipAndUpload.mockResolvedValueOnce([uploadedFile])
    parseRetentionFile.mockResolvedValueOnce(false)

    await processDataRetentionFile(filename)

    expect(console.log).toHaveBeenCalledWith(
      `Quarantining ${filename}, failed to parse file`
    )
  })

  test('should handle error during processing', async () => {
    const filename = 'retention-data.zip'
    const error = new Error('Download failed')
    storage.downloadFileAsStream.mockRejectedValueOnce(error)

    await expect(processDataRetentionFile(filename)).rejects.toThrow('Download failed')

    expect(console.error).toHaveBeenCalledWith(`Error thrown processing ${filename}`)
    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, error)
    expect(storage.deleteFile).toHaveBeenCalledWith(filename)
  })

  test('should delete file when error occurs', async () => {
    const filename = 'retention-data.zip'
    const error = new Error('Unzip failed')
    unzipAndUpload.mockRejectedValueOnce(error)

    await expect(processDataRetentionFile(filename)).rejects.toThrow('Unzip failed')

    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, error)
    expect(storage.deleteFile).toHaveBeenCalledWith(filename)
  })

  test('should handle error from unzipAndUpload', async () => {
    const filename = 'retention-data.zip'
    const error = new Error('Unzip error')
    unzipAndUpload.mockRejectedValueOnce(error)

    await expect(processDataRetentionFile(filename)).rejects.toThrow('Unzip error')

    expect(console.error).toHaveBeenCalledWith(`Error thrown processing ${filename}`)
    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, error)
    expect(storage.deleteFile).toHaveBeenCalledWith(filename)
  })

  test('should handle error from parseRetentionFile', async () => {
    const filename = 'retention-data.zip'
    const uploadedFile = 'retention-data.csv'
    unzipAndUpload.mockResolvedValueOnce([uploadedFile])
    const error = new Error('Parse error')
    parseRetentionFile.mockRejectedValueOnce(error)

    await expect(processDataRetentionFile(filename)).rejects.toThrow('Parse error')

    expect(console.error).toHaveBeenCalledWith(`Error thrown processing ${filename}`)
    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, error)
    expect(storage.deleteFile).toHaveBeenCalledWith(filename)
  })

  test('should handle error from archiveFile', async () => {
    const filename = 'retention-data.zip'
    const uploadedFile = 'retention-data.csv'
    unzipAndUpload.mockResolvedValueOnce([uploadedFile])
    parseRetentionFile.mockResolvedValueOnce(true)
    const error = new Error('Archive error')
    storage.archiveFile.mockRejectedValueOnce(error)

    await expect(processDataRetentionFile(filename)).rejects.toThrow('Archive error')

    expect(console.error).toHaveBeenCalledWith(`Error thrown processing ${filename}`)
    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, error)
    expect(storage.deleteFile).toHaveBeenCalledWith(filename)
  })

  test('should handle error from quarantineFile', async () => {
    const filename = 'retention-data.zip'
    const uploadedFile = 'retention-data.csv'
    unzipAndUpload.mockResolvedValueOnce([uploadedFile])
    parseRetentionFile.mockResolvedValueOnce(false)
    const error = new Error('Quarantine error')
    storage.quarantineFile.mockRejectedValueOnce(error)

    await expect(processDataRetentionFile(filename)).rejects.toThrow('Quarantine error')

    expect(console.error).toHaveBeenCalledWith(`Error thrown processing ${filename}`)
    expect(sendFileErrorEvent).toHaveBeenCalledWith(filename, error)
    expect(storage.deleteFile).toHaveBeenCalledWith(filename)
  })

  test('should handle empty uploaded files array', async () => {
    const filename = 'retention-data.zip'
    unzipAndUpload.mockResolvedValueOnce([])

    await processDataRetentionFile(filename)

    expect(storage.archiveFile).not.toHaveBeenCalled()
    expect(storage.quarantineFile).not.toHaveBeenCalled()
  })

  test('should complete successfully with no errors', async () => {
    const filename = 'retention-data.zip'
    const uploadedFile = 'retention-data.csv'
    unzipAndUpload.mockResolvedValueOnce([uploadedFile])
    parseRetentionFile.mockResolvedValueOnce(true)

    await expect(processDataRetentionFile(filename)).resolves.toBeUndefined()

    expect(console.error).not.toHaveBeenCalled()
    expect(sendFileErrorEvent).not.toHaveBeenCalled()
  })
})
