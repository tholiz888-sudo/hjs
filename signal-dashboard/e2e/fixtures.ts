import {test as base,expect} from '@playwright/test';
export const test=base.extend({page:async({page},use)=>{
 const portal=process.env.SIGNAL_PORTAL_URL?.replace(/\/$/,'');
 if(portal){const goto=page.goto.bind(page);page.goto=(url,options)=>goto(url.startsWith('/')?portal+url:url,options);}
 await use(page);
}});
export {expect};
