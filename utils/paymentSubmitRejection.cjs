function paymentSubmitRejection(body) {
  if (body?.type === 'submitOrderDataWsDto' && Number(body.code) === 301 &&
      String(body.details || '').trim().toLowerCase() === 'checksum error') {
    return { code: 301, reason: 'checksum error' };
  }
  return null;
}

module.exports = { paymentSubmitRejection };
