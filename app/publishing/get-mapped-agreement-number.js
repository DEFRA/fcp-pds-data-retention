const {
  SFI,
  CS,
  COHT_CAPITAL,
  COHT_REVENUE,
  DELINKED,
  LUMP_SUMS,
  SFI_PILOT,
  SFI23,
  SFI_EXPANDED,
  BPS,
} = require('../constants/schemes')

const fullAgreementLength = 8

const schemePrefixMap = {
  [CS]: 'A',
  [BPS]: 'C',
  [COHT_REVENUE]: 'E',
  [SFI_EXPANDED]: 'E',
  [COHT_CAPITAL]: 'H',
  [DELINKED]: 'Z',
  [SFI23]: 'Z',
  [LUMP_SUMS]: 'L',
  [SFI_PILOT]: 'S',
}

const getMappedAgreementNumber = (schemeId, agreementNumber) => {
  const stringifiedAgreement = String(agreementNumber)

  if (schemeId === SFI) {
    return stringifiedAgreement.padStart(fullAgreementLength, '0')
  }

  const prefix = schemePrefixMap[schemeId]
  if (prefix) {
    return prefix + stringifiedAgreement.padStart(fullAgreementLength - 1, '0')
  }

  return stringifiedAgreement
}

module.exports = {
  getMappedAgreementNumber
}
