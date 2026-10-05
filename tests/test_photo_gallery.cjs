const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(__dirname + '/../static/app.js', 'utf8');
const elements = new Map(), handlers = {}, timers = new Map();
let timerId = 0, reply;
const calls = [];
function element() {
    return {children: [], hidden:false, open:false, textContent:'',
        append(...nodes){this.children.push(...nodes)}, appendChild(node){this.children.push(node)},
        replaceChildren(){this.children=[]}, removeAttribute(name){delete this[name]},
        addEventListener(name, fn){(this.events ||= {})[name]=fn},
        showModal(){this.open=true}, close(){this.open=false;this.events?.close?.()},
        scrollIntoView(){}, getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100}}};
}
const $ = id => {if(!elements.has(id))elements.set(id,element());return elements.get(id)};
const document = {getElementById:$, createElement:element, addEventListener:(name, fn)=>handlers[name]=fn};
const context = vm.createContext({document, console, window:{addEventListener:(name,fn)=>handlers[name]=fn},
    fetch:async url=>{calls.push(url);return reply(url)},
    setTimeout:(fn, delay)=>{timers.set(++timerId,{fn,delay});return timerId},
    clearTimeout:id=>timers.delete(id)});
vm.runInContext(source,context);
const photos = Array.from({length:38},(_,i)=>({url:`/original/${i}`, thumbnail_url:`/thumb/${i}`,
    preview_url:`/preview/${i}`, captured_at:'2026-10-05T20:00:00'}));
reply = url => {const parsed=new URL(url,'http://test');const offset=Number(parsed.searchParams.get('offset')||0);
    const limit=Number(parsed.searchParams.get('limit'));return {ok:true,json:async()=>({count:38,photos:photos.slice(offset,offset+limit)})}};
(async()=>{
    context.setupPhotoHistory();
    await context.loadPhotoHistory();
    assert.equal($('photoGrid').children.length,12);
    assert.equal($('photoGrid').children[0].children[0].src,'/thumb/0');
    assert.equal($('photoHistoryMore').hidden,false);
    await context.loadPhotoHistory(true);await context.loadPhotoHistory(true);await context.loadPhotoHistory(true);
    assert.equal($('photoGrid').children.length,38);
    assert.equal($('photoHistoryMore').hidden,true);
    $('photoGrid').children[0].events.click();
    assert.equal($('photoViewer').open,true);
    assert.equal($('photoViewerImage').src,'/original/0');
    assert.equal($('photoViewerImage').hidden,true);
    $('photoViewerImage').onload();assert.equal($('photoViewerImage').hidden,false);
    $('photoViewerClose').events.click();assert.equal($('photoViewer').open,false);
    assert.equal($('photoViewerImage').src,undefined);
    await context.playTimelapse();
    assert.equal($('timelapseImage').src,'/preview/37');
    assert.equal([...timers.values()][0].delay,15000);
    $('timelapseImage').onload();
    assert.equal([...timers.values()][0].delay,500);
    const queued=[...timers.values()][0].fn;
    context.stopTimelapsePlayback();queued();
    assert.equal($('timelapseImage').src,undefined);
    assert.equal(timers.size,0);
    let resolve;
    reply=()=>new Promise(r=>resolve=r);
    const pending=context.playTimelapse();context.stopTimelapsePlayback();
    resolve({ok:true,json:async()=>({photos})});await pending;
    assert.equal($('timelapsePlayer').hidden,true);
    console.log('Photo gallery: pagination, inline originals, paced playback and stop races passed');
})().catch(error=>{console.error(error);process.exitCode=1});
