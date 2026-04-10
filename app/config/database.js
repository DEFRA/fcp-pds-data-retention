const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity')
const defaultPort = 5432

function isProd () {
  return process.env.NODE_ENV === 'production'
}

const hooks = {
  beforeConnect: async (cfg) => {
    if (isProd()) {
      const dbAuthEndpoint = 'https://ossrdbms-aad.database.windows.net/.default'
      const credential = new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID })
      const tokenProvider = getBearerTokenProvider(
        credential,
        dbAuthEndpoint
      )
      cfg.password = tokenProvider
    }
  }
}

const retry = {
  backoffBase: 500,
  backoffExponent: 1.1,
  match: [/SequelizeConnectionError/],
  max: 10,
  name: 'connection',
  timeout: 60000
}

const dbConfig = {
  database: process.env.POSTGRES_DB || 'fcp_pds_data_retention',
  dialect: 'postgres',
  dialectOptions: {
    ssl: isProd()
  },
  hooks,
  host: process.env.POSTGRES_HOST || 'fcp-pds-data-retention',
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || defaultPort,
  logging: process.env.POSTGRES_LOGGING || false,
  retry,
  schema: process.env.POSTGRES_SCHEMA_NAME || 'public',
  username: process.env.POSTGRES_USERNAME
}

module.exports = dbConfig
