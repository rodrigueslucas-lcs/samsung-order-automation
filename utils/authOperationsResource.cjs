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
  if(response.status!==302||!location)throw new Error('Jenkins isolated resource redirect was not observed.');
  const previous=new URL(location).origin;
  const name=(hostname()+'.local').toLowerCase();
  if(!/^[a-zA-Z0-9-]+\.local$/.test(name))throw new Error('Invalid machine DNS name.');
  const local=new Set(Object.values(interfaces()).flat().filter(Boolean).map(a=>a.address.split('%')[0].toLowerCase()));
  if(resourceAddress){if(!/^[a-fA-F0-9:]+$/.test(resourceAddress)||!local.has(resourceAddress.toLowerCase()))throw new Error('Resource address is not assigned to this machine.');}
  else {const answers=await lookup(name,{all:true});if(!answers.length||answers.some(a=>!local.has(a.address.split('%')[0].toLowerCase())))throw new Error('Resource hostname does not resolve exclusively to this machine.');}
  const api=new URL(config.JENKINS_URL);
  const target=api.protocol+'//'+(resourceAddress?'['+resourceAddress+']':name)+(api.port?':'+api.port:'');
  if(target===api.origin)throw new Error('Resource and credential-bearing Jenkins origins must stay distinct.');
  if(previous===target)return {changed:false,origin:target};
  const reachable=await request(target+'/login',{redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(!reachable.ok||!reachable.headers.get('x-jenkins'))throw new Error('Stable resource hostname did not reach this Jenkins.');
  if(!apply)return {changed:false,needsRepair:true,previous,origin:target};
  const crumbResponse=await request(config.JENKINS_URL+'/crumbIssuer/api/json',{headers,redirect:'manual'});
  if(!crumbResponse.ok)throw new Error('Jenkins crumb unavailable.');
  const crumb=await crumbResponse.json();
  // Change only the resource-domain URL. No CSP, permissions, auth or job change.
  const script="def c=jenkins.model.Jenkins.get().getExtensionList(jenkins.security.ResourceDomainConfiguration.class)[0]; c.setUrl('"+target+"/'); c.save(); println('RESOURCE_ORIGIN_UPDATED')";
  const result=await request(config.JENKINS_URL+'/scriptText',{method:'POST',redirect:'manual',headers:{...headers,[crumb.crumbRequestField]:crumb.crumb,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({script}).toString()});
  if(result.status===403)throw Object.assign(new Error('Resource repair requires Jenkins Overall/Administer and script-console permission.'),{code:'JENKINS_ADMIN_REQUIRED'});
  if(!result.ok||!(await result.text()).includes('RESOURCE_ORIGIN_UPDATED'))throw new Error('Jenkins resource configuration was not acknowledged.');
  return {changed:true,previous,origin:target};
}
module.exports={repairResourceOrigin,stableResourceAddress};
