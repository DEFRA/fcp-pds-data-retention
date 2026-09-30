const joi = require('joi')
const boom = require('@hapi/boom')
const { retentionData } = require('../../database')
const TABLES = require('../../constants/tables')
const { getSchemeIdFromSourceSystem } = require('../../helpers/get-scheme-id-from-source-system')
const { createRetentionDataExtract } = require('../../extract/create-retention-data-extract')

const ok = { statusCode: 200, message: 'ok' }
const defaultPage = 1
const minPageSize = 1
const defaultPageSize = 2500

const closureColumns = [
  'retentionData.retentionDataId',
  'retentionData.frn',
  'retentionData.schemeId',
  'retentionData.agreementNumber',
  'retentionData.endDate',
  'retentionData.addedBy',
  'retentionData.addedTime'
]

const applyClosureFilters = (frnAgreement, schemeId) => (query) => {
  if (frnAgreement) {
    query.where(function () {
      this.where('retentionData.agreementNumber', frnAgreement)

      if (/^\d+$/.test(frnAgreement)) {
        this.orWhere('retentionData.frn', Number(frnAgreement))
      }
    })
  }

  if (schemeId) {
    query.where('retentionData.schemeId', schemeId)
  }
}

module.exports = [
  {
    method: 'GET',
    path: '/closure',
    options: {
      validate: {
        query: joi.object({
          page: joi.number().integer().min(defaultPage).default(defaultPage),
          pageSize: joi.number().integer().min(minPageSize).default(defaultPageSize),
          frnAgreement: joi.string().allow('', null).optional(),
          schemeId: joi.number().integer().allow(null).optional()
        }),
        failAction: (_request, _h, error) => boom.badRequest(error)
      },
      handler: async (request, h) => {
        const {
          page,
          pageSize,
          frnAgreement,
          schemeId
        } = request.query

        const filters = applyClosureFilters(frnAgreement, schemeId)

        const [{ count }, closures] = await Promise.all([
          retentionData()
            .count({ count: '*' })
            .modify(filters)
            .first(),
          retentionData()
            .select(...closureColumns, { schemeName: 'scheme.name' })
            .leftJoin({ scheme: TABLES.schemes }, 'retentionData.schemeId', 'scheme.schemeId')
            .modify(filters)
            .orderBy('retentionData.addedTime', 'desc')
            .limit(pageSize)
            .offset((page - 1) * pageSize)
        ])

        return h.response({
          closures,
          count: Number(count)
        })
      }
    }
  },
  {
    method: 'GET',
    path: '/closure/exists',
    options: {
      validate: {
        query: joi.object({
          frn: joi.number().required(),
          agreementNumber: joi.string().required(),
          schemeId: joi.number().required()
        }),
        failAction: (_request, _h, error) => {
          return boom.badRequest(error)
        }
      },
      handler: async (request, h) => {
        const { frn, agreementNumber, schemeId } = request.query

        const closure = (await retentionData()
          .select('retentionDataId')
          .where({
            frn,
            agreementNumber,
            schemeId
          })
          .first()) ?? null

        return h.response({
          exists: !!closure
        }).code(ok.statusCode)
      }
    }
  },
  {
    method: 'POST',
    path: '/closure/add',
    options: {
      validate: {
        payload: joi.object({
          frn: joi.number().required(),
          agreementNumber: joi.string().required(),
          schemeId: joi.number().required(),
          endDate: joi.date().required(),
          addedBy: joi.string().required()
        }),
        failAction: (_request, _h, error) => {
          return boom.badRequest(error)
        }
      },
      handler: async (request, h) => {
        const { frn, agreementNumber, schemeId, endDate, addedBy } = request.payload

        await retentionData().insert({
          frn,
          schemeId,
          agreementNumber,
          endDate,
          addedBy,
          addedTime: new Date()
        })

        return h.response(ok.message).code(ok.statusCode)
      }
    }
  },
  {
    method: 'POST',
    path: '/closure/bulk',
    options: {
      handler: async (request, h) => {
        const { data, addedBy } = request.payload
        const now = new Date()

        const closures = data.map((closure, index) => {
          const schemeId = getSchemeIdFromSourceSystem(closure.sourceSystem)

          return {
            ...closure,
            row: index + 1,
            schemeId,
            endDate: closure.closureDate,
            addedBy,
            addedTime: now
          }
        }).map((closure) => {
          delete closure.sourceSystem
          delete closure.closureDate
          return closure
        })

        const seen = new Set()

        for (const closure of closures) {
          const key = `${closure.frn}|${closure.agreementNumber}|${closure.schemeId}`

          if (seen.has(key)) {
            return boom.badRequest('The uploaded file contains duplicate records.')
          }

          seen.add(key)
        }

        if (!closures.length) {
          return h.response(ok.message).code(ok.statusCode)
        }

        const existingClosures = await retentionData()
          .select(
            'frn',
            'agreementNumber',
            'schemeId'
          )
          .where(function () {
            for (const closure of closures) {
              this.orWhere({
                frn: closure.frn,
                agreementNumber: closure.agreementNumber,
                schemeId: closure.schemeId
              })
            }
          })

        if (existingClosures.length) {
          return boom.badRequest('One or more of the supplied closure records already exist.')
        }

        await retentionData().insert(
          closures.map(closure => ({
            frn: closure.frn,
            schemeId: closure.schemeId,
            agreementNumber: closure.agreementNumber,
            endDate: closure.endDate,
            addedBy: closure.addedBy,
            addedTime: closure.addedTime
          }))
        )

        return h.response(ok.message).code(ok.statusCode)
      }
    }
  },
  {
    method: 'POST',
    path: '/closure/remove',
    options: {
      validate: {
        payload: joi.object({
          retentionDataId: joi.number().integer().required()
        }),
        failAction: (_request, _h, error) => {
          return boom.badRequest(error)
        }
      },
      handler: async (request, h) => {
        await retentionData().where({ retentionDataId: request.payload.retentionDataId }).del()
        return h.response(ok.message).code(ok.statusCode)
      }
    }
  },
  {
    method: 'GET',
    path: '/closure/extract',
    options: {
      handler: async (_request, h) => {
        const filename = await createRetentionDataExtract()
        return h.response({
          filename
        }).code(ok.statusCode)
      }
    }
  }
]
