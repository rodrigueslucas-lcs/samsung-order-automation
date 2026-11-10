function matchesKnownDefectEvidence(defect, result) {
  if(defect.store==='EPP'&&((defect.jira==='RT-746043'&&defect.samId==='SAM-24952')||(defect.jira==='SAM-25161'&&defect.samId==='SAM-24865'))){
    const text=[result.error,result.message,result.blockedReason,result.statusDetails?.message,...(result.errors||[]).map(e=>e.message),...(result.annotations||[]).map(a=>a.description)].filter(x=>typeof x==='string').join('\n');
    if(/AUTH_OR_ENTITLEMENT|SERVER_IDENTITY|AMBIGUOUS_EPP_ORDER_ATTEMPT|SINGLE_SUBMIT_UNCONFIRMED|MASS_REQUIRED|EPP_TOOLTIP_TRIGGER_NOT_AVAILABLE|TimeoutError/i.test(text))return false;
    if(defect.jira==='RT-746043'&&/CO_EPP_TOOLTIP_MISSING_RT746043 co_epp_agre/.test(text))return true;
    return defect.jira==='RT-746043'
      ? /Back to Top behind the visible tooltip[\s\S]*"tooltipOnTop"\s*:\s*false/.test(text)
      : /CL_EPP_BANK_FORBIDDEN_403/.test(text);
  }
  if(defect.jira==='RT-779284'){
    const text=[result.error,result.message,result.blockedReason,result.statusDetails?.message,...(result.errors||[]).map(item=>item.message),...(result.annotations||[]).map(item=>item.description)].filter(value=>typeof value==='string').join('\n');
    if(/TimeoutError|AUTH_OR_ENTITLEMENT|SESSION_NOT_PROVEN|AMBIGUOUS_EPP_ORDER_ATTEMPT|MISSING_EPP_CONTACT_DATA/i.test(text))return false;
    const actualCashFailure=/pymesmx/i.test(text)&&/Paga en efectivo|mx-mercadoCash/i.test(text)&&/Lo sentimos,?\s*su transacci[oó]n no fue exitosa/i.test(text);
    if(/^(?:FAIL|ERROR|BROKEN|TIMED_OUT)/i.test(result.status||''))return actualCashFailure;
    return /MX_EPP_CASH_TRANSACTION_FAILED\s+pymesmx/.test(text)||actualCashFailure;
  }
  if(defect.jira==='SAM-25146'&&defect.store==='EPP'&&((defect.market==='CL'&&defect.samId==='SAM-24841')||(defect.market==='PE'&&defect.samId==='SAM-25114')||(defect.market==='CO'&&defect.samId==='SAM-24931'))){
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
