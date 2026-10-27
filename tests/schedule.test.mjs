import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSchedule,externalURL} from '../apps/api/schedule.js';
test('weekly timetable supports multiple days and different times in Vietnam timezone',()=>{
 const slots=buildSchedule({start_date:'2026-11-02',weeks:2,sessions:[{weekday:1,start_time:'18:00',end_time:'19:30'},{weekday:3,start_time:'19:00',end_time:'21:00'},{weekday:1,start_time:'08:00',end_time:'09:00'}]});
 assert.equal(slots.length,6);assert.equal(slots[0].starts_at,'2026-11-02T01:00:00.000Z');assert.equal(slots[1].starts_at,'2026-11-02T11:00:00.000Z');assert.equal(slots[2].ends_at,'2026-11-04T14:00:00.000Z');assert.equal(slots[5].starts_at,'2026-11-11T12:00:00.000Z');
});
test('arbitrary start date covers exactly the chosen number of weeks',()=>{const slots=buildSchedule({start_date:'2026-11-04',weeks:1,sessions:[{weekday:1,start_time:'08:00',end_time:'09:00'},{weekday:3,start_time:'10:00',end_time:'11:00'}]});assert.equal(slots[0].starts_at,'2026-11-04T03:00:00.000Z');assert.equal(slots[1].starts_at,'2026-11-09T01:00:00.000Z');});
test('rejects overlaps, invalid dates, times, empty sessions and impossible week counts',()=>{
 const base={start_date:'2026-11-02',weeks:1,sessions:[{weekday:1,start_time:'18:00',end_time:'19:30'}]};
 for(const override of [{weeks:0},{weeks:25},{start_date:'2026-02-30'},{sessions:[]},{sessions:[{weekday:7,start_time:'08:00',end_time:'09:00'}]},{sessions:[{weekday:1,start_time:'25:00',end_time:'26:00'}]},{sessions:[{weekday:1,start_time:'19:00',end_time:'18:00'}]},{sessions:[...base.sessions,{weekday:1,start_time:'19:00',end_time:'20:00'}]}])assert.throws(()=>buildSchedule({...base,...override}));
 assert.equal(buildSchedule({...base,sessions:[...base.sessions,{weekday:1,start_time:'19:30',end_time:'21:00'}]}).length,2);
});
test('material links reject executable protocols and embedded credentials',()=>{assert.equal(externalURL('https://drive.google.com/file/d/example/view'),'https://drive.google.com/file/d/example/view');for(const url of ['javascript:alert(1)','data:text/html,test','http://example.com','https://user:password@example.com','invalid','https://localhost'])assert.throws(()=>externalURL(url));});
