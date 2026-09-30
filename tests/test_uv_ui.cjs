const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const elements = new Map();
const handlers = {};
const document = {
    getElementById(id) {
        if (!elements.has(id)) elements.set(id, {textContent: '', setAttribute() {}});
        return elements.get(id);
    },
    querySelectorAll() { return []; }
};
const window = {
    addEventListener(name, callback) { handlers[name] = callback; },
    dispatchEvent() {}
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/overview.js'), 'utf8'), {
    document, window, location: {hash: ''}, requestAnimationFrame: callback => callback(),
    Event: class Event {}, Date
});
const uv = () => document.getElementById('ovUv').textContent;
handlers['plant:current']({detail: {uv_mw_cm2: 0}});
assert.strictEqual(uv(), '0.0000');
handlers['plant:current']({detail: {uv_mw_cm2: 0.325433}});
assert.strictEqual(uv(), '0.3254');
handlers['plant:current']({detail: {uv_mw_cm2: null}});
assert.strictEqual(uv(), '—');
handlers['plant:current']({detail: {uv_mw_cm2: null, uv_saturated: true}});
assert.strictEqual(uv(), 'Bereich überschritten');
handlers['plant:offline']();
assert.strictEqual(uv(), '—');
console.log('UV overview: zero, value, missing, saturation and offline passed');
