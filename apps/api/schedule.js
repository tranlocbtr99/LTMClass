// Dates/times are entered in Asia/Ho_Chi_Minh (UTC+07, no daylight saving).
const invalid=message=>{throw Object.assign(Error(message),{status:400});};
export function buildSchedule(input){
 if(!Number.isInteger(input.weeks)||input.weeks<1||input.weeks>24)invalid('Chọn từ 1–24 tuần.');
 if(!input.sessions){const start=new Date(input.starts_at),end=new Date(input.ends_at);if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)invalid('Thời gian buổi học không hợp lệ.');return Array.from({length:input.weeks},(_,i)=>({starts_at:new Date(+start+i*604800000).toISOString(),ends_at:new Date(+end+i*604800000).toISOString()}));}
 if(typeof input.start_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date))invalid('Ngày bắt đầu không hợp lệ.');
 const first=new Date(input.start_date+'T00:00:00Z');if(!Number.isFinite(+first)||first.toISOString().slice(0,10)!==input.start_date)invalid('Ngày bắt đầu không hợp lệ.');
 if(!Array.isArray(input.sessions)||!input.sessions.length||input.sessions.length>21)invalid('Chọn từ 1–21 khung giờ mỗi tuần.');
 for(const s of input.sessions){if(!Number.isInteger(s.weekday)||s.weekday<0||s.weekday>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end_time)||s.end_time<=s.start_time)invalid('Mỗi buổi cần ngày và giờ kết thúc sau giờ bắt đầu (trong cùng ngày).');}
 const slots=[];for(let i=0;i<input.weeks*7;i++){const day=new Date(+first+i*86400000),date=day.toISOString().slice(0,10);for(const s of input.sessions.filter(s=>s.weekday===day.getUTCDay()))slots.push({starts_at:new Date(`${date}T${s.start_time}:00+07:00`).toISOString(),ends_at:new Date(`${date}T${s.end_time}:00+07:00`).toISOString()});}
 slots.sort((a,b)=>a.starts_at.localeCompare(b.starts_at));for(let i=1;i<slots.length;i++)if(slots[i].starts_at<slots[i-1].ends_at)invalid('Các khung giờ đã chọn bị trùng hoặc chồng lấn.');return slots;
}
export function externalURL(value){let u;try{u=new URL(value);}catch{invalid('Liên kết không hợp lệ.');}if(typeof value!=='string'||value.length>2048||u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.hostname.endsWith('.local'))invalid('Sử dụng liên kết HTTPS, không chứa tên đăng nhập hoặc mật khẩu.');return u.href;}
