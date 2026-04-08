const { DefaultAzureCredential } = require('@azure/identity')
const { BlobServiceClient } = require('@azure/storage-blob')
const { storageConfig } = require('./config')
let blobServiceClient
let containersInitialised
let foldersInitialised

if (storageConfig.useConnectionStr) {
  console.log('Using connection string for BlobServiceClient')
  blobServiceClient = BlobServiceClient.fromConnectionString(storageConfig.connectionStr)
} else {
  console.log('Using DefaultAzureCredential for BlobServiceClient')
  const uri = `https://${storageConfig.storageAccount}.blob.core.windows.net`
  blobServiceClient = new BlobServiceClient(uri, new DefaultAzureCredential({ managedIdentityClientId: storageConfig.managedIdentityClientId }))
}

const container = blobServiceClient.getContainerClient(storageConfig.container)

const initialiseContainers = async () => {
  if (storageConfig.createContainers) {
    console.log('Making sure blob containers exist')
    await container.createIfNotExists()
    console.log('Containers ready')
  }
  if (!foldersInitialised) {
    await initialiseFolders()
  }
  containersInitialised = true
}

const initialiseFolders = async () => {
  console.log('Making sure folders exist')
  const placeHolderText = 'Placeholder'
  const inboundClient = container.getBlockBlobClient(`${storageConfig.inboundFolder}/default.txt`)
  await inboundClient.upload(placeHolderText, placeHolderText.length)
  foldersInitialised = true
  console.log('Folders ready')
}

const getBlob = async (filename) => {
  containersInitialised ?? await initialiseContainers()
  return container.getBlockBlobClient(`${storageConfig.inboundFolder}/${filename}`)
}

const getInboundFile = async () => {
  containersInitialised ?? await initialiseContainers()

  const prefix = `${storageConfig.inboundFolder}/DWH_PDS_SchemeClosures_`
  const regex = new RegExp(`^${prefix}\\d{14}\\.zip$`)

  const matchedFiles = []

  // specify prefix to ignore archive and quarantine folders, as well as default.txt file
  for await (const file of container.listBlobsFlat({ prefix })) {
    if (regex.test(file.name)) {
      matchedFiles.push(file.name.replace(`${storageConfig.inboundFolder}/`, ''))
    }
  }

  if (matchedFiles.length === 0) {
    return null
  }

  matchedFiles.sort()
  return matchedFiles[0]
}

const moveFile = async (sourceFolder, destinationFolder, sourceFilename, destinationFilename) => {
  const sourceBlob = container.getBlockBlobClient(`${sourceFolder}/${sourceFilename}`)
  const destinationBlob = container.getBlockBlobClient(`${destinationFolder}/${destinationFilename}`)
  const copyResult = await (await destinationBlob.beginCopyFromURL(sourceBlob.url)).pollUntilDone()

  if (copyResult.copyStatus === 'success') {
    await sourceBlob.delete()
    return true
  }

  return false
}

const archiveFile = async (filename, archiveFilename) => {
  return moveFile(storageConfig.inboundFolder, storageConfig.archiveFolder, filename, archiveFilename)
}

const quarantineFile = async (filename, quarantineFilename) => {
  return moveFile(storageConfig.inboundFolder, storageConfig.quarantineFolder, filename, quarantineFilename)
}

const downloadFileAsStream = async (filename) => {
  console.log(`Downloading file as stream: ${filename}`)
  try {
    const blob = await getBlob(filename)
    const downloadResponse = await blob.download(0)
    return downloadResponse.readableStreamBody
  } catch (e) {
    console.log(`An error occurred trying to download blob: ${e.message}`)
    throw e
  }
}

const deleteFile = async (filename) => {
  console.log(`Deleting file: ${filename}`)
  try {
    const blob = await getBlob(filename)
    await blob.delete()
    console.log(`File deleted: ${filename}`)
    return true
  } catch (e) {
    console.log(`An error occurred trying to delete blob: ${e.message}`)
    return false
  }
}

module.exports = {
  initialiseContainers,
  getInboundFile,
  archiveFile,
  quarantineFile,
  downloadFileAsStream,
  deleteFile,
  blobServiceClient
}
