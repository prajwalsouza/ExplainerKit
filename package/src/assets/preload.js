import {assert,number,options,safeCopy,KitError} from '../core/validate.js';

function manifest(input,baseURL,origins){
  const copy=safeCopy(input);options(copy,['acts'],'asset manifest');
  assert(Array.isArray(copy.acts)&&copy.acts.length>0&&copy.acts.length<=256,'INVALID_ASSET_MANIFEST','Use one to 256 ordered acts.');
  const assets=new Map(),actIds=new Set();
  const acts=copy.acts.map((act,index)=>{
    options(act,['id','files'],'asset act');assert(typeof act.id==='string'&&act.id.length>0&&act.id.length<=128&&!actIds.has(act.id),'INVALID_ASSET_ACT','Act IDs must be unique nonempty strings.');actIds.add(act.id);
    assert(Array.isArray(act.files)&&act.files.length<=1000,'INVALID_ASSET_MANIFEST','Use at most 1000 files per act.');
    const files=act.files.map(file=>{
      const item=typeof file==='string'?{id:file,url:file}:file;options(item,['id','url','integrity'],'asset file');
      assert(typeof item.id==='string'&&item.id.length>0&&item.id.length<=2048,'INVALID_ASSET_ID','Assets need a nonempty ID.');
      assert(typeof item.url==='string'&&item.url.length>0&&item.url.length<=2048,'INVALID_ASSET_URL','Asset URLs must contain at most 2048 characters.');
      let url;try{url=new URL(item.url,baseURL);}catch{throw new KitError('INVALID_ASSET_URL','Relative URLs require a valid baseURL.');}
      assert(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&origins.has(url.origin),'ASSET_ORIGIN_DENIED','Use HTTP(S) URLs on an explicitly allowed origin.');
      if(item.integrity!==undefined)assert(typeof item.integrity==='string'&&/^sha256-[A-Za-z0-9+/]{43}=$/.test(item.integrity),'INVALID_ASSET_INTEGRITY','Use one sha256-base64 integrity hash.');
      const descriptor=Object.freeze({id:item.id,url:url.href,source:item.url,integrity:item.integrity??null});
      const previous=assets.get(item.id);assert(!previous||(previous.url===descriptor.url&&previous.integrity===descriptor.integrity),'DUPLICATE_ASSET','A shared asset ID must retain the same URL and integrity.');assets.set(item.id,descriptor);assert(assets.size<=1000,'RESOURCE_LIMIT','Use at most 1000 unique assets.');return item.id;
    });return Object.freeze({id:act.id,index,files:Object.freeze([...new Set(files)])});
  });return{acts:Object.freeze(acts),assets};
}
function encodeBase64(bytes){let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}

