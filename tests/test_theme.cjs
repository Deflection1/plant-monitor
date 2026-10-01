const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname, '../static/theme.js'),'utf8');
function boot(saved,blocked=false){
 const listeners={},windowListeners={},stored=new Map(saved?[['plant-monitor.design',saved]]:[]);
 const links=['glass','glass','glass','windows-2000','botanical','windows-xp','osrs'].map(theme=>({dataset:{themeStylesheet:theme},disabled:false}));
 const select={value:'',addEventListener:(name,fn)=>listeners['select:'+name]=fn};
 const note={textContent:''},meta={content:''};
 const images=['growth','flower'].map(profile=>({src:'/static/profile-'+profile+'.svg?v=2',getAttribute(){return this.src},setAttribute(k,v){this.src=v}}));
 const chart={options:{scales:{x:{ticks:{},grid:{}},y:{ticks:{},grid:{}}}},data:{datasets:[{data:[5,9],backgroundColor:''}]},update(){this.updated=true},resize(){this.resized=true}};
 const climate=JSON.parse(JSON.stringify(chart));climate.data.datasets.push({data:[60,70]});climate.options.scales.yHumidity={ticks:{},grid:{},title:{}};climate.options.plugins={legend:{labels:{}}};climate.update=()=>{};climate.resize=()=>{};
 const light=JSON.parse(JSON.stringify(chart));light.update=()=>{};light.resize=()=>{};
 const document={documentElement:{dataset:{}},querySelectorAll(selector){return selector==='[data-theme-stylesheet]'?links:images},querySelector(){return meta},getElementById(id){return id==='themeSelect'?select:note},addEventListener(name,fn){listeners[name]=fn}};
 const window={Chart:{getChart:id=>({temperatureChart:chart,overviewClimateChart:climate,overviewLuxChart:light})[id]},dispatchEvent(){},addEventListener(name,fn){windowListeners[name]=fn}};
 const localStorage={getItem(k){if(blocked)throw Error('blocked');return stored.get(k)||null},setItem(k,v){if(blocked)throw Error('blocked');stored.set(k,v)}};
 vm.runInNewContext(source,{document,window,localStorage,Event:class{}});listeners.DOMContentLoaded();
 return {document,window,links,select,note,meta,images,chart,climate,light,stored,windowListeners,choose(value){select.value=value;listeners['select:change']()}};
}
const a=boot();assert.equal(a.document.documentElement.dataset.theme,'glass');assert.deepEqual(a.links.map(l=>l.disabled),[false,false,false,true,true,true,true]);
a.choose('windows-2000');assert.equal(a.stored.get('plant-monitor.design'),'windows-2000');assert.deepEqual(a.links.map(l=>l.disabled),[true,true,true,false,true,true,true]);assert(a.images.every(i=>i.src.includes('/windows-2000/')));assert.equal(a.chart.data.datasets[0].borderColor,'#b02020');assert.deepEqual(a.chart.data.datasets[0].data,[5,9]);assert(a.chart.resized);
const b=boot(a.stored.get('plant-monitor.design'));assert.equal(b.select.value,'windows-2000');
a.choose('glass');assert(a.images.every(i=>!i.src.includes('/windows-2000/')));assert.equal(a.chart.data.datasets[0].borderColor,'#67d391');
assert.equal(boot('unexpected').select.value,'glass');
const blocked=boot('windows-2000',true);assert.equal(blocked.select.value,'glass');blocked.choose('windows-2000');assert.equal(blocked.select.value,'windows-2000');assert(blocked.note.textContent.includes('nicht möglich'));
a.stored.set('plant-monitor.design','windows-2000');a.windowListeners.storage({key:'plant-monitor.design'});assert.equal(a.select.value,'windows-2000');
a.choose('botanical');assert.equal(a.stored.get('plant-monitor.design'),'botanical');assert.deepEqual(a.links.map(l=>l.disabled),[false,false,false,true,false,true,true]);assert(a.images.every(i=>i.src.includes('/botanical/')));assert.equal(a.chart.data.datasets[0].borderColor,'#b75d43');assert.equal(a.meta.content,'#f6f3ea');assert.deepEqual(a.chart.data.datasets[0].data,[5,9]);
assert.equal(boot('botanical').select.value,'botanical');
blocked.choose('botanical');assert.equal(blocked.select.value,'botanical');
a.stored.set('plant-monitor.design','botanical');a.windowListeners.storage({key:'plant-monitor.design'});assert.equal(a.select.value,'botanical');
a.choose('glass');assert(a.images.every(i=>!i.src.includes('/botanical/')));assert.deepEqual(a.links.map(l=>l.disabled),[false,false,false,true,true,true,true]);
a.choose('windows-2000');assert.deepEqual(a.links.map(l=>l.disabled),[true,true,true,false,true,true,true]);
for(const theme of ['glass','botanical','windows-2000','windows-xp','osrs']) {
 a.choose(theme);const p=a.window.plantTheme.palette();
 assert.equal(a.climate.data.datasets[0].borderColor,p.series.temperatureChart);
 assert.equal(a.climate.data.datasets[1].borderColor,p.series.humidityChart);
 assert.equal(a.light.data.datasets[0].borderColor,p.series.luxChart);
 assert.equal(a.climate.options.scales.yHumidity.ticks.color,p.tick);
 assert.equal(a.climate.options.scales.yHumidity.title.color,p.tick);
 assert.equal(a.climate.options.scales.yHumidity.ticks.font.family,theme==='osrs'?'"Plant Old School", monospace':'sans-serif');
 assert.equal(a.climate.options.plugins.legend.labels.color,p.tick);
 assert.deepEqual(a.climate.data.datasets[1].data,[60,70]);
}
a.choose('windows-xp');assert.equal(a.stored.get('plant-monitor.design'),'windows-xp');assert.deepEqual(a.links.map(l=>l.disabled),[true,true,true,false,true,false,true]);assert(a.images.every(i=>i.src.includes('/windows-xp/')));assert.equal(a.meta.content,'#0054e3');assert.equal(boot('windows-xp').select.value,'windows-xp');
blocked.choose('windows-xp');assert.equal(blocked.select.value,'windows-xp');assert(blocked.note.textContent.includes('nicht möglich'));
a.stored.set('plant-monitor.design','windows-xp');a.windowListeners.storage({key:'plant-monitor.design'});assert.equal(a.select.value,'windows-xp');
for(const theme of ['glass','botanical','windows-2000']){a.choose(theme);assert.equal(a.links[5].disabled,true);assert(a.images.every(i=>!i.src.includes('/windows-xp/')));}
a.choose('osrs');assert.equal(a.stored.get('plant-monitor.design'),'osrs');assert.deepEqual(a.links.map(l=>l.disabled),[true,true,true,false,true,true,false]);assert(a.images.every(i=>i.src.includes('/osrs/')));assert.equal(a.meta.content,'#24231c');assert.equal(boot('osrs').select.value,'osrs');
blocked.choose('osrs');assert.equal(blocked.select.value,'osrs');assert(blocked.note.textContent.includes('nicht möglich'));
a.stored.set('plant-monitor.design','osrs');a.windowListeners.storage({key:'plant-monitor.design'});assert.equal(a.select.value,'osrs');
for(const theme of ['glass','botanical','windows-2000','windows-xp']){a.choose(theme);assert.equal(a.links[6].disabled,true);assert(a.images.every(i=>!i.src.includes('/osrs/')));}
console.log('PASS: five designs, botanical palette and profile assets, default, immediate switching, persistence/reload, invalid values, blocked storage, cross-tab sync, SVG paths and chart data preservation');
