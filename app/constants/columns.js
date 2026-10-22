const TABLES = require('./tables')

const PRIMARY_KEYS = {
  [TABLES.retentionData]: 'retentionDataId',
  [TABLES.schemes]: 'schemeId'
}

const COLUMNS = {
  [TABLES.retentionData]: [
    'retentionDataId',
    'frn',
    'schemeId',
    'agreementNumber',
    'endDate',
    'addedBy',
    'addedTime'
  ],
  [TABLES.schemes]: [
    'schemeId',
    'name'
  ]
}

const pickColumns = (record, table) => {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([column]) => COLUMNS[table].includes(column))
      .filter(([column]) => column !== PRIMARY_KEYS[table])
  )
}

module.exports = {
  PRIMARY_KEYS,
  COLUMNS,
  pickColumns
}
