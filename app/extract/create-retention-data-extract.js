const { PassThrough } = require('node:stream')
const { once } = require('node:events')
const { stringify } = require('csv-stringify')
const { retentionData } = require('../database')
const TABLES = require('../constants/tables')
const { uploadStreamToBlob } = require('../storage')

const batchSize = 5000
const msAccuracy = 3

const pad = (value, length = 2) => {
  return String(value).padStart(length, '0')
}

const getTimestamp = () => {
  const now = new Date()

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    pad(now.getMilliseconds(), msAccuracy)
  ].join('')
}

const getExtractFilename = () => {
  return `fcp-pds-data-retention-extract-${getTimestamp()}.csv`
}

const getRetentionDataBatch = async (lastRetentionDataId) => {
  return retentionData()
    .select(
      'retentionData.retentionDataId',
      'retentionData.frn',
      { schemeName: 'scheme.name' },
      'retentionData.agreementNumber',
      'retentionData.endDate',
      'retentionData.addedBy',
      'retentionData.addedTime'
    )
    .leftJoin({ scheme: TABLES.schemes }, 'retentionData.schemeId', 'scheme.schemeId')
    .where('retentionData.retentionDataId', '>', lastRetentionDataId)
    .orderBy('retentionData.retentionDataId', 'asc')
    .limit(batchSize)
}

const writeRowsToCsv = async (csvStream, rows) => {
  for (const row of rows) {
    const canContinue = csvStream.write({
      frn: row.frn,
      agreementNumber: row.agreementNumber,
      schemeName: row.schemeName,
      closureDate: row.endDate ? row.endDate.toISOString().split('T')[0] : '',
      addedBy: row.addedBy,
      addedTime: row.addedTime ? row.addedTime.toISOString().split('T')[0] : ''
    })

    if (!canContinue) {
      await once(csvStream, 'drain')
    }
  }
}

const streamRetentionDataToCsv = async (csvStream) => {
  let lastRetentionDataId = 0

  while (true) {
    const rows = await getRetentionDataBatch(lastRetentionDataId)

    if (rows.length === 0) {
      break
    }

    await writeRowsToCsv(csvStream, rows)

    lastRetentionDataId = rows[rows.length - 1].retentionDataId
  }

  csvStream.end()
}

const createRetentionDataExtract = async () => {
  const filename = getExtractFilename()
  const passThrough = new PassThrough()

  const csvStream = stringify({
    header: true,
    columns: {
      frn: 'frn',
      agreementNumber: 'agreementNumber',
      schemeName: 'schemeName',
      closureDate: 'closureDate',
      addedBy: 'addedBy',
      addedTime: 'addedTime'
    }
  })

  csvStream.pipe(passThrough)

  const uploadPromise = uploadStreamToBlob(filename, passThrough, false)
  const csvPromise = streamRetentionDataToCsv(csvStream)

  await Promise.all([
    uploadPromise,
    csvPromise
  ])

  return filename
}

module.exports = {
  createRetentionDataExtract
}
