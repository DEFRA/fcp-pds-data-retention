describe('server config', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  test('uses default test configuration values', () => {
    const config = require('../../../app/config/server')

    expect(config.get('env')).toBe('test')
    expect(config.get('host')).toBe('0.0.0.0')
    expect(config.get('port')).toBe(3000)
    expect(config.get('isDev')).toBe(false)
  })

  test('reads environment variables', () => {
    process.env.NODE_ENV = 'production'
    process.env.HOST = '127.0.0.1'
    process.env.PORT = '8080'

    const config = require('../../../app/config/server')

    expect(config.get('env')).toBe('production')
    expect(config.get('host')).toBe('127.0.0.1')
    expect(config.get('port')).toBe(8080)
    expect(config.get('isDev')).toBe(false)
  })

  test('throws error for invalid host format', () => {
    process.env.HOST = 'invalid-host'

    expect(() => {
      require('../../../app/config/server')
    }).toThrow()
  })

  test('throws error for invalid port', () => {
    process.env.PORT = 'not-a-port'

    expect(() => {
      require('../../../app/config/server')
    }).toThrow()
  })

  test('accepts test environment', () => {
    process.env.NODE_ENV = 'test'

    const config = require('../../../app/config/server')

    expect(config.get('env')).toBe('test')
  })
})
