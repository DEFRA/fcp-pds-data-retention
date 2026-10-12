const FRN_PATTERN = /^\d{10}$/

const isValidFrn = (frn) => {
  if (typeof frn === 'string') {
    return FRN_PATTERN.test(frn)
  }

  return Number.isSafeInteger(frn) && FRN_PATTERN.test(String(frn))
}

module.exports = {
  isValidFrn
}
