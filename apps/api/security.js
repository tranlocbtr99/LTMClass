export const uid = () => crypto.randomUUID();
const hex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function hash(s) { return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))); }
export async function passwordHash(password,salt=uid()) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 return `${salt}:${hex(bits)}`;
}
export async function passwordMatches(password,stored) {
 const actual=await passwordHash(password,stored.split(':')[0]);
 let diff=actual.length^stored.length; for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^stored.charCodeAt(i); return diff===0;
}
export function text(v,max=200) { if(typeof v!=='string'||!v.trim()||v.length>max) throw new Error('INVALID_INPUT'); return v.trim(); }
export function money(v) { if(!Number.isSafeInteger(v)||v<0||v>10000000000)throw new Error('INVALID_INPUT');return v; }
export function sameOrigin(request) { return request.headers.get('Origin')===new URL(request.url).origin; }
