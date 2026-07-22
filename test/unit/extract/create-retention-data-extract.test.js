const { PassThrough } = require('stream')

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

jest.mock('../../../app/data', () => ({
  retentionData: {
    findAll: jest.fn()
  },
  scheme: {},
  Sequelize: {
    col: jest.fn(value => value),
    Op: {
      gt: Symbol('gt')
    }
  }
}))

jest.mock('../../../app/storage', () => ({
  uploadStreamToBlob: jest.fn()
}))

const db = require('../../../app/data')
const { uploadStreamToBlob } = require('../../../app/storage')
const { createRetentionDataExtract } = require('../../../app/extract/create-retention-data-extract')

describe('createRetentionDataExtract', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    csvStream.write.mockReturnValue(true)

    jest.useFakeTimers()
    jest.setSystemTime(
      new Date('2026-07-22T10:11:12.123Z')
    )
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should upload a generated csv file', async () => {
    db.retentionData.findAll
      .mockResolvedValueOnce([
        {
          retentionDataId: 1,
          frn: '123456',
          agreementNumber: 'AGR001',
          schemeName: 'SFI',
          endDate: '2026-01-01',
          addedBy: 'user1',
          addedTime: '2026-01-01T10:00:00'
        }
      ])
      .mockResolvedValueOnce([])

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

  test('should write all rows returned from the database', async () => {
    db.retentionData.findAll
      .mockResolvedValueOnce([
        {
          retentionDataId: 1,
          frn: '123',
          agreementNumber: 'AGR1',
          schemeName: 'Scheme A',
          endDate: '2026-01-01',
          addedBy: 'user1',
          addedTime: 'time1'
        },
        {
          retentionDataId: 2,
          frn: '456',
          agreementNumber: 'AGR2',
          schemeName: 'Scheme B',
          endDate: '2026-01-02',
          addedBy: 'user2',
          addedTime: 'time2'
        }
      ])
      .mockResolvedValueOnce([])

    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(csvStream.write).toHaveBeenCalledTimes(2)

    expect(csvStream.write).toHaveBeenNthCalledWith(1, {
      frn: '123',
      agreementNumber: 'AGR1',
      schemeName: 'Scheme A',
      closureDate: '2026-01-01',
      addedBy: 'user1',
      addedTime: 'time1'
    })

    expect(csvStream.write).toHaveBeenNthCalledWith(2, {
      frn: '456',
      agreementNumber: 'AGR2',
      schemeName: 'Scheme B',
      closureDate: '2026-01-02',
      addedBy: 'user2',
      addedTime: 'time2'
    })
  })

  test('should continue fetching until an empty batch is returned', async () => {
    db.retentionData.findAll
      .mockResolvedValueOnce([
        {
          retentionDataId: 1
        }
      ])
      .mockResolvedValueOnce([
        {
          retentionDataId: 2
        }
      ])
      .mockResolvedValueOnce([])

    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(db.retentionData.findAll).toHaveBeenCalledTimes(3)
  })

  test('should use the last retentionDataId when requesting subsequent batches', async () => {
    db.retentionData.findAll
      .mockResolvedValueOnce([
        {
          retentionDataId: 100
        }
      ])
      .mockResolvedValueOnce([])

    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(db.retentionData.findAll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          retentionDataId: {
            [db.Sequelize.Op.gt]: 100
          }
        }
      })
    )
  })

  test('should end the csv stream when processing is complete', async () => {
    db.retentionData.findAll.mockResolvedValueOnce([])

    uploadStreamToBlob.mockResolvedValue()

    await createRetentionDataExtract()

    expect(csvStream.end).toHaveBeenCalled()
  })

  test('should create csv stringify with expected columns', async () => {
    db.retentionData.findAll.mockResolvedValueOnce([])

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
    db.retentionData.findAll.mockResolvedValueOnce([])

    uploadStreamToBlob.mockRejectedValue(
      new Error('Upload failed')
    )

    await expect(
      createRetentionDataExtract()
    ).rejects.toThrow('Upload failed')
  })

  test('should propagate database errors', async () => {
    db.retentionData.findAll.mockRejectedValue(
      new Error('Database failed')
    )

    uploadStreamToBlob.mockResolvedValue()

    await expect(
      createRetentionDataExtract()
    ).rejects.toThrow('Database failed')
  })
})
