const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('flows/eppStorefront.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
function fixture({error=null,closed=false,fallbackError=null}={}){
 const captures=[],attachments=[],masks=[];
 const capture=vm.runInNewContext(source+'\nbusinessScreenshot;',{test:{info:()=>({outputPath:name=>'evidence/'+name,attach:async(name,data)=>attachments.push({name,...data})})}});
 const page={locator:selector=>{const mask={selector};masks.push(mask);return mask;},isClosed:()=>closed,screenshot:async options=>{captures.push(options);if(captures.length===1&&error)throw error;if(captures.length===2&&fallbackError)throw fallbackError;}};
 return{captures,attachments,masks,run:()=>capture(page,'proved-pdp')};
}
test('normal full-page capture keeps its mask and attaches evidence once',async()=>{
 const f=fixture();await f.run();assert.equal(f.captures.length,1);assert.equal(f.captures[0].fullPage,true);assert.equal(f.attachments.length,1);
});
test('only proven compositor failure falls back once to a masked viewport capture',async()=>{
 const f=fixture({error:Error('page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot')});await f.run();
 assert.equal(f.captures.length,2);assert.equal(f.captures[1].fullPage,false);assert.equal(f.captures[0].path,f.captures[1].path);assert.equal(f.captures[0].mask,f.captures[1].mask);assert.equal(f.captures[1].animations,'disabled');assert.equal(f.masks.length,2);
 assert.equal(JSON.parse(f.attachments[0].body).mode,'VIEWPORT_RECOVERY');assert.equal(f.attachments[1].name,'proved-pdp');
});
test('closed page, timeout and unrelated protocol errors are not concealed',async()=>{
 for(const options of [{closed:true,error:Error('Protocol error (Page.captureScreenshot): Unable to capture screenshot')},{error:Error('TimeoutError')},{error:Error('Protocol error: Target closed')}]){
  const f=fixture(options);await assert.rejects(f.run(),e=>e===options.error);assert.equal(f.captures.length,1);assert.equal(f.attachments.length,0);
 }
});
test('failed fallback remains failed and never attaches nonexistent evidence',async()=>{
 const failure=Error('viewport unavailable'),f=fixture({error:Error('Protocol error (Page.captureScreenshot): Unable to capture screenshot'),fallbackError:failure});await assert.rejects(f.run(),e=>e===failure);assert.equal(f.captures.length,2);assert.equal(f.attachments.length,0);
});
