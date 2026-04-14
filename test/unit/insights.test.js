const appInsights = require('applicationinsights')

describe('setup', () => {
  let originalEnv
  let consoleLogSpy
  let setupMock
  let startMock
  let defaultClientBackup

  beforeEach(() => {
    originalEnv = { ...process.env }
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { })
    startMock = jest.fn()
    setupMock = jest.fn(() => ({ start: startMock }))
    jest.spyOn(appInsights, 'setup').mockImplementation(setupMock)

    defaultClientBackup = appInsights.defaultClient

    appInsights.defaultClient = {
      context: {
        keys: { cloudRole: 'cloudRoleTag' },
        tags: {}
      }
    }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
    appInsights.defaultClient = defaultClientBackup
  })

  test('starts appInsights and sets cloud role tag when APPINSIGHTS_CONNECTIONSTRING is set', () => {
    process.env.APPINSIGHTS_CONNECTIONSTRING = 'fake-connection-string'
    process.env.APPINSIGHTS_CLOUDROLE = 'myAppRole'

    const { setup } = require('../../app/insights')
    setup()

    expect(setupMock).toHaveBeenCalledWith('fake-connection-string')
    expect(startMock).toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith('App Insights running')
    expect(appInsights.defaultClient.context.tags.cloudRoleTag).toBe('myAppRole')
  })

  test('logs not running when APPINSIGHTS_CONNECTIONSTRING is not set', () => {
    delete process.env.APPINSIGHTS_CONNECTIONSTRING

    const { setup } = require('../../app/insights')
    setup()

    expect(setupMock).not.toHaveBeenCalled()
    expect(startMock).not.toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith('App Insights not running')
  })
})
