const csv = require('csv-parser')

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
          endDate: row['APP_END_DATE']
        })
      })
      .on('end', () => resolve(results))
      .on('error', reject)
  })
}

module.exports = getRetentionDataFromFile
