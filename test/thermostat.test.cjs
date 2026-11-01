const {test}=require('node:test');const assert=require('node:assert/strict');
const dial=require('../public/mockup/thermostat');
test('Halbkreisregler trifft HA-Grenzen und Temperaturschritte',()=>{
 assert.equal(dial.snap(20.24,5,30,.5),20);assert.equal(dial.snap(20.26,5,30,.5),20.5);
 assert.equal(dial.snap(-5,5,30,.5),5);assert.equal(dial.snap(40,5,30,.5),30);
 assert.equal(dial.fraction(-82,0),0);assert.equal(dial.fraction(82,0),1);assert.equal(dial.fraction(0,-82),.5);
 const point=dial.point(17.5,5,30);assert.ok(Math.abs(point.x-100)<.001);assert.ok(Math.abs(point.y-28)<.001);
});
