'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {DEFAULTS}=require('../kronos-render/store.cjs');
test('admin form loads settings and saves boolean options without sending credentials or touching generation',async()=>{
 class Element{constructor(tag){this.tag=tag;this.children=[];this.value='';this.checked=false;}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}}
 const nodes=new Map(),fields=Object.entries(DEFAULTS).map(([name,value])=>({name,value:'',checked:false,type:typeof value==='boolean'?'checkbox':'text'}));fields.namedItem=name=>fields.find(f=>f.name===name);
 const form=new Element('form');form.elements=fields;form.querySelector=()=>({disabled:false});nodes.set('#settings-form',form);
 const document={body:{dataset:{adminBase:'/crypto'}},querySelector:s=>{if(!nodes.has(s))nodes.set(s,new Element(s));return nodes.get(s);},createElement:s=>new Element(s)};let saved;
 const context={document,window:{addEventListener(){}},confirm:()=>true,Date,Intl,Blob,URL,setTimeout,fetch:async(url,options)=>{assert.ok(url.startsWith('/crypto/admin/api/kronos/'));if(url.endsWith('/settings'))saved=JSON.parse(options.body);return {ok:true,json:async()=>url.endsWith('/state')?{settings:DEFAULTS,history:[],issues:[]}:{settings:saved}};}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../kronos-render/admin.js'),'utf8'),context);await new Promise(setImmediate);
 assert.equal(fields.namedItem('showMedian').checked,true);assert.equal(fields.namedItem('title').value,DEFAULTS.title);
 fields.namedItem('title').value='后台新标题';fields.namedItem('showMedian').checked=false;fields.namedItem('defaultPaths').value='5';await form.onsubmit({preventDefault(){}});
 assert.equal(saved.title,'后台新标题');assert.equal(saved.showMedian,false);assert.equal(saved.defaultPaths,5);assert.deepEqual(Object.keys(saved).sort(),Object.keys(DEFAULTS).sort());assert.match(nodes.get('#admin-status').textContent,/设置已保存/);
});
