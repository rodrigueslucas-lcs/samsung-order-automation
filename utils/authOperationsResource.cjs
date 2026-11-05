const os=require('node:os');
const dns=require('node:dns').promises;
const {publisherEnvironment}=require('./jenkinsPublisherConfig.cjs');
function stableResourceAddress({platform=process.platform,run=require('node:child_process').execFileSync}={}) {
  if(platform!=='win32')return null;
  const shell=require('node:path').join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const script="$a=Get-NetIPAddress -AddressFamily IPv6 -ErrorAction Stop | Where-Object { $_.AddressState -eq 'Preferred' -and $_.SuffixOrigin -eq 'Link' -and $_.IPAddress -notmatch '^(fe80|fc|fd|::)' } | Select-Object -First 1 -ExpandProperty IPAddress; if(-not $a){exit 2}; $a";
  const value=run(shell,['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();
  if(!/^[a-fA-F0-9:]+$/.test(value)||!value.includes(':'))throw new Error('Stable local IPv6 resource address was not proven.');
  return value.toLowerCase();
}
async function repairResourceOrigin({apply=false,env=process.env,resourceAddress=null}={}, {request=fetch,lookup=dns.lookup,hostname=os.hostname,interfaces=os.networkInterfaces}={}) {
  const config=publisherEnvironment(env);
  const headers={Authorization:'Basic '+Buffer.from(config.JENKINS_USER+':'+config.JENKINS_API_TOKEN).toString('base64')};
  const path='/userContent/samsung-smb-auth/s2/index.html';
  const response=await request(config.JENKINS_URL+path,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
  const location=response.headers.get('location');
  // HTML Publisher reports are not always mirrored to /userContent. If that
  // diagnostic URL is absent, read the Resource Root setting itself via the
  // same admin-only Jenkins script console needed to repair it. Read-only
  // inspection must not change CSP, jobs, credentials or report files.
  let crumb;
  const getCrumb=async()=>{
    if(crumb)return crumb;
    const reply=await request(config.JENKINS_URL+'/crumbIssuer/api/json',{headers,redirect:'manual'});
    if(!reply.ok)throw new Error('Jenkins crumb unavailable.');
    crumb=await reply.json();
    if(!crumb?.crumbRequestField||!crumb?.crumb)throw new Error('Jenkins crumb unavailable.');
    return crumb;
  };
  const groovy=async script=>{
    const token=await getCrumb();
    const reply=await request(config.JENKINS_URL+'/scriptText',{method:'POST',redirect:'manual',headers:{...headers,[token.crumbRequestField]:token.crumb,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({script}).toString()});
    if(reply.status===403)throw Object.assign(new Error('Resource repair requires Jenkins Overall/Administer and script-console permission.'),{code:'JENKINS_ADMIN_REQUIRED'});
    if(!reply.ok)throw new Error('Jenkins resource configuration was not acknowledged.');
    return reply.text();
  };
  let previous;
  if(response.status===302&&location)previous=new URL(location,config.JENKINS_URL).origin;
  else {
    const current=await groovy("def c=jenkins.model.Jenkins.get().getExtensionList(jenkins.security.ResourceDomainConfiguration.class)[0]; println('RESOURCE_ORIGIN '+(c.getUrl() ?: ''))");
    const marker=current.split(/\r?\n/).find(line=>line.startsWith('RESOURCE_ORIGIN '));
    if(!marker)throw new Error('Jenkins resource configuration was not acknowledged.');
    const url=marker.slice('RESOURCE_ORIGIN '.length).trim();
    previous=url?new URL(url).origin:null;
  }
  const api=new URL(config.JENKINS_URL);
  // On a local Jenkins, use a different but stable loopback hostname. A
  // public IPv6 may rotate, whereas localhost and 127.0.0.1 stay local.
  const loopbackPeer=api.hostname==='localhost'?'127.0.0.1':api.hostname==='127.0.0.1'?'localhost':null;
  const name=loopbackPeer||resourceAddress?null:(hostname()+'.local').toLowerCase();
  if(name&&!/^[a-zA-Z0-9-]+\.local$/.test(name))throw new Error('Invalid machine DNS name.');
  const local=new Set(Object.values(interfaces()).flat().filter(Boolean).map(a=>a.address.split('%')[0].toLowerCase()));
  if(resourceAddress){if(!/^[a-fA-F0-9:]+$/.test(resourceAddress)||!local.has(resourceAddress.toLowerCase()))throw new Error('Resource address is not assigned to this machine.');}
  else if(!loopbackPeer){const answers=await lookup(name,{all:true});if(!answers.length||answers.some(a=>!local.has(a.address.split('%')[0].toLowerCase())))throw new Error('Resource hostname does not resolve exclusively to this machine.');}
  const resourceHost=resourceAddress?'['+resourceAddress+']':loopbackPeer||name;
  const target=api.protocol+'//'+resourceHost+(api.port?':'+api.port:'');
  if(target===api.origin)throw new Error('Resource and credential-bearing Jenkins origins must stay distinct.');
  // Jenkins's Resource Root intentionally serves ONLY static files. After
  // configuration, /login normally returns 404 on that host. Before the
  // switch, the same host may return 200, so accept either with Jenkins proof.
  const reachable=await request(target+'/login',{redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(![200,404].includes(reachable.status)||!reachable.headers.get('x-jenkins'))throw new Error('Stable resource hostname did not reach this Jenkins.');
  if(previous===target)return {changed:false,origin:target};
  if(!apply)return {changed:false,needsRepair:true,previous,origin:target};
  // Change only the resource-domain URL. No CSP, permissions, auth or job change.
  const script="def c=jenkins.model.Jenkins.get().getExtensionList(jenkins.security.ResourceDomainConfiguration.class)[0]; c.setUrl('"+target+"/'); c.save(); println('RESOURCE_ORIGIN_UPDATED')";
  if(!(await groovy(script)).includes('RESOURCE_ORIGIN_UPDATED'))throw new Error('Jenkins resource configuration was not acknowledged.');
  return {changed:true,previous,origin:target};
}
module.exports={repairResourceOrigin,stableResourceAddress};
