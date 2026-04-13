const Joi = require('joi')

const mqSchema = Joi.object({
  messageQueue: {
    host: Joi.string().default('localhost'),
    useCredentialChain: Joi.bool().default(false),
    type: Joi.string(),
    appInsights: Joi.object(),
    username: Joi.string(),
    password: Joi.string(),
    managedIdentityClientId: Joi.string().optional()
  },
  retentionTopic: {
    address: Joi.string()
  }
})
const mqConfig = {
  messageQueue: {
    host: process.env.MESSAGE_QUEUE_HOST,
    useCredentialChain: process.env.NODE_ENV === 'production',
    type: 'Topic',
    appInsights: process.env.NODE_ENV === 'production' ? require('applicationinsights') : undefined,
    username: process.env.MESSAGE_QUEUE_USER,
    password: process.env.MESSAGE_QUEUE_PASSWORD,
    managedIdentityClientId: process.env.AZURE_CLIENT_ID
  },
  retentionTopic: {
    address: process.env.RETENTION_TOPIC_ADDRESS
  }
}

const mqResult = mqSchema.validate(mqConfig, {
  abortEarly: false
})

if (mqResult.error) {
  throw new Error(`The message queue config is invalid. ${mqResult.error.message}`)
}

const retentionTopic = { ...mqResult.value.messageQueue, ...mqResult.value.retentionTopic }

module.exports = {
  retentionTopic
}
