const joi = require('joi')
const boom = require('@hapi/boom')
const db = require('../../data')
const { getSchemeIdFromSourceSystem } = require('../../helpers/get-scheme-id-from-source-system')

module.exports = [
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
        return h.response('ok').code(200)
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

        return h.response('ok').code(200)
      }
    }
  }
]
