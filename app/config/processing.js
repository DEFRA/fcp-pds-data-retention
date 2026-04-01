const Joi = require('joi')

const schema = Joi.object({
  processingActive: Joi.boolean().default(true),
  pollingInterval: Joi.number().default(3600000) // 60 minutes
})

const config = {
  processingActive: process.env.PROCESSING_ACTIVE,
  pollingInterval: process.env.POLLING_INTERVAL
}

const result = schema.validate(config, {
  abortEarly: false
})

if (result.error) {
  throw new Error(`The processing config is invalid. ${result.error.message}`)
}

module.exports = result.value
