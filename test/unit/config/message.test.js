describe('message config', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  test('creates eventsTopic config in non-production', () => {
    process.env.NODE_ENV = 'development'
    process.env.MESSAGE_QUEUE_HOST = 'mq-host'
    process.env.MESSAGE_QUEUE_USER = 'user'
    process.env.MESSAGE_QUEUE_PASSWORD = 'pass'
    process.env.EVENTS_TOPIC_ADDRESS = 'events-topic'

    const config = require('../../../app/config/message')

    expect(config.eventsTopic.host).toBe('mq-host')
    expect(config.eventsTopic.username).toBe('user')
    expect(config.eventsTopic.password).toBe('pass')
    expect(config.eventsTopic.address).toBe('events-topic')
    expect(config.eventsTopic.useCredentialChain).toBe(false)
  })

  test('enables credential chain in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.MESSAGE_QUEUE_HOST = 'mq-host'
    process.env.EVENTS_TOPIC_ADDRESS = 'events-topic'
    process.env.AZURE_CLIENT_ID = 'client-id'

    jest.mock('applicationinsights', () => ({}), { virtual: true })

    const config = require('../../../app/config/message')

    expect(config.eventsTopic.useCredentialChain).toBe(true)
    expect(config.eventsTopic.managedIdentityClientId).toBe('client-id')
  })

  test('uses default host if not provided', () => {
    process.env.NODE_ENV = 'development'
    process.env.EVENTS_TOPIC_ADDRESS = 'events-topic'

    const config = require('../../../app/config/message')

    expect(config.eventsTopic.host).toBe('servicebus-emulator')
  })
})