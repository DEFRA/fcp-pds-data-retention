const TABLES = require('../../../app/constants/tables')
const { PRIMARY_KEYS, COLUMNS, pickColumns } = require('../../../app/constants/columns')

describe('pickColumns', () => {
  test('keeps properties that are columns on the table', () => {
    const record = { frn: 1, schemeId: 'value' }

    expect(pickColumns(record, TABLES.retentionData)).toEqual(record)
  })

  test('drops properties that are not columns on the table', () => {
    const result = pickColumns({ frn: 1, notAColumn: 'value' }, TABLES.retentionData)

    expect(result).toEqual({ frn: 1 })
  })

  test('drops the primary key', () => {
    const result = pickColumns({ retentionDataId: 1, frn: 1 }, TABLES.retentionData)

    expect(result).toEqual({ frn: 1 })
  })

  test('returns an empty object when given no properties', () => {
    expect(pickColumns({}, TABLES.retentionData)).toEqual({})
  })
})

describe('PRIMARY_KEYS', () => {
  test('each primary key is a column on its table', () => {
    for (const [table, primaryKey] of Object.entries(PRIMARY_KEYS)) {
      expect(COLUMNS[table]).toContain(primaryKey)
    }
  })
})
