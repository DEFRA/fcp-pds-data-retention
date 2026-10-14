const { PassThrough } = require('node:stream')
const { createKnexMock, createQueryBuilder } = require('../../helpers/mock-knex')

const mockDb = createKnexMock(['retentionData'])

const csvStream = new PassThrough({
  objectMode: true
})

csvStream.write = jest.fn(() => true)
csvStream.end = jest.fn()
csvStream.pipe = jest.fn()

const mockStringify = jest.fn(() => csvStream)

jest.mock('csv-stringify', () => ({
  stringify: mockStringify
}))

jest.mock('../../../app/database', () => ({
  client: mockDb.knex,
  transaction: mockDb.transaction,
  close: mockDb.close,
  ...mockDb.tables
}))

jest.mock('../../../app/storage', () => ({
  uploadStreamToBlob: jest.fn()
}))

const { uploadStreamToBlob } = require('../../../app/storage')
const { createRetentionDataExtract } = require('../../../app/extract/create-retention-data-extract')

const mockBatches = (...batches) => {
  return batches.map(rows => {
    const batchBuilder = createQueryBuilder().resolves(rows)
    mockDb.tables.retentionData.mockReturnValueOnce(batchBuilder)
    return batchBuilder
  })
}

describe('createRetentionDataExtract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDb.builder.resolves([])

    csvStream.write.mockReturnValue(true)

    jest.useFakeTimers()
    jest.setSystemTime(
      new Date(2026, 6, 22, 10, 11, 12, 123)
    )
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should upload a generated csv file', async () => {
    mockBatches([
      {
        retentionDataId: 1,
        frn: '123456',
        agreementNumber: 'AGR001',
        schemeName: 'SFI',
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        addedBy: 'user1',
        addedTime: new Date('2026-01-01T10:00:00.000Z')
      }
    ], [])

    uploadStreamToBlob.mockResolvedValue()

    const result = await createRetentionDataExtract()

    expect(result).toBe(
      'fcp-pds-data-retention-extract-20260722101112123.csv'
    )

    expect(uploadStreamToBlob).toHaveBeenCalledWith(
      'fcp-pds-data-retention-extract-20260722101112123.csv',
      expect.any(PassThrough),
      false
    )
  })

  test('should pipe the csv stream to the upload stream', async () => {
    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(csvStream.pipe).toHaveBeenCalledWith(expect.any(PassThrough))
  })

  test('should write all rows returned from the database', async () => {
    mockBatches([
      {
        retentionDataId: 1,
        frn: '123',
        agreementNumber: 'AGR1',
        schemeName: 'Scheme A',
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        addedBy: 'user1',
        addedTime: new Date('2026-01-01T10:00:00.000Z')
      },
      {
        retentionDataId: 2,
        frn: '456',
        agreementNumber: 'AGR2',
        schemeName: 'Scheme B',
        endDate: new Date('2026-01-02T00:00:00.000Z'),
        addedBy: 'user2',
        addedTime: new Date('2026-01-02T11:00:00.000Z')
      }
    ], [])

    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(csvStream.write).toHaveBeenCalledTimes(2)

    expect(csvStream.write).toHaveBeenNthCalledWith(1, {
      frn: '123',
      agreementNumber: 'AGR1',
      schemeName: 'Scheme A',
      closureDate: '2026-01-01',
      addedBy: 'user1',
      addedTime: '2026-01-01'
    })

    expect(csvStream.write).toHaveBeenNthCalledWith(2, {
      frn: '456',
      agreementNumber: 'AGR2',
      schemeName: 'Scheme B',
      closureDate: '2026-01-02',
      addedBy: 'user2',
      addedTime: '2026-01-02'
    })
  })

  test('should write empty strings for missing dates', async () => {
    mockBatches([
      {
        retentionDataId: 1,
        frn: '123',
        agreementNumber: 'AGR1',
        schemeName: 'Scheme A',
        endDate: null,
        addedBy: 'user1',
        addedTime: null
      }
    ], [])

    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(csvStream.write).toHaveBeenCalledWith({
      frn: '123',
      agreementNumber: 'AGR1',
      schemeName: 'Scheme A',
      closureDate: '',
      addedBy: 'user1',
      addedTime: ''
    })
  })

  test('should continue fetching until an empty batch is returned', async () => {
    mockBatches([{ retentionDataId: 1 }], [{ retentionDataId: 2 }], [])

    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(mockDb.tables.retentionData).toHaveBeenCalledTimes(3)
  })

  test('should use the last retentionDataId when requesting subsequent batches', async () => {
    const [firstBatch, secondBatch] = mockBatches([{ retentionDataId: 100 }], [])

    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(firstBatch.where).toHaveBeenCalledWith('retentionData.retentionDataId', '>', 0)
    expect(secondBatch.where).toHaveBeenCalledWith('retentionData.retentionDataId', '>', 100)
  })

  test('should query retention data using the expected clauses', async () => {
    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(mockDb.tables.retentionData).toHaveBeenCalledWith()
    expect(mockDb.builder.select).toHaveBeenCalledWith(
      'retentionData.retentionDataId',
      'retentionData.frn',
      { schemeName: 'scheme.name' },
      'retentionData.agreementNumber',
      'retentionData.endDate',
      'retentionData.addedBy',
      'retentionData.addedTime'
    )
    expect(mockDb.builder.leftJoin).toHaveBeenCalledWith({ scheme: 'schemes' }, 'retentionData.schemeId', 'scheme.schemeId')
    expect(mockDb.builder.where).toHaveBeenCalledWith('retentionData.retentionDataId', '>', 0)
    expect(mockDb.builder.orderBy).toHaveBeenCalledWith('retentionData.retentionDataId', 'asc')
    expect(mockDb.builder.limit).toHaveBeenCalledWith(5000)
  })

  test('should end the csv stream when processing is complete', async () => {
    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(csvStream.end).toHaveBeenCalled()
  })

  test('should create csv stringify with expected columns', async () => {
    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(mockStringify).toHaveBeenCalledWith({
      header: true,
      columns: {
        frn: 'frn',
        agreementNumber: 'agreementNumber',
        schemeName: 'schemeName',
        closureDate: 'closureDate',
        addedBy: 'addedBy',
        addedTime: 'addedTime'
      }
    })
  })

  test('should propagate upload errors', async () => {
    uploadStreamToBlob.mockRejectedValue(
      new Error('Upload failed')
    )

    await expect(
      createRetentionDataExtract()
    ).rejects.toThrow('Upload failed')
  })

  test('should propagate database errors', async () => {
    mockDb.builder.rejects(new Error('Database failed'))

    uploadStreamToBlob.mockResolvedValue()

    await expect(
      createRetentionDataExtract()
    ).rejects.toThrow('Database failed')
  })
})
