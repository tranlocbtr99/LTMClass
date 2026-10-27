import {uid,text,passwordMatches} from './security.js';
const q=(db,sql,...a)=>db.prepare(sql).bind(...a),one=(db,sql,...a)=>q(db,sql,...a).first(),all=async(db,sql,...a)=>(await q(db,sql,...a).all()).results,json=v=>Response.json(v,{headers:{'Cache-Control':'no-store'}}),fail=(s,c=400)=>{throw Object.assign(Error(s),{status:c});};
export async function account(req,db,path,body,user,tenant){
 if(path==='/account'&&req.method==='GET')return json(await one(db,'SELECT name,email,phone FROM users WHERE id=?',user.id));
 if(path==='/account'&&req.method==='PUT'){
  const stored=await one(db,'SELECT email,password FROM users WHERE id=?',user.id),email=text(body.email,254).toLowerCase(),name=text(body.name),phone=String(body.phone||'').trim().replace(/[\s().-]/g,'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Gmail/email không hợp lệ.');if(phone&&!/^\+?[0-9]{8,15}$/.test(phone))fail('Số điện thoại cần 8–15 chữ số, có thể bắt đầu bằng +.');
  const changed=email!==stored.email.toLowerCase();if(changed&&!await passwordMatches(text(body.current_password,128),stored.password))fail('Mật khẩu xác nhận không đúng.',403);
  if(changed&&await one(db,'SELECT 1 FROM users WHERE email=? AND id<>?',email,user.id))fail('Email đã được sử dụng.',409);
  const stmts=[q(db,'UPDATE users SET name=?,email=?,phone=? WHERE id=?',name,email,phone,user.id)];if(changed)stmts.push(q(db,'DELETE FROM sessions WHERE user_id=?',user.id));
  try{await db.batch(stmts);}catch(e){if(e.message?.includes('UNIQUE'))fail('Email đã được sử dụng.',409);throw e;}return json({ok:true,reauthenticate:changed});
 }
 if(path==='/teacher-contact'&&req.method==='GET'){
  const permitted=await one(db,`SELECT 1 FROM members WHERE tenant_id=? AND user_id=? UNION SELECT 1 FROM student_accounts a JOIN students s ON s.tenant_id=a.tenant_id AND s.id=a.student_id JOIN enrollments e ON e.tenant_id=a.tenant_id AND e.student_id=a.student_id JOIN classes c ON c.tenant_id=e.tenant_id AND c.id=e.class_id WHERE a.tenant_id=? AND a.user_id=? AND s.archived=0 AND e.active=1 AND c.archived=0 UNION SELECT 1 FROM guardian_links g JOIN students s ON s.tenant_id=g.tenant_id AND s.id=g.student_id JOIN enrollments e ON e.tenant_id=g.tenant_id AND e.student_id=g.student_id JOIN classes c ON c.tenant_id=e.tenant_id AND c.id=e.class_id WHERE g.tenant_id=? AND g.user_id=? AND g.revoked_at IS NULL AND s.archived=0 AND e.active=1 AND c.archived=0`,tenant,user.id,tenant,user.id,tenant,user.id);if(!permitted)fail('Không có quyền xem liên hệ giáo viên.',403);
  return json(await one(db,'SELECT u.name,u.phone,t.name workspace FROM tenants t JOIN users u ON u.id=t.owner_id WHERE t.id=?',tenant));
 }
 return null;
}
export async function announcements(req,db,path,body,tenant,user,audit){
 if(path==='/announcements'&&req.method==='GET')return json(await all(db,'SELECT a.*,c.name class_name FROM class_announcements a JOIN classes c ON c.tenant_id=a.tenant_id AND c.id=a.class_id WHERE a.tenant_id=? ORDER BY a.rowid DESC LIMIT 100',tenant));
 if(path==='/announcements'&&req.method==='POST'){
  const cls=await one(db,'SELECT id FROM classes WHERE tenant_id=? AND id=? AND archived=0',tenant,text(body.class_id));if(!cls)fail('Không tìm thấy lớp đang hoạt động.',404);
  const title=text(body.title,200),content=text(body.content,5000),kind=body.kind,request=text(body.request_key,100);if(!['general','schedule','assignment'].includes(kind))fail('Loại thông báo không hợp lệ.');
  const prior=await one(db,'SELECT * FROM class_announcements WHERE tenant_id=? AND request_key=?',tenant,request);if(prior){if(prior.class_id!==cls.id||prior.title!==title||prior.content!==content||prior.kind!==kind)fail('Mã gửi đã được sử dụng.',409);return json({id:prior.id,duplicate:true});}
  const id=uid();const result=await db.batch([q(db,'INSERT INTO class_announcements(id,tenant_id,class_id,author_id,kind,title,content,request_key) VALUES(?,?,?,?,?,?,?,?)',id,tenant,cls.id,user.id,kind,title,content,request),q(db,`INSERT OR IGNORE INTO notifications(id,tenant_id,user_id,event_key,title,content) SELECT lower(hex(randomblob(16))),?,recipient,'announcement:'||?,?,? FROM (SELECT a.user_id recipient FROM enrollments e JOIN students s ON s.tenant_id=e.tenant_id AND s.id=e.student_id JOIN student_accounts a ON a.tenant_id=e.tenant_id AND a.student_id=e.student_id WHERE e.tenant_id=? AND e.class_id=? AND e.active=1 AND s.archived=0 UNION SELECT g.user_id recipient FROM enrollments e JOIN students s ON s.tenant_id=e.tenant_id AND s.id=e.student_id JOIN guardian_links g ON g.tenant_id=e.tenant_id AND g.student_id=e.student_id WHERE e.tenant_id=? AND e.class_id=? AND e.active=1 AND s.archived=0 AND g.revoked_at IS NULL)`,tenant,id,title,content,tenant,cls.id,tenant,cls.id),audit('class_announcement',id)]);return json({id,recipients:result[1].meta.changes});
 }
 return null;
}
