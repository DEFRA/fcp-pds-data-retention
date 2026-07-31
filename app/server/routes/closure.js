const joi = require('joi')
const boom = require('@hapi/boom')
const db = require('../../data')
const { getSchemeIdFromSourceSystem } = require('../../helpers/get-scheme-id-from-source-system')
const { createRetentionDataExtract } = require('../../extract/create-retention-data-extract')

const ok = { statusCode: 200, message: 'ok' }
const defaultPage = 1
const minPageSize = 1
const defaultPageSize = 2500

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

        const where = {}

        if (frnAgreement) {
          const frnAgreementFilters = [
            { agreementNumber: frnAgreement }
          ]

          if (/^\d+$/.test(frnAgreement)) {
            frnAgreementFilters.push({ frn: Number(frnAgreement) })
          }

          where[db.Sequelize.Op.or] = frnAgreementFilters
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
          limit: pageSize,
          offset: (page - 1) * pageSize,
          distinct: true,
          raw: true,
          order: [['addedTime', 'DESC']]
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

        const closure = await db.retentionData.findOne({
          where: {
            frn,
            agreementNumber,
            schemeId
          },
          attributes: ['retentionDataId'],
          raw: true
        })

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

        await db.retentionData.create({
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

        const existingClosures = await db.retentionData.findAll({
          where: {
            [db.Sequelize.Op.or]: closures.map(closure => ({
              frn: closure.frn,
              agreementNumber: closure.agreementNumber,
              schemeId: closure.schemeId
            }))
          },
          attributes: [
            'frn',
            'agreementNumber',
            'schemeId'
          ],
          raw: true
        })

        if (existingClosures.length) {
          return boom.badRequest('One or more of the supplied closure records already exist.')
        }

        await db.retentionData.bulkCreate(
          closures.map(({ row, ...closure }) => closure)
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
        await db.retentionData.destroy({ where: { retentionDataId: request.payload.retentionDataId } })
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
