import {uid,text} from './security.js';
const q=(db,s,...a)=>db.prepare(s).bind(...a),one=(db,s,...a)=>q(db,s,...a).first();
const fail=(s,c=400)=>{throw Object.assign(Error(s),{status:c});},json=v=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
const code=prefix=>prefix+uid().replaceAll('-','').slice(0,24).toUpperCase();
const normalize=v=>text(v,100).replace(/\s/g,'').toUpperCase();
async function studentCode(db,tenant,id,rotate=false){await q(db,`INSERT INTO student_family_codes VALUES(?,?,?) ON CONFLICT(tenant_id,student_id) DO ${rotate?'UPDATE SET code=excluded.code':'NOTHING'}`,tenant,id,code('HS')).run();return (await one(db,'SELECT code FROM student_family_codes WHERE tenant_id=? AND student_id=?',tenant,id)).code;}
export async function joinCodes(req,db,path,body,user,tenant,tenants){
 if(path==='/class-code'&&req.method==='POST'){
  if(user.account_type!=='teacher'||!tenants.some(t=>t.id===tenant&&t.role==='owner'))fail('Chỉ giáo viên được cấp mã lớp.',403);
  const c=await one(db,'SELECT id FROM classes WHERE tenant_id=? AND id=? AND archived=0',tenant,text(body.class_id));if(!c)fail('Không tìm thấy lớp.',404);
  await q(db,`INSERT INTO class_join_codes VALUES(?,?,?) ON CONFLICT(tenant_id,class_id) DO ${body.rotate===true?'UPDATE SET code=excluded.code':'NOTHING'}`,tenant,c.id,code('LOP')).run();return json(await one(db,'SELECT code FROM class_join_codes WHERE tenant_id=? AND class_id=?',tenant,c.id));
 }
 if(path==='/learning/join'&&req.method==='POST'){
  if(user.account_type!=='student')fail('Hãy dùng tài khoản học viên để vào lớp.',403);
  const c=await one(db,'SELECT j.*,c.name FROM class_join_codes j JOIN classes c ON c.tenant_id=j.tenant_id AND c.id=j.class_id WHERE j.code=? AND c.archived=0',normalize(body.code));if(!c)fail('Mã lớp không hợp lệ hoặc đã được đổi.');
  const existing=await one(db,'SELECT a.student_id,s.archived FROM student_accounts a JOIN students s ON s.tenant_id=a.tenant_id AND s.id=a.student_id WHERE a.tenant_id=? AND a.user_id=?',c.tenant_id,user.id);if(existing?.archived)fail('Hồ sơ đã lưu trữ. Hãy liên hệ giáo viên.',403);
  const id=existing?.student_id||uid();const stmts=[];
  if(!existing)stmts.push(q(db,'INSERT INTO students(id,tenant_id,name) VALUES(?,?,?)',id,c.tenant_id,user.name),q(db,'INSERT INTO student_accounts VALUES(?,?,?)',c.tenant_id,id,user.id));
  stmts.push(q(db,'INSERT INTO enrollments VALUES(?,?,?,1) ON CONFLICT(tenant_id,class_id,student_id) DO UPDATE SET active=1',c.tenant_id,c.class_id,id),q(db,'INSERT INTO student_family_codes VALUES(?,?,?) ON CONFLICT(tenant_id,student_id) DO NOTHING',c.tenant_id,id,code('HS')));await db.batch(stmts);return json({ok:true,class_name:c.name,student_code:await studentCode(db,c.tenant_id,id)});
 }
 if(path==='/learning/student-code'&&['GET','POST'].includes(req.method)){
  const a=await one(db,'SELECT a.student_id FROM student_accounts a JOIN students s ON s.tenant_id=a.tenant_id AND s.id=a.student_id WHERE a.user_id=? AND a.tenant_id=? AND s.archived=0',user.id,tenant);if(!a)fail('Không có quyền học viên.',403);return json({code:await studentCode(db,tenant,a.student_id,req.method==='POST')});
 }
 if(path==='/family/join'&&req.method==='POST'){
  if(user.account_type!=='guardian')fail('Hãy dùng tài khoản phụ huynh.',403);
  const s=await one(db,'SELECT f.*,a.user_id FROM student_family_codes f JOIN students s ON s.tenant_id=f.tenant_id AND s.id=f.student_id JOIN student_accounts a ON a.tenant_id=f.tenant_id AND a.student_id=f.student_id WHERE f.code=? AND s.archived=0',normalize(body.code));if(!s)fail('Mã học viên không hợp lệ hoặc đã được đổi.');
  const old=await one(db,'SELECT revoked_at FROM guardian_links WHERE tenant_id=? AND student_id=? AND user_id=?',s.tenant_id,s.student_id,user.id);if(old?.revoked_at)fail('Quyền đã bị thu hồi. Hãy liên hệ giáo viên.',403);if(old)return json({ok:true});
  await q(db,'INSERT INTO guardian_links(id,tenant_id,student_id,user_id,verified_by,verified_at) VALUES(?,?,?,?,?,?)',uid(),s.tenant_id,s.student_id,user.id,s.user_id,new Date().toISOString()).run();return json({ok:true});
 }
 return null;
}
