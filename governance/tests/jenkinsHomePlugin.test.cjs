const test=require('node:test');
const assert=require('node:assert/strict');
const {manifest}=require('../../scripts/install-jenkins-home-plugin.cjs');
const valid='Short-Name: samsung-smb-home\nPlugin-Version: 2.0.0\nJenkins-Version: 2.568.3\nSupport-Dynamic-Loading: true\nPlugin-Dependencies: dashboard-view:2.569.v5ddb_c9b_a_7264,htmlpublisher:429\n';
test('installer accepts only scoped dynamically loadable artifact and exact approved dependencies',()=>{
  assert.deepEqual(manifest(valid).dependencies.map(d=>d.id),['dashboard-view','htmlpublisher']);
  for(const changed of [valid.replace('samsung-smb-home','other-plugin'),valid.replace('true','false'),valid.replace('htmlpublisher:429','unexpected:1'),valid.replace('htmlpublisher:429','dashboard-view:1'),valid.replace('2.568.3','invalid')])assert.throws(()=>manifest(changed));
});
test('installer unfolds manifest continuation lines without admitting optional extra plugins',()=>{
  assert.equal(manifest(valid.replace(',htmlpublisher',',\n htmlpublisher')).version,'2.0.0');
  assert.throws(()=>manifest(valid.replace('htmlpublisher:429','htmlpublisher:429,extra:1')));
});
