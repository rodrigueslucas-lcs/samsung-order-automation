const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {publisherEnvironment}=require('../utils/jenkinsPublisherConfig.cjs');
const {inspectHome}=require('../utils/jenkinsHomeWorkspace.cjs');

async function main(){
  const args=process.argv.slice(2);if(args.some(a=>a!=='--headed'))throw Error('Usage: node scripts/verify-jenkins-home.cjs [--headed]');
  const env=publisherEnvironment({}),base=new URL(env.JENKINS_URL),authorization='Basic '+Buffer.from(env.JENKINS_USER+':'+env.JENKINS_API_TOKEN).toString('base64');
  const request=(route,options={})=>fetch(base.origin+base.pathname.replace(/\/$/,'')+route,{...options,redirect:'manual',signal:AbortSignal.timeout(60000),headers:{Authorization:authorization,...options.headers}});
  const before=await inspectHome(request),output=path.resolve('test-results/jenkins-home-v2');fs.mkdirSync(output,{recursive:true});
  const resource=await request('/userContent/samsung-smb-quality/index.html'),resourceLocation=resource.headers.get('location'),resourceOrigin=resourceLocation?new URL(resourceLocation,base).origin:null;
  const browser=await chromium.launch({channel:'chrome',headless:!args.includes('--headed'),args:['--start-maximized']});
  let blockedWrites=0,nativeReadOnlyWidgetPosts=0;
  const result={screenshots:[],view:'01 - Overview',buildsTriggered:0};
  try{
    const context=await browser.newContext({viewport:{width:1500,height:1080}});
    await context.route('**/*',async route=>{
      const req=route.request(),u=new URL(req.url()),headers={...req.headers()};delete headers.authorization;
      if(!['GET','HEAD'].includes(req.method())){
        // Core sidebar widgets use POST even to read status. Block those too,
        // but distinguish them from any build/auth/configuration submission.
        if(req.method()==='POST'&&/^\/widget\/(BuildQueueWidget|ExecutorsWidget)\/ajax$/.test(u.pathname))nativeReadOnlyWidgetPosts++;
        else blockedWrites++;
        return route.abort();
      }
      // Fulfilling the authenticated response prevents Basic headers propagating
      // through a redirect onto Jenkins' anonymous signed resource domain.
      if(u.origin===base.origin){const response=await route.fetch({headers:{...headers,authorization},maxRedirects:0});return route.fulfill({response});}
      if(u.origin===resourceOrigin&&u.pathname.startsWith('/static-files/'))return route.continue({headers});
      return route.abort();
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',()=>errors.push('script-error'));
    await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByRole('heading',{name:'Samsung SMB — QA Automation Center',exact:true}).waitFor();
    await page.locator('.smb-freshness').filter({hasText:'LIVE'}).waitFor({timeout:60000});
    await page.waitForFunction(()=>document.querySelectorAll('.smb-flag').length===8&&[...document.querySelectorAll('.smb-flag')].every(i=>i.complete&&i.naturalWidth>0));
    const snapshot=await page.evaluate(async()=>{const root=document.querySelector('[data-smb-home]');return(await fetch((root.dataset.root||'').replace(/\/$/,'')+'/samsung-smb-home/snapshot',{credentials:'same-origin'})).json();});
    assert.equal(snapshot.jobs.length,10);assert.equal(await page.locator('.smb-card:visible').count(),10);assert.equal(await page.locator('.smb-build-button').count(),10);
    for(const label of ['MX — México','PE — Peru','CL — Chile','CO — Colômbia'])assert.equal(await page.getByText(label,{exact:true}).count(),2);
    assert.equal(errors.length,0);result.rootScriptErrors=0;result.flags=8;
    const capture=async(name)=>{const file=path.join(output,name+'.png');await page.screenshot({path:file,fullPage:true});result.screenshots.push(file);};
    await capture('desktop');
    for(const [index,name]of[[0,'base-store'],[1,'epp']]){const file=path.join(output,name+'.png');await page.locator('.smb-section').nth(index).screenshot({path:file});result.screenshots.push(file);}
    const liveFile=path.join(output,snapshot.running.length||snapshot.queue.length?'live-execution.png':'live-idle.png');await page.locator('.smb-monitor').screenshot({path:liveFile});result.screenshots.push(liveFile);
    for(const [width,name]of[[1100,'small-desktop'],[390,'mobile']]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await capture(name);}
    await page.setViewportSize({width:1500,height:1080});
    const firstObserved=snapshot.observedAt;await page.locator('[data-job="Samsung-SMB-CL"] .smb-build-button').focus();await page.evaluate(()=>scrollTo(0,500));const scroll=await page.evaluate(()=>scrollY);
    await page.waitForResponse(r=>r.url().endsWith('/samsung-smb-home/snapshot')&&r.status()===200,{timeout:25000});
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<2);
    const next=await page.evaluate(async()=>{const root=document.querySelector('[data-smb-home]');return(await fetch((root.dataset.root||'').replace(/\/$/,'')+'/samsung-smb-home/snapshot',{credentials:'same-origin'})).json();});
    assert.ok(next.observedAt>firstObserved);result.polling='PASS';result.running=next.running.length;result.queued=next.queue.length;result.executors=next.executors;
    const nativeQueue=await(await request('/queue/api/json?tree=items[task[name]]')).json();assert.equal(next.queue.length,(nativeQueue.items||[]).filter(i=>next.jobs.some(j=>j.name===i.task?.name)).length);
    const links=await page.locator('.smb-reports a').evaluateAll(nodes=>nodes.map(n=>({href:n.getAttribute('href'),label:n.textContent})));
    for(const link of links){assert.ok(link.href.startsWith('/')&&!link.href.startsWith('//'));const response=await request(link.href);assert.ok([200,302,303].includes(response.status));}
    result.reportLinks=links.length;
    // GET only: never click the native form's submit control or a non-parameterized build.
    let parameterPages=0;
    for(const job of next.jobs.filter(j=>j.parameterized&&j.canBuild&&!j.running.length&&!next.queue.some(q=>q.name===j.name))){
      const response=await page.goto(base.origin+'/job/'+encodeURIComponent(job.name)+'/build?delay=0sec',{waitUntil:'domcontentloaded'});
      // Jenkins 2.568 renders the native parameter review with HTTP 405 for GET;
      // the visible form is intentional, and no submission is made here.
      assert.ok([200,405].includes(response.status()));await page.getByRole('button',{name:'Build',exact:true}).waitFor();assert.ok(await page.locator('form').count()>0);parameterPages++;
    }
    result.parameterReviewPages=parameterPages;
    for(const job of next.jobs){
      for(const suffix of ['',...(job.completed?[job.completed.number+'/console']:[])]){const response=await request('/job/'+encodeURIComponent(job.name)+'/'+suffix);assert.equal(response.status,200);}
    }
    result.consoleAndHistory='PASS';
    await page.goto(base.href,{waitUntil:'domcontentloaded'});await page.locator('.smb-freshness').filter({hasText:'LIVE'}).waitFor();await page.reload({waitUntil:'domcontentloaded'});await page.locator('.smb-freshness').filter({hasText:'LIVE'}).waitFor();result.refreshPreserved=true;
    assert.equal(blockedWrites,0);result.blockedWriteAttempts=blockedWrites;result.nativeReadOnlyWidgetPostsBlocked=nativeReadOnlyWidgetPosts;
  }finally{await browser.close();}
  const after=await inspectHome(request);assert.deepEqual(after.protectedState,before.protectedState);assert.equal(after.primary,'01 - Overview');
  for(const job of before.jobs){const actual=after.jobs.find(j=>j.name===job.name);assert.equal(actual.configHash,job.configHash);assert.equal(actual.nextBuild,job.nextBuild);}
  result.jobsUnchanged=true;result.securityUnchanged=true;fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main().catch(error=>{console.error('[jenkins-home-verify] '+error.name+' · verification failed; inspect scoped UI evidence without exposing credentials.');console.error((error.stack||'').split('\n').filter(line=>line.includes('verify-jenkins-home.cjs:')).join('\n'));process.exitCode=1;});
