const databaseConfig = require('./database')
const messageConfig = require('./message')
const processingConfig = require('./processing')
const storageConfig = require('./storage')
const serverConfig = require('./server')

module.exports = {
  databaseConfig,
  messageConfig,
  processingConfig,
  storageConfig,
  serverConfig
}
