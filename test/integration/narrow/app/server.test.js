jest.mock('../../../../app/storage', () => ({
  uploadStreamToBlob: jest.fn()
}))
const { start } = require('../../../../app/server')

describe('Server test', () => {
  test('createServer returns server', async () => {
    const server = await start()
    expect(server).toBeDefined()
  })
})
