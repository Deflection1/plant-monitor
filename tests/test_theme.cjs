const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname, '../static/theme.js'),'utf8');
function boot(saved,blocked=false){
 const listeners={},windowListeners={},stored=new Map(saved?[['plant-monitor.design',saved]]:[]);
 const links=['glass','glass','glass','windows-2000'].map(theme=>({dataset:{themeStylesheet:theme},disabled:false}));
 const select={value:'',addEventListener:(name,fn)=>listeners['select:'+name]=fn};
 const note={textContent:''},meta={content:''};
 const images=['growth','flower'].map(profile=>({src:'/static/profile-'+profile+'.svg?v=2',getAttribute(){return this.src},setAttribute(k,v){this.src=v}}));
 const chart={options:{scales:{x:{ticks:{},grid:{}},y:{ticks:{},grid:{}}}},data:{datasets:[{data:[5,9],backgroundColor:''}]},update(){this.updated=true},resize(){this.resized=true}};
 const document={documentElement:{dataset:{}},querySelectorAll(selector){return selector==='[data-theme-stylesheet]'?links:images},querySelector(){return meta},getElementById(id){return id==='themeSelect'?select:note},addEventListener(name,fn){listeners[name]=fn}};
 const window={Chart:{getChart:id=>id==='temperatureChart'?chart:null},dispatchEvent(){},addEventListener(name,fn){windowListeners[name]=fn}};
 const localStorage={getItem(k){if(blocked)throw Error('blocked');return stored.get(k)||null},setItem(k,v){if(blocked)throw Error('blocked');stored.set(k,v)}};
 vm.runInNewContext(source,{document,window,localStorage,Event:class{}});listeners.DOMContentLoaded();
 return {document,window,links,select,note,meta,images,chart,stored,windowListeners,choose(value){select.value=value;listeners['select:change']()}};
}
const a=boot();assert.equal(a.document.documentElement.dataset.theme,'glass');assert.deepEqual(a.links.map(l=>l.disabled),[false,false,false,true]);
a.choose('windows-2000');assert.equal(a.stored.get('plant-monitor.design'),'windows-2000');assert.deepEqual(a.links.map(l=>l.disabled),[true,true,true,false]);assert(a.images.every(i=>i.src.includes('/windows-2000/')));assert.equal(a.chart.data.datasets[0].borderColor,'#b02020');assert.deepEqual(a.chart.data.datasets[0].data,[5,9]);assert(a.chart.resized);
const b=boot(a.stored.get('plant-monitor.design'));assert.equal(b.select.value,'windows-2000');
a.choose('glass');assert(a.images.every(i=>!i.src.includes('/windows-2000/')));assert.equal(a.chart.data.datasets[0].borderColor,'#67d391');
assert.equal(boot('unexpected').select.value,'glass');
const blocked=boot('windows-2000',true);assert.equal(blocked.select.value,'glass');blocked.choose('windows-2000');assert.equal(blocked.select.value,'windows-2000');assert(blocked.note.textContent.includes('nicht möglich'));
a.stored.set('plant-monitor.design','windows-2000');a.windowListeners.storage({key:'plant-monitor.design'});assert.equal(a.select.value,'windows-2000');
console.log('PASS: default, immediate switching, persistence/reload, invalid values, blocked storage, cross-tab sync, SVG paths and chart data preservation');
