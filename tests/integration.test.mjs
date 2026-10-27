import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../apps/api/worker.js';
function database(){const sql=new DatabaseSync(':memory:');for(const file of ['0001_core.sql','0002_teaching.sql','0003_family_operations.sql','0004_assistants.sql','0005_notification_updates.sql','0006_material_links.sql','0007_lesson_overlap.sql'])sql.exec(readFileSync('db/migrations/'+file,'utf8'));return {prepare(query){let values=[];const stmt={bind(...args){values=args;return stmt;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){const result=sql.prepare(query).run(...values);return {meta:{changes:Number(result.changes)}};}};return stmt;},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
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
test('student linking, homework grades, exam snapshots, recovery and authoritative deadlines',async()=>{
 const DB=database(),files=new Map();const FILES={async put(k,v){files.set(k,v);},async get(k){return files.has(k)?{body:files.get(k)}:null;},async delete(k){files.delete(k);}};let tenant='',cookie='';
 async function call(path,body,method){const response=await worker.fetch(new Request('https://ltm.test/api/v1'+path+(tenant?(path.includes('?')?'&':'?')+'tenant='+tenant:''),{method:method||(body?'POST':'GET'),headers:{Origin:'https://ltm.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined}),{DB,FILES});const content=response.headers.get('Content-Type')?.includes('json')?await response.json():await response.text();return {status:response.status,content,cookie:response.headers.get('Set-Cookie')};}
 let r=await call('/auth/register',{email:'t@example.test',name:'Teacher',workspace:'School',password:'teacher pass 12345'});cookie=r.cookie.split(';')[0];const teacherCookie=cookie;tenant=(await call('/auth/me')).content.tenants[0].id;const school=tenant;
 const classId=(await call('/classes',{name:'Class'})).content.id,studentId=(await call('/students',{name:'Learner'})).content.id;
 await call('/enrollments',{class_id:classId,student_id:studentId});
 const code=(await call('/student-invites',{student_id:studentId})).content.code;assert.ok(code);
 const due=new Date(Date.now()+3600000).toISOString();const assignmentId=(await call('/assignments',{class_id:classId,title:'Homework',instructions:'Explain your answer',due_at:due,published:true})).content.id;
 const questionId=(await call('/questions',{subject:'Math',prompt:'2 + 2?',choices:['1','2','3','4'],answer:3,explanation:'Add two'})).content.id;
 const exam=(await call('/exams',{class_id:classId,title:'Quiz',duration:30,opens_at:new Date(Date.now()-60000).toISOString(),closes_at:due,published:true,question_ids:[questionId]}));assert.equal(exam.status,201);const examId=exam.content.id;
 const material=(await call('/materials',{class_id:classId,title:'Notes',external_url:'https://drive.google.com/file/d/example/view'})).content.id;assert.ok(material);
 await DB.prepare("UPDATE questions SET answer=0 WHERE id=?").bind(questionId).run();
 tenant='';cookie='';r=await call('/auth/register',{email:'s@example.test',name:'Learner',workspace:'Personal',password:'learner pass 12345'});cookie=r.cookie.split(';')[0];const studentCookie=cookie;
 assert.equal((await call('/learning/redeem',{code})).status,200);assert.equal((await call('/learning/redeem',{code})).status,400);
 assert.equal((await call('/learning')).content.length,1);tenant=school;
 assert.equal((await call('/overview')).status,403);assert.equal((await call('/learn/overview')).content.assignments.length,1);
 assert.equal((await call('/learn/materials/'+material)).status,302);
 assert.equal((await call('/learn/submit',{assignment_id:assignmentId,content:'My answer'})).status,200);
 assert.equal((await call('/learn/submit',{assignment_id:assignmentId,content:'Another answer'})).status,409);
 r=await call('/learn/attempt',{exam_id:examId});assert.equal(r.status,200);assert.ok(!('answer' in r.content.questions[0]));assert.ok(!('explanation' in r.content.questions[0]));const attempt=r.content.attempt.id;
 assert.equal((await call('/learn/save',{attempt_id:attempt,answers:{0:3}})).status,200);
 r=await call('/learn/attempt',{exam_id:examId});assert.equal(JSON.parse(r.content.attempt.answers)[0],3);
 assert.equal((await call('/learn/save',{attempt_id:attempt,answers:{0:99}})).status,400);
 r=await call('/learn/save',{attempt_id:attempt,answers:{0:3},submit:true});assert.equal(r.content.score,10);
 r=await call('/learn/save',{attempt_id:attempt,answers:{0:0},submit:true});assert.equal(r.content.score,10);
 cookie=teacherCookie;const s=(await call('/teaching')).content.submissions[0];assert.equal((await call('/grades',{submission_id:s.id,score:8.5,feedback:'Good'})).status,200);
 cookie=studentCookie;assert.equal((await call('/learn/overview')).content.assignments[0].score,8.5);
 const student2=(await DB.prepare('SELECT id FROM users WHERE email=?').bind('s@example.test').first()).id;
 // Deadline cannot be extended by client-provided timestamps or answers after expiry.
 await DB.prepare('UPDATE attempts SET submitted_at=NULL,score=NULL,deadline=?,answers=? WHERE id=?').bind(new Date(Date.now()-1000).toISOString(),'{"0":0}',attempt).run();
 r=await call('/learn/save',{attempt_id:attempt,answers:{0:3},deadline:due,submit:true});assert.equal(r.content.score,0);
 tenant='';cookie='';r=await call('/auth/register',{email:'outsider@example.test',name:'Other',workspace:'Other',password:'outsider pass 12345'});cookie=r.cookie.split(';')[0];tenant=school;
 assert.equal((await call('/learn/overview')).status,403);assert.equal((await call('/learn/materials/'+material)).status,403);
});
test('guardian verification and revocation, private reports, recurring schedules and notification deduplication',async()=>{
 const DB=database();let tenant='',cookie='';async function call(path,body,method){const response=await worker.fetch(new Request('https://ltm.test/api/v1'+path+(tenant?(path.includes('?')?'&':'?')+'tenant='+tenant:''),{method:method||(body?'POST':'GET'),headers:{Origin:'https://ltm.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined}),{DB});return {status:response.status,content:await response.json(),cookie:response.headers.get('Set-Cookie')};}
 let r=await call('/auth/register',{email:'family-teacher@example.test',password:'family teacher test',name:'Teacher',workspace:'School'});cookie=r.cookie.split(';')[0];const teacher=cookie;tenant=(await call('/auth/me')).content.tenants[0].id;const school=tenant;
 const cls=(await call('/classes',{name:'Class',fee:100})).content.id,student=(await call('/students',{name:'Child'})).content.id;await call('/enrollments',{class_id:cls,student_id:student});
 assert.equal((await call('/classes/'+cls,{name:'Renamed',subject:'Math',fee:200},'PUT')).status,200);
 assert.equal((await call('/students/'+student,{name:'Child Updated',phone:'123'},'PUT')).status,200);
 const schedule={class_id:cls,starts_at:'2026-11-02T08:00:00Z',ends_at:'2026-11-02T09:00:00Z',weeks:4};assert.equal((await call('/schedules',schedule)).status,200);assert.equal((await call('/schedules',schedule)).status,200);assert.equal((await call('/overview')).content.lessons.length,4);
 assert.equal((await call('/guardian-invites',{student_id:student})).status,400);
 const code=(await call('/guardian-invites',{student_id:student,relationship_verified:true})).content.code;
 tenant='';cookie='';r=await call('/auth/register',{email:'parent@example.test',password:'parent password test',name:'Parent',workspace:'Personal'});cookie=r.cookie.split(';')[0];const parent=cookie;
 assert.equal((await call('/family/redeem',{code})).status,200);assert.equal((await call('/family/redeem',{code})).status,400);
 const link=(await call('/family')).content[0].id;tenant=school;
 assert.equal((await call('/overview')).status,403);assert.equal((await call('/family/overview?link='+link)).content.student.name,'Child Updated');assert.equal((await call('/reports')).status,403);
 cookie=teacher;const lesson=(await call('/overview')).content.lessons[0].id;await call('/attendance',{lesson_id:lesson,records:[{student_id:student,status:'present'}]});await call('/attendance',{lesson_id:lesson,records:[{student_id:student,status:'present'}]});
 const invoice=(await call('/invoices',{student_id:student,description:'Fees',amount:100,due_date:'2026-11-01'})).content.id;await call('/payments',{invoice_id:invoice,amount:100,request_key:'parent-receipt'});await call('/payments',{invoice_id:invoice,amount:100,request_key:'parent-receipt'});
 r=await call('/reports');assert.equal(r.content.received,100);assert.equal(r.content.invoiced,100);assert.equal(r.content.attendance[0].count,1);
 cookie=parent;r=await call('/notifications');assert.equal(r.content.length,2);assert.ok(r.content.every(n=>!n.read_at));await call('/notifications/read',{id:r.content[0].id});assert.ok((await call('/notifications')).content[0].read_at);
 cookie=teacher;assert.equal((await call('/guardians/revoke',{id:link})).status,200);await call('/enrollments',{class_id:cls,student_id:student},'DELETE');assert.equal((await call('/class-roster?class='+cls)).content.length,0);assert.equal((await call('/export')).content.invoices.length,1);
 cookie=parent;assert.equal((await call('/family/overview?link='+link)).status,403);assert.equal((await call('/family')).content.length,0);
});
test('assistant grants limit reads, attendance and grades to assigned classes',async()=>{
 const DB=database();let tenant='',cookie='';async function call(path,body,method){const r=await worker.fetch(new Request('https://ltm.test/api/v1'+path+(tenant?(path.includes('?')?'&':'?')+'tenant='+tenant:''),{method:method||(body?'POST':'GET'),headers:{Origin:'https://ltm.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined}),{DB});return {status:r.status,content:await r.json(),cookie:r.headers.get('Set-Cookie')};}
 let r=await call('/auth/register',{email:'assistant-owner@test.com',password:'owner password 123',name:'Owner',workspace:'School'});cookie=r.cookie.split(';')[0];const owner=cookie;tenant=(await call('/auth/me')).content.tenants[0].id;const school=tenant;
 const c1=(await call('/classes',{name:'Allowed'})).content.id,c2=(await call('/classes',{name:'Hidden'})).content.id,s1=(await call('/students',{name:'Allowed student'})).content.id,s2=(await call('/students',{name:'Hidden student'})).content.id;
 await call('/enrollments',{class_id:c1,student_id:s1});await call('/enrollments',{class_id:c2,student_id:s2});
 const createLesson=class_id=>call('/lessons',{class_id,starts_at:'2026-11-01T08:00:00Z',ends_at:'2026-11-01T09:00:00Z'});const l1=(await createLesson(c1)).content.id,l2=(await createLesson(c2)).content.id;
 const code=(await call('/assistant-invites',{class_ids:[c1]})).content.code;assert.ok(code);
 tenant='';cookie='';r=await call('/auth/register',{email:'assistant@test.com',password:'assistant password 123',name:'Assistant',workspace:'Personal'});cookie=r.cookie.split(';')[0];const assistant=cookie;
 assert.equal((await call('/assistant/redeem',{code})).status,200);const user=(await call('/auth/me')).content.user.id;tenant=school;
 r=await call('/overview');assert.equal(r.content.classes.length,1);assert.equal(r.content.classes[0].name,'Allowed');assert.equal(r.content.students.length,1);assert.equal(r.content.invoices.length,0);
 assert.equal((await call('/attendance',{lesson_id:l1,records:[{student_id:s1,status:'present'}]})).status,200);
 assert.equal((await call('/attendance',{lesson_id:l2,records:[{student_id:s2,status:'present'}]})).status,403);
 assert.equal((await call('/attendance?lesson='+l2)).status,403);assert.equal((await call('/classes',{name:'Forbidden'})).status,403);assert.equal((await call('/reports')).status,403);assert.equal((await call('/export')).status,403);
 cookie=owner;assert.equal((await call('/assistants/revoke',{user_id:user})).status,200);cookie=assistant;assert.equal((await call('/overview')).status,403);
});
test('scheduled job scores expired saved answers and expires stale credentials',async()=>{
 const DB=database();await DB.prepare("INSERT INTO users(id,email,name,password) VALUES('u','cron@test.com','User','hash')").bind().run();await DB.prepare("INSERT INTO tenants VALUES('t','Tenant','u')").bind().run();await DB.prepare("INSERT INTO classes(id,tenant_id,name) VALUES('c','t','Class')").bind().run();await DB.prepare("INSERT INTO students(id,tenant_id,name) VALUES('s','t','Student')").bind().run();await DB.prepare("INSERT INTO exams VALUES('x','t','c','Exam',30,'2026-01-01','2026-01-02',1)").bind().run();await DB.prepare("INSERT INTO exam_questions VALUES('t','x',0,?)").bind(JSON.stringify({answer:2})).run();await DB.prepare("INSERT INTO attempts(id,tenant_id,exam_id,student_id,started_at,deadline,answers) VALUES('a','t','x','s','2026-01-01','2026-01-02','{\"0\":2}')").bind().run();await DB.prepare("INSERT INTO sessions VALUES('expired','u',1)").bind().run();await worker.scheduled({}, {DB});const attempt=await DB.prepare("SELECT * FROM attempts WHERE id='a'").bind().first();assert.equal(attempt.score,10);assert.ok(attempt.submitted_at);assert.equal(await DB.prepare("SELECT * FROM sessions WHERE token_hash='expired'").bind().first(),null);
});
test('password changes require old password and invalidate existing sessions',async()=>{
 const DB=database();let cookie='';async function call(path,body){const r=await worker.fetch(new Request('https://ltm.test/api/v1'+path,{method:body?'POST':'GET',headers:{Origin:'https://ltm.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined}),{DB});return {status:r.status,content:await r.json(),cookie:r.headers.get('Set-Cookie')};}
 let r=await call('/auth/register',{email:'password@test.com',password:'original pass 123',name:'Test',workspace:'Test'});cookie=r.cookie.split(';')[0];
 assert.equal((await call('/account/password',{current_password:'wrong password',new_password:'new password 123'})).status,403);assert.equal((await call('/auth/me')).status,200);
 assert.equal((await call('/account/password',{current_password:'original pass 123',new_password:'new password 123'})).status,200);assert.equal((await call('/auth/me')).status,401);
 assert.equal((await call('/auth/login',{email:'password@test.com',password:'original pass 123'})).status,401);assert.equal((await call('/auth/login',{email:'password@test.com',password:'new password 123'})).status,200);
});
test('flexible schedules are atomic, idempotent and detect existing class overlaps',async()=>{
 const DB=database();let cookie='',tenant='';async function call(path,body){const r=await worker.fetch(new Request('https://ltm.test/api/v1'+path+(tenant?'?tenant='+tenant:''),{method:body?'POST':'GET',headers:{Origin:'https://ltm.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined}),{DB});return {status:r.status,content:await r.json(),cookie:r.headers.get('Set-Cookie')};}
 let r=await call('/auth/register',{email:'timetable@test.com',password:'timetable password',name:'Teacher',workspace:'School'});cookie=r.cookie.split(';')[0];tenant=(await call('/auth/me')).content.tenants[0].id;
 const cls=(await call('/classes',{name:'Class'})).content.id;
 const input={class_id:cls,start_date:'2026-11-02',weeks:2,sessions:[{weekday:1,start_time:'18:00',end_time:'19:30'},{weekday:3,start_time:'19:00',end_time:'21:00'}]};
 r=await call('/schedules',input);assert.equal(r.content.created,4);assert.equal((await call('/schedules',input)).content.created,0);
 r=await call('/schedules',{...input,sessions:[{weekday:1,start_time:'19:00',end_time:'20:00'}]});assert.equal(r.status,409);assert.equal((await call('/overview')).content.lessons.length,4);
 assert.equal((await call('/lessons',{class_id:cls,starts_at:'2026-11-02T11:30:00Z',ends_at:'2026-11-02T12:45:00Z'})).status,409);
 assert.equal((await call('/materials',{class_id:cls,title:'Unsafe',external_url:'javascript:alert(1)'})).status,400);
 assert.equal((await call('/materials',{class_id:cls,title:'Class notes',external_url:'https://example.com/notes'})).status,201);
});
