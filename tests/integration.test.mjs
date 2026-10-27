import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../apps/api/worker.js';
function database(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('db/migrations/0001_core.sql','utf8'));return {prepare(query){let values=[];const stmt={bind(...args){values=args;return stmt;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){const result=sql.prepare(query).run(...values);return {meta:{changes:Number(result.changes)}};}};return stmt;},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
test('teacher workflow, isolation, attendance and payment reconciliation',async()=>{
 const DB=database();let cookie='',tenant='';
 async function call(path,body,method){const response=await worker.fetch(new Request('https://ltm.test/api/v1'+path+(tenant?(path.includes('?')?'&':'?')+'tenant='+tenant:''),{method:method||(body?'POST':'GET'),headers:{Origin:'https://ltm.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined}),{DB});const content=await response.json();return {status:response.status,content,cookie:response.headers.get('Set-Cookie')};}
 let r=await call('/auth/register',{email:'teacher1@example.com',password:'testing password 123',name:'Teacher 1',workspace:'Workspace 1'});assert.equal(r.status,200);cookie=r.cookie.split(';')[0];const cookie1=cookie;
 r=await call('/auth/me');tenant=r.content.tenants[0].id;const tenant1=tenant;
 const class1=(await call('/classes',{name:'Toán 12',subject:'Toán',fee:500000})).content.id;
 const student1=(await call('/students',{name:'Student A'})).content.id;
 assert.equal((await call('/enrollments',{class_id:class1,student_id:student1})).status,200);
 const lesson=(await call('/lessons',{class_id:class1,starts_at:'2026-11-01T08:00:00Z',ends_at:'2026-11-01T09:30:00Z',topic:'Review'})).content.id;
 assert.ok(lesson);assert.equal((await call('/attendance',{lesson_id:lesson,records:[{student_id:student1,status:'present'}]})).status,200);
 assert.equal((await call('/attendance?lesson='+lesson)).content[0].status,'present');
 const invoice=(await call('/invoices',{student_id:student1,description:'November',amount:500000,due_date:'2026-11-05'})).content.id;
 const payment={invoice_id:invoice,amount:300000,request_key:'receipt-001'};
 assert.equal((await call('/payments',payment)).status,201);assert.equal((await call('/payments',payment)).status,200);
 assert.equal((await call('/payments',{...payment,amount:300001})).status,409);
 assert.equal((await call('/payments',{...payment,request_key:'receipt-002'})).status,409);
 assert.equal((await call('/payments',{...payment,amount:200000,request_key:'receipt-003'})).status,201);
 assert.equal((await call('/overview')).content.invoices[0].paid,500000);
 assert.equal((await call('/students/'+student1,{archived:true},'PATCH')).status,200);
 r=await call('/overview');assert.equal(r.content.students.length,0);assert.equal(r.content.invoices.length,1);
 tenant='';cookie='';r=await call('/auth/register',{email:'teacher2@example.com',password:'testing password 456',name:'Teacher 2',workspace:'Workspace 2'});cookie=r.cookie.split(';')[0];tenant=(await call('/auth/me')).content.tenants[0].id;
 assert.equal((await call('/overview')).content.classes.length,0);
 assert.equal((await call('/enrollments',{class_id:class1,student_id:student1})).status,404);
 tenant=tenant1;assert.equal((await call('/overview')).status,403);
 cookie=cookie1;assert.equal((await call('/overview')).status,200);
 assert.equal((await call('/auth/logout',{})).status,200);assert.equal((await call('/overview')).status,401);
});
