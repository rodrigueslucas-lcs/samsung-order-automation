const {jobs}=require('../reporting/jenkins-home/view.cjs');
const overview='01 - Overview';
async function adminJson(request,script){
 const crumbResponse=await request('/crumbIssuer/api/json');
 if(!crumbResponse.ok)throw Error('Home workspace CSRF read blocked.');
 const crumb=await crumbResponse.json();
 if(!/^[A-Za-z0-9-]+$/.test(crumb.crumbRequestField||'')||!crumb.crumb)throw Error('Home workspace CSRF invalid.');
 const response=await request('/scriptText',{method:'POST',headers:{[crumb.crumbRequestField]:crumb.crumb,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({script})});
 if(!response.ok)throw Error('Home workspace Overall/Administer or script access blocked: HTTP '+response.status);
 try{return JSON.parse((await response.text()).trim());}catch{throw Error('Home workspace administrative response invalid; details suppressed.');}
}
const fingerprint=`def sha={s->java.security.MessageDigest.getInstance('SHA-256').digest(s.getBytes('UTF-8')).encodeHex().toString()}; def protectedState=[realm:sha(Jenkins.XSTREAM2.toXML(j.securityRealm)),authorization:sha(Jenkins.XSTREAM2.toXML(j.authorizationStrategy)),credentials:new File(j.rootDir,'credentials.xml').exists()?sha(new File(j.rootDir,'credentials.xml').getText('UTF-8')):null,executors:j.numExecutors,mode:j.mode.toString(),formatter:sha(Jenkins.XSTREAM2.toXML(j.markupFormatter)),resourceDomain:sha(String.valueOf(jenkins.security.ResourceDomainConfiguration.get().getUrl())),csp:sha(String.valueOf(System.getProperty('hudson.model.DirectoryBrowserSupport.CSP')))];`;
async function inspectHome(request){
 return adminJson(request,`import jenkins.model.Jenkins; import groovy.json.JsonOutput; def j=Jenkins.get(); j.checkPermission(Jenkins.ADMINISTER); ${fingerprint}
 def reportActions={run->run.getAllActions().findAll{a->a.urlName!=null&&a.urlName==~ /[A-Za-z0-9_.-]+/&&a.urlName==~ /(?i).*(Executive|Dashboard|Quality|Allure|Playwright).*/}};
 def names=${JSON.stringify(jobs)}; def rows=names.collect{n->def q=j.getItemByFullName(n); if(q==null)throw new IllegalStateException('Home job unavailable'); def r=q.lastCompletedBuild; def published=q.builds.take(20).find{run->!run.building&&!reportActions(run).isEmpty()}; [name:n,building:q.lastBuild?.building?:false,completed:r?[number:r.number,result:r.result?.toString(),duration:r.duration,timestamp:r.timeInMillis]:null,reports:published?reportActions(published).collect{a->[path:a.urlName,build:published.number]}:[],configHash:sha(q.configFile.asString()),nextBuild:q.nextBuildNumber]};
 println(JsonOutput.toJson([observedAt:new Date().format("yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),primary:j.primaryView.name,formatter:j.markupFormatter.class.name,pluginActive:j.pluginManager.getPlugin('dashboard-view')?.active?:false,pluginVersion:j.pluginManager.getPlugin('dashboard-view')?.version,controlCenterActive:j.pluginManager.getPlugin('samsung-smb-home')?.active?:false,protectedState:protectedState,jobs:rows]))`);
}
function configurationScript(snapshot,owner){
 // V2 is rendered by a scoped DashboardPortlet, independent of the global formatter.
 if(!snapshot.controlCenterActive)throw Error('Home workspace scoped Control Center plugin must be installed and active first.');
 const html=Buffer.from('<!-- '+owner+' -->','utf8').toString('base64');
 const expected=Buffer.from(JSON.stringify(snapshot.jobs.map(j=>({name:j.name,configHash:j.configHash,nextBuild:j.nextBuild}))),'utf8').toString('base64');
 const security=Buffer.from(JSON.stringify(snapshot.protectedState),'utf8').toString('base64');
 return `import jenkins.model.Jenkins; import groovy.json.JsonOutput; import groovy.json.JsonSlurper; import hudson.plugins.view.dashboard.Dashboard;
 def j=Jenkins.get();j.checkPermission(Jenkins.ADMINISTER); ${fingerprint}
 def expected=new JsonSlurper().parseText(new String('${expected}'.decodeBase64(),'UTF-8'));def protectedBefore=new JsonSlurper().parseText(new String('${security}'.decodeBase64(),'UTF-8'));
 if(protectedState!=protectedBefore)throw new IllegalStateException('Protected configuration changed before UI update');
 expected.each{r->def q=j.getItemByFullName(r.name);if(q==null||sha(q.configFile.asString())!=r.configHash||q.nextBuildNumber!=r.nextBuild)throw new IllegalStateException('Job changed before UI update')};
 def old=j.getView('${overview}');if(old==null||!old.description?.contains('${owner}'))throw new IllegalStateException('Home overview ownership mismatch');
 if(!(old.class.name in ['hudson.model.ListView','hudson.plugins.view.dashboard.Dashboard']))throw new IllegalStateException('Unrecognized overview type');
 if(!j.pluginManager.getPlugin('dashboard-view')?.active)throw new IllegalStateException('Dashboard plugin unavailable');
 def previous=j.primaryView.name;def v=old;
 if(!(v instanceof Dashboard)){def replacement=new Dashboard('${overview}');replacement.setJobNames(new TreeSet(expected.collect{it.name}));
  if(j.primaryView==old){def all=j.getView('all');if(all==null)throw new IllegalStateException('All view unavailable');j.setPrimaryView(all)};
  j.deleteView(old);try{j.addView(replacement);v=replacement}catch(Exception error){j.addView(old);j.setPrimaryView(j.getView(previous));j.save();throw error}}
 v.setJobNames(new TreeSet(expected.collect{it.name}));v.setIncludeStdJobList(false);v.setHideJenkinsPanels(false);
 def type=j.pluginManager.uberClassLoader.loadClass('io.samsung.qa.home.ControlCenterPortlet');
 v.setTopPortlets([type.getConstructor(String.class).newInstance('Samsung SMB QA Automation Center')]);v.setLeftPortlets([]);v.setRightPortlets([]);
 v.setBottomPortlets([]);
 v.setDescription(new String('${html}'.decodeBase64(),'UTF-8'));v.save();j.setPrimaryView(v);j.save();
 expected.each{r->def q=j.getItemByFullName(r.name);if(sha(q.configFile.asString())!=r.configHash||q.nextBuildNumber!=r.nextBuild)throw new IllegalStateException('Job changed during UI update')};
 if(sha(Jenkins.XSTREAM2.toXML(j.securityRealm))!=protectedBefore.realm||sha(Jenkins.XSTREAM2.toXML(j.authorizationStrategy))!=protectedBefore.authorization)throw new IllegalStateException('Security invariant failed');
 println(JsonOutput.toJson([primary:j.primaryView.name,changedDefaultView:previous!='${overview}',defaultViewVerified:true,persisted:j.configFile.asString().contains('<primaryView>${overview}</primaryView>'),formatter:j.markupFormatter.class.name,viewType:v.class.name,jobCount:v.items.size(),jobsUnchanged:true,buildStarted:false,previousPrimary:previous]))`;
}
async function applyHome(request,snapshot,owner){
 if(!snapshot.pluginActive)throw Error('Home workspace Dashboard View plugin must be installed and active first.');
 if(!snapshot.controlCenterActive)throw Error('Home workspace scoped Control Center plugin must be installed and active first.');
 const result=await adminJson(request,configurationScript(snapshot,owner));
 if(result.primary!==overview||result.persisted!==true||result.defaultViewVerified!==true||result.jobCount!==10||result.jobsUnchanged!==true)throw Error('Home workspace persisted default view verification failed.');
 const after=await inspectHome(request);
 if(JSON.stringify(after.protectedState)!==JSON.stringify(snapshot.protectedState))throw Error('Home workspace protected configuration invariant failed.');
 return result;
}
module.exports={inspectHome,applyHome,configurationScript,adminJson,overview};
