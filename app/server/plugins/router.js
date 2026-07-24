const routes = [require('../routes/health'), require('../routes/closure')].flat()

module.exports = {
  plugin: {
    name: 'router',
    register: (server) => {
      server.route(routes)
    }
  }
}
