const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const source = name => fs.readFileSync(path.join(__dirname, '../static', name), 'utf8');
const elements = new Map(), handlers = {}, charts = new Map();
const element = id => {
    if (!elements.has(id)) elements.set(id, {id, textContent: '', dataset: {}, attrs: {}, tagName: 'SECTION',
        setAttribute(k,v) {this.attrs[k]=v;}, removeAttribute(k) {delete this.attrs[k];},
        scrollIntoView() {this.scrolled=true;}, querySelector() {return null;}});
    return elements.get(id);
};
const palette = {tick:'#555',grid:'#ccc',series:{temperatureChart:'#a11',humidityChart:'#11a',luxChart:'#aa1'}};
class Chart {
    constructor(canvas, config) {Object.assign(this,config);charts.set(canvas.id,this);}
    update() {this.updated=true;}
}
const window = {plantTheme:{palette:()=>palette},addEventListener:(name,fn)=>handlers[name]=fn,dispatchEvent() {}};
const document = {getElementById:element,querySelectorAll:()=>[]};
vm.runInNewContext(source('dashboard.js'),{document,window,Chart});
const emit = (name,detail) => handlers[name]({detail});
emit('plant:history', {range:'24h', labels:['a','b','c'],points:[{temperature:22,humidity:60,lux:0},{temperature:null,humidity:null,lux:null},{temperature:24,humidity:0,lux:123}]});
const climate = charts.get('overviewClimateChart'), light = charts.get('overviewLuxChart');
assert.deepEqual(Array.from(climate.data.datasets[0].data),[22,null,24]);
assert.deepEqual(Array.from(climate.data.datasets[1].data),[60,null,0]);
assert.equal(climate.data.datasets[1].yAxisID,'yHumidity');
assert.equal(climate.options.scales.yHumidity.position,'right');
assert.equal(climate.options.scales.y.title.text,'Temperatur (°C)');
assert.equal(climate.data.datasets[0].spanGaps,false);
assert.notEqual(climate.data.datasets[0].borderColor,climate.data.datasets[1].borderColor);
assert.deepEqual(Array.from(light.data.datasets[0].data),[0,null,123]);
emit('plant:history-error');assert(element('dashboardHistoryState').textContent.includes('zuletzt'));
emit('plant:history-loading');assert.equal(climate.data.labels.length,0);assert.equal(light.data.datasets[0].data.length,0);
emit('plant:history-error');assert(element('dashboardHistoryState').textContent.includes('nicht verfügbar'));
emit('plant:history',{range:'7d',labels:[],points:[]});assert(element('dashboardHistoryState').textContent.includes('keine Messwerte'));
emit('plant:current',{ppfd_center:0,uv_mw_cm2:0});assert.equal(element('dashboardPpfd').textContent,'0');assert.equal(element('dashboardUv').textContent,'0.0000');
emit('plant:current',{uv_saturated:true});assert.equal(element('dashboardUv').textContent,'Bereich überschritten');
emit('plant:offline');assert.equal(element('dashboardUv').textContent,'—');
emit('plant:light-today',{light_on_seconds:3660,dli_center:0});assert.equal(element('dashboardLightDuration').textContent,'1 h 1 min');assert.equal(element('dashboardDli').textContent,'0');
emit('plant:light-today-error');assert.equal(element('dashboardDli').textContent,'—');

const links = ['uebersicht','klimaverlauf','licht','bewaesserung','lueftung','kamera','system'].map(id=>{
    const e=element(id);e.dataset.route=id;e.addEventListener=()=>{};return e;
});
document.querySelectorAll = selector => selector==='[data-route]' ? links : [];
const location = {hash:'#klimaverlauf'};
vm.runInNewContext(source('overview.js'),{document,window,location,requestAnimationFrame:fn=>fn(),Event:class{},Date});
const route = hash => {location.hash=hash;handlers.hashchange();};
assert.equal(element('overviewView').hidden,true);assert.equal(element('historyView').hidden,false);
assert.equal(element('klimaverlauf').attrs['aria-current'],'page');
for (const [hash,id] of [['licht','lampControlSection'],['bewaesserung','irrigationControlSection'],['lueftung','fanControlSection'],['system','systemDiagnostics']]) {
    element(id).tagName='DETAILS';route('#'+hash);
    assert.equal(element('controlsView').hidden,false);assert.equal(element('historyView').hidden,true);
    assert(element(id).scrolled);assert(element(id).open);assert.equal(element(hash).attrs['aria-current'],'page');
}
route('#kamera');assert.equal(element('overviewView').hidden,false);assert(element('sharedCameraPanel').scrolled);
route('#uebersicht');assert.equal(element('controlsView').hidden,true);assert.equal(element('kamera').attrs['aria-current'],undefined);

const documentEvents = {};
document.addEventListener = (name,fn)=>documentEvents[name]=fn;
const toggle = element('navigationToggle');toggle.addEventListener=(name,fn)=>toggle[name]=fn;toggle.focus=()=>toggle.focused=true;
const sidebar = element('appSidebar');sidebar.dataset.open='false';
vm.runInNewContext(source('layout.js'),{document,window,requestAnimationFrame:fn=>fn()});
toggle.click();assert.equal(sidebar.dataset.open,'true');assert.equal(toggle.attrs['aria-expanded'],'true');
documentEvents.keydown({key:'Escape'});assert.equal(sidebar.dataset.open,'false');assert(toggle.focused);
toggle.click();handlers.hashchange();assert.equal(toggle.attrs['aria-expanded'],'false');

(async () => {
    // A late response for the old range must not overwrite a newer selection.
    const app = source('app.js');
    const extract = name => {const start=app.indexOf('function '+name+'(');const end=app.indexOf('// =====================================================',start);return app.slice(start,end);};
    const requests=[],events=[];let rendered;
    const chart = () => ({data:{datasets:[{}]},update(){}});
    const context = {historyRange:'24h',window:{dispatchEvent:e=>events.push(e)},console,
        fetch:url=>new Promise(resolve=>requests.push({url,resolve})),formatTime:value=>value,
        renderHistoryCharts:(points,labels)=>{rendered={points,labels}},
        CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},Event:class{constructor(type){this.type=type;}}};
    for (const name of ['temperature','humidity','vpd','lux','soilMoisture1','soilMoisture2','uv']) context[name+'Chart']=chart();
    vm.createContext(context);vm.runInContext('async '+extract('loadHistory'),context);
    const old = context.loadHistory();context.historyRange='7d';const fresh=context.loadHistory();
    requests[1].resolve({ok:true,json:async()=>({points:[{timestamp:'new',temperature:25}]})});await fresh;
    requests[0].resolve({ok:true,json:async()=>({points:[{timestamp:'old',temperature:10}]})});await old;
    assert.deepEqual(Array.from(rendered.labels),['new']);assert.equal(events.length,1);assert.equal(events[0].detail.range,'7d');
    const buttons=['24h','7d','24h','7d'].map(range=>({dataset:{range},classList:{toggle(k,on){this.active=on;}},setAttribute(k,v){this[k]=v;},addEventListener(k,fn){this.click=fn;}}));
    context.document={querySelectorAll:()=>buttons};context.loadHistory=()=>{};
    vm.runInContext(extract('setupRangeButtons'),context);context.setupRangeButtons();buttons[1].click();
    assert.deepEqual(buttons.map(b=>b.classList.active),[false,true,false,true]);assert.equal(buttons[3]['aria-pressed'],'true');
    console.log('PASS: summary charts, separate units, missing/zero values, errors, navigation, deep links, stale responses and synchronized range controls');
})().catch(error=>{console.error(error);process.exitCode=1;});
