jest.mock('log-timestamp')
jest.mock('../../app/insights', () => ({
  setup: jest.fn()
}))
jest.mock('../../app/server', () => ({
  start: jest.fn()
}))
jest.mock('../../app/processing', () => ({
  start: jest.fn()
}))
jest.mock('../../app/publishing', () => ({
  start: jest.fn()
}))
jest.mock('../../app/config', () => ({
  processingConfig: {}
}))
const { setup } = require('../../app/insights')
const { start: startServer } = require('../../app/server')
const processing = require('../../app/processing')
const publishing = require('../../app/publishing')
const { processingConfig } = require('../../app/config')

describe('index', () => {
  let mockServer
  let mockProcessingStart
  let mockPublishingStart

  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(process, 'exit').mockImplementation()

    mockServer = {
      start: jest.fn().mockResolvedValue(undefined),
      info: {
        uri: 'http://localhost:3000'
      }
    }

    mockProcessingStart = jest.fn().mockResolvedValue(undefined)
    mockPublishingStart = jest.fn().mockResolvedValue(undefined)

    startServer.mockResolvedValue(mockServer)
    processing.start = mockProcessingStart
    publishing.start = mockPublishingStart
    setup.mockImplementation(() => { })
    processingConfig.processingActive = true
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  test('should start server', async () => {
    const { init } = require('../../app/index')

    await init()

    expect(startServer).toHaveBeenCalledTimes(1)
  })

  test('should start processing', async () => {
    const { init } = require('../../app/index')

    await init()

    expect(mockProcessingStart).toHaveBeenCalledTimes(1)
  })

  test('should start publishing when processingActive is true', async () => {
    processingConfig.processingActive = true
    const { init } = require('../../app/index')

    await init()

    expect(mockPublishingStart).toHaveBeenCalledTimes(1)
  })

  test('should not start publishing when processingActive is false', async () => {
    processingConfig.processingActive = false
    const { init } = require('../../app/index')

    await init()

    expect(mockPublishingStart).not.toHaveBeenCalled()
  })

  test('should log message when publishing is not active', async () => {
    processingConfig.processingActive = false
    const { init } = require('../../app/index')

    await init()

    expect(console.log).toHaveBeenCalledWith(
      'Publishing retention data is not active in this environment'
    )
  })

  test('should start processing before publishing', async () => {
    const { init } = require('../../app/index')
    processingConfig.processingActive = true

    const callOrder = []

    mockProcessingStart.mockImplementation(() => {
      callOrder.push('processing.start')
      return Promise.resolve()
    })

    mockPublishingStart.mockImplementation(() => {
      callOrder.push('publishing.start')
      return Promise.resolve()
    })

    await init()

    expect(callOrder).toEqual(['processing.start', 'publishing.start'])
  })

  test('should handle server creation error', async () => {
    const error = new Error('Server creation failed')
    startServer.mockRejectedValueOnce(error)

    const { init } = require('../../app/index')

    await expect(init()).rejects.toThrow('Server creation failed')
  })

  test('should handle processing start error', async () => {
    const error = new Error('Processing start failed')
    mockProcessingStart.mockRejectedValueOnce(error)

    const { init } = require('../../app/index')

    await expect(init()).rejects.toThrow('Processing start failed')
  })

  test('should handle publishing start error when active', async () => {
    processingConfig.processingActive = true
    const error = new Error('Publishing start failed')
    mockPublishingStart.mockRejectedValueOnce(error)

    const { init } = require('../../app/index')

    await expect(init()).rejects.toThrow('Publishing start failed')
  })

  test('should complete successfully when all operations succeed', async () => {
    const { init } = require('../../app/index')

    const result = await init()

    expect(result).toBeUndefined()
    expect(startServer).toHaveBeenCalled()
    expect(mockProcessingStart).toHaveBeenCalled()
  })

  test('should not exit on successful initialization', async () => {
    const { init } = require('../../app/index')

    await init()

    expect(process.exit).not.toHaveBeenCalled()
  })

  test('should export init', () => {
    const { init } = require('../../app/index')

    expect(typeof init).toBe('function')
  })

  test('should call init on module load', () => {
    const { init } = require('../../app/index')

    expect(init).toBeDefined()
  })
})
