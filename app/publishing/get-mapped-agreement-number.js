const { SFI, CS, COHT_CAPITAL, COHT_REVENUE, DELINKED, LUMP_SUMS, SFI_PILOT, SFI23, SFI_EXPANDED } = require('../constants/schemes')

const fullAgreementLength = 8

// The data provided gives us agreement number in a numeric form, e.g. 123456
// However, the data supplied by D365 is usually appended with a letter relevant to the scheme, e.g. L123456.
// In addition, some data where there are leading 0s is simplified to numeric form.
const getMappedAgreementNumber = (schemeId, agreementNumber) => {
  const stringifiedAgreement = String(agreementNumber)
  switch (schemeId) {
    case SFI:
      return stringifiedAgreement.padStart(fullAgreementLength, '0')
    case CS:
      return 'C' + stringifiedAgreement.padStart(fullAgreementLength, '0')
    case COHT_REVENUE:
    case SFI_EXPANDED:
      return 'E' + stringifiedAgreement.padStart(fullAgreementLength - 1, '0')
    case COHT_CAPITAL:
      return 'H' + stringifiedAgreement.padStart(fullAgreementLength - 1, '0')
    case DELINKED:
    case SFI23:
      return 'Z' + stringifiedAgreement.padStart(fullAgreementLength - 1, '0')
    case LUMP_SUMS:
      return 'L' + stringifiedAgreement.padStart(fullAgreementLength - 1, '0')
    case SFI_PILOT:
      return 'S' + stringifiedAgreement.padStart(fullAgreementLength - 1, '0')
    default:
      return stringifiedAgreement
  }
}

module.exports = {
  getMappedAgreementNumber
}