/** Bounded first-party fetch queue. Construction is inert; start/updateAct opts in. */
export function preload(input,spec={}){
  options(spec,['ahead','maxBytes','maxConcurrent','baseURL','origins','fetch'],'preload options');
  const ahead=number(spec.ahead??2,'preload ahead',0,16),maxBytes=number(spec.maxBytes??16*1024*1024,'preload bytes',1,256*1024*1024),maxConcurrent=number(spec.maxConcurrent??3,'preload concurrency',1,16);
  assert(Number.isInteger(ahead)&&Number.isInteger(maxBytes)&&Number.isInteger(maxConcurrent),'INVALID_PRELOAD_OPTIONS','ahead, maxBytes and maxConcurrent must be integers.');
  const baseURL=spec.baseURL??globalThis.location?.href;let base;
  try{if(baseURL!==undefined)base=new URL(baseURL);}catch{throw new KitError('INVALID_ASSET_URL','baseURL must be an absolute HTTP(S) URL.');}
  assert(!base||(['http:','https:'].includes(base.protocol)&&!base.username&&!base.password),'INVALID_ASSET_URL','baseURL must be an absolute HTTP(S) URL without credentials.');
  const allowed=spec.origins===undefined?(base?[base.origin]:[]):safeCopy(spec.origins);assert(Array.isArray(allowed)&&allowed.length<=32,'INVALID_ASSET_ORIGINS','origins must contain at most 32 HTTP(S) origins.');
  const origins=new Set(allowed.map(origin=>{assert(typeof origin==='string','INVALID_ASSET_ORIGINS','Origins must be strings.');let url;try{url=new URL(origin);}catch{throw new KitError('INVALID_ASSET_ORIGINS','Provide absolute HTTP(S) origins.');}assert(['http:','https:'].includes(url.protocol)&&url.origin===origin,'INVALID_ASSET_ORIGINS','Origins must have no path, slash, credentials, or query.');return origin;}));
  const parsed=manifest(input,base?.href,origins),fetcher=spec.fetch??globalThis.fetch;
  assert(typeof fetcher==='function','UNSUPPORTED_FETCH','Provide a streaming Fetch-compatible implementation.');
  const records=new Map([...parsed.assets].map(([id,descriptor])=>[id,{descriptor,state:'idle',bytes:null,error:null,task:null}]));
  let disposed=false,current=null,desired=new Set(),active=0,heldBytes=0;const waiters=[];
  function snapshot(){return Object.freeze({disposed,act:current===null?null:parsed.acts[current].id,bytes:heldBytes,maxBytes,active,assets:Object.freeze([...records.values()].map(record=>Object.freeze({...record.descriptor,status:record.state,bytes:record.bytes?.byteLength??record.task?.held??0,error:record.error})))});}
  function settled(){if(disposed||[...desired].every(id=>!['queued','loading'].includes(records.get(id).state)))return Promise.resolve(snapshot());return new Promise(resolve=>waiters.push(resolve));}
  function notify(){if(disposed||[...desired].every(id=>!['queued','loading'].includes(records.get(id).state))){const view=snapshot();for(const resolve of waiters.splice(0))resolve(view);}}
  function release(task){if(task.held){heldBytes-=task.held;task.held=0;}}
  function cancel(record){const task=record.task;if(task){task.chunks.length=0;task.cancelled=true;task.controller.abort();task.reader?.cancel().catch(()=>{});release(task);record.task=null;}if(record.bytes){heldBytes-=record.bytes.byteLength;record.bytes=null;}record.state='idle';record.error=null;}
  function isCurrent(record,task){return !disposed&&!task.cancelled&&record.task===task&&desired.has(record.descriptor.id);}
  async function load(record,task){
    const {descriptor}=record;const chunks=task.chunks;
    try{
      const response=await fetcher(descriptor.url,{signal:task.controller.signal,credentials:'omit',redirect:'error',...(descriptor.integrity?{integrity:descriptor.integrity}:{})});
      if(!isCurrent(record,task))return;
      assert(response?.ok,'ASSET_HTTP_ERROR',`Asset request failed (${response?.status??'unknown'}).`);
      if(response.url){const final=new URL(response.url);assert(origins.has(final.origin)&&['http:','https:'].includes(final.protocol),'ASSET_ORIGIN_DENIED','The response came from an unapproved origin.');}
      assert(response.body&&typeof response.body.getReader==='function','ASSET_STREAM_REQUIRED','A streaming response body is required to enforce the byte budget.');
      task.reader=response.body.getReader();
      const declared=response.headers?.get?.('content-length');
      if(declared!==null&&declared!==undefined&&/^\d+$/.test(declared))assert(Number(declared)<=maxBytes-heldBytes,'ASSET_BUDGET_EXCEEDED','Content-Length exceeds the remaining asset byte budget.');
      for(;;){const result=await task.reader.read();if(!isCurrent(record,task))return;if(result.done)break;assert(++task.reads<=65536,'ASSET_CHUNK_LIMIT','An asset exceeds the 65536-chunk stream limit.');const value=result.value;assert(value instanceof Uint8Array,'INVALID_ASSET_CHUNK','Fetch streams must yield Uint8Array chunks.');assert(value.byteLength<=maxBytes-heldBytes,'ASSET_BUDGET_EXCEEDED','Stream bytes exceed the remaining asset byte budget.');heldBytes+=value.byteLength;task.held+=value.byteLength;if(value.byteLength)chunks.push(value.slice());}
      const bytes=new Uint8Array(task.held);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      if(descriptor.integrity){assert(globalThis.crypto?.subtle,'ASSET_INTEGRITY_UNSUPPORTED','Integrity verification requires Web Crypto.');const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);if(!isCurrent(record,task))return;assert(`sha256-${encodeBase64(new Uint8Array(digest))}`===descriptor.integrity,'ASSET_INTEGRITY_MISMATCH','The asset bytes do not match the expected SHA-256 hash.');}
      if(!isCurrent(record,task))return;
      record.bytes=bytes;task.held=0;record.state='ready';record.task=null;
    }catch(error){if(isCurrent(record,task)){task.controller.abort();release(task);record.state='error';record.error=Object.freeze({code:typeof error?.code==='string'?error.code:'ASSET_FETCH_FAILED',message:typeof error?.message==='string'?error.message.slice(0,1000):'Asset fetch failed.'});record.task=null;}}
    finally{
      if(task.reader){try{await task.reader.cancel();}catch{/* Already errored/closed. */}try{task.reader.releaseLock();}catch{/* Pending read controlled by the trusted fetch implementation. */}}
      if(record.task===task){release(task);record.task=null;if(!disposed&&desired.has(descriptor.id))record.state='idle';}
      active--;queueMicrotask(pump);notify();
    }
  }
  function pump(){if(disposed)return;for(const id of desired){if(active>=maxConcurrent)break;const record=records.get(id);if(record.state!=='queued')continue;const task={controller:new AbortController(),reader:null,chunks:[],reads:0,held:0,cancelled:false};record.task=task;record.state='loading';active++;void load(record,task);}}
  function updateAct(value=0){assert(!disposed,'DISPOSED','The preloader is disposed.');const index=typeof value==='string'?parsed.acts.findIndex(act=>act.id===value):value;assert(Number.isInteger(index)&&index>=0&&index<parsed.acts.length,'UNKNOWN_ASSET_ACT','Select an existing act ID or index.');
    current=index;const next=new Set();for(let i=index;i<=Math.min(parsed.acts.length-1,index+ahead);i++)for(const id of parsed.acts[i].files)next.add(id);desired=next;
    for(const [id,record] of records){if(!desired.has(id))cancel(record);else if(record.state==='idle')record.state='queued';}
    pump();notify();return settled();
  }
  function retry(id){assert(!disposed,'DISPOSED','The preloader is disposed.');const record=records.get(id);assert(record&&desired.has(id),'UNKNOWN_ASSET_ID','Retry an asset in the current preload window.');if(record.state==='error'){record.error=null;record.state='queued';pump();}return settled();}
  function get(id){assert(!disposed,'DISPOSED','The preloader is disposed.');const record=records.get(id);assert(record,'UNKNOWN_ASSET_ID','Unknown asset ID.');return record.bytes?record.bytes.slice():null;}
  function dispose(){if(disposed)return;disposed=true;desired.clear();for(const record of records.values())cancel(record);notify();}
  return Object.freeze({acts:parsed.acts,get status(){return snapshot();},start:updateAct,updateAct,settled,retry,get,dispose});
}
