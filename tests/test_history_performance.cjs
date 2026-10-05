const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../static/app.js','utf8');
const elements=new Map(),charts=new Map(),listeners={};let observer;
function $(id){if(!elements.has(id))elements.set(id,{id,visible:false,getClientRects(){return this.visible?[{}]:[]}});return elements.get(id)}
const document={hidden:false,getElementById:$,addEventListener:(name,fn)=>listeners[name]=fn};
class Chart{constructor(canvas,config){Object.assign(this,config);this.updates=[];charts.set(canvas.id,this)}update(mode){this.updates.push(mode)}}
class IntersectionObserver{constructor(fn){observer=this;this.fn=fn}observe(){}emit(id,on){this.fn([{target:$(id),isIntersecting:on}])}}
const context=vm.createContext({document,Chart,IntersectionObserver,console,requestAnimationFrame:fn=>fn(),
 window:{devicePixelRatio:3,plantTheme:{palette:()=>({series:{},tick:'#fff',grid:'#555'})},addEventListener:(name,fn)=>listeners[name]=fn}});
vm.runInContext(source,context);
context.createCharts();
context.renderHistoryCharts([{temperature:0,humidity:50},{temperature:null,humidity:51}],['a','b']);
assert.equal(charts.size,0,'hidden sidebar history must not create charts');
$('temperatureChart').visible=true;observer.emit('temperatureChart',true);
const temperature=charts.get('temperatureChart');assert.equal(charts.size,1);
assert.equal(temperature.options.animation,false);assert.equal(temperature.options.devicePixelRatio,1.5);
assert.deepEqual(Array.from(temperature.data.datasets[0].data),[0,null]);
assert.deepEqual(temperature.updates,['none']);
context.refreshHistoryCharts();assert.equal(temperature.updates.length,1,'unchanged cached data must not redraw');
observer.emit('temperatureChart',false);
context.renderHistoryCharts([{temperature:25,humidity:60}],['c']);
assert.equal(temperature.updates.length,1,'offscreen charts must not redraw');
observer.emit('temperatureChart',true);assert.deepEqual(Array.from(temperature.data.labels),['c']);
document.hidden=true;context.renderHistoryCharts([{temperature:26}],['d']);assert.equal(temperature.updates.length,2);
document.hidden=false;listeners.visibilitychange();assert.equal(temperature.updates.length,3);
$('temperatureChart').visible=false;listeners['plant:history-loading']();
assert.equal(temperature.updates.length,3);
// Classic layout moves the same canvas back into view; reuse its instance and clear old range.
$('temperatureChart').visible=true;listeners['plant:layout']();
assert.equal(charts.get('temperatureChart'),temperature);assert.equal(temperature.data.labels.length,0);
context.renderHistoryCharts([{temperature:27,humidity:0}],['e']);
$('humidityChart').visible=true;observer.emit('humidityChart',true);
assert.equal(charts.size,2);assert.equal(charts.get('humidityChart').data.datasets[0].data[0],0);
console.log('PASS: lazy history charts, cached hidden updates, background tabs, range clearing, layout reuse and zero/null values');
