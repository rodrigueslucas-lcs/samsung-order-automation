const test=require('node:test'),assert=require('node:assert/strict');
const {installArguments}=require('../../scripts/install-epp-ci-tools.cjs');
test('installing reporters cannot upgrade direct locked QA dependencies',()=>{
 const lock=require('../../package-lock.json'),args=installArguments(lock);
 for(const name of Object.keys(lock.packages[''].devDependencies))assert.ok(args.includes(name+'@'+lock.packages['node_modules/'+name].version));
 assert.ok(args.includes('@playwright/test@1.60.0'));assert.ok(args.includes('allure-playwright@3.11.1'));assert.ok(args.includes('allure-commandline@2.43.0'));
 assert.ok(args.includes('--no-save'));assert.ok(args.includes('--package-lock=false'));
});
test('missing dependency lock aborts installation instead of guessing latest',()=>{
 assert.throws(()=>installArguments({}));assert.throws(()=>installArguments({packages:{'':{devDependencies:{example:'^1'}}}}));
});
