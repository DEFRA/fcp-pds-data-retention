const Hapi = require('@hapi/hapi')
const routes = require('../../../../app/server/routes/closure')
const db = require('../../../../app/data')
const { getSchemeIdFromSourceSystem } = require('../../../../app/helpers/get-scheme-id-from-source-system')
const { createRetentionDataExtract } = require('../../../../app/extract/create-retention-data-extract')

jest.mock('../../../../app/data')
jest.mock('../../../../app/helpers/get-scheme-id-from-source-system')
jest.mock('../../../../app/extract/create-retention-data-extract')

jest.mock('../../../../app/storage', () => ({
  uploadStreamToBlob: jest.fn()
}))

describe('Closure API Routes', () => {
  let server

  beforeAll(async () => {
    server = Hapi.server({ port: 0 })
    server.route(routes)
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop()
    jest.resetAllMocks()
  })

  describe('GET /closure', () => {
    beforeEach(() => {
      db.scheme = {}
      db.Sequelize = {
        col: jest.fn().mockImplementation((column) => column),
        Op: {
          or: Symbol('or')
        }
      }
      db.retentionData = {
        findAndCountAll: jest.fn().mockResolvedValue({
          count: 2,
          rows: [
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
        })
      }
    })

    test('should return paginated closures using default page and pageSize', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure'
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({
        closures: [
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
        ],
        count: 2
      })

      expect(db.retentionData.findAndCountAll).toHaveBeenCalledTimes(1)
      expect(db.retentionData.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        include: [{
          model: db.scheme,
          as: 'scheme',
          attributes: []
        }],
        attributes: {
          include: [
            ['scheme.name', 'schemeName']
          ]
        },
        distinct: true,
        raw: true,
        limit: 2500,
        offset: 0,
        order: [['addedTime', 'DESC']]
      })
    })

    test('should apply page and pageSize when provided', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?page=3&pageSize=100'
      })

      expect(res.statusCode).toBe(200)

      expect(db.retentionData.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          offset: 200
        })
      )
    })

    test('should filter by numeric frnAgreement using agreementNumber or frn', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?frnAgreement=1234567890'
      })

      expect(res.statusCode).toBe(200)

      const queryArg = db.retentionData.findAndCountAll.mock.calls[0][0]
      const orKey = Object.getOwnPropertySymbols(queryArg.where)[0]

      expect(queryArg.where[orKey]).toEqual([
        { agreementNumber: '1234567890' },
        { frn: 1234567890 }
      ])
    })

    test('should filter non-numeric frnAgreement by agreementNumber only', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?frnAgreement=AG12345'
      })

      expect(res.statusCode).toBe(200)

      const queryArg = db.retentionData.findAndCountAll.mock.calls[0][0]
      const orKey = Object.getOwnPropertySymbols(queryArg.where)[0]

      expect(queryArg.where[orKey]).toEqual([
        { agreementNumber: 'AG12345' }
      ])
    })

    test('should filter by schemeId', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?schemeId=1'
      })

      expect(res.statusCode).toBe(200)

      const queryArg = db.retentionData.findAndCountAll.mock.calls[0][0]

      expect(queryArg.where.schemeId).toBe(1)
    })

    test('should filter by frnAgreement and schemeId together', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?frnAgreement=1234567890&schemeId=1'
      })

      expect(res.statusCode).toBe(200)

      expect(db.retentionData.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            [db.Sequelize.Op.or]: [
              { agreementNumber: '1234567890' },
              { frn: 1234567890 }
            ],
            schemeId: 1
          }
        })
      )
    })

    test('should return 400 when page is below minimum', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?page=0'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"page" must be greater than or equal to 1/)
      expect(db.retentionData.findAndCountAll).not.toHaveBeenCalled()
    })

    test('should return 400 when pageSize is below minimum', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?pageSize=0'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"pageSize" must be greater than or equal to 1/)
      expect(db.retentionData.findAndCountAll).not.toHaveBeenCalled()
    })

    test('should return 400 when schemeId is not a number', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?schemeId=not-a-number'
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"schemeId" must be a number/)
      expect(db.retentionData.findAndCountAll).not.toHaveBeenCalled()
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
      db.retentionData = { create: jest.fn().mockResolvedValue() }

      const res = await server.inject({
        method: 'POST',
        url: '/closure/add',
        payload: validPayload
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toBe('ok')

      expect(db.retentionData.create).toHaveBeenCalledTimes(1)
      expect(db.retentionData.create).toHaveBeenCalledWith(
        expect.objectContaining({
          frn: validPayload.frn,
          agreementNumber: validPayload.agreementNumber,
          schemeId: validPayload.schemeId,
          endDate: new Date(validPayload.endDate),
          addedBy: validPayload.addedBy,
          addedTime: expect.any(Number)
        })
      )
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
    })
  })

  describe('POST /closure/bulk', () => {
    beforeEach(() => {
      db.Sequelize = {
        Op: {
          or: Symbol('or')
        }
      }

      db.retentionData = {
        findAll: jest.fn().mockResolvedValue([]),
        bulkCreate: jest.fn().mockResolvedValue()
      }

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

      expect(db.retentionData.findAll).toHaveBeenCalledTimes(1)

      const findAllArg = db.retentionData.findAll.mock.calls[0][0]
      const orKey = Object.getOwnPropertySymbols(findAllArg.where)[0]

      expect(findAllArg.where[orKey]).toEqual([
        {
          frn: 1234567890,
          agreementNumber: 'AG12345',
          schemeId: 10
        },
        {
          frn: 9876543210,
          agreementNumber: 'AG67890',
          schemeId: 20
        }
      ])

      expect(findAllArg.attributes).toEqual([
        'frn',
        'agreementNumber',
        'schemeId'
      ])

      expect(findAllArg.raw).toBe(true)

      expect(db.retentionData.bulkCreate).toHaveBeenCalledTimes(1)
      expect(db.retentionData.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          frn: 1234567890,
          agreementNumber: 'AG12345',
          schemeId: 10,
          endDate: '2024-11-30',
          addedBy,
          addedTime: expect.any(Number)
        }),
        expect.objectContaining({
          frn: 9876543210,
          agreementNumber: 'AG67890',
          schemeId: 20,
          endDate: '2025-01-15',
          addedBy,
          addedTime: expect.any(Number)
        })
      ])

      const createdClosures = db.retentionData.bulkCreate.mock.calls[0][0]

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

      expect(db.retentionData.findAll).not.toHaveBeenCalled()
      expect(db.retentionData.bulkCreate).not.toHaveBeenCalled()
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

      db.retentionData.findAll.mockResolvedValue([
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

      expect(db.retentionData.findAll).toHaveBeenCalledTimes(1)
      expect(db.retentionData.bulkCreate).not.toHaveBeenCalled()
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

      db.retentionData.findAll.mockResolvedValue([
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

      expect(db.retentionData.findAll).toHaveBeenCalledTimes(1)
      expect(db.retentionData.bulkCreate).not.toHaveBeenCalled()
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

      expect(db.retentionData.findAll).not.toHaveBeenCalled()
      expect(db.retentionData.bulkCreate).not.toHaveBeenCalled()
    })
  })

  describe('POST /closure/remove', () => {
    beforeEach(() => {
      db.retentionData = {
        destroy: jest.fn().mockResolvedValue(1)
      }
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

      expect(db.retentionData.destroy).toHaveBeenCalledTimes(1)
      expect(db.retentionData.destroy).toHaveBeenCalledWith({
        where: {
          retentionDataId: payload.retentionDataId
        }
      })
    })

    test('should fail validation and return 400 when retentionDataId is missing', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/closure/remove',
        payload: {}
      })

      expect(res.statusCode).toBe(400)
      expect(res.result.message).toMatch(/"retentionDataId" is required/)
      expect(db.retentionData.destroy).not.toHaveBeenCalled()
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
      expect(db.retentionData.destroy).not.toHaveBeenCalled()
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
    beforeEach(() => {
      db.retentionData = {
        findOne: jest.fn()
      }
    })

    test('should return exists true when matching closure is found', async () => {
      db.retentionData.findOne.mockResolvedValue({
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

      expect(db.retentionData.findOne).toHaveBeenCalledWith({
        where: {
          frn: 1234567890,
          agreementNumber: 'AG12345',
          schemeId: 1
        },
        attributes: ['retentionDataId'],
        raw: true
      })
    })

    test('should return exists false when matching closure is not found', async () => {
      db.retentionData.findOne.mockResolvedValue(null)

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
