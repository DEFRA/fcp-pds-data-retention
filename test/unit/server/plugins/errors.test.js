const plugin = require('../../../../app/server/plugins/errors')

describe('errors plugin', () => {
  let server
  let h

  beforeEach(() => {
    server = {
      ext: jest.fn()
    }
    h = { continue: Symbol('continue') }
  })

  test('register calls server.ext with onPreResponse', () => {
    plugin.plugin.register(server)
    expect(server.ext).toHaveBeenCalledWith('onPreResponse', expect.any(Function))
  })

  describe('onPreResponse extension', () => {
    let onPreResponse

    beforeEach(() => {
      plugin.plugin.register(server)
      onPreResponse = server.ext.mock.calls[0][1]
    })

    test('logs error and returns response when response isBoom', () => {
      const log = jest.fn()
      const request = {
        response: {
          isBoom: true,
          output: { statusCode: 500 },
          message: 'error message',
          data: { payload: { message: 'payload error message' } }
        },
        log
      }

      const result = onPreResponse(request, h)

      expect(log).toHaveBeenCalledWith('error', {
        statusCode: 500,
        message: 'error message',
        payloadMessage: 'payload error message'
      })
      expect(result).toBe(request.response)
    })

    test('logs error with empty payloadMessage if data is missing', () => {
      const log = jest.fn()
      const request = {
        response: {
          isBoom: true,
          output: { statusCode: 404 },
          message: 'not found'
        },
        log
      }

      const result = onPreResponse(request, h)

      expect(log).toHaveBeenCalledWith('error', {
        statusCode: 404,
        message: 'not found',
        payloadMessage: ''
      })
      expect(result).toBe(request.response)
    })

    test('returns h.continue when response is not Boom', () => {
      const request = {
        response: { isBoom: false },
        log: jest.fn()
      }

      const result = onPreResponse(request, h)

      expect(result).toBe(h.continue)
    })
  })
})
