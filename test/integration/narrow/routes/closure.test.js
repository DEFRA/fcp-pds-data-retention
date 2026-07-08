const Hapi = require('@hapi/hapi')
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
})
