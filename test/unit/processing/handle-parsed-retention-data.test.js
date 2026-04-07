const sendRetentionDataInvalidEvents = require('../../../app/event/send-retention-data-invalid-events')
const { saveValidRetentionData } = require('../../../app/processing/save-valid-retention-data')
const { handleParsedRetentionData } = require('../../../app/processing/handle-parsed-retention-data')

jest.mock('../../../app/event/send-retention-data-invalid-events')
jest.mock('../../../app/processing/save-valid-retention-data')
jest.spyOn(console, 'error').mockImplementation()

describe('handleParsedRetentionData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    saveValidRetentionData.mockResolvedValue(undefined)
    sendRetentionDataInvalidEvents.mockResolvedValue(undefined)
  })

  test('should save valid retention data', async () => {
    const parsedRetentionData = {
      successful: [
        { frn: 123456, schemeId: 1, agreementNumber: 'AG001', endDate: '2025-12-31' }
      ],
      unsuccessful: []
    }

    await handleParsedRetentionData(parsedRetentionData)

    expect(saveValidRetentionData).toHaveBeenCalledWith(parsedRetentionData.successful)
  })

  test('should send invalid retention data events', async () => {
    const parsedRetentionData = {
      successful: [],
      unsuccessful: [
        { frn: 789012, scheme: 'UNKNOWN', agreementNumber: 'AG002', endDate: '2026-12-31' }
      ]
    }

    await handleParsedRetentionData(parsedRetentionData)

    expect(sendRetentionDataInvalidEvents).toHaveBeenCalledWith(parsedRetentionData.unsuccessful)
  })

  test('should return true on success', async () => {
    const parsedRetentionData = {
      successful: [{ frn: 123456 }],
      unsuccessful: []
    }

    const result = await handleParsedRetentionData(parsedRetentionData)

    expect(result).toBe(true)
  })

  test('should call saveValidRetentionData before sendRetentionDataInvalidEvents', async () => {
    const parsedRetentionData = {
      successful: [{ frn: 123456 }],
      unsuccessful: [{ frn: 789012 }]
    }

    await handleParsedRetentionData(parsedRetentionData)

    expect(saveValidRetentionData).toHaveBeenCalledBefore(sendRetentionDataInvalidEvents)
  })

  test('should handle error from saveValidRetentionData', async () => {
    const error = new Error('Database connection failed')
    saveValidRetentionData.mockRejectedValueOnce(error)

    const parsedRetentionData = {
      successful: [{ frn: 123456 }],
      unsuccessful: []
    }

    const result = await handleParsedRetentionData(parsedRetentionData)

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('One or more payment requests could not be sent')
    )
    expect(result).toBe(true)
  })

  test('should handle error from sendRetentionDataInvalidEvents', async () => {
    const error = new Error('Event publishing failed')
    sendRetentionDataInvalidEvents.mockRejectedValueOnce(error)

    const parsedRetentionData = {
      successful: [],
      unsuccessful: [{ frn: 789012 }]
    }

    const result = await handleParsedRetentionData(parsedRetentionData)

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('One or more payment requests could not be sent')
    )
    expect(result).toBe(true)
  })

  test('should return true even when error occurs', async () => {
    saveValidRetentionData.mockRejectedValueOnce(new Error('Save failed'))

    const parsedRetentionData = {
      successful: [{ frn: 123456 }],
      unsuccessful: []
    }

    const result = await handleParsedRetentionData(parsedRetentionData)

    expect(result).toBe(true)
  })

  test('should handle both successful and unsuccessful data together', async () => {
    const parsedRetentionData = {
      successful: [
        { frn: 111111, schemeId: 1 },
        { frn: 222222, schemeId: 2 }
      ],
      unsuccessful: [
        { frn: 333333, scheme: 'INVALID' }
      ]
    }

    await handleParsedRetentionData(parsedRetentionData)

    expect(saveValidRetentionData).toHaveBeenCalledWith(parsedRetentionData.successful)
    expect(sendRetentionDataInvalidEvents).toHaveBeenCalledWith(parsedRetentionData.unsuccessful)
  })

  test('should handle empty successful and unsuccessful arrays', async () => {
    const parsedRetentionData = {
      successful: [],
      unsuccessful: []
    }

    const result = await handleParsedRetentionData(parsedRetentionData)

    expect(saveValidRetentionData).toHaveBeenCalledWith([])
    expect(sendRetentionDataInvalidEvents).toHaveBeenCalledWith([])
    expect(result).toBe(true)
  })

  test('should log error with correct message format', async () => {
    const error = new Error('Test error message')
    saveValidRetentionData.mockRejectedValueOnce(error)

    const parsedRetentionData = {
      successful: [{ frn: 123456 }],
      unsuccessful: []
    }

    await handleParsedRetentionData(parsedRetentionData)

    expect(console.error).toHaveBeenCalledWith(
      'One or more payment requests could not be sent: Error: Test error message'
    )
  })
})
