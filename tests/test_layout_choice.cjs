const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../static/layout-choice.js'),'utf8');
function boot(saved,blocked=false,theme='botanical') {
    const callbacks={},listeners={},events=[];
    const storage=new Map([['plant-monitor.design',theme]]);
    if(saved) storage.set('plant-monitor.layout',saved);
    const stylesheet={disabled:false},select={value:'',addEventListener(name,fn){listeners[name]=fn;}},note={textContent:''};
    const analysis={parentElement:null,chartData:[21,null,23]},form={value:'unsaved value'};
    const slot=()=>({children:[],append(node){
        if(node.parentElement) node.parentElement.children=node.parentElement.children.filter(child=>child!==node);
        this.children.push(node);node.parentElement=this;
    }});
    const classic=slot(),history=slot();history.append(analysis);
    const nodes={sidebarLayoutStylesheet:stylesheet,layoutSelect:select,layoutPreferenceNote:note,overviewAnalysis:analysis,classicHistorySlot:classic,historyView:history,deviceForm:form};
    const document={documentElement:{dataset:{theme}},getElementById:id=>nodes[id]||null,addEventListener(name,fn){callbacks[name]=fn;}};
    const window={dispatchEvent:e=>events.push(e.type),addEventListener(name,fn){callbacks[name]=fn;}};
    const localStorage={getItem(key){if(blocked)throw Error('blocked');return storage.get(key)||null;},setItem(key,value){if(blocked)throw Error('blocked');storage.set(key,value);}};
    vm.runInNewContext(source,{window,document,localStorage,requestAnimationFrame:fn=>fn(),Event:class{constructor(type){this.type=type;}}});
    const headLayout=document.documentElement.dataset.layout;
    callbacks.DOMContentLoaded();
    return {window,document,stylesheet,select,note,analysis,form,classic,history,storage,callbacks,events,headLayout,choose(value){select.value=value;listeners.change();}};
}
for(const theme of ['glass','botanical','windows-2000','windows-xp','osrs']) {
    const a=boot(undefined,false,theme);
    assert.equal(a.headLayout,'sidebar');assert.equal(a.select.value,'sidebar');assert.equal(a.stylesheet.disabled,false);
    a.choose('classic');assert.equal(a.document.documentElement.dataset.layout,'classic');assert.equal(a.stylesheet.disabled,true);
    assert.equal(a.classic.children[0],a.analysis);assert.equal(a.history.children.length,0);
    assert.deepEqual(a.analysis.chartData,[21,null,23]);assert.equal(a.form.value,'unsaved value');
    assert.equal(a.document.documentElement.dataset.theme,theme);assert.equal(a.storage.get('plant-monitor.design'),theme);
    assert.equal(a.storage.get('plant-monitor.layout'),'classic');
    const reload=boot(a.storage.get('plant-monitor.layout'),false,theme);assert.equal(reload.headLayout,'classic');assert.equal(reload.analysis.parentElement,reload.classic);
    a.choose('sidebar');assert.equal(a.analysis.parentElement,a.history);assert.equal(a.classic.children.length,0);assert.equal(a.history.children.length,1);
    assert.equal(a.stylesheet.disabled,false);assert.deepEqual(a.analysis.chartData,[21,null,23]);
    a.storage.set('plant-monitor.layout','classic');a.callbacks.storage({key:'plant-monitor.layout'});assert.equal(a.select.value,'classic');
    a.storage.set('plant-monitor.layout','sidebar');a.callbacks.storage({key:'plant-monitor.design'});assert.equal(a.select.value,'classic');
    a.callbacks.storage({key:'plant-monitor.layout'});assert.equal(a.select.value,'sidebar');
    a.storage.delete('plant-monitor.layout');a.callbacks.storage({key:null});assert.equal(a.select.value,'sidebar');
    assert(a.events.includes('plant:layout'));assert(a.events.includes('resize'));
}
assert.equal(boot('unexpected').headLayout,'sidebar');
const blocked=boot('classic',true);assert.equal(blocked.headLayout,'sidebar');blocked.choose('classic');assert.equal(blocked.analysis.parentElement,blocked.classic);assert(blocked.note.textContent.includes('nicht möglich'));

// A saved history deep link must remain usable in both layouts.
for(const layout of ['classic','sidebar']) {
    const nodes={},callbacks={};
    const el=id=>nodes[id] ||= {setAttribute(){},scrollIntoView(){this.scrolled=true;},querySelector(){return null;}};
    const window={plantLayout:{current:()=>layout},addEventListener:(name,fn)=>callbacks[name]=fn,dispatchEvent(){}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/overview.js'),'utf8'),{
        document:{getElementById:el,querySelectorAll:()=>[]},window,location:{hash:'#klimaverlauf'},requestAnimationFrame:fn=>fn(),Event:class{}
    });
    assert.equal(el('overviewView').hidden,layout!=='classic');assert.equal(el('historyView').hidden,layout!=='sidebar');
    if(layout==='classic') assert(el('overviewAnalysis').scrolled);
    window.plantLayout.current=()=>layout==='classic'?'sidebar':'classic';callbacks['plant:layout']();
    assert.equal(el('overviewView').hidden,layout==='classic');assert.equal(el('historyView').hidden,layout==='sidebar');
}
console.log('PASS: both layouts with all designs, node/data/form preservation, saved preference, head initialization, blocked storage, cross-tab sync and history deep links');
