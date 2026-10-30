const EPP_ACCESS = Object.freeze({
  MX: Object.freeze({
    S1: Object.freeze({
      storefrontUrl: "https://stg.shop.samsung.com/mx/multistore/mxtotalplay/mxtotalplay/",
      verificationCode: "12345",
      accessMode: "verification-code",
      sku: null,
    }),
    S2: Object.freeze({
      storefrontUrl: "https://stg2.shop.samsung.com/mx/multistore/pymesmx/pymesmx/p/SM-F741BLBKLTM",
      verificationCode: "12345",
      accessMode: "verification-code",
      sku: "SM-F741BLBKLTM",
    }),
  }),
  CO: Object.freeze({
    S1: Object.freeze({
      storefrontUrl: "https://stg.shop.samsung.com/co/multistore/colaboradores_co/colaboradores_co/",
      verificationCode: "12345",
      accessMode: "verification-code",
      sku: null,
    }),
    S2: Object.freeze({
      storefrontUrl: "https://stg2.shop.samsung.com/co/multistore/co_epp_agre/co_epp_agre/p/QN85QN85DBKXZL",
      verificationCode: null,
      accessMode: "corporate-email-link",
      sku: "QN85QN85DBKXZL",
      note: "Enter a corporate email ID, activate the profile from the email link, then re-launch the EPP URL.",
    }),
  }),
  PE: Object.freeze({
    S1: Object.freeze({
      storefrontUrl: "https://stg.shop.samsung.com/pe/multistore/beneficios_empleados/beneficios_empleados/auth/multistore",
      verificationCode: "JET85",
      accessMode: "verification-code",
      sku: null,
    }),
    S2: Object.freeze({
      storefrontUrl: "https://stg2.shop.samsung.com/pe/multistore/beneficios_empleados/beneficios_empleados/",
      verificationCode: "JET85",
      accessMode: "verification-code",
      sku: null,
    }),
  }),
  CL: Object.freeze({
    S1: Object.freeze({
      storefrontUrl: "https://stg.shop.samsung.com/cl/multistore/alianzas/alianzas/",
      verificationCode: "JET85",
      accessMode: "verification-code",
      sku: null,
    }),
    S2: Object.freeze({
      storefrontUrl: "https://stg2.shop.samsung.com/cl/multistore/alianzas/alianzas/",
      authPath: "auth/multistore",
      verificationCode: "JET85",
      accessMode: "verification-code",
      sku: null,
    }),
  }),
});

