// Compatibility shim kept while callers migrate away from the historical
// environment-specific name. Physical QST discovery is now market-first and
// implemented by qstImplementation.js.
const implementation = require('./qstImplementation');

module.exports = {
  ...implementation,
  validateS1OfficialImplementation: implementation.validateOfficialImplementation,
};
