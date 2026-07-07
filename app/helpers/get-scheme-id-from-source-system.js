const schemes = require('../constants/schemes')
const sourceSystems = require('../constants/source-systems')

const getSchemeIdFromSourceSystem = (sourceSystem) => {
  const scheme = Object.keys(sourceSystems)
    .find(scheme => sourceSystems[scheme] === sourceSystem)
  return scheme ? schemes[scheme] : null
}

module.exports = {
  getSchemeIdFromSourceSystem
}
