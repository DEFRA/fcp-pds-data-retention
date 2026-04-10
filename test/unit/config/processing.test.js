describe('processing config', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  test('uses default values when env vars not set', () => {
    const config = require('../../../app/config/processing')

    expect(config.processingActive).toBe(true)
    expect(config.pollingInterval).toBe(3600000)
    expect(config.publishingInterval).toBe(3600000)
  })

  test('uses environment variables when provided', () => {
    process.env.PROCESSING_ACTIVE = 'false'
    process.env.POLLING_INTERVAL = '1000'
    process.env.PUBLISHING_INTERVAL = '2000'

    const config = require('../../../app/config/processing')

    expect(config.processingActive).toBe(false)
    expect(config.pollingInterval).toBe(1000)
    expect(config.publishingInterval).toBe(2000)
  })

  test('throws error when pollingInterval is invalid', () => {
    process.env.POLLING_INTERVAL = 'not-a-number'

    expect(() => {
      require('../../../app/config/processing')
    }).toThrow('The processing config is invalid')
  })

  test('throws error when publishingInterval is invalid', () => {
    process.env.PUBLISHING_INTERVAL = 'abc'

    expect(() => {
      require('../../../app/config/processing')
    }).toThrow('The processing config is invalid')
  })
})