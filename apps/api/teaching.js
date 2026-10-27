import {externalURL} from './schedule.js';
import {uid,hash,text} from './security.js';
const q=(db,sql,...a)=>db.prepare(sql).bind(...a),one=(db,sql,...a)=>q(db,sql,...a).first(),all=async(db,sql,...a)=>(await q(db,sql,...a).all()).results;
const json=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
const fail=(s,c=400)=>{throw Object.assign(Error(s),{status:c});};
const requiredDate=v=>{const d=new Date(v);if(!Number.isFinite(+d))fail('Ngày giờ không hợp lệ.');return d.toISOString();};
export async function learning(req,db,path,body,user,tenant,env){
 if(path==='/learning'&&req.method==='GET')return json(await all(db,'SELECT a.tenant_id,a.student_id,t.name tenant_name,s.name student_name FROM student_accounts a JOIN tenants t ON t.id=a.tenant_id JOIN students s ON s.tenant_id=a.tenant_id AND s.id=a.student_id WHERE a.user_id=? AND s.archived=0',user.id));
 if(path==='/learning/redeem'&&req.method==='POST'){
  const key=await hash(text(body.code,100)),invite=await one(db,'SELECT * FROM student_invites WHERE token_hash=? AND used_at IS NULL AND expires_at>?',key,Math.floor(Date.now()/1000));
  if(!invite)fail('Mã liên kết không hợp lệ hoặc đã hết hạn.');
  if(await one(db,'SELECT 1 FROM student_accounts WHERE tenant_id=? AND (student_id=? OR user_id=?)',invite.tenant_id,invite.student_id,user.id))fail('Học viên hoặc tài khoản đã được liên kết.',409);
  await db.batch([q(db,'INSERT INTO student_accounts(tenant_id,student_id,user_id) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM student_invites WHERE token_hash=? AND used_at IS NULL AND expires_at>?)',invite.tenant_id,invite.student_id,user.id,key,Math.floor(Date.now()/1000)),q(db,'UPDATE student_invites SET used_at=? WHERE token_hash=? AND used_at IS NULL',Math.floor(Date.now()/1000),key)]);return json({ok:true});
 }
 if(!path.startsWith('/learn/'))return null;
 const account=await one(db,'SELECT a.student_id FROM student_accounts a JOIN students s ON s.id=a.student_id AND s.tenant_id=a.tenant_id WHERE a.tenant_id=? AND a.user_id=? AND s.archived=0',tenant,user.id);if(!account)fail('Không có quyền học viên.',403);
 const student=account.student_id;
 const enrolled=async(classId)=>{if(!await one(db,'SELECT 1 FROM enrollments WHERE tenant_id=? AND student_id=? AND class_id=? AND active=1',tenant,student,classId))fail('Không thuộc lớp học.',403);};
 if(path==='/learn/overview'&&req.method==='GET'){
  const bind=[tenant,student];return json({assignments:await all(db,'SELECT a.*,s.content submission,s.external_url,s.score,s.feedback,s.submitted_at FROM assignments a JOIN enrollments e ON e.tenant_id=a.tenant_id AND e.class_id=a.class_id LEFT JOIN submissions s ON s.tenant_id=a.tenant_id AND s.assignment_id=a.id AND s.student_id=e.student_id WHERE a.tenant_id=? AND e.student_id=? AND e.active=1 AND a.published=1 ORDER BY a.due_at',...bind),exams:await all(db,'SELECT x.*,a.id attempt_id,a.submitted_at,a.score,a.deadline FROM exams x JOIN enrollments e ON e.tenant_id=x.tenant_id AND e.class_id=x.class_id LEFT JOIN attempts a ON a.tenant_id=x.tenant_id AND a.exam_id=x.id AND a.student_id=e.student_id WHERE x.tenant_id=? AND e.student_id=? AND e.active=1 AND x.published=1 ORDER BY x.opens_at',...bind),materials:await all(db,'SELECT m.id,m.title,m.filename,m.external_url,m.class_id,m.created_at FROM materials m JOIN enrollments e ON e.tenant_id=m.tenant_id AND e.class_id=m.class_id WHERE m.tenant_id=? AND e.student_id=? AND e.active=1',...bind)});
 }
 if(path==='/learn/submit'&&req.method==='POST'){
  const assignment=await one(db,'SELECT * FROM assignments WHERE tenant_id=? AND id=? AND published=1',tenant,text(body.assignment_id));if(!assignment)fail('Không tìm thấy bài tập.',404);await enrolled(assignment.class_id);if(Date.now()>Date.parse(assignment.due_at))fail('Đã hết hạn nộp bài.',409);
  if(await one(db,'SELECT 1 FROM submissions WHERE tenant_id=? AND assignment_id=? AND student_id=?',tenant,assignment.id,student))fail('Bài đã nộp. Không thể nộp lại.',409);
  const url=body.external_url?externalURL(body.external_url):'';const content=String(body.content||'').trim();if(!content&&!url)fail('Nhập bài làm hoặc liên kết bài nộp.');if(content.length>10000)fail('Bài làm tối đa 10000 ký tự.');await q(db,'INSERT INTO submissions(id,tenant_id,assignment_id,student_id,content,submitted_at,external_url) VALUES(?,?,?,?,?,?,?)',uid(),tenant,assignment.id,student,content,new Date().toISOString(),url).run();return json({ok:true});
 }
 if(path==='/learn/attempt'&&req.method==='POST'){
  const exam=await one(db,'SELECT * FROM exams WHERE tenant_id=? AND id=? AND published=1',tenant,text(body.exam_id));if(!exam)fail('Không tìm thấy bài thi.',404);await enrolled(exam.class_id);
  const now=new Date();if(now<new Date(exam.opens_at))fail('Bài thi chưa mở.');
  let attempt=await one(db,'SELECT * FROM attempts WHERE tenant_id=? AND exam_id=? AND student_id=?',tenant,exam.id,student);
  if(!attempt){if(now>=new Date(exam.closes_at))fail('Bài thi đã đóng.');await q(db,'INSERT INTO attempts(id,tenant_id,exam_id,student_id,started_at,deadline) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant_id,exam_id,student_id) DO NOTHING',uid(),tenant,exam.id,student,now.toISOString(),new Date(Math.min(+now+exam.duration*60000,Date.parse(exam.closes_at))).toISOString()).run();attempt=await one(db,'SELECT * FROM attempts WHERE tenant_id=? AND exam_id=? AND student_id=?',tenant,exam.id,student);}
  const questions=await all(db,'SELECT position,snapshot FROM exam_questions WHERE tenant_id=? AND exam_id=? ORDER BY position',tenant,exam.id);
  if(!attempt.submitted_at&&now>=new Date(attempt.deadline)){await finalize(db,attempt,questions);attempt=await one(db,'SELECT * FROM attempts WHERE id=?',attempt.id);}
  return json({attempt,server_now:now.toISOString(),questions:questions.map(r=>{const {answer,explanation,...safe}=JSON.parse(r.snapshot);return {...safe,position:r.position};})});
 }
 if(path==='/learn/save'&&req.method==='POST'){
  const attempt=await one(db,'SELECT * FROM attempts WHERE id=? AND tenant_id=? AND student_id=?',text(body.attempt_id),tenant,student);if(!attempt)fail('Không tìm thấy lượt thi.',404);
  if(attempt.submitted_at)return json({submitted:true,score:attempt.score});
  const attemptExam=await one(db,'SELECT class_id FROM exams WHERE tenant_id=? AND id=?',tenant,attempt.exam_id);await enrolled(attemptExam.class_id);
  const questions=await all(db,'SELECT position,snapshot FROM exam_questions WHERE tenant_id=? AND exam_id=? ORDER BY position',tenant,attempt.exam_id);
  const now=new Date();if(now>=new Date(attempt.deadline)){const score=await finalize(db,attempt,questions);return json({submitted:true,score});}
  if(!body.answers||Array.isArray(body.answers)||typeof body.answers!=='object')fail('Đáp án không hợp lệ.');const valid=new Set(questions.map(q=>String(q.position)));
  for(const [k,v] of Object.entries(body.answers))if(!valid.has(k)||!Number.isInteger(v)||v<0||v>3)fail('Đáp án không hợp lệ.');
  const answers=JSON.stringify(body.answers);
  await q(db,'UPDATE attempts SET answers=? WHERE id=? AND submitted_at IS NULL AND deadline>?',answers,attempt.id,now.toISOString()).run();
  if(body.submit===true){const saved=await one(db,'SELECT * FROM attempts WHERE id=?',attempt.id);const score=await finalize(db,saved,questions);return json({submitted:true,score});}
  return json({saved:true,server_now:now.toISOString()});
 }
 if(path.startsWith('/learn/materials/'))return download(db,req,tenant,path.split('/').pop(),enrolled,env);
 return null;
}
async function finalize(db,attempt,questions){const answers=JSON.parse(attempt.answers);const score=Math.round(questions.reduce((n,r)=>n+(answers[r.position]===JSON.parse(r.snapshot).answer?1:0),0)/questions.length*1000)/100;await q(db,'UPDATE attempts SET submitted_at=?,score=? WHERE id=? AND submitted_at IS NULL',new Date().toISOString(),score,attempt.id).run();return (await one(db,'SELECT score FROM attempts WHERE id=?',attempt.id)).score;}
export async function teaching(req,env,path,body,tenant,user,audit){
 const db=env.DB;
 const resource=async(table,id)=>{const row=await one(db,`SELECT * FROM ${table} WHERE tenant_id=? AND id=?`,tenant,text(id));if(!row)fail('Không tìm thấy dữ liệu.',404);return row;};
 if(path==='/teaching'&&req.method==='GET'){const expired=await all(db,'SELECT * FROM attempts WHERE tenant_id=? AND submitted_at IS NULL AND deadline<=?',tenant,new Date().toISOString());for(const a of expired)await finalize(db,a,await all(db,'SELECT position,snapshot FROM exam_questions WHERE tenant_id=? AND exam_id=?',tenant,a.exam_id));return json({material_mode:'links',assignments:await all(db,'SELECT * FROM assignments WHERE tenant_id=? ORDER BY due_at DESC',tenant),submissions:await all(db,'SELECT s.*,a.title assignment_title,t.name student_name FROM submissions s JOIN assignments a ON a.tenant_id=s.tenant_id AND a.id=s.assignment_id JOIN students t ON t.tenant_id=s.tenant_id AND t.id=s.student_id WHERE s.tenant_id=? ORDER BY s.submitted_at DESC',tenant),questions:await all(db,'SELECT * FROM questions WHERE tenant_id=? ORDER BY rowid DESC',tenant),exams:await all(db,'SELECT * FROM exams WHERE tenant_id=? ORDER BY opens_at DESC',tenant),attempts:await all(db,'SELECT a.*,s.name student_name,x.title exam_title FROM attempts a JOIN students s ON s.id=a.student_id AND s.tenant_id=a.tenant_id JOIN exams x ON x.id=a.exam_id AND x.tenant_id=a.tenant_id WHERE a.tenant_id=? ORDER BY a.started_at DESC',tenant),materials:await all(db,'SELECT id,class_id,title,filename,external_url,size,created_at FROM materials WHERE tenant_id=?',tenant)});}
 const publish=path.match(/^\/(assignments|exams)\/([^/]+)$/);
 if(publish&&req.method==='PATCH'){const [,table,id]=publish;await resource(table,id);if(typeof body.published!=='boolean')fail('Trạng thái không hợp lệ.');await db.batch([q(db,`UPDATE ${table} SET published=? WHERE tenant_id=? AND id=?`,Number(body.published),tenant,id),audit('publish_'+table,id)]);return json({ok:true});}
 if(path==='/student-invites'&&req.method==='POST'){
  const s=await resource('students',body.student_id);if(s.archived)fail('Học viên đã lưu trữ.');const code=uid()+uid();await db.batch([q(db,'UPDATE student_invites SET used_at=? WHERE tenant_id=? AND student_id=? AND used_at IS NULL',Math.floor(Date.now()/1000),tenant,s.id),q(db,'INSERT INTO student_invites VALUES(?,?,?,?,NULL)',await hash(code),tenant,s.id,Math.floor(Date.now()/1000)+86400),audit('invite_student',s.id)]);return json({code,expires_in:86400});
 }
 if(path==='/assignments'&&req.method==='POST'){
  const c=await resource('classes',body.class_id);if(c.archived)fail('Lớp đã lưu trữ.');const id=uid();await db.batch([q(db,'INSERT INTO assignments VALUES(?,?,?,?,?,?,?)',id,tenant,c.id,text(body.title),text(body.instructions,10000),requiredDate(body.due_at),body.published===true?1:0),audit('assignment',id)]);return json({id},201);
 }
 if(path==='/grades'&&req.method==='POST'){
  const s=await resource('submissions',body.submission_id);if(typeof body.score!=='number'||!Number.isFinite(body.score)||body.score<0||body.score>10)fail('Điểm cần nằm trong khoảng 0–10.');await db.batch([q(db,'UPDATE submissions SET score=?,feedback=?,graded_at=? WHERE id=? AND tenant_id=?',body.score,String(body.feedback||'').slice(0,2000),new Date().toISOString(),s.id,tenant),audit('grade',s.id)]);return json({ok:true});
 }
 if(path==='/questions'&&req.method==='POST'){
  if(!Array.isArray(body.choices)||body.choices.length!==4||!Number.isInteger(body.answer)||body.answer<0||body.answer>3)fail('Cần 4 lựa chọn và một đáp án đúng.');const id=uid();await db.batch([q(db,'INSERT INTO questions VALUES(?,?,?,?,?,?,?)',id,tenant,text(body.subject),text(body.prompt,5000),JSON.stringify(body.choices.map(c=>text(c,2000))),body.answer,String(body.explanation||'').slice(0,3000)),audit('question',id)]);return json({id},201);
 }
 if(path==='/exams'&&req.method==='POST'){
  const c=await resource('classes',body.class_id);if(c.archived)fail('Lớp đã lưu trữ.');if(!Number.isInteger(body.duration)||body.duration<1||body.duration>180)fail('Thời gian thi từ 1–180 phút.');const opens=requiredDate(body.opens_at),closes=requiredDate(body.closes_at);if(opens>=closes)fail('Thời điểm đóng phải sau thời điểm mở.');if(!Array.isArray(body.question_ids)||!body.question_ids.length||body.question_ids.length>100||new Set(body.question_ids).size!==body.question_ids.length)fail('Chọn từ 1–100 câu hỏi khác nhau.');const snapshots=await all(db,`SELECT * FROM questions WHERE tenant_id=? AND id IN(SELECT value FROM json_each(?))`,tenant,JSON.stringify(body.question_ids));if(snapshots.length!==body.question_ids.length)fail('Câu hỏi không hợp lệ.',404);snapshots.sort((a,b)=>body.question_ids.indexOf(a.id)-body.question_ids.indexOf(b.id));const id=uid();await db.batch([q(db,'INSERT INTO exams VALUES(?,?,?,?,?,?,?,?)',id,tenant,c.id,text(body.title),body.duration,opens,closes,body.published===true?1:0),q(db,`INSERT INTO exam_questions SELECT ?,?,CAST(key AS INTEGER),value FROM json_each(?)`,tenant,id,JSON.stringify(snapshots.map(s=>({...s,choices:JSON.parse(s.choices)})))),audit('exam',id)]);return json({id},201);
 }
 if(path==='/materials'&&req.method==='POST'){
  const c=await resource('classes',body.class_id);if(c.archived)fail('Lớp đã lưu trữ.');const url=externalURL(body.external_url),id=uid();await db.batch([q(db,'INSERT INTO materials(id,tenant_id,class_id,title,object_key,filename,mime,size,external_url) VALUES(?,?,?,?,?,?,?,?,?)',id,tenant,c.id,text(body.title),'link:'+id,new URL(url).hostname,'text/uri-list',0,url),audit('material_link',id)]);return json({id},201);
 }
 if(path.startsWith('/materials/')&&req.method==='GET')return download(db,req,tenant,path.split('/').pop(),null,env);
 return null;
}
async function download(db,req,tenant,id,enrolled,env){if(req.method!=='GET')return null;const material=await one(db,'SELECT * FROM materials WHERE tenant_id=? AND id=?',tenant,id);if(!material)fail('Không tìm thấy tài liệu.',404);if(enrolled)await enrolled(material.class_id);if(!material.external_url)fail('Tài liệu cũ cần được thay bằng liên kết.',410);return new Response(null,{status:302,headers:{Location:externalURL(material.external_url),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});}
