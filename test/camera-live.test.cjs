const {test}=require('node:test');const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {MjpegThrottle,createCameraLive}=require('../src/camera-live');
test('MJPEG wird trotz geteilter Header und JPEG-Daten als vollständiger Frame ausgeliefert',async()=>{
 const stream=new MjpegThrottle(),jpeg=Buffer.from([0xff,0xd8,1,2,3,0xff,0xd9]);
 const data=Buffer.concat([Buffer.from('--upstream\r\nContent-Type: image/jpeg\r\nContent-Length: 7\r\n\r\n'),jpeg,Buffer.from('\r\n')]);
 const chunks=[];stream.on('data',chunk=>chunks.push(chunk));const complete=new Promise(resolve=>stream.on('end',resolve));
 stream.write(data.subarray(0,30));stream.write(data.subarray(30,data.length-5));stream.end(data.subarray(data.length-5));await complete;
 const result=Buffer.concat(chunks);assert.ok(result.includes(jpeg));assert.match(result.toString('latin1'),/Content-Length: 7/i);assert.ok(result.toString('latin1').endsWith('\r\n--frame\r\n'),'Safari erhält die nachfolgende Grenze auch ohne ein zweites Kamerabild');
});
test('Vor Start abgebrochene Live-Anfragen starten keine Kamera',async()=>{
 let calls=0;const live=createCameraLive({getGo2RtcBase:async()=>{calls++;return 'http://test';},getRegistries:async()=>({entities:[],devices:[]}),http:{},ha:{},describeError:String});
 const abort=new AbortController();abort.abort();assert.equal(await live.openMjpeg('camera.one','',abort.signal),null);assert.equal(calls,0);
});
test('Abbruch während des Starts öffnet keinen MJPEG-Stream mehr',async()=>{
 let releaseFrame,streamCalls=0;const waitFrame=new Promise(resolve=>releaseFrame=resolve),abort=new AbortController();
 const live=createCameraLive({getGo2RtcBase:async()=>'http://test',getRegistries:async()=>({entities:[],devices:[]}),ha:{post:async()=>{}},http:{get:async(url)=>{if(url.endsWith('/api/streams'))return {data:{one:{}}};if(url.includes('frame.jpeg')){await waitFrame;return {data:Buffer.from([1])};}streamCalls++;return {data:Readable.from([]),headers:{'content-type':'multipart/x-mixed-replace'}};}},describeError:String});
 const promise=live.openMjpeg('camera.one','',abort.signal);await new Promise(resolve=>setImmediate(resolve));abort.abort();releaseFrame();assert.equal(await promise,null);assert.equal(streamCalls,0);
});
