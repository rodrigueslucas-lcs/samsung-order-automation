const {expect}=require('@playwright/test');
const assertions=require('../../utils/eppBusinessAssertions.cjs');
const runtime=require('../../utils/eppRuntimeData.cjs');

function assertCoEppCheckout(page,cfg){
  if(cfg.market!=='CO'||cfg.environment!=='S2'||cfg.program!=='co_epp_agre')throw new Error('CO EPP checkout requires its proven S2 programme.');
  assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
}

async function selectCoEppStandardDelivery(page,cfg){
  assertCoEppCheckout(page,cfg);
  const option=page.locator('label[for="group0co-Normal-9-11"]');
  await expect(option).toBeVisible({timeout:45000});
  const radio=page.locator('input[id="group0co-Normal-9-11"]');
  if(!await radio.isChecked()){
    const saved=page.waitForResponse(response=>{
      const url=new URL(response.url());
      return ['POST','PUT','PATCH'].includes(response.request().method())&&
        url.hostname==='s2-smb-api-cdn.ecom-stg.samsung.com'&&
        url.pathname===`/tokocommercewebservices/v2/${cfg.program}/users/current/carts/current/deliverymodes/update`;
    },{timeout:30000});
    const [response]=await Promise.all([saved,option.click()]);
    if(!response.ok()||await response.finished())throw new Error('CO EPP shipping update was not accepted; payment was not submitted.');
  }
  await expect(radio).toBeChecked();
}

async function acceptCoEppCheckoutTerms(page,{qaRecipient=false,env=process.env}={}){
  const marketing=page.locator('input[name="marketingOptIn"]');
  if(await marketing.count()&&await marketing.getAttribute('required')!==null&&!await marketing.isChecked()&&!qaRecipient&&env.CO_EPP_ALLOW_PRIMARY_MARKETING!=='1'){
    return {status:'BLOCKED',reason:'HUMAN_REQUIRED',stage:'CONSENT',detail:'The registered FIRST recipient requires explicit marketing opt-in approval; prior disposable-email approval does not cover this account.'};
  }
  for(const name of ['sameAsShipping','termsAndCondition','privacyPolicy','termsAndConditionDeliveryInstallation']){
    const box=page.locator(`input[name="${name}"]`);
    if(await box.count()&&!await box.isChecked())await box.check();
  }
  if(await marketing.count()&&await marketing.getAttribute('required')!==null&&!await marketing.isChecked())await marketing.check();
  return null;
}

async function completeCoEppCheckout(page,cfg,capture=async()=>{}){
  assertCoEppCheckout(page,cfg);
  const contact=runtime.getEppContact(cfg);
  if(!contact)return {status:'BLOCKED',reason:'MISSING_EPP_CONTACT_DATA',stage:'CONTACT',detail:'Controlled CO contact data is not configured.'};
  let qaRecipient=false;
  if(new URL(page.url()).searchParams.get('step')==='CHECKOUT_STEP_CONTACT_INFO'){
    const email=page.locator('input[name="email"],input[formcontrolname="email"]').filter({visible:true}).first();
    await expect(email).toBeVisible({timeout:30000});
    qaRecipient=contact.email==='co-epp-qst@mailinator.com'&&(await email.inputValue())===contact.email;
    await assertions.completeContact(page,cfg,contact);
  }
  await expect(page).toHaveURL(url=>url.searchParams.get('step')==='CHECKOUT_STEP_DELIVERY',{timeout:30000});
  await expect(page.locator('input[name="addressOptionShipping"][value="SAVED_ADDRESS"]')).toBeChecked({timeout:30000});
  await selectCoEppStandardDelivery(page,cfg);
  const blocked=await acceptCoEppCheckoutTerms(page,{qaRecipient});
  if(blocked){await capture('co-epp-required-consent');return blocked;}
  await page.getByRole('button',{name:'Continuar con el pago',exact:true}).click();
  await expect(page).toHaveURL(url=>url.searchParams.get('step')==='CHECKOUT_STEP_PAYMENT',{timeout:60000});
  assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
  await capture('co-epp-payment-reached');
  return null;
}
module.exports={assertCoEppCheckout,selectCoEppStandardDelivery,acceptCoEppCheckoutTerms,completeCoEppCheckout};
