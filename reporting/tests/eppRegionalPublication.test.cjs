const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {publishSummary}=require('../../scripts/publish-regional-quality.cjs');
const {buildRegionalSummary}=require('../epp-quality/regional.cjs');
test('regional publication uses only its public namespace and tolerates temporary Windows reader locks',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'regional-quality-'));
 try{
  const jenkins=path.join(home,'.jenkins'),output=path.join(home,'output');fs.mkdirSync(jenkins);fs.writeFileSync(path.join(jenkins,'config.xml'),'<jenkins/>');
  let busy=0;const io={...fs,renameSync:(source,target)=>{if(target.endsWith('index.html')&&busy++===0)throw Object.assign(new Error('Synthetic reader lock'),{code:'EBUSY'});return fs.renameSync(source,target);}};
  publishSummary(buildRegionalSummary([]),output,jenkins,io);
  const target=path.join(jenkins,'userContent/samsung-smb-quality');assert.ok(fs.existsSync(path.join(target,'index.html')));assert.equal(JSON.parse(fs.readFileSync(path.join(target,'summary.json'),'utf8')).rows.length,8);assert.equal(fs.readdirSync(path.join(target,'history')).length,1);assert.ok(!fs.readdirSync(target).some(name=>name.endsWith('.tmp')));assert.ok(busy>=2);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('arbitrary publication roots are rejected without changing their files',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'regional-quality-'));
 try{assert.throws(()=>publishSummary(buildRegionalSummary([]),path.join(home,'output'),home),/Unproven Jenkins/);assert.ok(!fs.existsSync(path.join(home,'userContent')));}finally{fs.rmSync(home,{recursive:true,force:true});}
});
