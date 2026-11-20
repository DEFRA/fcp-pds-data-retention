const Hapi = require('@hapi/hapi')
const { createKnexMock, createQueryBuilder } = require('../../../helpers/mock-knex')
const schemeIds = require('../../../../app/constants/schemes')
const mockDb = createKnexMock(['retentionData'])
mockDb.knex.batchInsert = jest.fn()

jest.mock('../../../../app/database', () => ({
  client: mockDb.knex,
  transaction: mockDb.transaction,
  close: mockDb.close,
  ...mockDb.tables
}))
jest.mock('../../../../app/helpers/get-scheme-id-from-source-system')
jest.mock('../../../../app/extract/create-retention-data-extract')

jest.mock('../../../../app/storage', () => ({
  uploadStreamToBlob: jest.fn()
}))

const routes = require('../../../../app/server/routes/closure')
const { getSchemeIdFromSourceSystem } = require('../../../../app/helpers/get-scheme-id-from-source-system')
const { createRetentionDataExtract } = require('../../../../app/extract/create-retention-data-extract')

describe('Closure API Routes', () => {
  let server

  beforeAll(async () => {
    server = Hapi.server({ port: 0 })
    server.route(routes)
    await server.initialize()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockDb.tables.retentionData.mockReset()
    mockDb.tables.retentionData.mockReturnValue(mockDb.builder)
    mockDb.builder.resolves([])
  })

  afterAll(async () => {
    await server.stop()
    jest.resetAllMocks()
  })

  describe('GET /closure', () => {
    const closures = [
      {
        retentionDataId: 1,
        frn: 1234567890,
        agreementNumber: 'AG12345',
        schemeId: 1,
        schemeName: 'SFI'
      },
      {
        retentionDataId: 2,
        frn: 9876543210,
        agreementNumber: 'AG67890',
        schemeId: 2,
        schemeName: 'CS'
      }
    ]

    let countBuilder
    let rowsBuilder

    beforeEach(() => {
      countBuilder = createQueryBuilder().resolves({ count: '2' })
      rowsBuilder = createQueryBuilder().resolves(closures)
      mockDb.tables.retentionData
        .mockReturnValueOnce(countBuilder)
        .mockReturnValueOnce(rowsBuilder)
    })

    test('should return paginated closures using default page and pageSize', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure'
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({
        closures,
        count: 2
      })

      expect(mockDb.tables.retentionData).toHaveBeenCalledTimes(2)
      expect(mockDb.tables.retentionData).toHaveBeenCalledWith()

      expect(countBuilder.count).toHaveBeenCalledWith({ count: '*' })
      expect(countBuilder.first).toHaveBeenCalledTimes(1)
      expect(countBuilder.where).not.toHaveBeenCalled()

      expect(rowsBuilder.select).toHaveBeenCalledWith(
        'retentionData.retentionDataId',
        'retentionData.frn',
        'retentionData.schemeId',
        'retentionData.agreementNumber',
        'retentionData.endDate',
        'retentionData.addedBy',
        'retentionData.addedTime',
        { schemeName: 'schemes.name' }
      )
      expect(rowsBuilder.leftJoin).toHaveBeenCalledWith('schemes', 'retentionData.schemeId', 'schemes.schemeId')
      expect(rowsBuilder.where).not.toHaveBeenCalled()
      expect(rowsBuilder.orderBy).toHaveBeenCalledWith('retentionData.addedTime', 'desc')
      expect(rowsBuilder.limit).toHaveBeenCalledWith(2500)
      expect(rowsBuilder.offset).toHaveBeenCalledWith(0)
    })

    test('should return count as a number', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure'
      })

      expect(res.result.count).toBe(2)
    })

    test('should apply page and pageSize when provided', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?page=3&pageSize=100'
      })

      expect(res.statusCode).toBe(200)

      expect(rowsBuilder.limit).toHaveBeenCalledWith(100)
      expect(rowsBuilder.offset).toHaveBeenCalledWith(200)
    })

    test('should filter by numeric frnAgreement using agreementNumber or frn', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?frnAgreement=1234567890'
      })

      expect(res.statusCode).toBe(200)

      expect(countBuilder.where).not.toHaveBeenCalled()
      expect(rowsBuilder.where).toHaveBeenCalledWith('retentionData.agreementNumber', '1234567890')
      expect(rowsBuilder.orWhere).toHaveBeenCalledWith('retentionData.frn', 1234567890)
    })

    test('should filter non-numeric frnAgreement by agreementNumber only', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?frnAgreement=AG12345'
      })

      expect(res.statusCode).toBe(200)

      expect(countBuilder.where).not.toHaveBeenCalled()
      expect(rowsBuilder.where).toHaveBeenCalledWith('retentionData.agreementNumber', 'AG12345')
      expect(rowsBuilder.orWhere).not.toHaveBeenCalled()
    })

    test('should filter by schemeId', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?schemeId=1'
      })

      expect(res.statusCode).toBe(200)

      expect(countBuilder.where).not.toHaveBeenCalled()
      expect(rowsBuilder.where).toHaveBeenCalledTimes(1)
      expect(rowsBuilder.where).toHaveBeenCalledWith('retentionData.schemeId', 1)
    })

    test('should filter by frnAgreement and schemeId together', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?frnAgreement=1234567890&schemeId=1'
      })

      expect(res.statusCode).toBe(200)

      expect(countBuilder.where).not.toHaveBeenCalled()
      expect(rowsBuilder.where).toHaveBeenCalledWith(expect.any(Function))
      expect(rowsBuilder.where).toHaveBeenCalledWith('retentionData.agreementNumber', '1234567890')
      expect(rowsBuilder.orWhere).toHaveBeenCalledWith('retentionData.frn', 1234567890)
      expect(rowsBuilder.where).toHaveBeenCalledWith('retentionData.schemeId', 1)
    })

    test('should return 500 when the database query fails', async () => {
      rowsBuilder.rejects(new Error('Database error'))

      const res = await server.inject({
        method: 'GET',
        url: '/closure'
      })

      expect(res.statusCode).toBe(500)
    })

    test('should return 400 when page is below minimum', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?page=0'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"page" must be greater than or equal to 1/)
      expect(mockDb.tables.retentionData).not.toHaveBeenCalled()
    })

    test('should return 400 when pageSize is below minimum', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?pageSize=0'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"pageSize" must be greater than or equal to 1/)
      expect(mockDb.tables.retentionData).not.toHaveBeenCalled()
    })

    test('should return 400 when schemeId is not a number', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?schemeId=not-a-number'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"schemeId" must be a number/)
      expect(mockDb.tables.retentionData).not.toHaveBeenCalled()
    })
  })

  describe('POST /closure/add', () => {
    const validPayload = {
      frn: 1234567890,
      agreementNumber: 'AG12345',
      schemeId: 1,
      endDate: '2025-12-31',
      addedBy: 'tester'
    }

    test('should successfully create closure and return 200', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/closure/add',
        payload: validPayload
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toBe('ok')

      expect(mockDb.tables.retentionData).toHaveBeenCalledWith()
      expect(mockDb.builder.insert).toHaveBeenCalledTimes(1)
      expect(mockDb.builder.insert).toHaveBeenCalledWith({
        frn: validPayload.frn,
        agreementNumber: validPayload.agreementNumber,
        schemeId: validPayload.schemeId,
        endDate: new Date(validPayload.endDate),
        addedBy: validPayload.addedBy,
        addedTime: expect.any(Date)
      })
    })

    test('should create closure when the scheme has no configured minimum date', async () => {
      const payload = { ...validPayload, schemeId: schemeIds.FC }
      const res = await server.inject({
        method: 'POST',
        url: '/closure/add',
        payload
      })

      expect(res.statusCode).toBe(200)
      expect(mockDb.builder.insert).toHaveBeenCalledWith(expect.objectContaining({
        schemeId: schemeIds.FC,
        endDate: new Date(payload.endDate)
      }))
    })

    test('should return 500 when the insert fails', async () => {
      mockDb.builder.rejects(new Error('Database error'))

      const res = await server.inject({
        method: 'POST',
        url: '/closure/add',
        payload: validPayload
      })

      expect(res.statusCode).toBe(500)
    })

    test('should fail validation and return 400 when payload is invalid', async () => {
      const invalidPayload = {
        frn: 'not-a-number',
        agreementNumber: '',
        schemeId: 'wrong-type',
        endDate: 'invalid-date',
        addedBy: ''
      }

      const res = await server.inject({
        method: 'POST',
        url: '/closure/add',
        payload: invalidPayload
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"frn" must be a number/)
      expect(mockDb.builder.insert).not.toHaveBeenCalled()
    })
  })

  describe('POST /closure/bulk', () => {
    const { batchInsert } = mockDb.knex
    const postBulk = (data, addedBy = 'bulk-tester') => server.inject({
      method: 'POST',
      url: '/closure/bulk',
      payload: { data, addedBy }
    })

    beforeEach(() => {
      batchInsert.mockReset()
      batchInsert.mockResolvedValue([])
      getSchemeIdFromSourceSystem.mockReset()
    })

    test('should transform the closures and batch insert them into retentionData', async () => {
      getSchemeIdFromSourceSystem.mockImplementation((sourceSystem) => {
        if (sourceSystem === 'SYS1') {
          return schemeIds.SFI
        }
        if (sourceSystem === 'SYS2') {
          return schemeIds.BPS
        }
        return null
      })

      const res = await postBulk([
        { frn: 1234567890, agreementNumber: 'AG12345', sourceSystem: 'SYS1', closureDate: '2024-11-30' },
        { frn: 9876543210, agreementNumber: 'AG67890', sourceSystem: 'SYS2', closureDate: '2025-01-15' }
      ])

      expect(res.statusCode).toBe(200)
      expect(res.result).toBe('ok')
      expect(getSchemeIdFromSourceSystem).toHaveBeenNthCalledWith(1, 'SYS1')
      expect(getSchemeIdFromSourceSystem).toHaveBeenNthCalledWith(2, 'SYS2')
      expect(batchInsert).toHaveBeenCalledTimes(1)
      expect(batchInsert).toHaveBeenCalledWith('retentionData', [
        {
          frn: 1234567890,
          agreementNumber: 'AG12345',
          schemeId: schemeIds.SFI,
          endDate: '2024-11-30',
          addedBy: 'bulk-tester',
          addedTime: expect.any(Date)
        },
        {
          frn: 9876543210,
          agreementNumber: 'AG67890',
          schemeId: schemeIds.BPS,
          endDate: '2025-01-15',
          addedBy: 'bulk-tester',
          addedTime: expect.any(Date)
        }
      ])
      expect(mockDb.tables.retentionData).not.toHaveBeenCalled()
    })

    test.each([
      ['an invalid FRN', { frn: 123456789, closureDate: '2024-11-30' }, 'Row 1: FRN must be exactly 10 digits'],
      ['an end date before the scheme minimum', { frn: 1234567890, closureDate: '2021-12-31' }, 'Row 1: End date 2021-12-31 is earlier than the minimum date 2022-01-01'],
      ['an invalid end date', { frn: 1234567890, closureDate: 'not-a-date' }, 'Row 1: End date is invalid']
    ])('should reject %s without writing to the database', async (_description, row, message) => {
      getSchemeIdFromSourceSystem.mockReturnValue(schemeIds.SFI)

      const res = await postBulk([{ agreementNumber: 'AG12345', sourceSystem: 'SYS1', ...row }])

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toBe(message)
      expect(batchInsert).not.toHaveBeenCalled()
    })

    test('should report the row number of the first invalid row', async () => {
      getSchemeIdFromSourceSystem.mockReturnValue(schemeIds.SFI)

      const res = await postBulk([
        { frn: 1234567890, agreementNumber: 'AG1', sourceSystem: 'SYS1', closureDate: '2024-11-30' },
        { frn: 123, agreementNumber: 'AG2', sourceSystem: 'SYS1', closureDate: '2024-11-30' }
      ])

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toBe('Row 2: FRN must be exactly 10 digits')
    })

    test('should accept a payload larger than 1MB and pass every row to a single batch insert', async () => {
      const rowCount = 11000
      const data = Array.from({ length: rowCount }, (_, i) => ({
        frn: 1000000000 + i,
        agreementNumber: `IMPS-AGREEMENT-NUMBER-${String(i).padStart(10, '0')}`,
        sourceSystem: 'SYS1',
        closureDate: '2024-11-30'
      }))
      expect(Buffer.byteLength(JSON.stringify({ data, addedBy: 'bulk-tester' }))).toBeGreaterThan(1024 * 1024)
      getSchemeIdFromSourceSystem.mockReturnValue(schemeIds.SFI)

      const res = await postBulk(data)

      expect(res.statusCode).toBe(200)
      expect(batchInsert).toHaveBeenCalledTimes(1)
      const [table, rows] = batchInsert.mock.calls[0]
      expect(table).toBe('retentionData')
      expect(rows).toHaveLength(rowCount)
      expect(rows[rowCount - 1].frn).toBe(1000000000 + rowCount - 1)
    })

    test('should return 400 without writing to the database when the upload contains duplicate rows', async () => {
      getSchemeIdFromSourceSystem.mockReturnValue(schemeIds.SFI)

      const res = await postBulk([
        { frn: 1234567890, agreementNumber: 'AG12345', sourceSystem: 'SYS1', closureDate: '2024-11-30' },
        { frn: 1234567890, agreementNumber: 'AG12345', sourceSystem: 'SYS1', closureDate: '2024-12-31' }
      ])

      expect(res.statusCode).toBe(400)
      expect(res.result).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The uploaded file contains duplicate records.'
      })
      expect(batchInsert).not.toHaveBeenCalled()
    })

    test('should return 400 when a closure already exists in the database (unique constraint violation)', async () => {
      getSchemeIdFromSourceSystem.mockReturnValue(schemeIds.SFI)
      batchInsert.mockRejectedValue(Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }))

      const res = await postBulk([
        { frn: 1234567890, agreementNumber: 'AG12345', sourceSystem: 'SYS1', closureDate: '2024-11-30' }
      ])

      expect(res.statusCode).toBe(400)
      expect(res.result).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'One or more of the supplied closure records already exist.'
      })
    })

    test('should return 500 for any other database error', async () => {
      getSchemeIdFromSourceSystem.mockReturnValue(schemeIds.SFI)
      batchInsert.mockRejectedValue(Object.assign(new Error('value too long for type character varying(50)'), { code: '22001' }))

      const res = await postBulk([
        { frn: 1234567890, agreementNumber: 'AG12345', sourceSystem: 'SYS1', closureDate: '2024-11-30' }
      ])

      expect(res.statusCode).toBe(500)
    })

    test('should return 200 without writing to the database for an empty upload', async () => {
      const res = await postBulk([], 'tester')

      expect(res.statusCode).toBe(200)
      expect(res.result).toBe('ok')
      expect(batchInsert).not.toHaveBeenCalled()
    })
  })

  describe('POST /closure/remove', () => {
    beforeEach(() => {
      mockDb.builder.resolves(1)
    })

    test('should successfully remove closure and return 200', async () => {
      const payload = {
        retentionDataId: 123
      }

      const res = await server.inject({
        method: 'POST',
        url: '/closure/remove',
        payload
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toBe('ok')

      expect(mockDb.tables.retentionData).toHaveBeenCalledWith()
      expect(mockDb.builder.where).toHaveBeenCalledWith({
        retentionDataId: payload.retentionDataId
      })
      expect(mockDb.builder.del).toHaveBeenCalledTimes(1)
    })

    test('should fail validation and return 400 when retentionDataId is missing', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/closure/remove',
        payload: {}
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"retentionDataId" is required/)
      expect(mockDb.builder.del).not.toHaveBeenCalled()
    })

    test('should fail validation and return 400 when retentionDataId is not a number', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/closure/remove',
        payload: {
          retentionDataId: 'not-a-number'
        }
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"retentionDataId" must be a number/)
      expect(mockDb.builder.del).not.toHaveBeenCalled()
    })
  })

  describe('GET /closure/extract', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    test('should create extract and return filename', async () => {
      createRetentionDataExtract.mockResolvedValue(
        'fcp-pds-data-retention-extract-20260722101112123.csv'
      )

      const res = await server.inject({
        method: 'GET',
        url: '/closure/extract'
      })

      expect(res.statusCode).toBe(200)

      expect(res.result).toEqual({
        filename: 'fcp-pds-data-retention-extract-20260722101112123.csv'
      })

      expect(createRetentionDataExtract).toHaveBeenCalledTimes(1)
    })

    test('should return 500 if extract creation fails', async () => {
      createRetentionDataExtract.mockRejectedValue(
        new Error('Failed to create extract')
      )

      const res = await server.inject({
        method: 'GET',
        url: '/closure/extract'
      })

      expect(res.statusCode).toBe(500)

      expect(createRetentionDataExtract).toHaveBeenCalledTimes(1)
    })
  })

  describe('GET /closure/exists', () => {
    test('should return exists true when matching closure is found', async () => {
      mockDb.builder.resolves({
        retentionDataId: 123
      })

      const res = await server.inject({
        method: 'GET',
        url: '/closure/exists?frn=1234567890&agreementNumber=AG12345&schemeId=1'
      })

      expect(res.statusCode).toBe(200)

      expect(res.result).toEqual({
        exists: true
      })

      expect(mockDb.tables.retentionData).toHaveBeenCalledWith()
      expect(mockDb.builder.select).toHaveBeenCalledWith('retentionDataId')
      expect(mockDb.builder.where).toHaveBeenCalledWith({
        frn: 1234567890,
        agreementNumber: 'AG12345',
        schemeId: 1
      })
      expect(mockDb.builder.first).toHaveBeenCalledTimes(1)
    })

    test('should return exists false when matching closure is not found', async () => {
      mockDb.builder.resolves(undefined)

      const res = await server.inject({
        method: 'GET',
        url: '/closure/exists?frn=1234567890&agreementNumber=AG12345&schemeId=1'
      })

      expect(res.statusCode).toBe(200)

      expect(res.result).toEqual({
        exists: false
      })
    })

    test('should return 400 when frn is missing', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure/exists?agreementNumber=AG12345&schemeId=1'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"frn" is required/)
    })

    test('should return 400 when agreementNumber is missing', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure/exists?frn=1234567890&schemeId=1'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"agreementNumber" is required/)
    })

    test('should return 400 when schemeId is missing', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure/exists?frn=1234567890&agreementNumber=AG12345'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"schemeId" is required/)
    })

    test('should return 400 when frn is not numeric', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure/exists?frn=abc&agreementNumber=AG12345&schemeId=1'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"frn" must be a number/)
    })

    test('should return 400 when schemeId is not numeric', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure/exists?frn=1234567890&agreementNumber=AG12345&schemeId=abc'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"schemeId" must be a number/)
    })
  })
})
