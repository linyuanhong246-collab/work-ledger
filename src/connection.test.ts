import assert from 'node:assert/strict';
import {clearDeviceSession,connectionMessage} from './connection.ts';
for(const kind of ['success','failure','hang']){const removed:string[]=[];await clearDeviceSession(()=>kind==='hang'?new Promise(()=>{}):kind==='failure'?Promise.reject(Error('Load failed')):Promise.resolve(),{removeItem:k=>removed.push(k)},'test-session',10);assert.deepEqual(removed,['test-session','test-session-code-verifier','test-session-user'])}
assert(connectionMessage(new TypeError('Load failed')).includes('切换'));assert.equal(connectionMessage(Error('version conflict')),'version conflict');console.log('PASS: successful, failed and hanging sign-out clear only the current session keys; network error messages');
