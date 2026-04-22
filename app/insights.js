const { useAzureMonitor } = require('@azure/monitor-opentelemetry')

const setup = () => {
  const connectionString = process.env.APPINSIGHTS_CONNECTIONSTRING
  if (connectionString) {
    useAzureMonitor({
      azureMonitorExporterOptions: {
        connectionString
      }
    })
    console.log('Azure Monitor (OpenTelemetry) Running')
  } else {
    console.log('Azure Monitor not running')
  }
}

module.exports = {
  setup
}
