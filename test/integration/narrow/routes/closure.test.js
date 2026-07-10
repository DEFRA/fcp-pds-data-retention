const Hapi = require('@hapi/hapi')
const { Op } = require('sequelize')
const routes = require('../../../../app/server/routes/closure')
const db = require('../../../../app/data')
const { getSchemeIdFromSourceSystem } = require('../../../../app/helpers/get-scheme-id-from-source-system')

jest.mock('../../../../app/data')
jest.mock('../../../../app/helpers/get-scheme-id-from-source-system')

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
        col: jest.fn().mockImplementation((column) => column)
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
        offset: 0
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

      expect(db.retentionData.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            [Op.or]: [
              { agreementNumber: '1234567890' },
              { frn: 1234567890 }
            ]
          }
        })
      )

      const queryArg = db.retentionData.findAndCountAll.mock.calls[0][0]
      expect(queryArg).not.toHaveProperty('limit')
      expect(queryArg).not.toHaveProperty('offset')
    })

    test('should filter non-numeric frnAgreement by agreementNumber only', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?frnAgreement=AG12345'
      })

      expect(res.statusCode).toBe(200)

      expect(db.retentionData.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            [Op.or]: [
              { agreementNumber: 'AG12345' }
            ]
          }
        })
      )

      const queryArg = db.retentionData.findAndCountAll.mock.calls[0][0]
      expect(queryArg).not.toHaveProperty('limit')
      expect(queryArg).not.toHaveProperty('offset')
    })

    test('should filter by schemeId', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/closure?schemeId=2'
      })

      expect(res.statusCode).toBe(200)

      expect(db.retentionData.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            schemeId: 2
          }
        })
      )

      const queryArg = db.retentionData.findAndCountAll.mock.calls[0][0]
      expect(queryArg).not.toHaveProperty('limit')
      expect(queryArg).not.toHaveProperty('offset')
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
            [Op.or]: [
              { agreementNumber: '1234567890' },
              { frn: 1234567890 }
            ],
            schemeId: 1
          }
        })
      )

      const queryArg = db.retentionData.findAndCountAll.mock.calls[0][0]
      expect(queryArg).not.toHaveProperty('limit')
      expect(queryArg).not.toHaveProperty('offset')
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

    test('should successfully upsert closure and return 200', async () => {
      db.retentionData = { upsert: jest.fn().mockResolvedValue() }

      const res = await server.inject({
        method: 'POST',
        url: '/closure/add',
        payload: validPayload
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toBe('ok')
      expect(db.retentionData.upsert).toHaveBeenCalledTimes(1)
      expect(db.retentionData.upsert).toHaveBeenCalledWith(
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
      db.retentionData = { upsert: jest.fn().mockResolvedValue() }
      getSchemeIdFromSourceSystem.mockReset()
    })

    test('should process bulk closures, transform data, upsert and return 200', async () => {
      const inputData = [
        {
          sourceSystem: 'SYS1',
          closureDate: '2024-11-30',
          someOtherField: 'value1'
        },
        {
          sourceSystem: 'SYS2',
          closureDate: '2025-01-15',
          someOtherField: 'value2'
        }
      ]
      const addedBy = 'bulk-tester'

      // Mock getSchemeIdFromSourceSystem to return dummy schemeIds
      getSchemeIdFromSourceSystem.mockImplementation((sourceSystem) => {
        if (sourceSystem === 'SYS1') return 10
        if (sourceSystem === 'SYS2') return 20
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

      expect(getSchemeIdFromSourceSystem).toHaveBeenCalledTimes(inputData.length)
      expect(getSchemeIdFromSourceSystem).toHaveBeenNthCalledWith(1, 'SYS1')
      expect(getSchemeIdFromSourceSystem).toHaveBeenNthCalledWith(2, 'SYS2')

      // Validate transformed data passed to upsert
      expect(db.retentionData.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = db.retentionData.upsert.mock.calls[0][0]
      expect(Array.isArray(upsertArg)).toBe(true)
      expect(upsertArg).toHaveLength(inputData.length)

      upsertArg.forEach((closure, index) => {
        expect(closure).toHaveProperty('schemeId', getSchemeIdFromSourceSystem(inputData[index].sourceSystem))
        expect(closure).not.toHaveProperty('sourceSystem')
        expect(closure).toHaveProperty('endDate', inputData[index].closureDate)
        expect(closure).not.toHaveProperty('closureDate')
        expect(closure).toHaveProperty('addedBy', addedBy)
        expect(closure).toHaveProperty('addedTime')
        expect(typeof closure.addedTime).toBe('number')
        expect(closure.someOtherField).toBe(inputData[index].someOtherField)
      })
    })

    test('should handle empty data array and still call upsert', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/closure/bulk',
        payload: {
          data: [],
          addedBy: 'tester'
        }
      })

      expect(res.statusCode).toBe(200)
      expect(db.retentionData.upsert).toHaveBeenCalledWith([])
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
})
