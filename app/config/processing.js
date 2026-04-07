const Joi = require('joi')

const sixtyMinutes = 3600000

const schema = Joi.object({
  processingActive: Joi.boolean().default(true),
  pollingInterval: Joi.number().default(sixtyMinutes),
  publishingInterval: Joi.number().default(sixtyMinutes)
})

const config = {
  processingActive: process.env.PROCESSING_ACTIVE,
  pollingInterval: process.env.POLLING_INTERVAL,
  publishingInterval: process.env.PUBLISHING_INTERVAL
}

const result = schema.validate(config, {
  abortEarly: false
})

if (result.error) {
  throw new Error(`The processing config is invalid. ${result.error.message}`)
}

module.exports = result.value
