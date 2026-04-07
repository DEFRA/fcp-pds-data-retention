const { Readable } = require('stream')
const unzipper = require('unzipper')
const { storageConfig } = require('../../../app/config')
const storage = require('../../../app/storage')
const { unzipAndUpload } = require('../../../app/processing/unzip-and-upload')

jest.mock('unzipper')
jest.mock('../../../app/config')
jest.mock('../../../app/storage')
jest.spyOn(console, 'log').mockImplementation()
jest.spyOn(console, 'error').mockImplementation()

describe('unzipAndUpload', () => {
  let mockZipStream
  let mockParseStream
  let mockBlobClient

  beforeEach(() => {
    jest.clearAllMocks()

    mockBlobClient = {
      uploadStream: jest.fn().mockResolvedValue(undefined)
    }

    storage.getBlob.mockResolvedValue(mockBlobClient)
    storage.quarantineFile.mockResolvedValue(undefined)

    mockParseStream = new Readable()
    mockParseStream.on = jest.fn((event, handler) => {
      mockParseStream.handlers = mockParseStream.handlers || {}
      mockParseStream.handlers[event] = handler
      return mockParseStream
    })

    mockZipStream = new Readable()
    mockZipStream.pipe = jest.fn().mockReturnValue(mockParseStream)

    storageConfig.inboundFolder = '/inbound'
  })

  test('should return a promise', () => {
    const result = unzipAndUpload(mockZipStream)

    expect(result instanceof Promise).toBe(true)
  })

  test('should pipe zipStream through unzipper.Parse', () => {
    unzipAndUpload(mockZipStream)

    expect(mockZipStream.pipe).toHaveBeenCalledWith(unzipper.Parse())
  })

  test('should register entry event handler', () => {
    unzipAndUpload(mockZipStream)

    expect(mockParseStream.on).toHaveBeenCalledWith('entry', expect.any(Function))
  })

  test('should register close event handler', () => {
    unzipAndUpload(mockZipStream)

    expect(mockParseStream.on).toHaveBeenCalledWith('close', expect.any(Function))
  })

  test('should register error event handler', () => {
    unzipAndUpload(mockZipStream)

    expect(mockParseStream.on).toHaveBeenCalledWith('error', expect.any(Function))
  })

  test('should skip directory entries', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const directoryEntry = {
      type: 'Directory',
      path: 'some/directory/',
      autodrain: jest.fn()
    }

    mockParseStream.handlers.entry(directoryEntry)
    mockParseStream.handlers.close()

    await promise

    expect(directoryEntry.autodrain).toHaveBeenCalled()
    expect(storage.getBlob).not.toHaveBeenCalled()
  })

  test('should skip entries ending with slash', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const directoryEntry = {
      type: 'File',
      path: 'some/directory/',
      autodrain: jest.fn()
    }

    mockParseStream.handlers.entry(directoryEntry)
    mockParseStream.handlers.close()

    await promise

    expect(directoryEntry.autodrain).toHaveBeenCalled()
  })

  test('should extract file from zip and upload', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'folder/retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    const result = await promise

    expect(storage.getBlob).toHaveBeenCalledWith('/inbound/retention-data.csv')
    expect(mockBlobClient.uploadStream).toHaveBeenCalledWith(fileEntry)
    expect(result).toContain('retention-data.csv')
  })

  test('should extract base file name correctly', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'path/to/file/retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    const result = await promise

    expect(result[0]).toBe('retention-data.csv')
  })

  test('should handle multiple files', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const file1 = {
      type: 'File',
      path: 'file1.csv'
    }

    const file2 = {
      type: 'File',
      path: 'file2.csv'
    }

    mockParseStream.handlers.entry(file1)
    mockParseStream.handlers.entry(file2)
    mockParseStream.handlers.close()

    const result = await promise

    expect(result).toHaveLength(2)
    expect(result).toContain('file1.csv')
    expect(result).toContain('file2.csv')
  })

  test('should return uploaded files array', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    const result = await promise

    expect(Array.isArray(result)).toBe(true)
    expect(result).toContain('retention-data.csv')
  })

  test('should wait for all uploads to complete before resolving', async () => {
    const uploadPromises = []

    mockBlobClient.uploadStream.mockImplementation(() => {
      return new Promise(resolve => {
        uploadPromises.push({ resolve })
      })
    })

    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    const resultPromise = promise.then(result => result)

    // Upload not complete yet
    expect(uploadPromises).toHaveLength(1)

    uploadPromises[0].resolve()

    const result = await resultPromise

    expect(result).toContain('retention-data.csv')
  })

  test('should reject promise on unzip error', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const error = new Error('Unzip failed')
    mockParseStream.handlers.error(error)

    await expect(promise).rejects.toThrow('Unzip failed')
  })

  test('should reject promise on upload error', async () => {
    mockBlobClient.uploadStream.mockRejectedValueOnce(new Error('Upload failed'))

    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    await expect(promise).rejects.toThrow('Upload failed')
  })

  test('should quarantine file on upload error', async () => {
    mockBlobClient.uploadStream.mockRejectedValueOnce(new Error('Upload failed'))

    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    await promise.catch(() => { })

    expect(storage.quarantineFile).toHaveBeenCalledWith('retention-data.csv')
  })

  test('should log when skipping directory', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const directoryEntry = {
      type: 'Directory',
      path: 'some/directory/',
      autodrain: jest.fn()
    }

    mockParseStream.handlers.entry(directoryEntry)
    mockParseStream.handlers.close()

    await promise

    expect(console.log).toHaveBeenCalledWith('Skipping directory: some/directory/')
  })

  test('should log when extracting file', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'path/to/retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    await promise

    expect(console.log).toHaveBeenCalledWith('Extracting file from zip: retention-data.csv')
  })

  test('should log when uploading to blob storage', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    await promise

    expect(console.log).toHaveBeenCalledWith(
      'Uploaded file to blob storage: retention-data.csv'
    )
  })

  test('should log when parsing finished', async () => {
    const promise = unzipAndUpload(mockZipStream)

    mockParseStream.handlers.close()

    await promise

    expect(console.log).toHaveBeenCalledWith(
      'DWH zip file parsing finished, waiting for uploads to complete...'
    )
  })

  test('should log when all files uploaded successfully', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    await promise

    expect(console.log).toHaveBeenCalledWith(
      'DWH zip file successfully unzipped and all files uploaded'
    )
  })

  test('should log error on unzip error', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const error = new Error('Unzip failed')
    mockParseStream.handlers.error(error)

    await promise.catch(() => { })

    expect(console.error).toHaveBeenCalledWith('Error during unzipping: ', error)
  })

  test('should use storageConfig.inboundFolder in blob path', async () => {
    storageConfig.inboundFolder = '/custom/inbound'

    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    await promise

    expect(storage.getBlob).toHaveBeenCalledWith('/custom/inbound/retention-data.csv')
  })

  test('should handle mixed files and directories', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const directory = {
      type: 'Directory',
      path: 'folder/',
      autodrain: jest.fn()
    }

    const file1 = {
      type: 'File',
      path: 'file1.csv'
    }

    const file2 = {
      type: 'File',
      path: 'folder/file2.csv'
    }

    mockParseStream.handlers.entry(directory)
    mockParseStream.handlers.entry(file1)
    mockParseStream.handlers.entry(file2)
    mockParseStream.handlers.close()

    const result = await promise

    expect(result).toHaveLength(2)
    expect(result).toContain('file1.csv')
    expect(result).toContain('file2.csv')
    expect(directory.autodrain).toHaveBeenCalled()
  })

  test('should handle file with no path folder', async () => {
    const promise = unzipAndUpload(mockZipStream)

    const fileEntry = {
      type: 'File',
      path: 'retention-data.csv'
    }

    mockParseStream.handlers.entry(fileEntry)
    mockParseStream.handlers.close()

    const result = await promise

    expect(result[0]).toBe('retention-data.csv')
  })
})
