const unzipper = require('unzipper')
const { storageConfig } = require('../config')
const storage = require('../storage')

const unzipAndUpload = (zipStream) => {
  const uploadedFiles = []
  const uploadPromises = []

  return new Promise((resolve, reject) => {
    zipStream
      .pipe(unzipper.Parse())
      .on('entry', (entry) => {
        const fileName = entry.path
        if (entry.type === 'Directory' || fileName.endsWith('/')) {
          console.log(`Skipping directory: ${fileName}`)
          entry.autodrain()
          return
        }

        const baseFileName = fileName.split('/').pop()
        console.log(`Extracting file from zip: ${baseFileName}`)

        const uploadPromise = storage
          .getBlob(`${storageConfig.inboundFolder}/${baseFileName}`, false)
          .then(blobClient => blobClient.uploadStream(entry))
          .then(() => {
            console.log(`Uploaded file to blob storage: ${baseFileName}`)
            uploadedFiles.push(baseFileName)
          })
          .catch(async (err) => {
            await storage.quarantineFile(baseFileName)
            throw err
          })

        uploadPromises.push(uploadPromise)
      })
      .on('close', async () => {
        console.log('DWH zip file parsing finished, waiting for uploads to complete...')
        try {
          await Promise.all(uploadPromises)
          console.log('DWH zip file successfully unzipped and all files uploaded')
          resolve(uploadedFiles)
        } catch (err) {
          reject(err)
        }
      })
      .on('error', (err) => {
        console.error('Error during unzipping: ', err)
        reject(err)
      })
  })
}

module.exports = {
  unzipAndUpload
}
