const csv = require('csv-parser')
const { normaliseValidationDate } = require('../helpers/normaliseValidationDates')

const DATE_TIME_PATTERN = /^(?<month>\d{2})\/(?<day>\d{2})\/(?<year>\d{4}) (?<time>\d{2}:\d{2}:\d{2})$/
const ISO_TIME_SUFFIX = '.000Z'
const UTC_SUFFIX = 'Z'
const MIDNIGHT_TIME = '00:00:00'

const parseDateString = (dateString) => {
  if (typeof dateString !== 'string' || !dateString.trim()) {
    return null
  }

  const trimmedDate = dateString.trim()
  const dateTimeMatch = trimmedDate.match(DATE_TIME_PATTERN)
  if (dateTimeMatch) {
    const { year, month, day, time } = dateTimeMatch.groups
    const normalisedDate = normaliseValidationDate(`${year}/${day}/${month}`)
    return normalisedDate ? createUtcDate(normalisedDate, time) : null
  }

  const normalisedDate = normaliseValidationDate(trimmedDate)
  return normalisedDate ? createUtcDate(normalisedDate, MIDNIGHT_TIME) : null
}

const createUtcDate = (normalisedDate, time) => {
  const isoDateTime = `${normalisedDate}T${time}${UTC_SUFFIX}`
  const expectedIsoDateTime = `${normalisedDate}T${time}${ISO_TIME_SUFFIX}`
  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime()) || date.toISOString() !== expectedIsoDateTime) {
    return null
  }

  return date
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
          endDate: parseDateString(row['APP_END_DATE'])
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
