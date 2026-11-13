#!/usr/bin/env node
import {mkdir,writeFile,stat,open} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {launchChrome,executablePath,runProcess} from './lib/cdp.mjs';

const MAX_PIXELS=8_294_400,MAX_FRAMES=100_000;
const ensure=(condition,message)=>{if(!condition)throw Error(message);};
function finite(value,label,min,max){const n=Number(value);ensure(value!==''&&Number.isFinite(n)&&n>=min&&n<=max,`${label} must be finite in [${min}, ${max}].`);return n;}
export function validateDimensions(width=1920,height=1080){
 width=finite(width,'width',1,8192);height=finite(height,'height',1,8192);ensure(Number.isInteger(width)&&Number.isInteger(height),'Export dimensions must be whole pixels.');ensure(width*height<=MAX_PIXELS,'Export exceeds the 8,294,400-pixel (4K UHD) budget.');return Object.freeze({width,height});
}
export function frameSchedule({from=0,duration,fps=30},sourceDuration){
 from=finite(from,'from',0,1e7);fps=finite(fps,'fps',.01,240);sourceDuration=finite(sourceDuration,'hook duration',Number.MIN_VALUE,1e7);ensure(from<sourceDuration,'Export start must precede hook duration.');
 duration=finite(duration??sourceDuration-from,'duration',Number.MIN_VALUE,1e7);const tolerance=32*Number.EPSILON*Math.max(1,sourceDuration,from+duration);ensure(from+duration<=sourceDuration+tolerance,'Export range exceeds hook duration.');
 const product=duration*fps,count=Math.max(1,Math.ceil(product-32*Number.EPSILON*Math.max(1,product)));ensure(count<=MAX_FRAMES,`Export exceeds ${MAX_FRAMES} frames.`);
 return Object.freeze(Array.from({length:count},(_,index)=>Object.freeze({index,time:from+index/fps,file:`frame-${String(index).padStart(6,'0')}.png`})));
}
export function pngDimensions(bytes){
 ensure(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR','Chrome did not return a valid PNG.');return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
}
export function parseExportArgs(argv){
 const input={video:'auto'},flags={ '--url':'url','--out':'out','--width':'width','--height':'height','--fps':'fps','--from':'from','--duration':'duration','--chrome':'chromePath','--ffmpeg':'ffmpegPath','--timeout-ms':'timeoutMs','--audio':'audioPath'};
 for(let i=0;i<argv.length;i++){const key=argv[i];if(key==='--help'||key==='-h'){input.help=true;continue;}if(key==='--no-video'){input.video=false;continue;}if(key==='--video'){input.video=true;continue;}ensure(Object.hasOwn(flags,key),`Unknown option ${key}.`);const value=argv[++i];ensure(value!==undefined&&!value.startsWith('--'),`${key} needs a value.`);ensure(input[flags[key]]===undefined,`Repeated option ${key}.`);input[flags[key]]=value;}
 if(input.help)return input;ensure(input.url&&input.out,'Supply --url and --out.');const url=new URL(input.url);ensure(['http:','https:','file:'].includes(url.protocol),'Export URL must use http, https or file.');ensure(!url.username&&!url.password,'Do not put credentials in the export URL.');
 ensure(!(input.audioPath&&input.video===false),'Audio mux requires video output; omit --no-video.');
 const dimensions=validateDimensions(input.width,input.height);return {...input,...dimensions,...(input.audioPath?{audioPath:resolve(input.audioPath)}:{}),url:url.href,out:resolve(input.out),fps:finite(input.fps??30,'fps',.01,240),from:finite(input.from??0,'from',0,1e7),duration:input.duration===undefined?undefined:finite(input.duration,'duration',Number.MIN_VALUE,1e7),timeoutMs:finite(input.timeoutMs??30000,'timeout-ms',100,120000)};
}
const HELP=`Usage: explainerkit-export-film --url URL --out NEW_DIRECTORY [options]

--width 1920 --height 1080   Output pixels (4K: 3840 × 2160)
--fps 30 --from 0           Exact samples: from + frameIndex / fps
--duration SECONDS         Default: remaining hook duration, endpoint excluded
--video / --no-video       Require MP4 / PNG only (default: MP4 if ffmpeg found)
--chrome PATH              Override Chrome (or CHROME_PATH environment variable)
--ffmpeg PATH              Override ffmpeg executable
--audio MIX.wav            Mux an explicit local audio mix, aligned to --from
--timeout-ms 30000         Per command/readiness timeout

Page contract: window.explainerkitExport={duration,element,seek(time),ready?,resize?}.
Output directory must not exist. PNGs and manifest remain available on failure.
`;

async function encodeVideo(options,schedule){
 if(options.video===false)return {status:'disabled'};
 const binary=options.ffmpegPath??await executablePath('ffmpeg',['/opt/homebrew/bin/ffmpeg']);
 if(!binary){ensure(options.video!==true&&!options.audioPath,'ffmpeg is required by --video/--audio but was not found.');return {status:'unavailable',reason:'ffmpeg not found; PNG sequence is complete.'};}
 ensure(options.width%2===0&&options.height%2===0,'MP4 yuv420p encoding requires even dimensions. PNG sequence is complete; use --no-video for odd dimensions.');
 const output=join(options.out,'film.mp4'),args=['-hide_banner','-loglevel','error','-n','-framerate',String(options.fps),'-start_number','0','-i',join(options.out,'frame-%06d.png')];
 if(options.audioPath)args.push('-protocol_whitelist','file','-ss',String(options.from),'-i',options.audioPath,'-map','0:v:0','-map','1:a:0','-af','apad','-t',String(schedule.length/options.fps),'-c:a','aac','-b:a','192k');
 else args.push('-an');
 args.push('-frames:v',String(schedule.length),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output);
 const result=await runProcess(binary,args,{timeoutMs:Math.max(120_000,schedule.length*1000)});ensure(result.code===0,`ffmpeg encoding failed (${result.code??result.signal}): ${result.stderr.slice(-4000)}`);return {status:'complete',file:'film.mp4',codec:'libx264',pixelFormat:'yuv420p',crf:18,preset:'medium',executable:binary,audio:options.audioPath?{codec:'aac',source:options.audioPath,from:options.from,padded:true}:{status:'none'}};
}
/** Explicit frame capture; no wall-clock playback or cumulative frame stepping. */
export async function exportFilm(options){
 const validated=parseExportArgs(['--url',String(options.url),'--out',String(options.out),'--width',String(options.width??1920),'--height',String(options.height??1080),'--fps',String(options.fps??30),'--from',String(options.from??0),...(options.duration===undefined?[]:['--duration',String(options.duration)]),'--timeout-ms',String(options.timeoutMs??30000),...(options.chromePath?['--chrome',options.chromePath]:[]),...(options.ffmpegPath?['--ffmpeg',options.ffmpegPath]:[]),...(options.audioPath?['--audio',String(options.audioPath)]:[]),...(options.video===false?['--no-video']:options.video===true?['--video']:[])]);
 options=validated;
 if(options.audioPath){
  const info=await stat(options.audioPath);ensure(info.isFile()&&info.size>=44&&info.size<=512_000_000,'Audio mux input must be a local WAV file no larger than512MB.');
  const file=await open(options.audioPath,'r');try{const header=Buffer.alloc(12);const read=await file.read(header,0,12,0);ensure(read.bytesRead===12&&header.toString('ascii',0,4)==='RIFF'&&header.toString('ascii',8,12)==='WAVE','Audio mux accepts a local RIFF/WAVE mix, not playlists or remote media references.');}finally{await file.close();}
 }
 // Atomic creation is the overwrite gate, including existing empty directories.
 await mkdir(options.out,{recursive:false});
 const manifestPath=join(options.out,'manifest.json'),manifest={version:1,status:'running',url:options.url,width:options.width,height:options.height,fps:options.fps,from:options.from,requestedDuration:options.duration??null,sampling:'from + index / fps; half-open range',frames:[],video:{status:'pending'}};
 const save=()=>writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');let browser;
 await save();
 try{
  browser=await launchChrome({chromePath:options.chromePath??process.env.CHROME_PATH,timeoutMs:options.timeoutMs});
  await browser.send('Emulation.setDeviceMetricsOverride',{width:options.width,height:options.height,deviceScaleFactor:1,mobile:false});
  const navigation=await browser.send('Page.navigate',{url:options.url});ensure(!navigation.errorText,`Navigation failed: ${navigation.errorText}`);
  const readyStart=Date.now();let available=false;
  while(Date.now()-readyStart<options.timeoutMs){try{available=await browser.evaluate('!!window.explainerkitExport');}catch(error){if(!/context|navigation/i.test(error.message))throw error;}if(available)break;if(browser.exceptions.length)throw Error(`Page failed before readiness: ${browser.exceptions.join('\n')}`);await new Promise(resolve=>setTimeout(resolve,50));}
  ensure(available,'Page did not expose window.explainerkitExport before the readiness timeout.');
  const dimensions={width:options.width,height:options.height};
  const info=await browser.evaluate(`(async()=>{const h=window.explainerkitExport;if(typeof h.seek!=='function')throw Error('Export hook must provide seek(time).');await h.ready;await document.fonts?.ready;await h.resize?.(${JSON.stringify(dimensions)});await document.fonts?.ready;if(!(h.element instanceof Element)||!h.element.isConnected)throw Error('Export hook element must be a connected Element.');return {duration:h.duration,userAgent:navigator.userAgent,dpr:devicePixelRatio};})()`);
  const schedule=frameSchedule(options,info.duration);Object.assign(manifest,{sourceDuration:info.duration,duration:options.duration??info.duration-options.from,frameCount:schedule.length,userAgent:info.userAgent,devicePixelRatio:info.dpr});
  for(const sample of schedule){
   const clip=await browser.evaluate(`(async()=>{const h=window.explainerkitExport;await h.seek(${JSON.stringify(sample.time)});await document.fonts?.ready;const element=h.element;if(!(element instanceof Element)||!element.isConnected)throw Error('Export element was disconnected.');element.scrollIntoView({block:'start',inline:'start',behavior:'instant'});if(element instanceof HTMLCanvasElement&&(element.width!==${options.width}||element.height!==${options.height}))throw Error('Canvas intrinsic dimensions must match export pixels.');const r=element.getBoundingClientRect();const style=getComputedStyle(element);if(style.display==='none'||style.visibility!=='visible'||r.width<=0||r.height<=0)throw Error('Export element is not visible.');if(Math.abs(r.width-${options.width})>.01||Math.abs(r.height-${options.height})>.01)throw Error('Export element must measure exactly ${options.width} × ${options.height} CSS pixels; received '+r.width+' × '+r.height);return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`);
   ensure(browser.exceptions.length===0,`Page exception while seeking: ${browser.exceptions.join('\n')}`);
   const capture=await browser.send('Page.captureScreenshot',{format:'png',clip,fromSurface:true,captureBeyondViewport:true}),bytes=Buffer.from(capture.data,'base64'),actual=pngDimensions(bytes);ensure(actual.width===options.width&&actual.height===options.height,`Unexpected PNG dimensions ${actual.width} × ${actual.height}.`);
   await writeFile(join(options.out,sample.file),bytes,{flag:'wx'});manifest.frames.push({...sample,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
   if(schedule.length>10&&(sample.index+1)%10===0)await save();
  }
  manifest.video=await encodeVideo(options,schedule);manifest.status='complete';await save();return manifest;
 }catch(error){manifest.status='failed';manifest.error=error instanceof Error?error.message:String(error);if(manifest.frames.length===manifest.frameCount&&manifest.video.status==='pending')manifest.video={status:'failed',error:manifest.error};await save();throw error;
 }finally{await browser?.close();}
}

// npm runs the installed command through a symbolic link, so compare the resolved file rather than the link.
if(process.argv[1]&&pathToFileURL(realpathSync(resolve(process.argv[1]))).href===import.meta.url){
 try{const options=parseExportArgs(process.argv.slice(2));if(options.help)console.log(HELP);else{const result=await exportFilm(options);console.log(JSON.stringify({status:result.status,directory:options.out,width:result.width,height:result.height,frames:result.frameCount,video:result.video},null,2));}}
 catch(error){console.error(`Export failed: ${error.message}`);process.exitCode=1;}
}
