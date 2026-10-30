import {expect,test} from '@playwright/test';
import {completeClRegisteredContact,continueClRegisteredDeliveryToPayment} from './cl/paymentFlows';
import {selectClCheckoutOption} from './cl/qstFlows';
import assertions from '../utils/eppBusinessAssertions.cjs';
import runtime from '../utils/eppRuntimeData.cjs';

export function classifyClEppAddressState({newChecked,streetFields,visibleStreet,visibleRegion}){
  if(newChecked&&streetFields>0&&visibleStreet===0&&visibleRegion===0)return{status:'BLOCKED',classification:'APPLICATION_BUG',reason:'ENVIRONMENT_DEFECT',stage:'DELIVERY_FORM',expected:'Selecting a new delivery address renders editable street and region controls.',actual:'New address is selected, but existing street and region controls remain hidden after the bounded render wait.',manualAction:'Samsung must repair EPP shipping-address rendering or expose a usable saved CL shipping address in the supported checkout UI.',detail:'CL EPP new-address mode is selected, but its existing street/region controls stay hidden after 30s. No payment is reachable.'};
  return null;
}

export async function completeClEppCheckout(page,cfg,capture=async()=>{}){
  if(cfg.market!=='CL')throw new Error('CL EPP checkout cannot target another market.');
  assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
  const data=runtime.getEppRuntimeData(cfg),contact=runtime.getEppContact(cfg),address=data?.delivery;
  if(!contact||!address||!['region','commune','street','number'].every(k=>typeof address[k]==='string'&&address[k]))return{status:'BLOCKED',reason:'MISSING_EPP_CONTACT_DATA',stage:'CONTACT',detail:'Existing CL QA contact/delivery data must be provisioned in ignored EPP runtime data.'};
  await completeClRegisteredContact(page,contact);
  assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
  const shipping=page.locator('[data-activestepname="CHECKOUT_STEP_DELIVERY"]');
  // Preserve an already selected, visible saved destination in the approved
  // commune. Forcing New Address can race the saved-address rerender in S2.
  const approvedCommune=new RegExp(address.commune.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
  const savedMode=shipping.getByRole('radio',{name:/^Mis direcciones$/i});
  if(await savedMode.waitFor({state:'visible',timeout:10000}).then(()=>true,()=>false)){
    if(!await savedMode.isChecked())await savedMode.locator('xpath=ancestor::mat-radio-button[1]').click();
    await expect(savedMode).toBeChecked();
  }
  const selectedSaved=shipping.getByRole('radio',{name:approvedCommune,checked:true});
  if(await selectedSaved.waitFor({state:'visible',timeout:10000}).then(()=>true,()=>false)){
    await continueClRegisteredDeliveryToPayment(page,{diagnose:true,storefront:cfg});
    assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
    return null;
  }
  const fresh=page.getByRole('radio',{name:/A[nñ]adir nueva direcci[oó]n/i});
  const street=shipping.locator('input[name="line2"]:visible').first();
  await fresh.or(street).first().waitFor({state:'visible',timeout:30000});
  if(await fresh.isVisible()){await fresh.locator('xpath=ancestor::mat-radio-button[1]').click();await expect(fresh).toBeChecked();}
  const usable=await street.waitFor({state:'visible',timeout:30000}).then(()=>true,()=>false);
  if(!usable){
    const state={newChecked:await fresh.isChecked(),streetFields:await shipping.locator('app-customer-address-v2 input[name="line2"]').count(),visibleStreet:await street.count(),visibleRegion:await shipping.locator('mat-select[name="regionIso"]:visible').count()};
    const blocker=classifyClEppAddressState(state);
    await capture('epp-cl-delivery-address-state');
    await test.info().attach('EPP CL address state',{body:JSON.stringify(state),contentType:'application/json'});
    if(blocker){
      await test.info().attach('EPP CL classified delivery blocker',{body:JSON.stringify({...blocker,market:cfg.market,environment:cfg.environment,program:cfg.program,state}),contentType:'application/json'});
      return blocker;
    }
    throw new Error('CL EPP delivery address did not become usable; inspect its current state. No payment submitted.');
  }
  const region=shipping.locator('mat-select[name="regionIso"]:visible').first();
  const escaped=address.region.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  await selectClCheckoutOption(page,region,new RegExp(escaped,'i'));
  await selectClCheckoutOption(page,shipping.locator('mat-select[name="town"]:visible').first(),address.commune);
  await street.fill(address.street);
  await shipping.locator('input[name="line1"]:visible').first().fill(address.number);
  const save=shipping.locator('input[name="saveInAddressBook"]:visible').first();
  if(await save.count()){if(await save.isChecked())await save.uncheck({force:true});await expect(save).not.toBeChecked();}
  await continueClRegisteredDeliveryToPayment(page,{addressReady:true,diagnose:true,storefront:cfg});
  assertions.assertStoreRoute(page.url(),cfg,/^checkout\//);
  return null;
}
