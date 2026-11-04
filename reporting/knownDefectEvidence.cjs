function matchesKnownDefectEvidence(defect, result) {
  if(defect.jira==='SAM-25146'&&defect.market==='CL'&&defect.samId==='SAM-24841'&&defect.store==='EPP'){
    const evidence=[result.error,result.message,result.blockedReason,result.statusDetails?.message,...(result.errors||[]).map(item=>item.message),...(result.annotations||[]).map(item=>item.description)].filter(value=>typeof value==='string').join('\n');
    return /MISSING_EXPECTED_CART_FOOTER/.test(evidence);
  }
  if (defect.jira !== 'RT-738525') return true;
  const text = [result.error, result.message, result.blockedReason,
    result.statusDetails?.message, ...(result.errors || []).map(error => error.message),
    ...(result.annotations || []).filter(item => item.type === 'known-defect').map(item => item.description),
  ].filter(value => typeof value === 'string').join('\n');
  // This RT starts after a valid OTP. Missing mail, browser timeouts and
  // unrelated checkout failures must retain their original FAIL status.
  if (/OTP email was not found|waitForOtpEmail|TimeoutError/i.test(text)) return false;
  return /accepted the OTP but could not find[\s\S]+in the current BaseSite/i.test(text)
    || /accepts OTP but cannot resolve[\s\S]+in the current BaseSite/i.test(text);
}
module.exports = { matchesKnownDefectEvidence };
