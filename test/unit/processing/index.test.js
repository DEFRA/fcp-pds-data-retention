jest.mock('../../../app/config/processing')
const processingConfig = require('../../../app/config/processing')
jest.mock('../../../app/processing/poll-inbound')
const pollInbound = require('../../../app/processing/poll-inbound')
const { start } = require('../../../app/processing/index')

jest.useFakeTimers()
jest.spyOn(console, 'log').mockImplementation()

describe('start', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.spyOn(global, 'setTimeout')
    pollInbound.mockResolvedValue(undefined)
    processingConfig.pollingInterval = 5000
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  test('should call pollInbound', () => {
    start()

    expect(pollInbound).toHaveBeenCalledTimes(1)
  })

  test('should schedule next execution with configured interval', async () => {
    processingConfig.pollingInterval = 10000

    start()

    await jest.runOnlyPendingTimersAsync()

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 10000)
  })

  test('should reschedule itself after pollInbound completes', async () => {
    start()

    await jest.runOnlyPendingTimersAsync()

    expect(setTimeout).toHaveBeenCalledTimes(2)
  })

  test('should log error when pollInbound fails', async () => {
    const error = new Error('Poll failed')
    pollInbound.mockRejectedValueOnce(error)

    start()

    await jest.runOnlyPendingTimersAsync()

    expect(console.log).toHaveBeenCalledWith(error)
  })

  test('should schedule next execution even when error occurs', async () => {
    pollInbound.mockRejectedValueOnce(new Error('Poll failed'))

    start()

    await jest.runOnlyPendingTimersAsync()

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), processingConfig.pollingInterval)
  })

  test('should continue polling after error', async () => {
    pollInbound.mockRejectedValueOnce(new Error('Poll failed'))

    start()

    await jest.runOnlyPendingTimersAsync()
    expect(pollInbound).toHaveBeenCalledTimes(2)

    pollInbound.mockResolvedValueOnce(undefined)

    jest.runAllTimers()

    expect(pollInbound).toHaveBeenCalledTimes(3)
  })

  test('should call pollInbound multiple times on successive intervals', async () => {
    processingConfig.pollingInterval = 3000

    start()

    await jest.runOnlyPendingTimersAsync()
    expect(pollInbound).toHaveBeenCalledTimes(2)

    jest.advanceTimersByTime(3000)

    await jest.runOnlyPendingTimersAsync()
    expect(pollInbound).toHaveBeenCalledTimes(4)

    jest.advanceTimersByTime(3000)

    await jest.runOnlyPendingTimersAsync()
    expect(pollInbound).toHaveBeenCalledTimes(6)
  })

  test('should use configured polling interval', async () => {
    processingConfig.pollingInterval = 7500

    start()

    await jest.runOnlyPendingTimersAsync()

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 7500)
  })

  test('should handle different error types', async () => {
    const error = new TypeError('Unexpected type')
    pollInbound.mockRejectedValueOnce(error)

    start()

    await jest.runOnlyPendingTimersAsync()

    expect(console.log).toHaveBeenCalledWith(error)
    expect(setTimeout).toHaveBeenCalled()
  })

  test('should not throw when pollInbound rejects', async () => {
    pollInbound.mockRejectedValueOnce(new Error('Poll failed'))

    await expect(start()).resolves.not.toThrow()
  })
})
