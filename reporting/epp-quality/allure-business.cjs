// A presentation layer for EPP Allure 2, aligned with Base Store business reporting.
// Applied ONLY to a private copy of Playwright's original Allure results before generation.
const fs = require('node:fs');
const path = require('node:path');

const FIELDS = [
  ['MX','SAM-25020','Product variants / selectors','Product & Catalog','Validate selection of an available PDP variant and the corresponding product identity.','The selected variation and resulting PDP identity are consistent.'],
  ['MX','SAM-25021','Add product to cart','Cart & Promotions','Add the configured programme product from its PDP to the cart.','The selected product is visible in the current EPP cart.'],
  ['MX','SAM-25022','Cart page UI','Cart & Promotions','Validate the EPP cart contents, summary and required footer.','Cart information and required controls are displayed correctly.'],
  ['MX','SAM-25034','Checkout — contact information','Checkout','Reach registered EPP checkout and validate contact details.','The contact-information section can be accessed and verified.'],
  ['MX','SAM-25044','Back to Top control','Cart & Promotions','Check the Back to Top control on the EPP cart.','The control behaves as required by the official scenario.'],
  ['MX','SAM-25045','Registered credit-card payment','Payment & Order','Create one authorised new EPP card order and verify its causal confirmation.','A new order and matching confirmation are proven within this campaign.'],
  ['MX','SAM-25046','Cash payment','Payment & Order','Validate the approved EPP cash payment journey when prerequisites permit it.','Cash payment behaviour is validated without ambiguous duplicate submissions.'],
  ['PE','SAM-25109','EPP login','Account & Access','Validate access to the configured EPP storefront and authorised verification gate.','The correct programme storefront and authenticated context are available.'],
  ['PE','SAM-25113','Add product to cart','Cart & Promotions','Add the configured EPP product from PDP to cart.','The selected programme product appears in the cart.'],
  ['PE','SAM-25114','Cart page UI','Cart & Promotions','Validate the cart product, summary and required footer.','The official cart UI components are visible and consistent.'],
  ['PE','SAM-25125','Checkout navigation','Checkout','Validate navigation from the cart into registered checkout.','The expected registered checkout step is reached; guest substitution is not accepted.'],
  ['PE','SAM-25138','Registered credit-card payment','Payment & Order','Create one new authorised card order and validate its causal confirmation.','The new current-campaign order is confirmed with matching evidence.'],
  ['PE','SAM-25140','Order confirmation','Payment & Order','Validate the current campaign order confirmation without submitting another payment.','Confirmation references the same proven new order created in this campaign.'],
  ['CL','SAM-24836','EPP login','Account & Access','Validate the configured CL EPP storefront and its verification-code gate.','The intended programme storefront is available with appropriate access.'],
  ['CL','SAM-24840','Add product to cart','Cart & Promotions','Add the configured CL EPP product from PDP to cart.','The EPP product is present and validated in the cart.'],
  ['CL','SAM-24841','Cart page UI','Cart & Promotions','Validate EPP cart product, summary and expected footer.','The expected cart presentation and required footer are available.'],
  ['CL','SAM-24851','Checkout navigation','Checkout','Validate checkout navigation from the CL EPP cart.','The correct checkout page and workflow are available.'],
  ['CL','SAM-24864','Registered card payment','Payment & Order','Create a new CL EPP credit/debit card order and validate its confirmation.','A new authorised order and matching public confirmation are proven.'],
  ['CL','SAM-24865','Direct bank transfer','Payment & Order','Validate a new CL EPP bank transfer order when reconciliation permits submission.','A single approved transfer leads to a proven current-campaign outcome.'],
  ['CL','SAM-24866','Order confirmation','Payment & Order','Validate confirmation for the CL EPP order without another payment submission.','Confirmation refers to the same causally proven new order.'],
  ['CO','SAM-24929','Product variants / selectors','Product & Catalog','Select a PDP variant and verify the corresponding product identity.','The chosen option and PDP identity are consistent.'],
  ['CO','SAM-24930','Add product to cart','Cart & Promotions','Add the configured CO EPP product from PDP to cart.','The selected product is visible in the EPP cart.'],
  ['CO','SAM-24931','Cart page UI','Cart & Promotions','Validate cart product, summary and required footer.','The official EPP cart sections behave as expected.'],
  ['CO','SAM-24942','Checkout — contact details','Checkout','Reach CO EPP checkout and validate the contact-details section.','The correct contact-details section is accessible and valid.'],
  ['CO','SAM-24952','Back to Top / tooltip','Cart & Promotions','Validate Back to Top behaviour and its programme-specific tooltip prerequisite.','Required Back to Top and tooltip behaviour is demonstrated with eligible test data.'],
  ['CO','SAM-24953','Registered credit-card payment','Payment & Order','Create one new authorised CO EPP card order and validate its causal confirmation.','The submitted test order and matching confirmation are proven.']
];
const catalog = Object.freeze(Object.fromEntries(FIELDS.map(([market,id,title,feature,objective,expected]) => [id,{market,id,title,feature,objective,expected}])));
const flags = Object.freeze({MX:'🇲🇽',PE:'🇵🇪',CL:'🇨🇱',CO:'🇨🇴'});
const safe = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text = value => String(value || '').replace(/\u001b\[[0-9;]*m/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();
const tcFrom = result => (String(result.name||'')+' '+String(result.fullName||'')).match(/\bSAM-\d+\b/)?.[0] || null;
const plainStatus = status => ({passed:'PASS',failed:'FAIL',broken:'BROKEN',skipped:'SKIPPED',unknown:'UNKNOWN'}[status] || String(status||'NOT RUN').toUpperCase());
const risk = Object.freeze({PASS:['#067647','#ECFDF3'],FAIL:['#B42318','#FEF3F2'],BROKEN:['#B54708','#FFFAEB'],SKIPPED:['#B54708','#FFFAEB'],UNKNOWN:['#475467','#F2F4F7']});
const technicalName = name => /^(?:before hooks?|after hooks?|worker cleanup)$/i.test(String(name||'').trim());
function statusSummary(result,quality){
  if(quality==='KNOWN_DEFECT')return 'Known application defect matched the current official run evidence. This is not a PASS.';
  if(quality==='TEST_DATA_REQUIRED')return 'Required test data was not available or not proven in this execution.';
  if(quality==='AUTH_BLOCKED')return 'Required authenticated identity or entitlement was unavailable.';
  if(quality==='RECONCILIATION_REQUIRED')return 'An earlier transaction needs reconciliation; another submission must not be assumed safe.';
  const code=String(result.status||'');
  if(code==='passed')return 'Recorded Playwright assertions passed during this run.';
  if(code==='skipped')return 'Scenario was skipped. See its recorded reason and prerequisites.';
  const first=text(result.statusDetails?.message).split('\n').find(Boolean);
  return first ? first.slice(0,360) : 'The current execution did not meet the expected scenario outcome.';
}
function addLabel(result,name,value){
  result.labels ||= [];
  result.labels=result.labels.filter(item=>item.name!==name);
  result.labels.push({name,value});
}
function collectAttachments(steps,output=[]){
  for(const step of steps||[]){output.push(...(step.attachments||[]));collectAttachments(step.steps,output);}
  return output;
}
function polishSteps(result){
  if(!Array.isArray(result.steps))return;
  const kept=[],promoted=[];
  for(const step of result.steps){
    if(technicalName(step.name)&&step.status!=='failed'&&step.status!=='broken'){
      collectAttachments([step],promoted);
    }else kept.push(step);
  }
  const seen=new Set((result.attachments||[]).map(a=>a.source).filter(Boolean));
  result.attachments ||= [];
  for(const attachment of promoted){
    if(!attachment.source||seen.has(attachment.source))continue;
    seen.add(attachment.source);
    result.attachments.push(attachment);
  }
  result.steps=kept;
}
function businessDescription(entry,result,quality,reference){
  const outcome=plainStatus(result.status);
  const [fg,bg]=risk[outcome]||risk.UNKNOWN;
  const jira='https://jira.secext.samsung.net/browse/'+entry.id;
  const summary=statusSummary(result,quality);
  const verifiedSteps=(result.steps||[]).filter(step=>!technicalName(step.name)).map(step=>'<li>'+safe(step.name)+' <small style="color:#607185">('+safe(step.status||'recorded')+')</small></li>').join('');
  const defect=quality==='KNOWN_DEFECT';
  const status=defect?'KNOWN DEFECT · '+outcome:quality && quality!=='PASS'?quality.replace(/_/g,' ')+' · '+outcome:outcome;
  // Keep the business summary distinct from the actual technical status.
  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:980px;line-height:1.55;color:#172b45">' +
    '<div style="background:'+bg+';border:1px solid '+fg+'66;border-left:5px solid '+fg+';border-radius:12px;padding:16px 18px;margin:0 0 14px">' +
    '<div style="font-size:12px;font-weight:800;color:'+fg+';letter-spacing:.7px">'+safe(status)+'</div>' +
    '<div style="font-size:20px;font-weight:800;margin:6px 0;color:#102943">'+safe(entry.title)+'</div>' +
    '<a href="'+jira+'" style="color:#0757aa;font-weight:750" target="_blank" rel="noopener noreferrer">'+entry.id+' · Official QST</a></div>' +
    (quality==='KNOWN_DEFECT' && /^(?:RT|SAM)-\\d+$/.test(reference||'') ?
      '<div style="background:#f5f0ff;border:1px solid #bdb4fe;border-left:5px solid #7853bb;border-radius:10px;padding:13px 16px;margin:12px 0;color:#34234d"><strong>Known Defect · </strong><a style="color:#5b3b9f;font-weight:800" href="https://jira.secext.samsung.net/browse/'+safe(reference)+'" target="_blank" rel="noopener noreferrer">'+safe(reference)+'</a><p style="margin:5px 0 0">Current matching evidence does not count as PASS.</p></div>' : '') +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-bottom:12px">' +
    section('O que foi validado',entry.objective) + section('Resultado esperado',entry.expected) + '</div>' +
    '<div style="border:1px solid #d9e4f0;border-left:4px solid '+fg+';border-radius:10px;background:#fff;padding:14px 16px;margin:12px 0">' +
    '<strong style="color:#183856">Resultado observado</strong><p style="margin:6px 0;color:#273a51;overflow-wrap:anywhere">'+safe(summary)+'</p></div>' +
    (verifiedSteps?'<div style="border:1px solid #d9e4f0;border-radius:10px;background:#fff;padding:14px 16px;margin:12px 0">' +
      '<strong style="color:#183856">Passos registrados nesta execução</strong><ol style="margin:8px 0 0;padding-left:19px;color:#263c55">'+verifiedSteps+'</ol></div>':'') +
    '<div style="border:1px solid #d9e4f0;border-radius:10px;background:#f6f9fd;padding:12px 15px">' +
    '<strong style="color:#183856">Contexto da execução</strong><div style="color:#425772;font-size:13px;margin-top:5px">' +
    safe(flags[entry.market]+' '+entry.market)+' · EPP · S2 · '+safe(entry.feature)+
    '</div><p style="margin:6px 0 0;color:#53657d;font-size:12px">Allure status is the original Playwright status. Quality classification is an additional QA label. Full diagnostics are retained in the technical attachments and source results.</p></div></div>';
}
function section(title,body){return '<div style="border:1px solid #d9e4f0;border-radius:10px;background:#fff;padding:14px 16px"><strong style="color:#183856">'+safe(title)+'</strong><p style="color:#334b63;margin:7px 0 0">'+safe(body)+'</p></div>';}
function copyAndPolish(sourceDir,destinationDir,{market,rows=[]}={}){
  if(!['MX','PE','CL','CO'].includes(market))throw Error('Unsupported EPP presentation market.');
  const source=path.resolve(sourceDir),destination=path.resolve(destinationDir);
  if(source===destination||destination.startsWith(source+path.sep)||source.startsWith(destination+path.sep))throw Error('Presentation input and source must be independent.');
  if(fs.existsSync(destination))throw Error('EPP presentation directory already exists; refusing to mix runs.');
  fs.cpSync(source,destination,{recursive:true,errorOnExist:true,force:false});
  const quality=new Map(rows.map(row=>[row.tc,row]));
  const files=fs.readdirSync(destination).filter(name=>name.endsWith('-result.json'));
  const seen=new Set();
  for(const file of files){
    const target=path.join(destination,file);
    const result=JSON.parse(fs.readFileSync(target,'utf8'));
    const id=tcFrom(result),entry=catalog[id];
    if(!entry||entry.market!==market)throw Error('Unrecognized or foreign official EPP Allure case: '+String(id));
    if(seen.has(id))throw Error('Duplicate official EPP Allure case: '+id);
    seen.add(id);
    // Raw source file stays unchanged; preserve test outcome, history identity, UUID and actual step assertions.
    const rawStatus=result.status;
    result.name=id+' · '+entry.title;
    result.labels=(result.labels||[]).filter(label=>!['parentSuite','suite','subSuite','epic','feature','story'].includes(label.name));
    addLabel(result,'parentSuite',flags[market]+' '+market+' · S2');
    addLabel(result,'suite','EPP · Official QST');
    addLabel(result,'subSuite',entry.feature);
    addLabel(result,'epic','Samsung SMB QST');
    addLabel(result,'feature',market+' · EPP · '+entry.feature);
    addLabel(result,'story',id+' · '+entry.title);
    addLabel(result,'tag','official-epp');
    if(quality.has(id))addLabel(result,'tag','QA: '+quality.get(id).quality);
    result.parameters=(result.parameters||[]).map(p=>/^(?:Project|Browser)$/i.test(p.name||'')?{...p,mode:'hidden',excluded:true}:p);
    polishSteps(result);
    result.descriptionHtml=businessDescription(entry,result,quality.get(id)?.quality,quality.get(id)?.reference);
    delete result.description;
    // Keep detailed exception in its own collapsible attachment instead of a wall of log text.
    if(rawStatus==='failed'||rawStatus==='broken'){
      const diagnostic=[text(result.statusDetails?.message),text(result.statusDetails?.trace)].filter(Boolean).join('\n\n');
      if(diagnostic){
        const filename='epp-failure-'+id+'.txt';
        fs.writeFileSync(path.join(destination,filename),diagnostic);
        result.attachments ||= [];
        result.attachments.push({name:'Full Playwright failure diagnostic',source:filename,type:'text/plain'});
        result.statusDetails ||= {};
        result.statusDetails.message=text(result.statusDetails.message).split('\n')[0].slice(0,380)+'\nFull technical details: see attached Playwright failure diagnostic.';
        result.statusDetails.trace='';
      }
    }
    if(result.status!==rawStatus)throw Error('Raw Allure status was modified unexpectedly.');
    fs.writeFileSync(target,JSON.stringify(result));
  }
  return {total:files.length,market,caseIds:[...seen]};
}
module.exports={catalog,flags,businessDescription,copyAndPolish,tcFrom,polishSteps};
