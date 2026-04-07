jest.mock('../../../app/publishing/get-pending-retention-data')
jest.mock('../../../app/messaging/send-publish-message')
jest.mock('../../../app/data')

const { getPendingRetentionData } = require('../../../app/publishing/get-pending-retention-data')
const sendPublishMessage = require('../../../app/messaging/send-publish-message')
const db = require('../../../app/data')
const { publishStatements } = require('../../../app/publishing/publish-retention-data')

describe('publishStatements', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    db.retentionData = {
      destroy: jest.fn().mockResolvedValue(1)
    }
    sendPublishMessage.mockResolvedValue(undefined)
  })

  test('should get pending retention data', async () => {
    getPendingRetentionData.mockResolvedValue([])

    await publishStatements()

    expect(getPendingRetentionData).toHaveBeenCalledTimes(1)
  })

  test('should process all pending retention data items', async () => {
    const mockData = [
      { dataRetentionId: 1, frn: 'FRN001', agreementNumber: 'AGR001' },
      { dataRetentionId: 2, frn: 'FRN002', agreementNumber: 'AGR002' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    await publishStatements()

    expect(sendPublishMessage).toHaveBeenCalledTimes(2)
    expect(db.retentionData.destroy).toHaveBeenCalledTimes(2)
  })

  test('should send publish message with correct pending data', async () => {
    const mockData = [
      { dataRetentionId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    await publishStatements()

    expect(sendPublishMessage).toHaveBeenCalledWith(mockData[0])
  })

  test('should destroy record with correct dataRetentionId', async () => {
    const mockData = [
      { dataRetentionId: 123, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    await publishStatements()

    expect(db.retentionData.destroy).toHaveBeenCalledWith({
      where: { dataRetentionId: 123 }
    })
  })

  test('should log data passing retention with frn and agreement number', async () => {
    const mockData = [
      { dataRetentionId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    await publishStatements()

    expect(consoleSpy).toHaveBeenCalledWith(
      'Data passed 7 year retention for frn: FRN001, agreement number: AGR001'
    )
    consoleSpy.mockRestore()
  })

  test('should log notification supplied to downstream systems after each item', async () => {
    const mockData = [
      { dataRetentionId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    await publishStatements()

    expect(consoleSpy).toHaveBeenCalledWith('Notification supplied to downstream systems')
    consoleSpy.mockRestore()
  })

  test('should handle empty pending data array', async () => {
    getPendingRetentionData.mockResolvedValue([])

    await publishStatements()

    expect(sendPublishMessage).not.toHaveBeenCalled()
    expect(db.retentionData.destroy).not.toHaveBeenCalled()
  })

  test('should throw error when getPendingRetentionData fails', async () => {
    const testError = new Error('Database error')
    getPendingRetentionData.mockRejectedValue(testError)

    await expect(publishStatements()).rejects.toThrow('Database error')
  })

  test('should throw error when sendPublishMessage fails', async () => {
    const mockData = [
      { dataRetentionId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const testError = new Error('Message send failed')
    sendPublishMessage.mockRejectedValue(testError)

    await expect(publishStatements()).rejects.toThrow('Message send failed')
  })

  test('should throw error when destroy fails', async () => {
    const mockData = [
      { dataRetentionId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const testError = new Error('Destroy failed')
    db.retentionData.destroy.mockRejectedValue(testError)

    await expect(publishStatements()).rejects.toThrow('Destroy failed')
  })

  test('should process items sequentially', async () => {
    const mockData = [
      { dataRetentionId: 1, frn: 'FRN001', agreementNumber: 'AGR001' },
      { dataRetentionId: 2, frn: 'FRN002', agreementNumber: 'AGR002' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const callOrder = []
    sendPublishMessage.mockImplementation((data) => {
      callOrder.push(`message-${data.dataRetentionId}`)
      return Promise.resolve()
    })
    db.retentionData.destroy.mockImplementation((query) => {
      callOrder.push(`destroy-${query.where.dataRetentionId}`)
      return Promise.resolve()
    })

    await publishStatements()

    expect(callOrder).toEqual([
      'message-1',
      'destroy-1',
      'message-2',
      'destroy-2'
    ])
  })

  test('should handle multiple items with different frn and agreement numbers', async () => {
    const mockData = [
      { dataRetentionId: 1, frn: 'FRN001', agreementNumber: 'AGR001' },
      { dataRetentionId: 2, frn: 'FRN002', agreementNumber: 'AGR002' },
      { dataRetentionId: 3, frn: 'FRN003', agreementNumber: 'AGR003' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    await publishStatements()

    const logCalls = consoleSpy.mock.calls.filter(call =>
      call[0].includes('Data passed 7 year retention')
    )
    expect(logCalls).toHaveLength(3)
    consoleSpy.mockRestore()
  })
})
