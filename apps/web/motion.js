// Progressive enhancement: motion never gates navigation or data entry.
export const reducedMotion=()=>typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export async function closeDialog(dialog){
 if(!dialog.open)return;
 if(reducedMotion()||typeof dialog.animate!=='function'){dialog.close();return;}
 if(dialog.dataset.closing==='true')return;
 dialog.dataset.closing='true';
 try{await dialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(8px) scale(.985)'}],{duration:140,easing:'cubic-bezier(.4,0,1,1)'}).finished;}catch{/* An interrupted animation must still allow closing. */}
 finally{delete dialog.dataset.closing;dialog.close();}
}
export function installMotion(){
 document.addEventListener('pointerdown',event=>{
  if(reducedMotion()||event.button>0)return;
  const button=event.target.closest?.('button');if(!button||button.disabled||button.classList.contains('lesson-event'))return;
  if(typeof button.animate==='function')button.animate([{transform:'scale(1)'},{transform:'scale(.975)'},{transform:'scale(1)'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
 },{passive:true});
 const modal=document.querySelector('#modal');modal?.addEventListener('cancel',event=>{if(!reducedMotion()&&typeof modal.animate==='function'){event.preventDefault();void closeDialog(modal);}});
}
