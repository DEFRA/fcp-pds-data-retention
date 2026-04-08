const { DefaultAzureCredential } = require('@azure/identity')
const { BlobServiceClient } = require('@azure/storage-blob')
const { storageConfig } = require('../../app/config')

jest.mock('@azure/identity')
jest.mock('@azure/storage-blob')
jest.mock('../../app/config')
jest.spyOn(console, 'log').mockImplementation()

describe('storage', () => {
  let mockContainerClient
  let mockBlockBlobClient

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    mockBlockBlobClient = {
      upload: jest.fn().mockResolvedValue(undefined),
      download: jest.fn().mockResolvedValue({
        readableStreamBody: 'mockStream'
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      url: 'https://storage.blob.core.windows.net/container/file.txt',
      beginCopyFromURL: jest.fn().mockResolvedValue({
        pollUntilDone: jest.fn().mockResolvedValue({ copyStatus: 'success' })
      })
    }

    mockContainerClient = {
      createIfNotExists: jest.fn().mockResolvedValue(undefined),
      getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
      listBlobsFlat: jest.fn()
    }

    const mockBlobServiceClient = jest.fn(() => ({
      getContainerClient: jest.fn().mockReturnValue(mockContainerClient)
    }))

    mockBlobServiceClient.fromConnectionString = jest.fn().mockReturnValue({
      getContainerClient: jest.fn().mockReturnValue(mockContainerClient)
    })

    require('@azure/storage-blob').BlobServiceClient = mockBlobServiceClient

    storageConfig.useConnectionStr = false
    storageConfig.connectionStr = 'DefaultEndpointsProtocol=https://...'
    storageConfig.storageAccount = 'myaccount'
    storageConfig.container = 'mycontainer'
    storageConfig.inboundFolder = '/inbound'
    storageConfig.archiveFolder = '/archive'
    storageConfig.quarantineFolder = '/quarantine'
    storageConfig.createContainers = true
    storageConfig.managedIdentityClientId = 'client-id'
  })

  test('should create BlobServiceClient from connection string when useConnectionStr is true', () => {
    storageConfig.useConnectionStr = true

    require('../../app/storage')

    expect(BlobServiceClient.fromConnectionString).toHaveBeenCalledWith(
      storageConfig.connectionStr
    )
  })

  test('should create BlobServiceClient with DefaultAzureCredential when useConnectionStr is false', () => {
    storageConfig.useConnectionStr = false

    require('../../app/storage')

    expect(BlobServiceClient).toHaveBeenCalledWith(
      'https://myaccount.blob.core.windows.net',
      expect.any(Object)
    )
  })

  test('should pass managedIdentityClientId to DefaultAzureCredential', () => {
    storageConfig.useConnectionStr = false
    storageConfig.managedIdentityClientId = 'my-client-id'

    require('../../app/storage')

    expect(DefaultAzureCredential).toHaveBeenCalledWith({
      managedIdentityClientId: 'my-client-id'
    })
  })

  test('should initialise containers when initialiseContainers is called', async () => {
    storageConfig.createContainers = true
    const storage = require('../../app/storage')

    await storage.initialiseContainers?.()

    expect(mockContainerClient.createIfNotExists).toHaveBeenCalled()
  })

  test('should return null when no inbound files found', async () => {
    mockContainerClient.listBlobsFlat.mockReturnValueOnce({
      [Symbol.asyncIterator]: async function * () { }
    })

    const storage = require('../../app/storage')
    const result = await storage.getInboundFile()

    expect(result).toBeNull()
  })

  test('should return matched inbound file', async () => {
    const mockFiles = [
      { name: '/inbound/DWH_PDS_SchemeClosures_20250101140000.zip' }
    ]

    mockContainerClient.listBlobsFlat.mockReturnValueOnce({
      [Symbol.asyncIterator]: async function * () {
        for (const file of mockFiles) {
          yield file
        }
      }
    })

    const storage = require('../../app/storage')
    const result = await storage.getInboundFile()

    expect(result).toBe('DWH_PDS_SchemeClosures_20250101140000.zip')
  })

  test('should filter files by regex pattern', async () => {
    const mockFiles = [
      { name: '/inbound/DWH_PDS_SchemeClosures_20250101140000.zip' },
      { name: '/inbound/DWH_PDS_SchemeClosures_invalid.zip' },
      { name: '/inbound/default.txt' }
    ]

    mockContainerClient.listBlobsFlat.mockReturnValueOnce({
      [Symbol.asyncIterator]: async function * () {
        for (const file of mockFiles) {
          yield file
        }
      }
    })

    const storage = require('../../app/storage')
    const result = await storage.getInboundFile()

    expect(result).toBe('DWH_PDS_SchemeClosures_20250101140000.zip')
  })

  test('should return oldest file when multiple matches found', async () => {
    const mockFiles = [
      { name: '/inbound/DWH_PDS_SchemeClosures_20250103140000.zip' },
      { name: '/inbound/DWH_PDS_SchemeClosures_20250101140000.zip' },
      { name: '/inbound/DWH_PDS_SchemeClosures_20250102140000.zip' }
    ]

    mockContainerClient.listBlobsFlat.mockReturnValueOnce({
      [Symbol.asyncIterator]: async function * () {
        for (const file of mockFiles) {
          yield file
        }
      }
    })

    const storage = require('../../app/storage')
    const result = await storage.getInboundFile()

    expect(result).toBe('DWH_PDS_SchemeClosures_20250101140000.zip')
  })

  test('should download file as stream', async () => {
    const mockStream = { data: 'stream' }
    mockBlockBlobClient.download.mockResolvedValueOnce({
      readableStreamBody: mockStream
    })

    const storage = require('../../app/storage')
    const result = await storage.downloadFileAsStream('retention-data.csv')

    expect(mockBlockBlobClient.download).toHaveBeenCalledWith(0)
    expect(result).toBe(mockStream)
  })

  test('should log when downloading file', async () => {
    const storage = require('../../app/storage')

    await storage.downloadFileAsStream('retention-data.csv')

    expect(console.log).toHaveBeenCalledWith(
      'Downloading file as stream: retention-data.csv'
    )
  })

  test('should handle download error', async () => {
    const error = new Error('Download failed')
    mockBlockBlobClient.download.mockRejectedValueOnce(error)

    const storage = require('../../app/storage')

    await expect(storage.downloadFileAsStream('retention-data.csv')).rejects.toThrow(
      'Download failed'
    )
  })

  test('should delete file successfully', async () => {
    const storage = require('../../app/storage')
    const result = await storage.deleteFile('retention-data.zip')

    expect(mockBlockBlobClient.delete).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  test('should log when deleting file', async () => {
    const storage = require('../../app/storage')

    await storage.deleteFile('retention-data.zip')

    expect(console.log).toHaveBeenCalledWith('Deleting file: retention-data.zip')
    expect(console.log).toHaveBeenCalledWith('File deleted: retention-data.zip')
  })

  test('should handle delete error and return false', async () => {
    mockBlockBlobClient.delete.mockRejectedValueOnce(new Error('Delete failed'))

    const storage = require('../../app/storage')
    const result = await storage.deleteFile('retention-data.zip')

    expect(result).toBe(false)
  })

  test('should archive file by moving to archive folder', async () => {
    const storage = require('../../app/storage')
    const result = await storage.archiveFile('retention-data.zip', 'retention-data-archived.zip')

    expect(mockBlockBlobClient.beginCopyFromURL).toHaveBeenCalled()
    expect(mockBlockBlobClient.delete).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  test('should quarantine file by moving to quarantine folder', async () => {
    const storage = require('../../app/storage')
    const result = await storage.quarantineFile('retention-data.zip', 'retention-data-quarantined.zip')

    expect(mockBlockBlobClient.beginCopyFromURL).toHaveBeenCalled()
    expect(mockBlockBlobClient.delete).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  test('should return false when archive copy fails', async () => {
    mockBlockBlobClient.beginCopyFromURL.mockResolvedValueOnce({
      pollUntilDone: jest.fn().mockResolvedValueOnce({ copyStatus: 'failed' })
    })

    const storage = require('../../app/storage')
    const result = await storage.archiveFile('retention-data.zip', 'retention-data-archived.zip')

    expect(result).toBe(false)
  })

  test('should not delete source file when archive copy fails', async () => {
    mockBlockBlobClient.beginCopyFromURL.mockResolvedValueOnce({
      pollUntilDone: jest.fn().mockResolvedValueOnce({ copyStatus: 'failed' })
    })

    const storage = require('../../app/storage')
    await storage.archiveFile('retention-data.zip', 'retention-data-archived.zip')

    expect(mockBlockBlobClient.delete).not.toHaveBeenCalled()
  })

  test('should handle copy error', async () => {
    mockBlockBlobClient.beginCopyFromURL.mockRejectedValueOnce(
      new Error('Copy failed')
    )

    const storage = require('../../app/storage')

    await expect(
      storage.archiveFile('retention-data.zip', 'retention-data-archived.zip')
    ).rejects.toThrow('Copy failed')
  })

  test('should export getInboundFile', () => {
    const storage = require('../../app/storage')

    expect(storage.getInboundFile).toBeDefined()
    expect(typeof storage.getInboundFile).toBe('function')
  })

  test('should export archiveFile', () => {
    const storage = require('../../app/storage')

    expect(storage.archiveFile).toBeDefined()
    expect(typeof storage.archiveFile).toBe('function')
  })

  test('should export quarantineFile', () => {
    const storage = require('../../app/storage')

    expect(storage.quarantineFile).toBeDefined()
    expect(typeof storage.quarantineFile).toBe('function')
  })

  test('should export downloadFileAsStream', () => {
    const storage = require('../../app/storage')

    expect(storage.downloadFileAsStream).toBeDefined()
    expect(typeof storage.downloadFileAsStream).toBe('function')
  })

  test('should export deleteFile', () => {
    const storage = require('../../app/storage')

    expect(storage.deleteFile).toBeDefined()
    expect(typeof storage.deleteFile).toBe('function')
  })

  test('should export blobServiceClient', () => {
    const storage = require('../../app/storage')

    expect(storage.blobServiceClient).toBeDefined()
  })

  test('should use inboundFolder in getBlob path', async () => {
    storageConfig.inboundFolder = '/custom/inbound'

    const storage = require('../../app/storage')
    await storage.downloadFileAsStream('test.csv')

    expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith(
      '/custom/inbound/test.csv'
    )
  })

  test('should handle multiple file patterns correctly', async () => {
    const mockFiles = [
      { name: '/inbound/DWH_PDS_SchemeClosures_20250101000000.zip' },
      { name: '/inbound/DWH_PDS_SchemeClosures_20250101235959.zip' },
      { name: '/inbound/OTHER_FILE_20250101140000.zip' }
    ]

    mockContainerClient.listBlobsFlat.mockReturnValueOnce({
      [Symbol.asyncIterator]: async function * () {
        for (const file of mockFiles) {
          yield file
        }
      }
    })

    const storage = require('../../app/storage')
    const result = await storage.getInboundFile()

    expect(result).toBe('DWH_PDS_SchemeClosures_20250101000000.zip')
  })

  test('should log error message when download fails', async () => {
    const error = new Error('Network error')
    mockBlockBlobClient.download.mockRejectedValueOnce(error)

    const storage = require('../../app/storage')

    await storage.downloadFileAsStream('retention-data.csv').catch(() => { })

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('An error occurred trying to download blob')
    )
  })

  test('should log error message when delete fails', async () => {
    mockBlockBlobClient.delete.mockRejectedValueOnce(new Error('Delete error'))

    const storage = require('../../app/storage')
    await storage.deleteFile('retention-data.zip')

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('An error occurred trying to delete blob')
    )
  })
})
