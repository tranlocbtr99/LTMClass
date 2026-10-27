import {account,announcements} from './accounts.js';
import {redeemAssistant,manageAssistants,assistantRequest} from './assistants.js';
import {personal,operations} from './operations.js';
import {learning,teaching} from './teaching.js';
import {uid,hash,passwordHash,passwordMatches,text,money,sameOrigin} from './security.js';
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
const all=async(db,sql,...args)=>(await query(db,sql,...args).all()).results;
const one=(db,sql,...args)=>query(db,sql,...args).first();
const cookie=(token,age)=>`ltm_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function limited(db,key,limit){const now=Math.floor(Date.now()/1000);await query(db,'INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END',key,now+900,now,now).run();const row=await one(db,'SELECT count FROM rate_limits WHERE key=?',key);if(row.count>limit)fail('Thử lại sau 15 phút.',429);}
async function api(req,env){
 const url=new URL(req.url),path=url.pathname.replace('/api/v1',''),db=env.DB;
 if(path==='/health')return json({ok:true,version:'0.5.0'});
 if(!db)fail('Cơ sở dữ liệu chưa được cấu hình.',503);
 const write=!['GET','HEAD'].includes(req.method);
 if(write&&!sameOrigin(req))fail('Nguồn yêu cầu không hợp lệ.',403);
 let body={};if(write){if(!req.headers.get('content-type')?.includes('application/json'))fail('Yêu cầu JSON.',415);const raw=await req.text();if(raw.length>300000)fail('Yêu cầu quá lớn.',413);try{body=JSON.parse(raw);}catch{fail('JSON không hợp lệ.');}if(!body||Array.isArray(body)||typeof body!=='object')fail('Dữ liệu không hợp lệ.');}
 if(['/auth/register','/auth/login'].includes(path)&&req.method==='POST'){
  await limited(db,`auth:${req.headers.get('CF-Connecting-IP')||'local'}`,30);
  const email=text(body.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Email không hợp lệ.');
  const password=text(body.password,128);if(password.length<12)fail('Mật khẩu cần ít nhất 12 ký tự.');
  let user=await one(db,'SELECT * FROM users WHERE email=?',email);
  if(path.endsWith('register')){
   if(user)fail('Không thể đăng ký email này.',409);
   const id=uid(),tenant=uid(),name=text(body.name),workspace=text(body.workspace);
   await db.batch([query(db,'INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)',id,email,name,await passwordHash(password)),query(db,'INSERT INTO tenants(id,name,owner_id) VALUES(?,?,?)',tenant,workspace,id),query(db,"INSERT INTO members VALUES(?,?,'owner')",tenant,id)]);user={id,email,name};
  }else if(!user||!await passwordMatches(password,user.password))fail('Email hoặc mật khẩu không đúng.',401);
  const token=uid()+uid(),expires=Math.floor(Date.now()/1000)+604800;
  await query(db,'INSERT INTO sessions VALUES(?,?,?)',await hash(token),user.id,expires).run();
  return json({ok:true},200,{'Set-Cookie':cookie(token,604800)});
 }
 const token=req.headers.get('Cookie')?.match(/(?:^|;\s*)ltm_session=([^;]+)/)?.[1];
 const session=token&&await one(db,'SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?',await hash(token),Math.floor(Date.now()/1000));
 if(!session)fail('Vui lòng đăng nhập.',401);
 if(path==='/auth/logout'&&req.method==='POST'){await query(db,'DELETE FROM sessions WHERE token_hash=?',await hash(token)).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
 const tenants=await all(db,'SELECT t.id,t.name,m.role FROM tenants t JOIN members m ON t.id=m.tenant_id WHERE m.user_id=?',session.id);
 if(path==='/auth/me'&&req.method==='GET')return json({user:session,tenants});
 const tenant=url.searchParams.get('tenant');
 if(write&&['/account','/account/password'].includes(path))await limited(db,'account:'+session.id,10);
 const accountResult=await account(req,db,path,body,session,tenant);if(accountResult)return accountResult;
 const assistantRedemption=await redeemAssistant(req,db,path,body,session);if(assistantRedemption)return assistantRedemption;
 const personalResult=await personal(req,db,path,body,session,tenant);if(personalResult)return personalResult;
 const learnerResult=await learning(req,db,path,body,session,tenant,env);if(learnerResult)return learnerResult;
 const membership=tenants.find(t=>t.id===tenant);if(!membership)fail('Không có quyền truy cập không gian này.',403);

 const audit=(action,id)=>query(db,'INSERT INTO audit_logs(id,tenant_id,user_id,action,resource_id) VALUES(?,?,?,?,?)',uid(),tenant,session.id,action,id);
 if(membership.role==='assistant')return assistantRequest(req,db,path,body,tenant,session,audit);
 const announcementResult=await announcements(req,db,path,body,tenant,session,audit);if(announcementResult)return announcementResult;
 const assistantManagement=await manageAssistants(req,db,path,body,tenant,audit);if(assistantManagement)return assistantManagement;
 const operationsResult=await operations(req,db,path,body,tenant,session,audit);if(operationsResult)return operationsResult;
 const teachingResult=await teaching(req,env,path,body,tenant,session,audit);if(teachingResult)return teachingResult;
 const resource=async(table,id)=>{const r=await one(db,`SELECT * FROM ${table} WHERE tenant_id=? AND id=?`,tenant,text(id));if(!r)fail('Không tìm thấy dữ liệu.',404);return r;};
 if(path==='/overview'&&req.method==='GET')return json({totals:await one(db,`SELECT (SELECT COUNT(*) FROM classes WHERE tenant_id=? AND archived=0) classes,(SELECT COUNT(*) FROM students WHERE tenant_id=? AND archived=0) students,(SELECT COUNT(*) FROM lessons WHERE tenant_id=? AND ends_at>?) upcoming,(SELECT COALESCE(SUM(amount),0) FROM invoices WHERE tenant_id=?)-(SELECT COALESCE(SUM(amount),0) FROM payments WHERE tenant_id=?) outstanding`,tenant,tenant,tenant,new Date().toISOString(),tenant,tenant),classes:await all(db,'SELECT * FROM classes WHERE tenant_id=? AND archived=0',tenant),students:await all(db,'SELECT * FROM students WHERE tenant_id=? AND archived=0',tenant),lessons:await all(db,'SELECT l.*,c.name class_name FROM lessons l JOIN classes c ON c.id=l.class_id AND c.tenant_id=l.tenant_id WHERE l.tenant_id=? ORDER BY starts_at DESC LIMIT 500',tenant),enrollments:await all(db,'SELECT * FROM enrollments WHERE tenant_id=? AND active=1',tenant),invoices:await all(db,'SELECT i.*,s.name student_name,COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.tenant_id=i.tenant_id AND p.invoice_id=i.id),0) paid FROM invoices i JOIN students s ON s.id=i.student_id AND s.tenant_id=i.tenant_id WHERE i.tenant_id=? ORDER BY due_date DESC LIMIT 500',tenant)});
 if(['/classes','/students'].includes(path)&&req.method==='POST'){
  const id=uid(),name=text(body.name),table=path.slice(1);let stmt;
  if(table==='classes')stmt=query(db,'INSERT INTO classes(id,tenant_id,name,subject,fee) VALUES(?,?,?,?,?)',id,tenant,name,String(body.subject||'').slice(0,200),money(body.fee||0));
  else stmt=query(db,'INSERT INTO students(id,tenant_id,name,phone,guardian) VALUES(?,?,?,?,?)',id,tenant,name,String(body.phone||'').slice(0,30),String(body.guardian||'').slice(0,200));
  await db.batch([stmt,audit(`create_${table}`,id)]);return json({id},201);
 }
 const entity=path.match(/^\/(classes|students)\/([^/]+)$/);
 if(entity&&req.method==='PATCH'){const [,table,id]=entity;await resource(table,id);if(typeof body.archived!=='boolean')fail('Trạng thái không hợp lệ.');await db.batch([query(db,`UPDATE ${table} SET archived=? WHERE tenant_id=? AND id=?`,Number(body.archived),tenant,id),audit(`archive_${table}`,id)]);return json({ok:true});}
 if(path==='/enrollments'&&req.method==='POST'){
  const c=await resource('classes',body.class_id),s=await resource('students',body.student_id);if(c.archived||s.archived)fail('Dữ liệu đã lưu trữ.');
  await db.batch([query(db,'INSERT INTO enrollments VALUES(?,?,?,1) ON CONFLICT(tenant_id,class_id,student_id) DO UPDATE SET active=1',tenant,c.id,s.id),audit('enroll',s.id)]);return json({ok:true});
 }
 if(path==='/lessons'&&req.method==='POST'){
  const c=await resource('classes',body.class_id),start=new Date(body.starts_at),end=new Date(body.ends_at);if(c.archived||!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)fail('Thời gian buổi học không hợp lệ.');const id=uid();
  await db.batch([query(db,'INSERT INTO lessons VALUES(?,?,?,?,?,?)',id,tenant,c.id,start.toISOString(),end.toISOString(),String(body.topic||'').slice(0,500)),audit('create_lesson',id)]);return json({id},201);
 }
 if(path==='/attendance'&&req.method==='GET'){await resource('lessons',url.searchParams.get('lesson'));return json(await all(db,'SELECT * FROM attendance WHERE tenant_id=? AND lesson_id=?',tenant,url.searchParams.get('lesson')));}
 if(path==='/attendance'&&req.method==='POST'){
  const lesson=await resource('lessons',body.lesson_id);if(!Array.isArray(body.records)||body.records.length>300)fail('Danh sách không hợp lệ.');const statements=[];
  const enrolled=new Set((await all(db,'SELECT student_id FROM enrollments WHERE tenant_id=? AND class_id=? AND active=1',tenant,lesson.class_id)).map(e=>e.student_id));
  for(const row of body.records){if(!['present','absent','late','excused'].includes(row.status))fail('Trạng thái không hợp lệ.');if(!enrolled.has(row.student_id))fail('Học viên không thuộc lớp.');}
  await db.batch([query(db,`INSERT INTO attendance(tenant_id,lesson_id,student_id,status) SELECT ?,?,json_extract(value,'$.student_id'),json_extract(value,'$.status') FROM json_each(?) WHERE true ON CONFLICT(tenant_id,lesson_id,student_id) DO UPDATE SET status=excluded.status`,tenant,lesson.id,JSON.stringify(body.records)),audit('attendance',lesson.id)]);return json({ok:true});
 }
 if(path==='/invoices'&&req.method==='POST'){
  await resource('students',body.student_id);const amount=money(body.amount);if(amount===0||!/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)||!Number.isFinite(Date.parse(body.due_date)))fail('Học phí hoặc hạn thu không hợp lệ.');const id=uid();await db.batch([query(db,'INSERT INTO invoices VALUES(?,?,?,?,?,?)',id,tenant,body.student_id,text(body.description),amount,body.due_date),audit('invoice',id)]);return json({id},201);
 }
 if(path==='/payments'&&req.method==='POST'){
  const invoice=await resource('invoices',body.invoice_id),amount=money(body.amount),key=text(body.request_key,100);if(!amount)fail('Số tiền phải lớn hơn 0.');
  const existing=await one(db,'SELECT * FROM payments WHERE tenant_id=? AND request_key=?',tenant,key);if(existing){if(existing.invoice_id!==invoice.id||existing.amount!==amount)fail('Mã giao dịch đã được sử dụng.',409);return json({id:existing.id});}
  const id=uid();const results=await db.batch([query(db,'INSERT INTO payments(id,tenant_id,invoice_id,amount,request_key) SELECT ?,?,?,?,? WHERE ? <= (SELECT amount-COALESCE((SELECT SUM(amount) FROM payments WHERE tenant_id=? AND invoice_id=?),0) FROM invoices WHERE tenant_id=? AND id=?)',id,tenant,invoice.id,amount,key,amount,tenant,invoice.id,tenant,invoice.id),query(db,"INSERT INTO audit_logs(id,tenant_id,user_id,action,resource_id) SELECT ?,?,?,'payment',? WHERE EXISTS(SELECT 1 FROM payments WHERE id=?)",uid(),tenant,session.id,id,id)]);if(!results[0].meta.changes)fail('Số tiền vượt khoản còn phải thu.',409);return json({id},201);
 }
 if(path==='/audit'&&req.method==='GET')return json(await all(db,'SELECT action,resource_id,created_at FROM audit_logs WHERE tenant_id=? ORDER BY rowid DESC LIMIT 100',tenant));
 fail('Không tìm thấy chức năng.',404);
}
export default {async scheduled(event,env){const now=new Date().toISOString(),seconds=Math.floor(Date.now()/1000);await env.DB.batch([query(env.DB,`UPDATE attempts SET score=(SELECT ROUND(10.0*SUM(CASE WHEN json_extract(attempts.answers,'$."'||q.position||'"')=json_extract(q.snapshot,'$.answer') THEN 1 ELSE 0 END)/COUNT(*),2) FROM exam_questions q WHERE q.tenant_id=attempts.tenant_id AND q.exam_id=attempts.exam_id),submitted_at=? WHERE submitted_at IS NULL AND deadline<=?`,now,now),query(env.DB,'DELETE FROM sessions WHERE expires_at<?',seconds),query(env.DB,'DELETE FROM rate_limits WHERE reset_at<?',seconds),query(env.DB,'DELETE FROM student_invites WHERE expires_at<?',seconds),query(env.DB,'DELETE FROM guardian_invites WHERE expires_at<?',seconds),query(env.DB,'DELETE FROM assistant_invites WHERE expires_at<?',seconds)]);},async fetch(req,env){let response;try{response=new URL(req.url).pathname.startsWith('/api/')?await api(req,env):await env.ASSETS.fetch(req);}catch(e){if(e.message?.includes('SCHEDULE_OVERLAP')){e=Object.assign(new Error('Lịch học chồng lấn buổi đã có trong cùng lớp.'),{status:409});}response=json({error:e.message==='INVALID_INPUT'?'Dữ liệu không hợp lệ.':e.status?e.message:'Lỗi hệ thống. Vui lòng thử lại.'},e.status|| (e.message==='INVALID_INPUT'?400:500));}const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");return new Response(response.body,{status:response.status,headers});}};
