const joi = require('joi')
const boom = require('@hapi/boom')
const { Op } = require('sequelize')
const db = require('../../data')
const { getSchemeIdFromSourceSystem } = require('../../helpers/get-scheme-id-from-source-system')

const ok = { statusCode: 200, message: 'ok' }

module.exports = [
  {
    method: 'GET',
    path: '/closure',
    options: {
      validate: {
        query: joi.object({
          page: joi.number().integer().min(1).default(1),
          pageSize: joi.number().integer().min(1).default(2500),
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

        const where = {}

        if (frnAgreement) {
          const frnAgreementFilters = [
            { agreementNumber: frnAgreement }
          ]

          if (/^\d+$/.test(frnAgreement)) {
            frnAgreementFilters.push({ frn: Number(frnAgreement) })
          }

          where[Op.or] = frnAgreementFilters
        }

        if (schemeId) {
          where.schemeId = schemeId
        }

        const query = {
          where,
          include: [{
            model: db.scheme,
            as: 'scheme',
            attributes: []
          }],
          attributes: {
            include: [
              [db.Sequelize.col('scheme.name'), 'schemeName']
            ]
          },
          distinct: true,
          raw: true
        }

        if (!frnAgreement && !schemeId) {
          query.limit = pageSize
          query.offset = (page - 1) * pageSize
        }

        const { count, rows: closures } = await db.retentionData.findAndCountAll(query)

        return h.response({
          closures,
          count
        })
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

        await db.retentionData.upsert({
          frn,
          schemeId,
          agreementNumber,
          endDate,
          addedBy,
          addedTime: Date.now()
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
        const now = Date.now()

        for (const closure of data) {
          closure.schemeId = getSchemeIdFromSourceSystem(closure.sourceSystem)
          delete closure.sourceSystem

          closure.endDate = closure.closureDate
          delete closure.closureDate

          closure.addedBy = addedBy
          closure.addedTime = now
        }

        await db.retentionData.upsert(data)

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
        failAction: (request, h, error) => {
          return boom.badRequest(error)
        }
      },
      handler: async (request, h) => {
        await db.retentionData.destroy({ where: { retentionDataId: request.payload.retentionDataId } })
        return h.response('ok').code(200)
      }
    }
  }
]
