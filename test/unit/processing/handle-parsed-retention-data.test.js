const { saveValidRetentionData } = require('../../../app/processing/save-valid-retention-data')
const { sendInvalidRetentionData } = require('../../../app/processing/send-invalid-retention-data')
const { handleParsedRetentionData } = require('../../../app/processing/handle-parsed-retention-data')

jest.mock('../../../app/processing/save-valid-retention-data')
jest.mock('../../../app/processing/send-invalid-retention-data')
jest.spyOn(console, 'error').mockImplementation()

describe('handleParsedRetentionData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    saveValidRetentionData.mockResolvedValue(undefined)
    sendInvalidRetentionData.mockResolvedValue(undefined)
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

  test('should send invalid retention data', async () => {
    const parsedRetentionData = {
      successful: [],
      unsuccessful: [
        { frn: 654321, error: 'Invalid data' }
      ]
    }

    await handleParsedRetentionData(parsedRetentionData)

    expect(sendInvalidRetentionData).toHaveBeenCalledWith(parsedRetentionData.unsuccessful)
  })

  test('should call both saveValidRetentionData and sendInvalidRetentionData', async () => {
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
    expect(sendInvalidRetentionData).toHaveBeenCalledWith(parsedRetentionData.unsuccessful)
  })

  test('should handle empty successful and unsuccessful arrays', async () => {
    const parsedRetentionData = {
      successful: [],
      unsuccessful: []
    }

    const result = await handleParsedRetentionData(parsedRetentionData)

    expect(saveValidRetentionData).toHaveBeenCalledWith([])
    expect(sendInvalidRetentionData).toHaveBeenCalledWith([])
    expect(result).toBe(true)
  })

  test('should return true on success', async () => {
    const parsedRetentionData = {
      successful: [{ frn: 123456 }],
      unsuccessful: []
    }

    const result = await handleParsedRetentionData(parsedRetentionData)

    expect(result).toBe(true)
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
      `Retention data could not be sent: ${error}`
    )
    expect(result).toBe(true)
  })

  test('should handle error from sendInvalidRetentionData', async () => {
    const error = new Error('Send failed')
    sendInvalidRetentionData.mockRejectedValueOnce(error)

    const parsedRetentionData = {
      successful: [{ frn: 123456 }],
      unsuccessful: [{ frn: 789012, error: 'Invalid' }]
    }

    const result = await handleParsedRetentionData(parsedRetentionData)

    expect(saveValidRetentionData).toHaveBeenCalledWith(parsedRetentionData.successful)
    expect(sendInvalidRetentionData).toHaveBeenCalledWith(parsedRetentionData.unsuccessful)

    expect(console.error).toHaveBeenCalledWith(
      `Retention data could not be sent: ${error}`
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

  test('should log error with correct message format for saveValidRetentionData', async () => {
    const error = new Error('Test error message')
    saveValidRetentionData.mockRejectedValueOnce(error)

    const parsedRetentionData = {
      successful: [{ frn: 123456 }],
      unsuccessful: []
    }

    await handleParsedRetentionData(parsedRetentionData)

    expect(console.error).toHaveBeenCalledWith(
      `Retention data could not be sent: ${error}`
    )
  })

  test('should log error with correct message format for sendInvalidRetentionData', async () => {
    const error = new Error('Test send error')
    sendInvalidRetentionData.mockRejectedValueOnce(error)

    const parsedRetentionData = {
      successful: [{ frn: 123456 }],
      unsuccessful: [{ frn: 789012 }]
    }

    await handleParsedRetentionData(parsedRetentionData)

    expect(console.error).toHaveBeenCalledWith(
      `Retention data could not be sent: ${error}`
    )
  })
})
