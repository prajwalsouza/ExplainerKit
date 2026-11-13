import {spawn} from 'node:child_process';
import {mkdtemp,rm,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,delimiter} from 'node:path';

export async function executablePath(name,candidates=[]){
 const search=[...candidates,...(process.env.PATH??'').split(delimiter).filter(Boolean).map(dir=>join(dir,name))];
 for(const path of search)try{await access(path,constants.X_OK);return path;}catch{}return null;
}
export function runProcess(command,args,{timeoutMs=120_000}={}){
 return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:['ignore','pipe','pipe'],shell:false});let stdout='',stderr='',done=false;const timer=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);
  child.stdout.on('data',data=>{stdout=(stdout+data).slice(-65536);});child.stderr.on('data',data=>{stderr=(stderr+data).slice(-65536);});
  child.on('error',error=>{if(done)return;done=true;clearTimeout(timer);reject(error);});child.on('close',(code,signal)=>{if(done)return;done=true;clearTimeout(timer);resolve({code,signal,stdout,stderr});});
 });
}

/** New isolated browser profile per run; no personal browsing profile is read. */
export async function launchChrome({chromePath,timeoutMs=30_000}={}){
 const executable=chromePath??await executablePath('google-chrome',['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/chromium-browser']);
 if(!executable)throw Error('Chrome/Chromium not found. Set CHROME_PATH or pass --chrome.');
 const profile=await mkdtemp(join(tmpdir(),'explainerkit-export-')),pending=new Map(),exceptions=[];let socket,sequence=0,closing=false,closed=false,stderr='';
 const child=spawn(executable,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--hide-scrollbars',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:['ignore','ignore','pipe'],shell:false});
 const exit=new Promise(resolve=>child.once('close',resolve));
 const failPending=error=>{for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(error);}pending.clear();};
 async function close(){if(closed)return;closed=true;closing=true;if(socket?.readyState===WebSocket.OPEN)socket.close();if(child.exitCode===null)child.kill();const timer=setTimeout(()=>child.kill('SIGKILL'),2000);await exit;clearTimeout(timer);await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150});}
 try{
  const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Chrome startup timed out.')),timeoutMs);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Chrome exited during startup (${code}): ${stderr.slice(-1000)}`));});child.stderr.on('data',data=>{stderr=(stderr+data).slice(-65536);const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(new URL(match[1]).host);}});});
  const response=await fetch(`http://${endpoint}/json/new?about:blank`,{method:'PUT',signal:AbortSignal.timeout(timeoutMs)});if(!response.ok)throw Error(`Cannot open browser target: ${response.status}`);const page=await response.json();
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Browser WebSocket connection timed out.')),timeoutMs);socket.onopen=()=>{clearTimeout(timer);resolve();};socket.onerror=()=>{clearTimeout(timer);reject(Error('Browser WebSocket connection failed.'));};});
  socket.onmessage=({data})=>{const message=JSON.parse(data);if(message.id){const call=pending.get(message.id);if(!call)return;pending.delete(message.id);clearTimeout(call.timer);message.error?call.reject(Error(`${call.method}: ${message.error.message}`)):call.resolve(message.result);}else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);};
  socket.onclose=()=>{if(!closing)failPending(Error('Browser connection closed.'));};socket.onerror=()=>failPending(Error('Browser connection failed.'));
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Browser command timed out: ${method}`));},timeoutMs);pending.set(id,{resolve,reject,timer,method});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  await send('Page.enable');await send('Runtime.enable');
  return {send,evaluate,exceptions,close};
 }catch(error){await close();throw error;}
}
