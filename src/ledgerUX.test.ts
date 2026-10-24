import assert from 'node:assert/strict';
import {purposeOptions,changesApplied} from './ledgerUX.ts';
const empty=()=>({bosses:[],works:[],wages:[],expenses:[],receipts:[],allocations:[]});
assert.deepEqual(purposeOptions([]),['过路费','修车费','换轮胎','交通罚款']);
const e=(purpose:string,date='2026-10-01')=>({id:purpose,bossId:'b',date,amount:100,purpose});assert.equal(purposeOptions([e('停车'),e('停车'),e('材料','2026-10-02')])[0],'停车');assert(purposeOptions(Array.from({length:8},(_,i)=>e('用途'+i))).length===6);
const base=empty(),next={...empty(),bosses:[{id:'b',name:'张',rate:100,note:''}]};assert(!changesApplied(base,next,base));assert(changesApplied(base,next,next));assert(changesApplied(base,next,{...next,bosses:[...next.bosses,{id:'c',name:'李',rate:200,note:''}]}));assert(!changesApplied(next,base,next));assert(changesApplied(next,base,base));console.log('PASS: purpose defaults, frequency ranking, cap, retry detection, concurrent additions, deletions');
