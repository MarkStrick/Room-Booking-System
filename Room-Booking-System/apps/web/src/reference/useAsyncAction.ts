import { useRef, useState } from 'react';
export function useAsyncAction() {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const running=useRef(false);
  async function perform(task:()=>Promise<void>,success?:()=>void) {
    if(running.current)return;
    running.current=true;setBusy(true);setError('');
    try { await task(); success?.(); } catch(e) { setError((e as Error).message); } finally { running.current=false;setBusy(false); }
  }
  return {busy,error,perform};
}
