const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('static/app.js', 'utf8');
const start = source.indexOf('async function loadCurrent()');
const end = source.indexOf('async function loadLightToday()', start);
const nodes = new Map();
const events = [];
const icons = [{dataset:{}}];
let payload;
let ok = true;
const context = {
    console: {error(){}}, Date,
    $: id => { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); },
    number: (v, d=1) => v == null ? '--' : Number(v).toFixed(d),
    fetch: async () => ({ok, status:503, json:async () => payload}),
    window: {dispatchEvent: event => events.push(event)},
    document: {querySelectorAll: () => icons},
    CustomEvent: class {constructor(type, options){this.type=type;this.detail=options.detail;}},
    Event: class {constructor(type){this.type=type;}},
    setLightStateIcons: state => {icons[0].dataset.state = state ? 'on' : 'off';}
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
(async () => {
    payload = {environment_available:false, lux:null, light_on:null,
        soil_moisture_1:99.7, soil_moisture_2:99.8, soil_raw_1:3186, soil_raw_2:2916};
    await context.loadCurrent();
    assert.equal(nodes.get('soilMoisture1').textContent, '99.7');
    assert.equal(nodes.get('soilMoisture2').textContent, '99.8');
    assert.equal(nodes.get('lux').textContent, '--');
    assert.equal(nodes.get('lightText').textContent, '--');
    assert.equal(icons[0].dataset.state, 'unknown');
    assert.match(nodes.get('systemStatus').innerHTML, /Umgebungssensor/);
    assert.equal(events.at(-1).type, 'plant:current');
    payload = {...payload, environment_available:true, lux:0, light_on:false};
    await context.loadCurrent();
    assert.equal(nodes.get('lux').textContent, '0');
    assert.equal(nodes.get('lightText').textContent, 'Aus');
    assert.match(nodes.get('systemStatus').innerHTML, /Online/);
    ok = false;
    await context.loadCurrent();
    assert.equal(events.at(-1).type, 'plant:offline');
    console.log('Partial sensor rendering, recovery and offline checks passed');
})().catch(error => {console.error(error);process.exitCode=1;});
