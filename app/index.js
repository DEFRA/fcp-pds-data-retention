import 'log-timestamp'
import { setup } from './insights'
import { createServer } from './server'
import { processingConfig } from './config'
const processing = require('./processing')
const publishing = require('./publishing')

const init = async () => {
  const server = await createServer()
  await server.start()
  console.log('Server running on %s', server.info.uri)
  await processing.start()
  if (processingConfig.processingActive) {
    await publishing.start()
  } else {
    console.log('Publishing retention data is not active in this environment')
  }
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

setup()
init()
