const schemes = require('../constants/schemes')
const sourceSystems = require('../constants/source-systems')

const getSchemeIdFromSourceSystem = (sourceSystem) => {
  const matchingScheme = Object.keys(sourceSystems)
    .find(scheme => sourceSystems[scheme] === sourceSystem)
  return matchingScheme ? schemes[matchingScheme] : null
}

module.exports = {
  getSchemeIdFromSourceSystem
}
