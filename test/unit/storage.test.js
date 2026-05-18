jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn()
}))

jest.mock('@azure/storage-blob', () => {
  const mockBlockBlobClient = {
    upload: jest.fn().mockResolvedValue(undefined),
    download: jest.fn().mockResolvedValue({ readableStreamBody: 'mockStream' }),
    delete: jest.fn().mockResolvedValue(undefined),
    url: 'https://storage.blob.core.windows.net/container/file.txt',
    beginCopyFromURL: jest.fn().mockResolvedValue({
      pollUntilDone: jest.fn().mockResolvedValue({ copyStatus: 'success' })
    })
  }

  const mockContainerClient = {
    createIfNotExists: jest.fn().mockResolvedValue(undefined),
    getBlockBlobClient: jest.fn().mockImplementation((path) => {
      mockBlockBlobClient._lastPath = path
      return mockBlockBlobClient
    }),
    listBlobsFlat: jest.fn()
  }

  const mockBlobServiceClient = {
    getContainerClient: jest.fn().mockReturnValue(mockContainerClient)
  }

  const BlobServiceClient = jest.fn(() => mockBlobServiceClient)
  BlobServiceClient.fromConnectionString = jest.fn(() => mockBlobServiceClient)

  return { BlobServiceClient }
})

jest.mock('../../app/config', () => {
  const config = {
    useConnectionStr: false,
    connectionStr: 'DefaultEndpointsProtocol=https;AccountName=mock;AccountKey=mockKey;EndpointSuffix=core.windows.net',
    storageAccount: 'myaccount',
    container: 'mycontainer',
    inboundFolder: 'inbound',
    archiveFolder: 'archive',
    quarantineFolder: 'quarantine',
    createContainers: true,
    managedIdentityClientId: 'client-id'
  }
  return {
    storageConfig: config
  }
})

jest.spyOn(console, 'log').mockImplementation(() => { })

