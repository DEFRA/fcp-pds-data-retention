const { stringToBoolean } = require('../helpers/string-to-boolean')
const defaultPort = 5432

function isProd () {
  return process.env.NODE_ENV === 'production'
}

const dbConfig = {
  database: process.env.POSTGRES_DB || 'fcp_pds_data_retention',
  host: process.env.POSTGRES_HOST || 'fcp-pds-data-retention',
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || defaultPort,
  logging: stringToBoolean(process.env.POSTGRES_LOGGING || false),
  pool: {
    max: 5,
    min: 0,
    acquire: 60000,
    idle: 10000
  },
  schema: process.env.POSTGRES_SCHEMA_NAME || 'public',
  ssl: isProd(),
  username: process.env.POSTGRES_USERNAME
}

module.exports = dbConfig
