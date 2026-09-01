function requireOptIn(variable, action, environment = process.env) {
  if (environment[variable] !== "1") {
    throw new Error(`${action} requires explicit runtime opt-in: ${variable}=1.`);
  }
}

function requirePaymentSubmitOptIn(environment) {
  requireOptIn("ALLOW_PAYMENT_SUBMIT", "Payment submit", environment);
}

function requireCronJobRunOptIn(environment) {
  requireOptIn("ALLOW_CRONJOB_RUN", "CronJob execution", environment);
}

module.exports = {
  requireOptIn,
  requirePaymentSubmitOptIn,
  requireCronJobRunOptIn,
};
