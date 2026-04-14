const storage = require('../storage')
const { parseRetentionFile } = require('./parse-retention-file')
const { unzipAndUpload } = require('./unzip-and-upload')

const processDataRetentionFile = async (filename) => {
  try {
    console.log(`Processing zip file: ${filename}`)
    const downloadStream = await storage.downloadFileAsStream(filename)
    const uploadedFiles = await unzipAndUpload(downloadStream)
    await storage.deleteFile(filename)
    console.log(`Processed and deleted zip file: ${filename}`)
    for (const uploadedFile of uploadedFiles) {
      const fileStream = await storage.downloadFileAsStream(uploadedFile)
      const parseSuccess = await parseRetentionFile(fileStream)

      if (parseSuccess) {
        console.log(`Archiving ${uploadedFile}, successfully parsed file`)
        await storage.archiveFile(uploadedFile, uploadedFile)
      } else {
        console.log(`Quarantining ${filename}, failed to parse file`)
        await storage.quarantineFile(uploadedFile, uploadedFile)
      }
    }
  } catch (err) {
    console.error(`Error thrown processing ${filename}`)
    await storage.deleteFile(filename)
    throw err
  }
}

module.exports = processDataRetentionFile
