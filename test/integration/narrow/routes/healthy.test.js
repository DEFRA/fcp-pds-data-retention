jest.mock('../../../../app/storage', () => ({
  uploadStreamToBlob: jest.fn()
}))
const { start } = require('../../../../app/server')

describe('healthy test', () => {
  let server

  beforeEach(async () => {
    server = await start()
  })

  afterEach(async () => {
    await server.stop()
  })

  test('GET /healthy route returns 200', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/healthy'
    })

    expect(response.statusCode).toBe(200)
  })
})
