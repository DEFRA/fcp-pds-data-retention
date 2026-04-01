import 'log-timestamp'
import { setup } from './insights'
import { createServer } from './server'
const processing = require('./processing')

const init = async () => {
  const server = await createServer()
  await server.start()
  console.log('Server running on %s', server.info.uri)
  await processing.start()
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

setup()
init()
