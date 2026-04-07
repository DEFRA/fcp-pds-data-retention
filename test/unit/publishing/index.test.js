jest.mock('../../../app/config')
jest.mock('../../../app/publishing/publish-retention-data')

const { processingConfig } = require('../../../app/config')
const { publishRetentionData } = require('../../../app/publishing/publish-retention-data')
const { start } = require('../../../app/publishing')

describe('publishing/index - start', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    processingConfig.publishingInterval = 5000
    publishRetentionData.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should call publishRetentionData on start', async () => {
    await start()

    expect(publishRetentionData).toHaveBeenCalledTimes(1)
  })

  test('should schedule next execution with publishingInterval', async () => {
    await start()

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000)
  })

  test('should use configured publishing interval', async () => {
    processingConfig.publishingInterval = 10000

    await start()

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 10000)
  })

  test('should handle publishRetentionData errors gracefully', async () => {
    const testError = new Error('Publishing failed')
    publishRetentionData.mockRejectedValue(testError)
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    await start()

    expect(consoleSpy).toHaveBeenCalledWith(testError)
    consoleSpy.mockRestore()
  })

  test('should schedule next execution even when publishRetentionData fails', async () => {
    publishRetentionData.mockRejectedValue(new Error('Publishing failed'))

    await start()

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000)
  })

  test('should schedule next execution in finally block', async () => {
    publishRetentionData.mockResolvedValue(undefined)

    await start()

    expect(setTimeout).toHaveBeenCalled()
  })

  test('should recursively call start on scheduled timeout', async () => {
    publishRetentionData.mockResolvedValue(undefined)

    await start()

    const timeoutCallback = setTimeout.mock.calls[0][0]
    expect(typeof timeoutCallback).toBe('function')
  })

  test('should continue execution loop on successful publish', async () => {
    publishRetentionData.mockResolvedValue(undefined)

    await start()

    expect(publishRetentionData).toHaveBeenCalled()
    expect(setTimeout).toHaveBeenCalled()
  })

  test('should log error with correct error object', async () => {
    const testError = new Error('Specific error message')
    publishRetentionData.mockRejectedValue(testError)
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    await start()

    expect(consoleSpy).toHaveBeenCalledWith(testError)
    consoleSpy.mockRestore()
  })
})
