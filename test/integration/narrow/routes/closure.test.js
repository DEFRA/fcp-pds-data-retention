const Hapi = require('@hapi/hapi')
const { createKnexMock, createQueryBuilder } = require('../../../helpers/mock-knex')

const mockDb = createKnexMock(['retentionData'])

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
        { schemeName: 'scheme.name' }
      )
      expect(rowsBuilder.leftJoin).toHaveBeenCalledWith({ scheme: 'schemes' }, 'retentionData.schemeId', 'scheme.schemeId')
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

      for (const builder of [countBuilder, rowsBuilder]) {
        expect(builder.where).toHaveBeenCalledWith('retentionData.agreementNumber', '1234567890')
        expect(builder.orWhere).toHaveBeenCalledWith('retentionData.frn', 1234567890)
      }
    })

    test('should filter non-numeric frnAgreement by agreementNumber only', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?frnAgreement=AG12345'
      })

      expect(res.statusCode).toBe(200)

      for (const builder of [countBuilder, rowsBuilder]) {
        expect(builder.where).toHaveBeenCalledWith('retentionData.agreementNumber', 'AG12345')
        expect(builder.orWhere).not.toHaveBeenCalled()
      }
    })

    test('should filter by schemeId', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?schemeId=1'
      })

      expect(res.statusCode).toBe(200)

      for (const builder of [countBuilder, rowsBuilder]) {
        expect(builder.where).toHaveBeenCalledTimes(1)
        expect(builder.where).toHaveBeenCalledWith('retentionData.schemeId', 1)
      }
    })

    test('should filter by frnAgreement and schemeId together', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?frnAgreement=1234567890&schemeId=1'
      })

      expect(res.statusCode).toBe(200)

      for (const builder of [countBuilder, rowsBuilder]) {
        expect(builder.where).toHaveBeenCalledWith(expect.any(Function))
        expect(builder.where).toHaveBeenCalledWith('retentionData.agreementNumber', '1234567890')
        expect(builder.orWhere).toHaveBeenCalledWith('retentionData.frn', 1234567890)
        expect(builder.where).toHaveBeenCalledWith('retentionData.schemeId', 1)
      }
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
    let existingBuilder
    let insertBuilder

    beforeEach(() => {
      existingBuilder = createQueryBuilder().resolves([])
      insertBuilder = createQueryBuilder().resolves()
      mockDb.tables.retentionData
        .mockReturnValueOnce(existingBuilder)
        .mockReturnValueOnce(insertBuilder)

      getSchemeIdFromSourceSystem.mockReset()
    })

    test('should process bulk closures, transform data, bulk create records and return 200', async () => {
      const inputData = [
        {
          frn: 1234567890,
          agreementNumber: 'AG12345',
          sourceSystem: 'SYS1',
          closureDate: '2024-11-30'
        },
        {
          frn: 9876543210,
          agreementNumber: 'AG67890',
          sourceSystem: 'SYS2',
          closureDate: '2025-01-15'
        }
      ]

      const addedBy = 'bulk-tester'

      getSchemeIdFromSourceSystem.mockImplementation((sourceSystem) => {
        if (sourceSystem === 'SYS1') {
          return 10
        }
        if (sourceSystem === 'SYS2') {
          return 20
        }
        return null
      })

      const res = await server.inject({
        method: 'POST',
        url: '/closure/bulk',
        payload: {
          data: inputData,
          addedBy
        }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toBe('ok')

      expect(getSchemeIdFromSourceSystem).toHaveBeenCalledTimes(2)
      expect(getSchemeIdFromSourceSystem).toHaveBeenNthCalledWith(1, 'SYS1')
      expect(getSchemeIdFromSourceSystem).toHaveBeenNthCalledWith(2, 'SYS2')

      expect(mockDb.tables.retentionData).toHaveBeenCalledTimes(2)

      expect(existingBuilder.select).toHaveBeenCalledWith(
        'frn',
        'agreementNumber',
        'schemeId'
      )
      expect(existingBuilder.where).toHaveBeenCalledWith(expect.any(Function))
      expect(existingBuilder.orWhere).toHaveBeenCalledTimes(2)
      expect(existingBuilder.orWhere).toHaveBeenNthCalledWith(1, {
        frn: 1234567890,
        agreementNumber: 'AG12345',
        schemeId: 10
      })
      expect(existingBuilder.orWhere).toHaveBeenNthCalledWith(2, {
        frn: 9876543210,
        agreementNumber: 'AG67890',
        schemeId: 20
      })

      expect(insertBuilder.insert).toHaveBeenCalledTimes(1)
      expect(insertBuilder.insert).toHaveBeenCalledWith([
        {
          frn: 1234567890,
          agreementNumber: 'AG12345',
          schemeId: 10,
          endDate: '2024-11-30',
          addedBy,
          addedTime: expect.any(Date)
        },
        {
          frn: 9876543210,
          agreementNumber: 'AG67890',
          schemeId: 20,
          endDate: '2025-01-15',
          addedBy,
          addedTime: expect.any(Date)
        }
      ])

      const createdClosures = insertBuilder.insert.mock.calls[0][0]

      expect(createdClosures[0]).not.toHaveProperty('row')
      expect(createdClosures[0]).not.toHaveProperty('sourceSystem')
      expect(createdClosures[0]).not.toHaveProperty('closureDate')

      expect(createdClosures[1]).not.toHaveProperty('row')
      expect(createdClosures[1]).not.toHaveProperty('sourceSystem')
      expect(createdClosures[1]).not.toHaveProperty('closureDate')
    })

    test('should return 400 and not check database or bulk create when duplicate rows exist in upload', async () => {
      const inputData = [
        {
          frn: 1234567890,
          agreementNumber: 'AG12345',
          sourceSystem: 'SYS1',
          closureDate: '2024-11-30'
        },
        {
          frn: 1234567890,
          agreementNumber: 'AG12345',
          sourceSystem: 'SYS1',
          closureDate: '2024-12-31'
        }
      ]

      getSchemeIdFromSourceSystem.mockReturnValue(10)

      const res = await server.inject({
        method: 'POST',
        url: '/closure/bulk',
        payload: {
          data: inputData,
          addedBy: 'bulk-tester'
        }
      })

      expect(res.statusCode).toBe(400)
      expect(res.result).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'The uploaded file contains duplicate records.'
      })

      expect(mockDb.tables.retentionData).not.toHaveBeenCalled()
      expect(existingBuilder.select).not.toHaveBeenCalled()
      expect(insertBuilder.insert).not.toHaveBeenCalled()
    })

    test('should return 400 and not bulk create records when matching closures already exist in database', async () => {
      const inputData = [
        {
          frn: 1234567890,
          agreementNumber: 'AG12345',
          sourceSystem: 'SYS1',
          closureDate: '2024-11-30'
        },
        {
          frn: 9876543210,
          agreementNumber: 'AG67890',
          sourceSystem: 'SYS2',
          closureDate: '2025-01-15'
        }
      ]

      getSchemeIdFromSourceSystem.mockImplementation((sourceSystem) => {
        if (sourceSystem === 'SYS1') {
          return 10
        }
        if (sourceSystem === 'SYS2') {
          return 20
        }
        return null
      })

      existingBuilder.resolves([
        {
          frn: 9876543210,
          agreementNumber: 'AG67890',
          schemeId: 20
        }
      ])

      const res = await server.inject({
        method: 'POST',
        url: '/closure/bulk',
        payload: {
          data: inputData,
          addedBy: 'bulk-tester'
        }
      })

      expect(res.statusCode).toBe(400)
      expect(res.result).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'One or more of the supplied closure records already exist.'
      })

      expect(mockDb.tables.retentionData).toHaveBeenCalledTimes(1)
      expect(existingBuilder.select).toHaveBeenCalledTimes(1)
      expect(insertBuilder.insert).not.toHaveBeenCalled()
    })

    test('should return 400 when more than one existing closure is found in database', async () => {
      const inputData = [
        {
          frn: 1111111111,
          agreementNumber: 'AG111',
          sourceSystem: 'SYS1',
          closureDate: '2024-11-30'
        },
        {
          frn: 2222222222,
          agreementNumber: 'AG222',
          sourceSystem: 'SYS2',
          closureDate: '2025-01-15'
        },
        {
          frn: 3333333333,
          agreementNumber: 'AG333',
          sourceSystem: 'SYS3',
          closureDate: '2025-02-01'
        }
      ]

      getSchemeIdFromSourceSystem.mockImplementation((sourceSystem) => {
        if (sourceSystem === 'SYS1') {
          return 10
        }
        if (sourceSystem === 'SYS2') {
          return 20
        }
        if (sourceSystem === 'SYS3') {
          return 30
        }
        return null
      })

      existingBuilder.resolves([
        {
          frn: 1111111111,
          agreementNumber: 'AG111',
          schemeId: 10
        },
        {
          frn: 3333333333,
          agreementNumber: 'AG333',
          schemeId: 30
        }
      ])

      const res = await server.inject({
        method: 'POST',
        url: '/closure/bulk',
        payload: {
          data: inputData,
          addedBy: 'bulk-tester'
        }
      })

      expect(res.statusCode).toBe(400)
      expect(res.result).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'One or more of the supplied closure records already exist.'
      })

      expect(mockDb.tables.retentionData).toHaveBeenCalledTimes(1)
      expect(existingBuilder.select).toHaveBeenCalledTimes(1)
      expect(insertBuilder.insert).not.toHaveBeenCalled()
    })

    test('should handle empty data array and not call findAll or bulkCreate', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/closure/bulk',
        payload: {
          data: [],
          addedBy: 'tester'
        }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toBe('ok')

      expect(mockDb.tables.retentionData).not.toHaveBeenCalled()
      expect(existingBuilder.select).not.toHaveBeenCalled()
      expect(insertBuilder.insert).not.toHaveBeenCalled()
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