// Operator observations are routing policy, never runtime entitlement proof.
function getEppPrograms(market, environment='S2') {
  const code=String(market).toUpperCase(),env=normalizeEnvironment(environment);
  if(!EPP_ACCESS[code])throw new Error('Unsupported EPP market.');
  const legacy=EPP_ACCESS[code][env],root=inferMultistoreRoot(new URL(legacy.storefrontUrl));
  const legacyId=root.pathname.split('/').filter(Boolean)[2];
  const make=(id,priority,extra={})=>Object.freeze({id,canonicalUrl:new URL(`/${code.toLowerCase()}/multistore/${id}/${id}/`,root).href,registrationUrl:null,requiresRetirees:null,callbackBehavior:'UNPROVEN',priority,knownStatus:'UNPROVEN',allowAutomaticRetry:true,notes:'Independent identity, entitlement and storefront proof required.',...extra});
  const old=make(legacyId,10,{canonicalUrl:root.href,legacy:true,...(code==='CO'&&env==='S2'?{priority:99,knownStatus:'BLOCKED_CALLBACK_TO_PRODUCTION',allowAutomaticRetry:false,callbackBehavior:'TO_PRODUCTION',requiresRetirees:true}:{}),...(code==='PE'&&env==='S2'?{priority:99,knownStatus:'VERIFICATION_CODE_REJECTED',allowAutomaticRetry:false}:{}),...(code==='CL'?{knownStatus:'OBSERVED_FUNCTIONAL'}:{})});
  const programs=[old];
  if(code==='CL')programs.push(
    make('colaboradores',20,{allowAutomaticRetry:false,notes:'Documented CL internal EPP; independent access proof required before execution.'}),
    make('ventab2b_cl',30,{allowAutomaticRetry:false,notes:'Documented CL Direct Bank Transfer programme; independent access/provider proof required.'})
  );
  if(code==='CO'&&env==='S2')programs.push(make('alianzas_co',1,{knownStatus:'OBSERVED_FUNCTIONAL',requiresRetirees:true,identityEntryPath:'/co/',registrationUrl:new URL('/co/multistore/alianzas_co/alianzas_co/registration',root).href}),make('estudiantes_co',2,{knownStatus:'OBSERVED_RECOVERABLE',requiresRetirees:true,identityEntryPath:'/co/',callbackBehavior:'BROKEN_400_RECOVER_CANONICAL'}));
  if(code==='PE'&&env==='S2'){
    programs.push(make('ventaestudiantes',30,{canonicalUrl:new URL('/pe/multistore/peeppmulti/ventaestudiantes/',root).href,apiSite:'ventaestudiantes',referenceSku:'QN65QN800DGXPE',allowAutomaticRetry:false,notes:'SDS QA reference; storefront-observed OCC baseSite ventaestudiantes differs from URL segment peeppmulti. Explicit selection only; independent identity, entitlement and payment proof required.'}));
    programs.push(make('pe_centelec',1,{canonicalUrl:new URL('/pe/pe_centelec/pe_centelec/',root).href,knownStatus:'PROGRAM_CONTEXT_NOT_PROVEN',callbackBehavior:'ALTERNATIVE_ROOT_TO_PRODUCTION',allowAutomaticRetry:false}));
    programs.push(make('pe_membership_vip',2,{reportedEntryUrl:new URL('/pe/pe_membership_vip/pe_membership_vip/',root).href,identityEntryPath:'/pe/',knownStatus:'OBSERVED_FUNCTIONAL',callbackBehavior:'STAGING_RETURN_VERIFIED',allowAutomaticRetry:true}));
    programs.push(make('pe_yape',3,{registrationUrl:new URL('/pe/multistore/pe_yape/pe_yape/registration',root).href,knownStatus:'ENTITLEMENT_OR_STOREFRONT_RENDER_BLOCKED',requiresRetirees:true,allowAutomaticRetry:false}));
  }
  return Object.freeze(programs.sort((a,b)=>a.priority-b.priority));
}

function normalizeEnvironment(value) {
  const environment = String(value || "S2").trim().toUpperCase();
  if (!["S1", "S2"].includes(environment)) throw new Error(`Unsupported EPP environment: ${environment}.`);
  return environment;
}

function inferMultistoreRoot(url) {
  const pathname = url.pathname;
  const pdpMarker = pathname.toLowerCase().indexOf("/p/");
  const rootPath = pdpMarker >= 0 ? pathname.slice(0, pdpMarker + 1) : pathname.replace(/auth\/multistore\/?$/i, "");
  return new URL(rootPath.endsWith("/") ? rootPath : `${rootPath}/`, url.origin);
}

