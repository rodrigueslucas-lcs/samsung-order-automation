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

async function selectCoEppPickupDelivery(page,cfg){
  assertCoEppCheckout(page,cfg);
  const pickup=page.getByRole('tab',{name:'Recoge',exact:true});
  if(await pickup.getAttribute('aria-selected')!=='true')await pickup.click();
  const city=page.locator('mat-select[name="pickupStoreSelect"]');
  await expect(city).toBeVisible({timeout:30000});
  if(!/Bogota, D\.C\./i.test(await city.innerText())){
    await city.click();await page.getByRole('option',{name:'Bogota, D.C.',exact:true}).click();
  }
  const store=page.getByText('Casa Samsung',{exact:true}).filter({visible:true});
  await expect(store).toBeVisible({timeout:30000});await expect(store).toHaveCount(1);
  const selected=page.locator('input[name="store_option"]:checked');
  if(await selected.count()!==1){
    const saved=page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==='POST'&&u.hostname==='s2-smb-api-cdn.ecom-stg.samsung.com'&&u.pathname===`/tokocommercewebservices/v2/${cfg.program}/users/current/carts/current/deliverymodes/updateDeliveryEntriesStorePickup`;},{timeout:30000});
    const [response]=await Promise.all([saved,store.click()]);
    if(!response.ok()||await response.finished())throw new Error('CO EPP pickup store did not persist; no payment submitted.');
  }
  await expect(selected).toHaveCount(1);
  const labels=page.locator('label').filter({hasText:/Recoge entre/i});
  await expect(labels.first()).toBeVisible({timeout:30000});
  const slots=page.locator('input[name="delivery_date_option"]');
  let chosen=false;
  for(let i=0;i<await slots.count();i++)if(await slots.nth(i).isEnabled()){
    if(!await slots.nth(i).isChecked())await labels.nth(i).click();
    await expect(slots.nth(i)).toBeChecked();chosen=true;break;
  }
  if(!chosen)throw new Error('CO EPP pickup has no enabled appointment; no payment submitted.');
}

async function ensureCoEppBilling(page){
  const same=page.locator('input[name="sameAsShipping"]');
  if(!await same.count()||await same.isChecked())return;
  if(await same.isVisible()&&await same.isEnabled()){await same.check();return;}
  // Pickup has no shipping address to copy. The observed billing component
  // must already prove a selected saved address; hidden fields stay untouched.
  const billing=page.locator('app-billing-address-v2');
  await expect(billing).toBeVisible();
  await expect(billing.getByRole('radio',{name:/^Dirección guardada$/i})).toBeChecked();
  await expect(billing.getByRole('radio',{name:/,/,checked:true})).toHaveCount(1);
}

async function acceptCoEppCheckoutTerms(page,{qaRecipient=false,env=process.env}={}){
  const marketing=page.locator('input[name="marketingOptIn"]');
  if(await marketing.count()&&await marketing.getAttribute('required')!==null&&!await marketing.isChecked()&&!qaRecipient&&env.CO_EPP_ALLOW_PRIMARY_MARKETING!=='1'){
    return {status:'BLOCKED',reason:'HUMAN_REQUIRED',stage:'CONSENT',detail:'The registered FIRST recipient requires explicit marketing opt-in approval; prior disposable-email approval does not cover this account.'};
  }
  await ensureCoEppBilling(page);
  for(const name of ['termsAndCondition','privacyPolicy','termsAndConditionDeliveryInstallation']){
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
    const email=await assertions.waitForEppContactEmail(page,cfg);
    qaRecipient=contact.email==='co-epp-qst@mailinator.com'&&(await email.inputValue())===contact.email;
    await assertions.completeContact(page,cfg,contact);
  }
  await expect(page).toHaveURL(url=>url.searchParams.get('step')==='CHECKOUT_STEP_DELIVERY',{timeout:30000});
  const savedAddress=page.locator('input[name="addressOptionShipping"][value="SAVED_ADDRESS"]');
  const addressReady=await savedAddress.waitFor({state:'attached',timeout:10000}).then(()=>true,()=>false);
  if(addressReady&&await savedAddress.isChecked())await selectCoEppStandardDelivery(page,cfg);
  else await selectCoEppPickupDelivery(page,cfg);
  const blocked=await acceptCoEppCheckoutTerms(page,{qaRecipient});
  if(blocked){await capture('co-epp-required-consent');return blocked;}
  await page.getByRole('button',{name:'Continuar con el pago',exact:true}).click();
  await expect(page).toHaveURL(url=>url.searchParams.get('step')==='CHECKOUT_STEP_PAYMENT',{timeout:60000});
  assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
  await capture('co-epp-payment-reached');
  return null;
}
module.exports={assertCoEppCheckout,selectCoEppStandardDelivery,selectCoEppPickupDelivery,ensureCoEppBilling,acceptCoEppCheckoutTerms,completeCoEppCheckout};
