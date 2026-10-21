async function removePeEntryAndReadBack({ remove, readCart, entryNumber, pause, attempts = 10 }) {
  let response;
  try { response = await remove(); } catch (error) {
    if (!/apiRequestContext\.delete: Timeout \d+ms exceeded/i.test(String(error?.message || error))) throw error;
    // The server may have completed the DELETE despite the client timeout.
    // Read only; a second DELETE could remove a reindexed remaining item.
  }
  if (response && !response.ok()) throw new Error(`PE setup cart removal returned HTTP ${response.status()}.`);
  for (let poll = 0; poll < attempts; poll++) {
    const cart = await readCart();
    if (!cart.entries.some(entry => entry.entryNumber === entryNumber)) return cart;
    if (poll + 1 < attempts) await pause(500);
  }
  throw new Error(response
    ? 'PE setup cart removal was acknowledged but did not persist; no mutation was retried.'
    : 'PE setup cart removal timed out and did not persist; no mutation was retried.');
}

module.exports = { removePeEntryAndReadBack };
