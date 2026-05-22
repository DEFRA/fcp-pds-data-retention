const csv = require('csv-parser')

const parseDateString = (dateStr) => {
  if (!dateStr) {
    return null
  }

  const [datePart, timePart] = dateStr.split(' ')
  if (!datePart || !timePart) return null

  const [month, day, year] = datePart.split('/')
  if (!month || !day || !year) return null

  const isoString = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`

  const date = new Date(isoString)
  return Number.isNaN(date.getTime()) ? null : date
}

const getRetentionDataFromFile = (fileStream) => {
  const results = []
  return new Promise((resolve, reject) => {
    fileStream
      .pipe(csv())
      .on('data', row => {
        results.push({
          frn: row['FRN'],
          scheme: row['SCHEME'],
          agreementNumber: row['APP_REF'],
          endDate: parseDateString(row['APP_END_DATE'])
        })
      })
      .on('end', () => resolve(results))
      .on('error', reject)
  })
}

module.exports = getRetentionDataFromFile
