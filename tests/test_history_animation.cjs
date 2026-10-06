const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../static/history-animation.js','utf8');
const elements=new Map(),charts=new Map(),events={};let observer;
for(const id of ['temperatureChart','humidityChart','overviewClimateChart']) {
    elements.set(id,{id,shown:false,getClientRects(){return this.shown?[{}]:[]}});
    charts.set(id,{data:{labels:['a']},calls:[],resize(){this.calls.push('resize')},reset(){this.calls.push('reset')},update(){this.calls.push('update')}});
}
const document={hidden:false,getElementById:id=>elements.get(id),addEventListener:(name,fn)=>events[name]=fn};
class IntersectionObserver{constructor(fn){this.fn=fn;observer=this;this.observed=[]}observe(canvas){this.observed.push(canvas.id)}emit(id,on){this.fn([{target:elements.get(id),isIntersecting:on}])}}
vm.runInNewContext(source,{document,window:{Chart:{getChart:id=>charts.get(id)}},IntersectionObserver});
events.DOMContentLoaded();assert.deepEqual(observer.observed,['temperatureChart','humidityChart']);
const chart=charts.get('temperatureChart');observer.emit('temperatureChart',false);assert.equal(chart.calls.length,0);
elements.get('temperatureChart').shown=true;observer.emit('temperatureChart',true);
assert.deepEqual(chart.calls,['resize','reset','update']);
observer.emit('temperatureChart',true);assert.equal(chart.calls.length,3);
observer.emit('temperatureChart',false);observer.emit('temperatureChart',true);assert.equal(chart.calls.length,6);
document.hidden=true;observer.emit('temperatureChart',false);observer.emit('temperatureChart',true);assert.equal(chart.calls.length,6);
document.hidden=false;charts.get('humidityChart').data.labels=[];elements.get('humidityChart').shown=true;
observer.emit('humidityChart',true);assert.equal(charts.get('humidityChart').calls.length,0);
assert.equal(charts.get('overviewClimateChart').calls.length,0);
console.log('PASS: history reveal animation, repeated observations, hidden tabs, empty data and overview isolation');
