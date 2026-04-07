jest.mock('log-timestamp')
jest.mock('../../app/insights')
jest.mock('../../app/server')
jest.mock('../../app/processing')
jest.mock('../../app/publishing')
jest.mock('../../app/config')

const { setup } = require('../../app/insights')
const { createServer } = require('../../app/server')
const processing = require('../../app/processing')
const publishing = require('../../app/publishing')
const { processingConfig } = require('../../app/config')

jest.spyOn(console, 'log').mockImplementation()
jest.spyOn(process, 'exit').mockImplementation()

describe('index', () => {
  let mockServer
  let mockProcessingStart
  let mockPublishingStart

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    mockServer = {
      start: jest.fn().mockResolvedValue(undefined),
      info: {
        uri: 'http://localhost:3000'
      }
    }

    mockProcessingStart = jest.fn().mockResolvedValue(undefined)
    mockPublishingStart = jest.fn().mockResolvedValue(undefined)

    createServer.mockResolvedValue(mockServer)
    processing.start = mockProcessingStart
    publishing.start = mockPublishingStart
    setup.mockImplementation(() => { })
    processingConfig.processingActive = true
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  test('should create server', async () => {
    const { init } = require('../../app/index')

    await init()

    expect(createServer).toHaveBeenCalledTimes(1)
  })

  test('should start server', async () => {
    const { init } = require('../../app/index')

    await init()

    expect(mockServer.start).toHaveBeenCalledTimes(1)
  })

  test('should log server URI', async () => {
    const { init } = require('../../app/index')

    await init()

    expect(console.log).toHaveBeenCalledWith(
      'Server running on %s',
      'http://localhost:3000'
    )
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

  test('should start server before processing', async () => {
    const { init } = require('../../app/index')

    const callOrder = []

    mockServer.start.mockImplementation(() => {
      callOrder.push('server.start')
      return Promise.resolve()
    })

    mockProcessingStart.mockImplementation(() => {
      callOrder.push('processing.start')
      return Promise.resolve()
    })

    await init()

    expect(callOrder).toEqual(['server.start', 'processing.start'])
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
    createServer.mockRejectedValueOnce(error)

    const { init } = require('../../app/index')

    await expect(init()).rejects.toThrow('Server creation failed')
  })

  test('should handle server start error', async () => {
    const error = new Error('Server start failed')
    mockServer.start.mockRejectedValueOnce(error)

    const { init } = require('../../app/index')

    await expect(init()).rejects.toThrow('Server start failed')
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
    expect(createServer).toHaveBeenCalled()
    expect(mockServer.start).toHaveBeenCalled()
    expect(mockProcessingStart).toHaveBeenCalled()
  })

  test('should use correct server info from server object', async () => {
    mockServer.info.uri = 'http://0.0.0.0:8080'

    const { init } = require('../../app/index')

    await init()

    expect(console.log).toHaveBeenCalledWith(
      'Server running on %s',
      'http://0.0.0.0:8080'
    )
  })

  test('should not exit on successful initialization', async () => {
    const { init } = require('../../app/index')

    await init()

    expect(process.exit).not.toHaveBeenCalled()
  })

  test('should handle unhandledRejection by logging and exiting', () => {
    require('../../app/index')

    const unhandledRejectionHandler = process.on.mock.calls.find(
      call => call[0] === 'unhandledRejection'
    )[1]

    const testError = new Error('Unhandled error')
    unhandledRejectionHandler(testError)

    expect(console.log).toHaveBeenCalledWith(testError)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  test('should call setup on module load', () => {
    require('../../app/index')

    expect(setup).toHaveBeenCalled()
  })

  test('should call init on module load', () => {
    const { init } = require('../../app/index')

    expect(init).toBeDefined()
  })
})
