const { setup } = require('../../app/insights')
const { createServer } = require('../../app/server')
const processing = require('../../app/processing')

jest.mock('log-timestamp')
jest.mock('../../app/insights')
jest.mock('../../app/server')
jest.mock('../../app/processing')
jest.spyOn(console, 'log').mockImplementation()
jest.spyOn(process, 'exit').mockImplementation()

describe('index', () => {
  let mockServer
  let mockProcessingStart

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

    createServer.mockResolvedValue(mockServer)
    processing.start = mockProcessingStart
    setup.mockImplementation(() => { })
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

  test('should init be called on module load', () => {
    expect(createServer).toHaveBeenCalled()
  })
})
