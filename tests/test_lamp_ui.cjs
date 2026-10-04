const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(__dirname + '/../static/app.js', 'utf8');
const start = source.indexOf('function lampProfileLabel(');
const end = source.indexOf('// =====================================================', source.indexOf('function setupLampControl()', start));
const elements = new Map();
function $(id) {
    if (!elements.has(id)) elements.set(id, {value:'',checked:false,textContent:'',dataset:{},attrs:{},
        getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v},addEventListener(){}});
    return elements.get(id);
}
let reply;
const calls = [];
const context = vm.createContext({$, console, setInterval(){},
    window:{plantTheme:{profileIcon:()=>'/static/profile-growth.svg'}},
    fetch:async (path, options) => {calls.push({path,options}); return reply(path, options);}});
vm.runInContext(source.slice(start,end),context);
const config = {name:'Lampe',profile:'custom',control_enabled:true,
    profiles:{custom:{power_percent:50,schedule_enabled:false,on_time:'08:00',off_time:'20:00'}}};
const response = data => ({ok:true,json:async()=>data});
(async () => {
    reply = () => response(config);
    await context.loadLampConfig();
    assert.equal($('lampControlEnabled').checked,true);
    assert.equal($('lampPowerInput').value,'50');
    reply = (path) => response(path.endsWith('/status')
        ? {output_available:true,output_percent:50,output_voltage:5,message:'Manuelle Steuerung'}
        : {...config,status:'ok',output_state:{error:null}});
    await context.saveLampConfig();
    const saved = JSON.parse(calls.find(c=>c.options?.method==='POST').options.body);
    assert.equal(saved.control_enabled,true);
    assert.equal(saved.power_percent,50);
    assert($('lampOutputStatus').textContent.includes('5 V'));
    reply = path => response(path.endsWith('/status')
        ? {output_available:false,message:'Ausgabe unbekannt'}
        : {...config,status:'ok',output_state:{error:'bus error'}});
    await context.saveLampConfig();
    assert($('lampConfigMessage').textContent.includes('Ausgabe fehlgeschlagen'));
    assert($('lampOutputStatus').textContent.includes('unbekannt'));
    reply = () => {throw Error('offline')};
    await context.loadLampStatus();
    assert.equal($('lampControlStatus').textContent,'Status unbekannt');
    assert($('lampOutputStatus').textContent.includes('nicht erreichbar'));
    console.log('Lamp UI: activation, output status and errors passed');
})().catch(error => {console.error(error);process.exitCode=1;});
