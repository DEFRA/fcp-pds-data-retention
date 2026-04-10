const database = require('../../../app/config/database')

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn(),
  getBearerTokenProvider: jest.fn()
}))

const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity')

describe('database hooks.beforeConnect', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv }
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('sets password using token provider in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.AZURE_CLIENT_ID = 'test-client-id'

    const mockTokenProvider = jest.fn()
    getBearerTokenProvider.mockReturnValue(mockTokenProvider)

    const cfg = {}

    await database.hooks.beforeConnect(cfg)

    expect(DefaultAzureCredential).toHaveBeenCalledWith({
      managedIdentityClientId: 'test-client-id'
    })

    expect(getBearerTokenProvider).toHaveBeenCalledWith(
      expect.any(Object),
      'https://ossrdbms-aad.database.windows.net/.default'
    )

    expect(cfg.password).toBe(mockTokenProvider)
  })

  test('does nothing when not in production', async () => {
    process.env.NODE_ENV = 'development'

    const cfg = { password: 'existing' }

    await database.hooks.beforeConnect(cfg)

    expect(DefaultAzureCredential).not.toHaveBeenCalled()
    expect(getBearerTokenProvider).not.toHaveBeenCalled()
    expect(cfg.password).toBe('existing')
  })
})