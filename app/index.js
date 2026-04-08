require('log-timestamp')
require('./insights').setup()
const { start: startServer } = require('./server')
const { processingConfig } = require('./config')
const processing = require('./processing')
const publishing = require('./publishing')

const init = async () => {
  await startServer()
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

init()
