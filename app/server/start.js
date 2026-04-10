const { createServer } = require('./create-server')

const start = async () => {
  const server = await createServer()
  await server.start()
  return server
}

module.exports = {
  start
}
