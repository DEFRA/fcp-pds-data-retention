const routes = [require('../routes/health')].flat()

module.exports = {
  plugin: {
    name: 'router',
    register: (server) => {
      server.route(routes)
    }
  }
}