describe('storage', () => {
  let storage
  let storageConfig
  let BlobServiceClient
  let DefaultAzureCredential
  let mockContainerClient
  let mockBlockBlobClient

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    storageConfig = require('../../app/config').storageConfig
    BlobServiceClient = require('@azure/storage-blob').BlobServiceClient
    DefaultAzureCredential = require('@azure/identity').DefaultAzureCredential

    storageConfig.useConnectionStr = false
    storageConfig.connectionStr = 'DefaultEndpointsProtocol=https;AccountName=mock;AccountKey=mockKey;EndpointSuffix=core.windows.net'
    storageConfig.storageAccount = 'myaccount'
    storageConfig.container = 'mycontainer'
    storageConfig.inboundFolder = 'inbound'
    storageConfig.archiveFolder = 'archive'
    storageConfig.quarantineFolder = 'quarantine'
    storageConfig.createContainers = true
    storageConfig.managedIdentityClientId = 'client-id'

    storage = require('../../app/storage')

    const mockBlobServiceClient = BlobServiceClient.mock.results.length > 0 ? BlobServiceClient.mock.results[0].value : null
    mockContainerClient = mockBlobServiceClient ? mockBlobServiceClient.getContainerClient() : null
    mockBlockBlobClient = mockContainerClient ? mockContainerClient.getBlockBlobClient() : null
  })

  test('creates BlobServiceClient with DefaultAzureCredential when useConnectionStr is false', () => {
    storageConfig.useConnectionStr = false
    jest.resetModules()
    storage = require('../../app/storage')
    expect(BlobServiceClient).toHaveBeenCalledWith(
      `https://${storageConfig.storageAccount}.blob.core.windows.net`,
      expect.any(Object)
    )
  })

  test('passes managedIdentityClientId to DefaultAzureCredential', () => {
    jest.resetModules()
    storage = require('../../app/storage')
    expect(DefaultAzureCredential).toHaveBeenCalledWith({ managedIdentityClientId: 'client-id' })
  })

  test('initialiseContainers calls createIfNotExists and initialiseFolders', async () => {
    mockContainerClient.createIfNotExists.mockClear()
    mockContainerClient.getBlockBlobClient().upload.mockClear()
    await storage.initialiseContainers()
    expect(mockContainerClient.createIfNotExists).toHaveBeenCalled()
    expect(mockContainerClient.getBlockBlobClient().upload).toHaveBeenCalled()
  })

  test('getInboundFile returns null if no files', async () => {
    mockContainerClient.listBlobsFlat.mockReturnValueOnce({
      [Symbol.asyncIterator]: async function * () { }
    })
    const result = await storage.getInboundFile()
    expect(result).toBeNull()
  })

  test('getInboundFile returns matched file', async () => {
    const mockFiles = [
      { name: 'inbound/FCP_PDS_SchemeClosures_20250101140000.zip' }
    ]
    mockContainerClient.listBlobsFlat.mockReturnValueOnce({
      [Symbol.asyncIterator]: async function * () {
        for (const f of mockFiles) yield f
      }
    })
    const result = await storage.getInboundFile()
    expect(result).toBe('FCP_PDS_SchemeClosures_20250101140000.zip')
  })

  test('getInboundFile returns oldest matched file when multiple matches found', async () => {
    const mockFiles = [
      { name: 'inbound/FCP_PDS_SchemeClosures_20250103140000.zip' },
      { name: 'inbound/FCP_PDS_SchemeClosures_20250101140000.zip' },
      { name: 'inbound/FCP_PDS_SchemeClosures_20250102140000.zip' }
    ]
    mockContainerClient.listBlobsFlat.mockReturnValueOnce({
      [Symbol.asyncIterator]: async function * () {
        for (const f of mockFiles) yield f
      }
    })
    const result = await storage.getInboundFile()
    expect(result).toBe('FCP_PDS_SchemeClosures_20250101140000.zip')
  })

  test('downloadFileAsStream returns stream and logs', async () => {
    const stream = await storage.downloadFileAsStream('file.txt')
    expect(mockBlockBlobClient.download).toHaveBeenCalledWith(0)
    expect(stream).toBe('mockStream')
    expect(console.log).toHaveBeenCalledWith('Downloading file as stream: file.txt')
  })

  test('downloadFileAsStream throws error on failure', async () => {
    const error = new Error('Download failed')
    mockBlockBlobClient.download.mockRejectedValueOnce(error)
    await expect(storage.downloadFileAsStream('file.txt')).rejects.toThrow('Download failed')
  })

  test('deleteFile returns true when successful', async () => {
    const result = await storage.deleteFile('file.txt')
    expect(mockBlockBlobClient.delete).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  test('deleteFile returns false on error', async () => {
    mockBlockBlobClient.delete.mockRejectedValueOnce(new Error('fail'))
    const result = await storage.deleteFile('file.txt')
    expect(result).toBe(false)
  })

  test('archiveFile moves file successfully', async () => {
    const result = await storage.archiveFile('file.txt', 'archived-file.txt')
    expect(mockBlockBlobClient.beginCopyFromURL).toHaveBeenCalled()
    expect(mockBlockBlobClient.delete).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  test('quarantineFile moves file successfully', async () => {
    const result = await storage.quarantineFile('file.txt', 'quarantined-file.txt')
    expect(mockBlockBlobClient.beginCopyFromURL).toHaveBeenCalled()
    expect(mockBlockBlobClient.delete).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  test('exports expected functions and blobServiceClient', () => {
    expect(typeof storage.getInboundFile).toBe('function')
    expect(typeof storage.archiveFile).toBe('function')
    expect(typeof storage.quarantineFile).toBe('function')
    expect(typeof storage.downloadFileAsStream).toBe('function')
    expect(typeof storage.deleteFile).toBe('function')
    expect(storage.blobServiceClient).toBeDefined()
  })
})
