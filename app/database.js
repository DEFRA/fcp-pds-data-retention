const { Database } = require('ffc-database')
const { databaseConfig: dbConfig } = require('./config')
const TABLES = require('./constants/tables')

const database = new Database({ ...dbConfig, tables: TABLES })

module.exports = database.connect()
