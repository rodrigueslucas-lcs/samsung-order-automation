const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { requiresStorefrontAuth, verify } = require('../../scripts/verify-jenkins-storefront-auth.cjs');
for (const [market, samId] of [['PE','SAM-25103'],['CO','SAM-24920'],['CL','SAM-24830']]) {
  test(`${market} direct BackOffice target does not launch Samsung Account verification`, () => {
    const env = { [`${market}_QST_TARGET_IDS`]:samId, CI:'1' };
    assert.equal(verify({market,env,spawn:()=>assert.fail('Unrelated storefront login'),log() {}}),0);
    assert.equal(requiresStorefrontAuth(market,` ${samId.toLowerCase()} `),false);
  });
  for (const targets of ['', 'SAM-UNKNOWN', `${samId},SAM-UNKNOWN`, 'SAM-24962']) {
    test(`${market} full or non-BO scope retains real verifier and its failure (${targets || 'full'})`, () => {
      let calls=0;
      const env={ [`${market}_QST_TARGET_IDS`]:targets, CI:'1' };
      assert.equal(verify({market,env,spawn:(executable,args,options)=>{
        calls++;assert.equal(executable,process.execPath);
        assert.deepEqual(args,[path.resolve(`scripts/auth-verify-${market.toLowerCase()}.cjs`)]);
        assert.equal(options.env,env);return {status:20};
      },log() {}}),20);
      assert.equal(calls,1);
    });
  }
}
test('cross-market BackOffice IDs and partial IDs cannot skip verification', () => {
  assert.equal(requiresStorefrontAuth('CL','SAM-25103'),true);
  assert.equal(requiresStorefrontAuth('PE','SAM-251030'),true);
});
test('verifier process failure is not converted to success', () => {
  assert.equal(verify({market:'PE',env:{},spawn:()=>({status:null}),log() {}}),1);
  assert.throws(()=>verify({market:'PE',env:{},spawn:()=>({error:Error('spawn failed')}),log() {}}),/spawn failed/);
});
