const fs = require('node:fs');
const path = require('node:path');
const filename = path.resolve(__dirname, '../playwright/.auth/epp/runtime-data.json');

function getMxCardOverride(config, io, env) {
  if(config.market!=='MX'||!env.MX_EPP_TEST_CARD_FILE)return null;
  if(config.environment!=='S2'||config.program!=='pymesmx')throw new Error('MX_EPP_CARD_SCOPE_INVALID: only MX S2 pymesmx is supported.');
  const directory=path.resolve(__dirname,'../playwright/.auth/epp/cards');
  const file=path.resolve(env.MX_EPP_TEST_CARD_FILE),relative=path.relative(directory,file);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||path.extname(file)!=='.json')throw new Error('MX_EPP_CARD_FILE_INVALID: use an ignored EPP cards JSON fixture.');
  let fixture;
  try{fixture=JSON.parse(io.readFileSync(file,'utf8'));}catch{throw new Error('MX_EPP_CARD_FILE_INVALID: fixture unavailable or invalid; contents suppressed.');}
  if(!fixture||fixture.market!=='MX'||fixture.environment!=='S2'||fixture.program!=='pymesmx'||fixture.provider!=='mercadopago'||fixture.type!=='credit'||fixture.scenario!=='approved'||!['mastercard','visa','amex'].includes(fixture.brand)||!/^[-a-z0-9]{1,64}$/.test(fixture.id||''))throw new Error('MX_EPP_CARD_SCOPE_INVALID: fixture identity/provider/scenario not accepted.');
  const card=fixture.card;
  if(!card||!['number','holderName','expiry','cvv','document'].every(k=>typeof card[k]==='string'&&card[k].trim()))throw new Error('MX_EPP_CARD_DATA_INCOMPLETE: approved fixture fields required; contents suppressed.');
  const digits=card.number.replace(/\s/g,'');
  const patterns={mastercard:/^(?:5[1-5]\d{14}|2[2-7]\d{14})$/,visa:/^4\d{15}$/,amex:/^3[47]\d{13}$/};
  if(!patterns[fixture.brand].test(digits)||!new RegExp('^\\d{'+(fixture.brand==='amex'?4:3)+'}$').test(card.cvv)||!/^APRO$/i.test(card.holderName)||! /^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry))throw new Error('MX_EPP_CARD_DATA_INVALID: fixture format does not match the approved credit scenario.');
  const selected=Object.fromEntries(['number','holderName','expiry','cvv','document'].map(key=>[key,card[key]]));
  return {card:{...selected,number:digits},cardFixture:{id:fixture.id,brand:fixture.brand,provider:fixture.provider,type:fixture.type}};
}
function getEppRuntimeData(config, io = fs, env = process.env) {
  if (!io.existsSync(filename)) return null;
  let source;
  try {
    source = JSON.parse(io.readFileSync(filename, 'utf8'));
  } catch { throw new Error('EPP ignored QA data file is invalid; contents suppressed.'); }
  const market = source[config.environment]?.[config.market];
  const data = config.programNamespace ? market?.programs?.[config.programNamespace] : market;
  if(!data||typeof data!=='object'||Array.isArray(data))return null;
  const override=getMxCardOverride(config,io,env);
  return override?{...data,payment:{...data.payment,...override}}:data;
}
function getEppContact(config, io = fs) {
  const contact = getEppRuntimeData(config, io)?.contact;
  if (!contact) return null;
  if (!['firstName','lastName','phone'].every(name => typeof contact[name] === 'string' && contact[name].trim())) throw new Error('EPP QA contact fields are incomplete; contents suppressed.');
  return contact;
}
module.exports = { getEppRuntimeData, getEppContact };
