import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSwarms,recipients,validThreshold,season} from '../lib/swarm.js';
const start=Date.parse('2026-04-11T10:33:47Z');
const sample=(values:number[],step=10*60000)=>values.map((v,i)=>({t:start+i*step,v}));
test('confirmed red colony swarm on April 11 is detected at 1 kg, missed at 1.5',()=>{
 const points=[{t:start,v:46.1},{t:Date.parse('2026-04-11T10:43:52Z'),v:44.77},{t:Date.parse('2026-04-11T10:53:57Z'),v:44.8}];
 assert.equal(detectSwarms(points,1).length,1);assert.equal(detectSwarms(points,1)[0].loss,1.33);assert.equal(detectSwarms(points,1.5).length,0);
});
test('normal departure, reversible lifting, unconfirmed and delayed readings do not alarm',()=>{
 for(const values of [[46.42,46.24,46.1],[44.95,21.36,45.65],[46.1,44.77]])assert.equal(detectSwarms(sample(values),1).length,0);
 assert.equal(detectSwarms(sample([46,44,44],20*60000),1).length,0);
});
test('one event per two hours, then separate events; inclusive threshold',()=>{
 assert.equal(detectSwarms(sample([46,45,45,44,44]),1).length,1);
 const points=[...sample([46,45,45]),...sample([45,44,44]).map(p=>({...p,t:p.t+3*3600000}))];assert.equal(detectSwarms(points,1).length,2);
});
test('shared threshold and multiple recipients validate',()=>{
 assert.deepEqual(recipients('A@example.de, b@example.de\na@example.de'),['a@example.de','b@example.de']);
 assert.throws(()=>recipients('broken'));assert.throws(()=>recipients('x@example.de\r\nBcc: evil@example.de'));
 assert.equal(validThreshold('1'),false);assert.equal(validThreshold(NaN),false);assert.equal(validThreshold(1),true);
 assert.equal(season(Date.parse('2026-04-11')),true);assert.equal(season(Date.parse('2026-10-11')),false);
});

test('multiple small steps within 15 minutes accumulate to threshold',()=>{assert.equal(detectSwarms(sample([46,45.6,45.3,45,45],5*60000),1).length,1);});
