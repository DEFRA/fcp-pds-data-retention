import logging from './logging.js'
import router from './router.js'

const registerPlugins = async (server) => {
  const plugins = [
    logging,
    router
  ]

  await server.register(plugins)
}

export {
  registerPlugins
}
