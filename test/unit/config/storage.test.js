describe('blob storage config', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  test('loads valid configuration with defaults', () => {
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'storage-account'

    const config = require('../../../app/config/storage')

    expect(config.storageAccount).toBe('storage-account')
    expect(config.container).toBe('dwh')
    expect(config.inboundFolder).toBe('data_retention')
    expect(config.archiveFolder).toBe('archive')
    expect(config.quarantineFolder).toBe('quarantine')
    expect(config.useConnectionStr).toBe(true)
    expect(config.createContainers).toBe(true)
  })

  test('uses connection string when enabled', () => {
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'storage-account'
    process.env.AZURE_STORAGE_USE_CONNECTION_STRING = 'true'
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'test-connection'

    const config = require('../../../app/config/storage')

    expect(config.useConnectionStr).toBe(true)
    expect(config.connectionStr).toBe('test-connection')
  })

  test('includes managed identity client id when provided', () => {
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'storage-account'
    process.env.AZURE_CLIENT_ID = 'client-id'

    const config = require('../../../app/config/storage')

    expect(config.managedIdentityClientId).toBe('client-id')
  })
})