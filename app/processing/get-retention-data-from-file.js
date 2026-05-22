const csv = require('csv-parser')

const parseDateString = (dateStr) => {
  if (!dateStr) {
    return null
  }

  const [datePart, timePart] = dateStr.split(' ')
  if (!datePart || !timePart) {
    return null
  }

  const [month, day, year] = datePart.split('/')
  if (!month || !day || !year) {
    return null
  }

  const isoString = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`

  const date = new Date(isoString)
  return Number.isNaN(date.getTime()) ? null : date
}

const getRetentionDataFromFile = (fileStream, onRow) => {
  return new Promise((resolve, reject) => {
    const parser = csv()
    fileStream.pipe(parser)

    let processing = false
    const queue = []

    const processNext = async () => {
      if (processing) {
        return
      }
      if (queue.length === 0) {
        parser.resume()
        return
      }

      processing = true
      const row = queue.shift()
      try {
        await onRow({
          frn: row['FRN'],
          scheme: row['SCHEME'],
          agreementNumber: row['APP_REF'],
          endDate: parseDateString(row['APP_END_DATE']),
        })
      } catch (err) {
        reject(err)
        return
      } finally {
        processing = false
      }
      setImmediate(processNext)
    }

    parser.on('data', (row) => {
      queue.push(row)
      parser.pause()
      processNext()
    })

    parser.on('end', () => {
      const waitForQueueEmpty = () => {
        if (processing || queue.length > 0) {
          setImmediate(waitForQueueEmpty)
        } else {
          resolve()
        }
      }
      waitForQueueEmpty()
    })

    parser.on('error', reject)
  })
}

module.exports = getRetentionDataFromFile
