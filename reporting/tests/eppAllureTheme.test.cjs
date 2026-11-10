const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {applyAllureTheme, STYLE_FILE} = require('../epp-quality/allure-theme.cjs');

test('EPP generated Allure theme is idempotent and does not change test results', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'epp-allure-presentation-'));
  try {
    const index=path.join(root,'index.html');
    const payload='{"status":"failed","name":"SAM-24952"}';
    const dataDir=path.join(root,'data');
    fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(dataDir,'test-case.json'),payload);
    fs.writeFileSync(index,'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>');
    assert.equal(applyAllureTheme(root),true);
    assert.equal(applyAllureTheme(root),true);
    const html=fs.readFileSync(index,'utf8');
    assert.equal(html.split('data-samsung-epp-allure-theme').length-1,1);
    assert.match(html,/samsung-epp-allure\.css/);
    assert.ok(fs.readFileSync(path.join(root,STYLE_FILE),'utf8').includes('.side-nav'));
    assert.equal(fs.readFileSync(path.join(dataDir,'test-case.json'),'utf8'),payload);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('missing generated report does not publish a misleading Allure theme',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'epp-allure-missing-'));
  try {assert.equal(applyAllureTheme(root),false);assert.equal(fs.readdirSync(root).length,0);}
  finally {fs.rmSync(root,{recursive:true,force:true});}
});