function getEppConfig(market, environment = process.env) {
  const code = String(market || "").trim().toUpperCase();
  if (!EPP_ACCESS[code]) throw new Error(`Unsupported EPP market: ${market}.`);
  const envName = normalizeEnvironment(
    environment[`${code}_QST_ENVIRONMENT`] || environment.ENVIRONMENT || "S2"
  );
  const source = EPP_ACCESS[code][envName];
  const programs=getEppPrograms(code,envName);
  const selected=String(environment[`${code}_EPP_PROGRAM`]||environment.EPP_PROGRAM||'').trim();
  let program=selected?programs.find(p=>p.id===selected):programs.find(p=>!['BLOCKED_CALLBACK_TO_PRODUCTION','VERIFICATION_CODE_REJECTED','ENTITLEMENT_OR_STOREFRONT_RENDER_BLOCKED','BLOCKED_EXTERNAL','STORE_FRONT_RENDER_BLOCKED','PROGRAM_CONTEXT_NOT_PROVEN'].includes(p.knownStatus))||programs.find(p=>p.legacy);
  if(!program)throw new Error('Unknown EPP programme for market/environment.');
  const authSlot = String(environment[`${code}_EPP_AUTH_SLOT`] || environment.EPP_AUTH_SLOT || 'primary').toLowerCase();
  if (!['primary', 'second'].includes(authSlot) || (authSlot === 'second' && !['MX', 'CO'].includes(code))) throw new Error('Unsupported EPP account slot.');
  const override = String(environment[`${code}_EPP_STOREFRONT_URL`] || "").trim();
  const entryUrl = new URL(override || (program.legacy?source.storefrontUrl:program.canonicalUrl));
  if (entryUrl.protocol !== "https:") throw new Error(`${code} EPP storefront must use https.`);
  const expectedHost = envName === "S2" ? "stg2.shop.samsung.com" : "stg.shop.samsung.com";
  if (entryUrl.hostname !== expectedHost || entryUrl.port || entryUrl.username || entryUrl.password) {
    throw new Error(`${code} EPP storefront must use the configured ${envName} staging host.`);
  }
  if(override&&!selected){
    const matched=programs.find(p=>p.canonicalUrl===inferMultistoreRoot(entryUrl).href);
    if(!matched)throw new Error('EPP override must identify a registered staging programme.');
    program=matched;
  }
  const approvedAlternative=!program.legacy&&new URL(program.canonicalUrl).pathname===entryUrl.pathname;
  if (!entryUrl.pathname.toLowerCase().startsWith(`/${code.toLowerCase()}/multistore/`)&&!approvedAlternative) {
    throw new Error(`${code} EPP storefront must stay inside /${code.toLowerCase()}/multistore/.`);
  }
  const rootUrl = inferMultistoreRoot(entryUrl);
  if(selected&&rootUrl.href!==program.canonicalUrl)throw new Error('Selected EPP programme cannot route to another programme.');
  const explicitPdp = String(environment[`${code}_EPP_QST_PDP_URL`] || "").trim();
  const pdpUrl = explicitPdp ? new URL(explicitPdp) : (/\/p\//i.test(entryUrl.pathname) ? entryUrl : program.referenceSku ? new URL('p/'+encodeURIComponent(program.referenceSku),rootUrl) : null);
  const sku = String(environment[`${code}_EPP_QST_SKU`] || (program.legacy?source.sku:program.referenceSku) || "").trim() || null;
  if (pdpUrl && (pdpUrl.origin !== rootUrl.origin || pdpUrl.username || pdpUrl.password || !pdpUrl.pathname.startsWith(rootUrl.pathname) || !/\/p\/[^/]+\/?$/.test(pdpUrl.pathname))) {
    throw new Error(`${code} EPP PDP must stay on the configured staging multistore.`);
  }
  if (pdpUrl && sku && decodeURIComponent(pdpUrl.pathname.split('/').filter(Boolean).at(-1)) !== sku) throw new Error("EPP PDP and SKU must identify the same product.");
  const plpValue = String(environment[`${code}_EPP_QST_PLP_URL`] || "").trim();
  const plpUrl = plpValue ? new URL(plpValue) : null;
  if (plpUrl && (plpUrl.origin !== rootUrl.origin || !plpUrl.pathname.startsWith(rootUrl.pathname) || plpUrl.username || plpUrl.password)) throw new Error("EPP PLP must stay inside the configured staging multistore.");
  return Object.freeze({
    market: code,
    ...(program.apiSite?{apiSite:program.apiSite}:{}),
    program: program.id,
    programPolicy: program,
    programNamespace: program.legacy?null:program.id,
    authSlot,
    environment: envName,
    environmentLabel: envName === "S2" ? "S2/STG2" : "S1/STG",
    entryUrl,
    rootUrl,
    identityEntryUrl:program.identityEntryPath?new URL(program.identityEntryPath,rootUrl):null,
    authEntryUrl: source.authPath&&program.legacy ? new URL(source.authPath, rootUrl) : null,
    pdpUrl,
    sku,
    plpUrl,
    cartUrl: new URL("cart", rootUrl),
    verificationCode: program.legacy?source.verificationCode:null,
    accessMode: program.legacy?source.accessMode:'existing-entitlement',
    note: source.note || null,
  });
}

module.exports = { EPP_ACCESS, getEppConfig, getEppPrograms, inferMultistoreRoot, normalizeEnvironment };
