(()=>{
'use strict';
const T=window.ICR2_TRACK,S=T.samples,N=S.length,E=window.ICR2_ENV,P3=window.ICR2_PHASE3,CAR=window.ICR2_CAR;
const canvas=document.getElementById('gl');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
if(!gl){document.body.innerHTML='<p style="padding:30px">This browser does not provide WebGL.</p>';return;}
const ui={speed:document.getElementById('speed'),lap:document.getElementById('lap'),progress:document.getElementById('progress'),target:document.getElementById('target'),surface:document.getElementById('surface'),camera:document.getElementById('camera'),tag:document.getElementById('tag'),position:document.getElementById('position'),laptime:document.getElementById('laptime'),gear:document.getElementById('gear'),rpm:document.getElementById('rpm'),standings:document.getElementById('standings'),cockpit:document.getElementById('cockpit'),wheel:document.getElementById('wheel'),dashspeed:document.getElementById('dashspeed'),dashgear:document.getElementById('dashgear'),dashlap:document.getElementById('dashlap'),dashpos:document.getElementById('dashpos'),dashrpm:document.getElementById('dashrpm'),rpmbar:document.getElementById('rpmbar'),settingsOverlay:document.getElementById('settingsOverlay'),startSignal:document.getElementById('startSignal')};
const keys=new Set();let cameraMode=0,ghostOn=true,environmentOn=true,standingsOn=false,settingsOpen=false;const cameraNames=['CHASE','COCKPIT','TV','MAP'];let hitTimer=0;
const DEFAULT_SETTINGS={handlingPreset:'classic',aiStraightCap:(T.oval?255:145),aiPace:110,startMode:'rolling',raceLaps:3,collisionAssist:true};
const SETTINGS_KEY='icr2_phase75_settings_'+(T.id||window.ICR2_SELECTED_TRACK||'track');
function loadSettings(){try{const v=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');return Object.assign({},DEFAULT_SETTINGS,v);}catch(_){return Object.assign({},DEFAULT_SETTINGS);}}
let settings=loadSettings();
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch(_){}}
function handlingProfile(){if(settings.handlingPreset==='gentle')return{steer:.90,response:.82,grip:.97,brake:1};if(settings.handlingPreset==='responsive')return{steer:1.05,response:1.15,grip:1.02,brake:1};return{steer:1,response:1,grip:1,brake:1};}
function syncSettingsUI(){const hp=document.getElementById('setHandling');if(hp)hp.value=settings.handlingPreset;const sc=document.getElementById('setAICap'),sco=document.getElementById('outAICap');if(sc){sc.value=settings.aiStraightCap;if(sco)sco.textContent=settings.aiStraightCap+' mph';}const ai=document.getElementById('setAI'),ao=document.getElementById('outAI');if(ai){ai.value=settings.aiPace;if(ao)ao.textContent=settings.aiPace+'%';}const st=document.getElementById('setStart');if(st)st.value=settings.startMode;const ca=document.getElementById('setCollisionAssist');if(ca)ca.checked=!!settings.collisionAssist;}
function bindSettings(){document.getElementById('setHandling')?.addEventListener('change',e=>{settings.handlingPreset=e.target.value;saveSettings();syncSettingsUI();});document.getElementById('setAICap')?.addEventListener('input',e=>{settings.aiStraightCap=Number(e.target.value);saveSettings();syncSettingsUI();});document.getElementById('setAI')?.addEventListener('input',e=>{settings.aiPace=Number(e.target.value);saveSettings();syncSettingsUI();});document.getElementById('setStart')?.addEventListener('change',e=>{settings.startMode=e.target.value;saveSettings();});document.getElementById('setCollisionAssist')?.addEventListener('change',e=>{settings.collisionAssist=e.target.checked;saveSettings();});document.getElementById('settingsDefaults')?.addEventListener('click',()=>{settings=Object.assign({},DEFAULT_SETTINGS);saveSettings();syncSettingsUI();});document.getElementById('settingsRestart')?.addEventListener('click',()=>{reset();toggleSettings(false);});document.getElementById('settingsClose')?.addEventListener('click',()=>toggleSettings(false));document.getElementById('settingsBtn')?.addEventListener('click',()=>toggleSettings());syncSettingsUI();}
function toggleSettings(force){settingsOpen=force===undefined?!settingsOpen:!!force;ui.settingsOverlay.style.display=settingsOpen?'flex':'none';if(settingsOpen){keys.clear();}else{canvas.focus({preventScroll:true});}}

function keyName(e){
 const code=(e.code||'').toLowerCase(),key=(e.key||'').toLowerCase();
 return code==='keyw'?'w':code==='keys'?'s':code==='keya'?'a':code==='keyd'?'d':code==='keye'?'e':code==='keyq'?'q':code==='keyx'?'x':code==='keyo'?'o':code==='keyk'?'k':code==='keyu'?'u':code==='keyv'?'v':code==='keyh'?'h':code==='f2'?'f2':code==='f3'?'f3':code==='escape'?'escape':
        code==='arrowup'?'arrowup':code==='arrowdown'?'arrowdown':
        code==='arrowleft'?'arrowleft':code==='arrowright'?'arrowright':key;
}
function onKeyDown(e){
 const k=keyName(e);
 if(!e.repeat&&(k==='k'||k==='f3')){e.preventDefault();toggleSettings();return;}
 if(settingsOpen){if(!e.repeat&&k==='escape')toggleSettings(false);return;}
 keys.add(k);ensureAudio();
 if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','o','k','u','v','h','f2'].includes(k))e.preventDefault();
 if(!e.repeat&&k==='r')reset();
 if(!e.repeat&&k==='x')recoverCar(true);
 if(!e.repeat&&k==='m'){cameraMode=(cameraMode+1)%cameraNames.length;updateCameraLabel();}
 if(!e.repeat&&k==='g')ghostOn=!ghostOn;
 if(!e.repeat&&(k==='o'||k==='f2')){standingsOn=!standingsOn;ui.standings.style.display=standingsOn?'block':'none';}
 if(!e.repeat&&k==='e'){environmentOn=!environmentOn;updateTag();}
 if(!e.repeat&&k==='q'){soundOn=!soundOn;applySoundState();updateTag();}
}
function onKeyUp(e){keys.delete(keyName(e));}
document.addEventListener('keydown',onKeyDown,{capture:true});
document.addEventListener('keyup',onKeyUp,{capture:true});
addEventListener('blur',()=>keys.clear());
canvas.tabIndex=0;canvas.addEventListener('pointerdown',()=>{ensureAudio();canvas.focus({preventScroll:true});});requestAnimationFrame(()=>canvas.focus({preventScroll:true}));bindSettings();
function resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.floor(innerWidth*d),h=Math.floor(innerHeight*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);}addEventListener('resize',resize);resize();
let soundOn=true,audio=null,audioLastImpact=0;
function ensureAudio(){
 if(!soundOn)return;
 if(audio&&audio.ctx){if(audio.ctx.state==='suspended')audio.ctx.resume();return;}
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
 const ctx=new AC(),master=ctx.createGain();master.gain.value=.30;master.connect(ctx.destination);
 const engineGain=ctx.createGain();engineGain.gain.value=0;const engineFilter=ctx.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=1800;engineGain.connect(engineFilter);engineFilter.connect(master);
 const osc1=ctx.createOscillator(),osc2=ctx.createOscillator();osc1.type='sawtooth';osc2.type='square';const g1=ctx.createGain(),g2=ctx.createGain();g1.gain.value=.70;g2.gain.value=.14;osc1.connect(g1);osc2.connect(g2);g1.connect(engineGain);g2.connect(engineGain);osc1.start();osc2.start();
 const nbuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),nd=nbuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=(Math.random()*2-1)*.75;
 const noise=ctx.createBufferSource();noise.buffer=nbuf;noise.loop=true;const noiseFilter=ctx.createBiquadFilter();noiseFilter.type='bandpass';noiseFilter.frequency.value=1100;noiseFilter.Q.value=.7;const noiseGain=ctx.createGain();noiseGain.gain.value=0;noise.connect(noiseFilter);noiseFilter.connect(noiseGain);noiseGain.connect(master);noise.start();
 audio={ctx,master,engineGain,engineFilter,osc1,osc2,noiseGain,noiseFilter};applySoundState();
}
function applySoundState(){if(!audio)return;const now=audio.ctx.currentTime;audio.master.gain.cancelScheduledValues(now);audio.master.gain.setTargetAtTime(soundOn?.30:0,now,.025);if(soundOn&&audio.ctx.state==='suspended')audio.ctx.resume();}
function updateAudio(rpm,mps,lateral,grass,throttle){if(!audio||!soundOn)return;const now=audio.ctx.currentTime,base=Math.max(40,rpm/60*1.05);audio.osc1.frequency.setTargetAtTime(base,now,.025);audio.osc2.frequency.setTargetAtTime(base*2.02,now,.025);audio.engineFilter.frequency.setTargetAtTime(650+Math.min(1,rpm/13000)*2400,now,.04);const eg=.028+.10*Math.min(1,rpm/12500)+.035*throttle;audio.engineGain.gain.setTargetAtTime(eg,now,.035);const slip=Math.min(1,Math.abs(lateral)/4.0),speed=Math.min(1,mps/45),ng=(grass?.085:.012)+slip*.13*speed;audio.noiseGain.gain.setTargetAtTime(ng,now,.04);audio.noiseFilter.frequency.setTargetAtTime(grass?650:1050+speed*1250,now,.05);}
function playImpact(strength=.7){if(!audio||!soundOn)return;const now=audio.ctx.currentTime;if(now-audioLastImpact<.08)return;audioLastImpact=now;const o=audio.ctx.createOscillator(),g=audio.ctx.createGain();o.type='square';o.frequency.setValueAtTime(115+strength*80,now);o.frequency.exponentialRampToValueAtTime(38,now+.12);g.gain.setValueAtTime(.12*Math.min(1,strength),now);g.gain.exponentialRampToValueAtTime(.001,now+.14);o.connect(g);g.connect(audio.master);o.start(now);o.stop(now+.15);}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}

const colorProg=program(
`attribute vec3 p;attribute vec3 c;uniform mat4 vp;varying vec3 col;varying float depth;void main(){col=c;vec4 q=vp*vec4(p,1.0);gl_Position=q;depth=q.w;}`,
`precision mediump float;varying vec3 col;varying float depth;void main(){float fog=smoothstep(450.0,1800.0,depth);gl_FragColor=vec4(mix(col,vec3(.518,.769,.941),fog*.72),1.0);}`);
const cp=gl.getAttribLocation(colorProg,'p'),cc=gl.getAttribLocation(colorProg,'c'),cvp=gl.getUniformLocation(colorProg,'vp');

const texProg=program(
`attribute vec3 p;attribute vec2 uv;attribute vec4 rect;attribute vec2 invsz;uniform mat4 vp;uniform float flipV;varying vec2 tuv;varying vec4 vrect;varying float depth;void main(){vec2 f=fract(uv*invsz);float fy=mix(f.y,1.0-f.y,flipV);vec2 base=vec2(rect.x,1.0-rect.y-rect.w);tuv=base+vec2(f.x*rect.z,fy*rect.w);vrect=rect;vec4 q=vp*vec4(p,1.0);gl_Position=q;depth=q.w;}`,
`precision mediump float;uniform sampler2D atlas;varying vec2 tuv;varying vec4 vrect;varying float depth;void main(){vec4 t=texture2D(atlas,tuv);if(t.a<.08)discard;float fog=smoothstep(450.0,1800.0,depth);gl_FragColor=vec4(mix(t.rgb,vec3(.518,.769,.941),fog*.72),t.a);}`);
const tp=gl.getAttribLocation(texProg,'p'),tu=gl.getAttribLocation(texProg,'uv'),tr=gl.getAttribLocation(texProg,'rect'),ti=gl.getAttribLocation(texProg,'invsz'),tvp=gl.getUniformLocation(texProg,'vp'),ta=gl.getUniformLocation(texProg,'atlas'),tflip=gl.getUniformLocation(texProg,'flipV');

function V(x,y,z){return [x,z,y];} // ICR2 XY ground plane -> WebGL XZ; altitude -> Y
function pushTri(a,b,c,col,arr){for(const q of [a,b,c])arr.push(...q,...col);}
function lineMesh(path,width,height,col){const a=[];for(let i=0;i<path.length-1;i++){const p0=path[i],p1=path[i+1],dx=p1[0]-p0[0],dy=p1[1]-p0[1],d=Math.hypot(dx,dy)||1,nx=-dy/d*width/2,ny=dx/d*width/2;const z0=(p0[2]||0)+height,z1=(p1[2]||0)+height;const A=V(p0[0]+nx,p0[1]+ny,z0),B=V(p0[0]-nx,p0[1]-ny,z0),C=V(p1[0]+nx,p1[1]+ny,z1),D=V(p1[0]-nx,p1[1]-ny,z1);pushTri(A,B,C,col,a);pushTri(C,B,D,col,a);}return new Float32Array(a);}
function roadSafetyMesh(){const a=[],col=[.18,.19,.19];for(let i=0;i<N-1;i++){const j=i+1,l0=(S[i].wall_left||S[i].left),r0=(S[i].wall_right||S[i].right),l1=(S[j].wall_left||S[j].left),r1=(S[j].wall_right||S[j].right);const A=V(l0[0],l0[1],(l0[2]||0)-.045),B=V(r0[0],r0[1],(r0[2]||0)-.045),C=V(l1[0],l1[1],(l1[2]||0)-.045),D=V(r1[0],r1[1],(r1[2]||0)-.045);pushTri(A,B,C,col,a);pushTri(C,B,D,col,a);}return new Float32Array(a);}
function startMesh(){const a=[],l=S[0].left,r=S[0].right,c=S[0].center,n=S[1].center,dx=n[0]-c[0],dy=n[1]-c[1],d=Math.hypot(dx,dy)||1,px=dx/d*.38,py=dy/d*.38;const A=V(l[0]-px,l[1]-py,.09),B=V(r[0]-px,r[1]-py,.09),C=V(l[0]+px,l[1]+py,.09),D=V(r[0]+px,r[1]+py,.09);pushTri(A,B,C,[.96,.96,.94],a);pushTri(C,B,D,[.96,.96,.94],a);return new Float32Array(a);}
function colorBuffer(data,usage=gl.STATIC_DRAW){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,usage);return{b,count:data.length/6};}
const envColor=colorBuffer(new Float32Array(E.colored));
const roadSafety=colorBuffer(roadSafetyMesh());
const overlayMeshes=[colorBuffer(lineMesh(S.map(x=>x.race),.33,.12,[.90,.20,.10])),colorBuffer(startMesh())];
const dyn=gl.createBuffer();
function drawColor(buf,count){gl.useProgram(colorProg);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(cp);gl.vertexAttribPointer(cp,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(cc);gl.vertexAttribPointer(cc,3,gl.FLOAT,false,24,12);gl.drawArrays(gl.TRIANGLES,0,count);}

const envTexBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,envTexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(E.textured),gl.STATIC_DRAW);const envTexCount=E.textured.length/11;
const p3GroundBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,p3GroundBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(P3.ground),gl.STATIC_DRAW);const p3GroundCount=P3.ground.length/11;
const spriteBuffer=gl.createBuffer(),horizonBuffer=gl.createBuffer(),farGroundBuffer=gl.createBuffer(),carColorBuffer=gl.createBuffer(),carTexBuffer=gl.createBuffer();
function drawTextured(buf,count,flipV=0){gl.useProgram(texProg);gl.uniform1f(tflip,flipV?1:0);gl.bindBuffer(gl.ARRAY_BUFFER,buf);const stride=44;gl.enableVertexAttribArray(tp);gl.vertexAttribPointer(tp,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(tu);gl.vertexAttribPointer(tu,2,gl.FLOAT,false,stride,12);gl.enableVertexAttribArray(tr);gl.vertexAttribPointer(tr,4,gl.FLOAT,false,stride,20);gl.enableVertexAttribArray(ti);gl.vertexAttribPointer(ti,2,gl.FLOAT,false,stride,36);gl.drawArrays(gl.TRIANGLES,0,count);}

let atlasReady=false,atlasTexture=gl.createTexture();
function updateCameraLabel(){if(ui.camera)ui.camera.textContent=cameraNames[cameraMode];if(ui.cockpit)ui.cockpit.style.display=cameraMode===1?'block':'none';}
function updateTag(){ui.tag.innerHTML=`Phase 5.0 · exact 4.1 handling + AI speed cap<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'}`;}
updateCameraLabel();
updateTag();
const atlasImg=new Image();atlasImg.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,atlasTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlasImg);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);atlasReady=true;updateTag();};
atlasImg.onerror=()=>{ui.tag.innerHTML='Phase 5.0 · texture atlas failed to load<br>geometry is still available';};atlasImg.src=E.atlas_data||E.atlas;
let carAtlasReady=false,carTexture=gl.createTexture();const carImg=new Image();carImg.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,carTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,carImg);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);carAtlasReady=true;};carImg.src=(window.ICR2_ASSET_URLS||{})['car_atlas.png']||'car_atlas.png';

function ident(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];return o;}
function perspective(fovy,asp,n,f){const t=1/Math.tan(fovy/2),o=new Float32Array(16);o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;}
function ortho(l,r,b,t,n,f){const o=ident();o[0]=2/(r-l);o[5]=2/(t-b);o[10]=-2/(f-n);o[12]=-(r+l)/(r-l);o[13]=-(t+b)/(t-b);o[14]=-(f+n)/(f-n);return o;}
function norm(a){const d=Math.hypot(...a)||1;return a.map(v=>v/d);}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function lookAt(e,t,u){const z=norm([e[0]-t[0],e[1]-t[1],e[2]-t[2]]),x=norm(cross(u,z)),y=cross(z,x),o=ident();o[0]=x[0];o[1]=y[0];o[2]=z[0];o[4]=x[1];o[5]=y[1];o[6]=z[1];o[8]=x[2];o[9]=y[2];o[10]=z[2];o[12]=-dot(x,e);o[13]=-dot(y,e);o[14]=-dot(z,e);return o;}

const center=S.map(s=>s.center),race=S.map(s=>s.race);let car,lap=1,lastIdx=0,ghostProg=0,lapClock=0,bestLap=Infinity,lastLap=0,safeState=null,escapeTimer=0,raceStarted=true,startCountdown=0,startGoTimer=0;
const AI_NAMES=['Johansson','Gugelmin','Sullivan','de Ferran','Pruett','Unser Jr.','Fittipaldi'];
const AI_COLORS=[[.83,.12,.08],[.08,.38,.78],[.9,.76,.1],[.18,.7,.32],[.68,.12,.7],[.92,.32,.08],[.08,.7,.72]];
let opponents=[];
const trackBounds=(()=>{let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;for(const p of center){minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);miny=Math.min(miny,p[1]);maxy=Math.max(maxy,p[1]);}return{minx,maxx,miny,maxy,cx:(minx+maxx)/2,cy:(miny+maxy)/2,w:maxx-minx,h:maxy-miny};})();
function nearestIndex(x,y){let best=0,bd=1e30;for(let i=0;i<N;i+=2){const dx=x-center[i][0],dy=y-center[i][1],d=dx*dx+dy*dy;if(d<bd){bd=d;best=i;}}for(let i=Math.max(0,best-3);i<=Math.min(N-1,best+3);i++){const dx=x-center[i][0],dy=y-center[i][1],d=dx*dx+dy*dy;if(d<bd){bd=d;best=i;}}return[best,Math.sqrt(bd)];}
function trackFrame(idx){const im=(idx-2+N)%N,ip=(idx+2)%N,c=center[idx],pm=center[im],pp=center[ip];let tx=pp[0]-pm[0],ty=pp[1]-pm[1],td=Math.hypot(tx,ty)||1;tx/=td;ty/=td;let nx=-ty,ny=tx;const lp=S[idx].wall_left||S[idx].left,rp=S[idx].wall_right||S[idx].right,lv=[lp[0]-c[0],lp[1]-c[1]];if(lv[0]*nx+lv[1]*ny<0){nx=-nx;ny=-ny;}const lw=Math.max(1,lv[0]*nx+lv[1]*ny),rv=[rp[0]-c[0],rp[1]-c[1]],rw=Math.max(1,-(rv[0]*nx+rv[1]*ny));return{c,tx,ty,nx,ny,lw,rw};}
function drivingStatus(x,y){const [idx]=nearestIndex(x,y),f=trackFrame(idx),dx=x-f.c[0],dy=y-f.c[1],lat=dx*f.nx+dy*f.ny;const bands=P3.surface[Math.min(P3.surface.length-1,idx)]||[];let family=-1;for(const b of bands){if(lat>=b[0]&&lat<=b[1]){family=b[2];break;}}const inside=(family===5||family===6),pit=inside&&lat<-7.0&&(idx>920||idx<120);return{inside,pit,idx,lat,f,family};}
function setCarAtIndex(idx,lateral=0,speed=0){const f=trackFrame((idx+N)%N),p=center[(idx+N)%N],p2=center[(idx+4+N)%N],h=Math.atan2(p2[1]-p[1],p2[0]-p[0]);car={x:p[0]+f.nx*lateral,y:p[1]+f.ny*lateral,heading:h,vx:Math.cos(h)*speed,vy:Math.sin(h)*speed,steer:0,wheelSpin:0};}
function reset(){lap=1;lapClock=0;lastLap=0;bestLap=Infinity;opponents=[];escapeTimer=0;startGoTimer=0;if(settings.startMode==='standing'){setCarAtIndex(3,0,0);lastIdx=3;raceStarted=false;startCountdown=3.25;for(let i=0;i<7;i++){const row=Math.floor(i/2),pr=8+(3-row)*8,lane=(i%2?1:-1)*1.28;opponents.push({name:AI_NAMES[i],color:AI_COLORS[i],prog:pr,completed:0,speed:0,lane,skill:.965+i*.006,launchDelay:.18+(i%3)*.11+Math.floor(i/3)*.035});}}else{setCarAtIndex(3,0,0);lastIdx=3;raceStarted=true;startCountdown=0;for(let i=0;i<7;i++){let pr=3-(i+1)*8,cl=0;if(pr<0){pr+=N;cl=-1;}opponents.push({name:AI_NAMES[i],color:AI_COLORS[i],prog:pr,completed:cl,speed:0,lane:(i%2?1:-1)*(0.7+0.22*i),skill:.965+i*.006,launchDelay:0});}}safeState={x:car.x,y:car.y,heading:car.heading,vx:0,vy:0};updateStartSignal();}reset();
function updateStartSignal(){if(!ui.startSignal)return;if(!raceStarted&&settings.startMode==='standing'){ui.startSignal.style.display='block';ui.startSignal.textContent=Math.max(1,Math.ceil(startCountdown));}else if(startGoTimer>0){ui.startSignal.style.display='block';ui.startSignal.textContent='GO!';}else ui.startSignal.style.display='none';}
function rememberSafeState(){const st=drivingStatus(car.x,car.y);if((st.family===5||st.family===6)&&hitTimer<=0){safeState={x:car.x,y:car.y,heading:car.heading,vx:car.vx,vy:car.vy};}}
function recoverCar(manual=false){if(!safeState)return;car.x=safeState.x;car.y=safeState.y;car.heading=safeState.heading;car.vx=safeState.vx*.25;car.vy=safeState.vy*.25;car.steer=0;escapeTimer=0;hitTimer=.35;if(manual)ui.surface.textContent='RECOVERED';}
function escapedTrackBounds(){const st=drivingStatus(car.x,car.y),bands=P3.surface[Math.min(P3.surface.length-1,st.idx)]||[];if(!bands.length)return false;let lo=Infinity,hi=-Infinity;for(const b of bands){lo=Math.min(lo,b[0]);hi=Math.max(hi,b[1]);}return st.lat<lo-3.0||st.lat>hi+3.0;}
function orient(ax,ay,bx,by,cx,cy){return(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);}function onSeg(ax,ay,bx,by,cx,cy){return cx>=Math.min(ax,bx)-1e-5&&cx<=Math.max(ax,bx)+1e-5&&cy>=Math.min(ay,by)-1e-5&&cy<=Math.max(ay,by)+1e-5;}function segCross(ax,ay,bx,by,cx,cy,dx,dy){const e=1e-7,o1=orient(ax,ay,bx,by,cx,cy),o2=orient(ax,ay,bx,by,dx,dy),o3=orient(cx,cy,dx,dy,ax,ay),o4=orient(cx,cy,dx,dy,bx,by);if(((o1>e&&o2<-e)||(o1<-e&&o2>e))&&((o3>e&&o4<-e)||(o3<-e&&o4>e)))return true;if(Math.abs(o1)<=e&&onSeg(ax,ay,bx,by,cx,cy))return true;if(Math.abs(o2)<=e&&onSeg(ax,ay,bx,by,dx,dy))return true;if(Math.abs(o3)<=e&&onSeg(cx,cy,dx,dy,ax,ay))return true;if(Math.abs(o4)<=e&&onSeg(cx,cy,dx,dy,bx,by))return true;return false;}
function reflectVelocity(nx,ny,loss=.42){const vn=car.vx*nx+car.vy*ny;if(vn<0){car.vx-=(1.15)*vn*nx;car.vy-=(1.15)*vn*ny;}car.vx*=loss;car.vy*=loss;}
function resolveWallCollision(oldx,oldy){const w=P3.walls,radius=.96;for(let i=0;i<w.length;i+=4){const ax=w[i],ay=w[i+1],bx=w[i+2],by=w[i+3];if(segCross(oldx,oldy,car.x,car.y,ax,ay,bx,by)){const sx=bx-ax,sy=by-ay,d=Math.hypot(sx,sy)||1;let nx=-sy/d,ny=sx/d;const oldSide=orient(ax,ay,bx,by,oldx,oldy);if(oldSide<0){nx=-nx;ny=-ny;}car.x=oldx+nx*.04;car.y=oldy+ny*.04;reflectVelocity(nx,ny,.50);hitTimer=.42;playImpact(Math.min(1,Math.hypot(car.vx,car.vy)/35+.3));return true;}}
 let best=null;for(let i=0;i<w.length;i+=4){const ax=w[i],ay=w[i+1],bx=w[i+2],by=w[i+3],sx=bx-ax,sy=by-ay,l2=sx*sx+sy*sy;if(l2<1e-8)continue;let tt=((car.x-ax)*sx+(car.y-ay)*sy)/l2;tt=Math.max(0,Math.min(1,tt));const qx=ax+tt*sx,qy=ay+tt*sy,dx=car.x-qx,dy=car.y-qy,d2=dx*dx+dy*dy;if(d2<radius*radius&&(!best||d2<best.d2)){const d=Math.sqrt(Math.max(d2,1e-10)),oldSide=orient(ax,ay,bx,by,oldx,oldy);let nx=-sy/Math.sqrt(l2),ny=sx/Math.sqrt(l2);if(oldSide<0){nx=-nx;ny=-ny;}best={d2,d,nx,ny};}}
 if(best){const push=radius-best.d+.035;car.x+=best.nx*push;car.y+=best.ny*push;reflectVelocity(best.nx,best.ny,.66);hitTimer=.25;playImpact(Math.min(1,Math.hypot(car.vx,car.vy)/35+.25));return true;}return false;}
function lerpPath(path,p){let i=Math.floor(p)%N;if(i<0)i+=N;let j=(i+1)%N,t=p-Math.floor(p);return[path[i][0]*(1-t)+path[j][0]*t,path[i][1]*(1-t)+path[j][1]*t,(path[i][2]||0)*(1-t)+(path[j][2]||0)*t];}
function aiPose(o){const p=lerpPath(race,o.prog),p2=lerpPath(race,o.prog+1),h=Math.atan2(p2[1]-p[1],p2[0]-p[0]),idx=(Math.floor(o.prog)%N+N)%N,f=trackFrame(idx);return{x:p[0]+f.nx*o.lane,y:p[1]+f.ny*o.lane,h};}
function updateAI(dt){if(!raceStarted&&settings.startMode==='standing')return;for(let i=0;i<opponents.length;i++){const o=opponents[i];if(o.launchDelay>0){o.launchDelay=Math.max(0,o.launchDelay-dt);continue;}const idx=(Math.floor(o.prog)%N+N)%N,targetMph=Math.min(S[idx].speed_mph*o.skill*(settings.aiPace/100),settings.aiStraightCap),target=targetMph*.44704;let desired=target;for(const a of opponents){if(a===o)continue;let gap=(a.completed-o.completed)*N+(a.prog-o.prog);if(gap>0&&gap<10&&Math.abs(a.lane-o.lane)<1.2)desired=Math.min(desired,a.speed*.97);}const delta=desired-o.speed,maxAccel=o.speed<18?8.8:o.speed<36?6.3:4.2,maxBrake=13.5;o.speed+=Math.max(-maxBrake*dt,Math.min(maxAccel*dt,delta));o.speed=Math.max(0,o.speed);const prev=o.prog;o.prog+=o.speed*dt/T.lp_resolution_m;if(o.prog>=N){o.prog-=N;o.completed++;}if(prev<0&&o.prog>=0)o.completed++;}}
function raceOrder(){const idx=nearestIndex(car.x,car.y)[0],playerScore=(lap-1)*N+idx,rows=[{name:'YOU',score:playerScore,player:true}];for(const o of opponents)rows.push({name:o.name,score:o.completed*N+o.prog,player:false});rows.sort((a,b)=>b.score-a.score);return{rows,pos:rows.findIndex(r=>r.player)+1};}
function formatTime(s){if(!isFinite(s))return'—';const m=Math.floor(s/60),r=s-m*60;return m+':'+r.toFixed(3).padStart(6,'0');}
function gearRpm(mps,throttle){const mph=Math.max(0,mps*2.23694),cuts=[0,48,82,117,151,188,230];let g=1;while(g<6&&mph>cuts[g])g++;if(mph<1&&throttle<.05)return['N',900];const lo=cuts[g-1],hi=cuts[g],f=Math.max(0,Math.min(1,(mph-lo)/(hi-lo)));return[g,Math.round(5700+f*6900)];}
function resolveCarContacts(){for(const o of opponents){const p=aiPose(o),dx=car.x-p.x,dy=car.y-p.y,d=Math.hypot(dx,dy);if(d<1.45&&d>.001){const nx=dx/d,ny=dy/d,push=(1.45-d)*.55;car.x+=nx*push;car.y+=ny*push;const vn=car.vx*nx+car.vy*ny;if(vn<0){car.vx-=vn*nx*.8;car.vy-=vn*ny*.8;}hitTimer=Math.max(hitTimer,.10);}}}
// 8.5 hook: proportional steering (touch/tilt). Returns the key value unchanged
// unless the 8.5 mobile layer is active, so Classic/7.11 compat stays bit-identical.
function p85SteerInput(k){return k;}
function fixedUpdate(dt){if(settingsOpen)return;if(hitTimer>0)hitTimer=Math.max(0,hitTimer-dt);if(startGoTimer>0){startGoTimer=Math.max(0,startGoTimer-dt);updateStartSignal();}if(!raceStarted&&settings.startMode==='standing'){startCountdown-=dt;if(startCountdown<=0){raceStarted=true;startCountdown=0;startGoTimer=.9;}updateStartSignal();}
 const up=keys.has('w')||keys.has('arrowup'),dn=keys.has('s')||keys.has('arrowdown'),le=keys.has('a')||keys.has('arrowleft'),ri=keys.has('d')||keys.has('arrowright'),controls=raceStarted||settings.startMode!=='standing';const steerInput=controls?p85SteerInput((ri?1:0)-(le?1:0)):0,st=drivingStatus(car.x,car.y),speed=Math.hypot(car.vx,car.vy),mph=speed*2.23694;const grass=st.family===0,paint=st.family===6,hp=handlingProfile();const grip=(grass?2.3:paint?6.2:8.0)*hp.grip,rolling=grass?.95:.16,drag=grass?.0105:(typeof p75PlayerDrag==='function'?p75PlayerDrag():.0031),engine=grass?5.8:(typeof p75PlayerEngine==='function'?p75PlayerEngine():12.4);const maxSteer=(.30-.245*Math.min(1,speed/43))*hp.steer,targetSteer=steerInput*maxSteer,rack=(steerInput?2.4:5.2)*hp.response;car.steer+=(targetSteer-car.steer)*Math.min(1,dt*rack);const fx=Math.cos(car.heading),fy=Math.sin(car.heading),lx=-fy,ly=fx;let vf=car.vx*fx+car.vy*fy,vl=car.vx*lx+car.vy*ly;let drive=(controls&&up?engine:0);if(controls&&dn){const bs=hp.brake;drive+=vf>0.6?-24*bs:-10.5*bs;}let a=drive-rolling*Math.sign(vf)-drag*vf*Math.abs(vf);vf+=a*dt;if(!up&&!dn&&Math.abs(vf)<.08)vf=0;vf=Math.max(-14.2,Math.min((typeof p75PlayerMaxSpeed==='function'?p75PlayerMaxSpeed():94),vf));const latDamp=Math.exp(-grip*dt);vl*=latDamp;const steerAuthority=vf<0?(.72+.28*Math.min(1,Math.abs(vf)/3.0)):Math.min(1,Math.abs(vf)/8),yaw=(vf/3.1)*Math.tan(car.steer)*(vf<0?2.05:1)*steerAuthority*(grass?.58:1);car.heading+=yaw*dt;const nfx=Math.cos(car.heading),nfy=Math.sin(car.heading),nlx=-nfy,nly=nfx;car.vx=nfx*vf+nlx*vl;car.vy=nfy*vf+nly*vl;const oldx=car.x,oldy=car.y;car.x+=car.vx*dt;car.y+=car.vy*dt;resolveWallCollision(oldx,oldy);if(settings.collisionAssist&&escapedTrackBounds()){escapeTimer+=dt;if(escapeTimer>1.0)recoverCar(false);}else escapeTimer=0;if(ghostOn)resolveCarContacts();rememberSafeState();car.wheelSpin=(car.wheelSpin+vf*dt/.33)%(Math.PI*2);const idx=nearestIndex(car.x,car.y)[0];if(raceStarted)lapClock+=dt;if(lastIdx>N*.82&&idx<N*.18&&vf>3&&raceStarted){if(lapClock>5){lastLap=lapClock;bestLap=Math.min(bestLap,lastLap);}lapClock=0;lap++;}lastIdx=idx;updateAI(dt);if(raceStarted)ghostProg=(ghostProg+(S[Math.floor(ghostProg)%N].speed_mph*.44704*dt)/T.lp_resolution_m)%N;const order=raceOrder(),[gear,rpm]=gearRpm(Math.hypot(car.vx,car.vy),up?1:0);updateAudio(rpm,Math.hypot(car.vx,car.vy),vl,grass,up?1:0);ui.speed.textContent=Math.round(mph);ui.lap.textContent=lap;ui.progress.textContent=(idx/(N-1)*100).toFixed(1)+'%';ui.target.textContent=Math.round(S[idx].speed_mph)+' mph';ui.surface.textContent=hitTimer>.2?'WALL HIT':(st.pit?'pit lane':grass?'grass':paint?'paint/curb':'track');ui.position.textContent=order.pos+' / 8';ui.laptime.textContent=formatTime(lapClock);ui.gear.textContent=gear;ui.rpm.textContent=rpm;ui.dashspeed.textContent=Math.round(mph);ui.dashgear.textContent=gear;ui.dashlap.textContent=lap;ui.dashpos.textContent=order.pos+'/8';ui.dashrpm.textContent=rpm;ui.rpmbar.style.width=Math.min(100,rpm/13000*100)+'%';ui.wheel.style.setProperty('--wheelrot',(car.steer/Math.max(.001,maxSteer)*95).toFixed(1)+'deg');if(standingsOn){ui.standings.innerHTML='<b>RUNNING ORDER</b><br>'+order.rows.map((r,i)=>'<strong>'+(i+1)+'</strong>'+r.name).join('<br>')+'<br><br>Last '+formatTime(lastLap)+' · Best '+formatTime(bestLap);}}
function localPt(x,z,h,u,v,y){const c=Math.cos(h),s=Math.sin(h);return[x+u*c-v*s,y,z+u*s+v*c];}
function addBoxPart(a,x,z,h,u,v,L,W,y0,H,col){const p=[localPt(x,z,h,u-L/2,v-W/2,y0),localPt(x,z,h,u+L/2,v-W/2,y0),localPt(x,z,h,u+L/2,v+W/2,y0),localPt(x,z,h,u-L/2,v+W/2,y0)],q=p.map(k=>[k[0],k[1]+H,k[2]]);for(const f of [[p[0],p[1],q[0]],[q[0],p[1],q[1]],[p[1],p[2],q[1]],[q[1],p[2],q[2]],[p[2],p[3],q[2]],[q[2],p[3],q[3]],[p[3],p[0],q[3]],[q[3],p[0],q[0]],[q[0],q[1],q[3]],[q[3],q[1],q[2]]])pushTri(...f,col,a);}
function addWedgePart(a,x,z,h,u0,u1,w0,w1,y0,H,col){const b=[localPt(x,z,h,u0,-w0/2,y0),localPt(x,z,h,u1,-w1/2,y0),localPt(x,z,h,u1,w1/2,y0),localPt(x,z,h,u0,w0/2,y0)],t=b.map(k=>[k[0],k[1]+H,k[2]]);for(const f of [[b[0],b[1],t[0]],[t[0],b[1],t[1]],[b[1],b[2],t[1]],[t[1],b[2],t[2]],[b[2],b[3],t[2]],[t[2],b[3],t[3]],[b[3],b[0],t[3]],[t[3],b[0],t[0]],[t[0],t[1],t[3]],[t[3],t[1],t[2]]])pushTri(...f,col,a);}
function indyCarMesh(x,z,h,ghost=false,baseColor=null){const a=[],white=ghost?[.18,.66,.94]:[.95,.95,.92],red=baseColor|| (ghost?[.08,.40,.72]:[.83,.09,.08]),blue=ghost?[.08,.32,.60]:[.14,.14,.16],dark=[.035,.04,.045],tire=[.025,.025,.028],metal=[.38,.40,.42],accent=ghost?[.24,.78,.98]:[.92,.78,.15];
 addWedgePart(a,x,z,h,-1.25,1.05,.72,.55,.28,.48,white);addWedgePart(a,x,z,h,.85,2.45,.48,.20,.25,.30,red);addWedgePart(a,x,z,h,-2.0,-.65,.52,.66,.28,.52,red);
 addBoxPart(a,x,z,h,.0,-.66,1.75,.42,.24,.34,blue);addBoxPart(a,x,z,h,.0,.66,1.75,.42,.24,.34,blue);addBoxPart(a,x,z,h,2.48,0,.24,1.92,.18,.08,white);addBoxPart(a,x,z,h,-2.08,0,.25,1.62,.86,.12,red);addBoxPart(a,x,z,h,-1.92,0,.18,.18,.30,.62,metal);
 addBoxPart(a,x,z,h,-.28,0,.68,.54,.68,.20,dark);addBoxPart(a,x,z,h,.55,0,.82,.34,.64,.05,accent);
 for(const u of [1.55,-1.42])for(const v of [-.92,.92]){addBoxPart(a,x,z,h,u,v,.52,.28,.13,.58,tire);addBoxPart(a,x,z,h,u,v,.30,.30,.31,.18,metal);}
 return a;}
function dynamicMesh(){let a=[];if(ghostOn){for(const o of opponents){const p=aiPose(o);a=a.concat(indyCarMesh(p.x,p.y,p.h,false,o.color));}}return new Float32Array(a);}
function transformCarColored(x,z,h){const src=CAR.colored,a=new Float32Array(src.length),c=Math.cos(h),ss=Math.sin(h);for(let i=0;i<src.length;i+=6){const u=src[i],yy=src[i+1],v=src[i+2];a[i]=x+u*c-v*ss;a[i+1]=yy;a[i+2]=z+u*ss+v*c;a[i+3]=src[i+3];a[i+4]=src[i+4];a[i+5]=src[i+5];}return a;}
function transformCarTextured(x,z,h){const src=CAR.textured,a=new Float32Array(src.length),c=Math.cos(h),ss=Math.sin(h);for(let i=0;i<src.length;i+=11){const u=src[i],yy=src[i+1],v=src[i+2];a[i]=x+u*c-v*ss;a[i+1]=yy;a[i+2]=z+u*ss+v*c;for(let k=3;k<11;k++)a[i+k]=src[i+k];}return a;}
function playerWheelMesh(){const a=[],tire=[.025,.025,.027],metal=[.34,.35,.36],h=car.heading,c=Math.cos(h),s=Math.sin(h);function boxAt(u,v,front){const steer=front?car.steer*1.25:0,ang=h+steer,ca=Math.cos(ang),sa=Math.sin(ang),cx=car.x+u*c-v*s,cz=car.y+u*s+v*c;addBoxPart(a,cx,cz,ang,0,0,.54,.30,.18,.55,tire);addBoxPart(a,cx,cz,ang,0,0,.22,.32,.35,.13,metal);}boxAt(1.61,.87,true);boxAt(1.61,-.87,true);boxAt(-1.47,.81,false);boxAt(-1.47,-.81,false);return new Float32Array(a);}
function farGroundMesh(cx,cz){const R=1100,y=(typeof p7ElevationAt==='function'?p7ElevationAt(cx,cz):0)-.34,col=P3.far_ground_rgb,a=[];pushTri([cx-R,y,cz-R],[cx+R,y,cz-R],[cx-R,y,cz+R],col,a);pushTri([cx-R,y,cz+R],[cx+R,y,cz-R],[cx+R,y,cz+R],col,a);return new Float32Array(a);}
function horizonMesh(cx,cz){const a=[],r=900,baseY=(typeof p7ElevationAt==='function'?p7ElevationAt(cx,cz):0),bottom=baseY-12,top=baseY+70,rect=E.rects.horiz,dim=E.dims.horiz,inv=[1/dim[0],1/dim[1]];if(!rect||!dim)return new Float32Array();for(let i=0;i<8;i++){const a0=(i/8)*Math.PI*2+Math.PI/8,a1=((i+1)/8)*Math.PI*2+Math.PI/8;const p0=[cx+Math.cos(a0)*r,bottom,cz+Math.sin(a0)*r],p1=[cx+Math.cos(a1)*r,bottom,cz+Math.sin(a1)*r],t0=[p0[0],top,p0[2]],t1=[p1[0],top,p1[2]],v0=1+i*200,v1=1+(i+1)*200;const verts=[[t0,30,v0],[t1,30,v1],[p0,1,v0],[p0,1,v0],[t1,30,v1],[p1,1,v1]];for(const [p,u,v] of verts)a.push(...p,u,v,...rect,...inv);}return new Float32Array(a);}
function spriteMesh(eye){const a=[];for(const s of E.sprites){const [x,yground,zbase,w,h,name]=s,r=E.rects[name],dim=E.dims[name];if(!r||!dim)continue;const nx=eye[0]-x,nz=eye[2]-yground,nd=Math.hypot(nx,nz)||1,rx=nz/nd,rz=-nx/nd,hw=w*.5;const L=[x-rx*hw,zbase,yground-rz*hw],R=[x+rx*hw,zbase,yground+rz*hw],LT=[L[0],zbase+h,L[2]],RT=[R[0],zbase+h,R[2]],uw=Math.max(.001,dim[0]-.01),vh=Math.max(.001,dim[1]-.01),inv=[1/dim[0],1/dim[1]];const verts=[[L,0,vh],[R,uw,vh],[LT,0,0],[LT,0,0],[R,uw,vh],[RT,uw,0]];for(const [p,u,v] of verts)a.push(...p,u,v,...r,...inv);}return new Float32Array(a);}
function setVP(vp){gl.useProgram(colorProg);gl.uniformMatrix4fv(cvp,false,vp);gl.useProgram(texProg);gl.uniformMatrix4fv(tvp,false,vp);gl.uniform1i(ta,0);}
function render(){
 resize();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(P3.sky_rgb[0],P3.sky_rgb[1],P3.sky_rgb[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 let eye,target,P;const cx=car.x,cz=car.y,c=Math.cos(car.heading),s=Math.sin(car.heading),asp=canvas.width/canvas.height;if(cameraMode===0){eye=[cx-c*13,6.0,cz-s*13];target=[cx+c*38,1.25,cz+s*38];P=perspective(1.00,asp,.18,6000);}else if(cameraMode===1){eye=[cx+c*.72,1.05,cz+s*.72];target=[cx+c*85,1.02,cz+s*85];P=perspective(.88,asp,.06,6000);}else if(cameraMode===2){eye=[cx-c*28-s*16,13,cz-s*28+c*16];target=[cx+c*24,1.0,cz+s*24];P=perspective(.82,asp,.2,6000);}else{const span=Math.max(trackBounds.w,trackBounds.h)*.62,halfY=span,halfX=halfY*asp;eye=[trackBounds.cx,1800,trackBounds.cy];target=[trackBounds.cx,0,trackBounds.cy];P=ortho(-halfX,halfX,-halfY,halfY,.2,4000);}
 const upVec=cameraMode===3?[0,0,-1]:[0,1,0],vp=mul(P,lookAt(eye,target,upVec));setVP(vp);
 const fg=farGroundMesh(cx,cz);gl.bindBuffer(gl.ARRAY_BUFFER,farGroundBuffer);gl.bufferData(gl.ARRAY_BUFFER,fg,gl.DYNAMIC_DRAW);drawColor(farGroundBuffer,fg.length/6);
 if(environmentOn&&atlasReady){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);const hz=horizonMesh(cx,cz);gl.bindBuffer(gl.ARRAY_BUFFER,horizonBuffer);gl.bufferData(gl.ARRAY_BUFFER,hz,gl.DYNAMIC_DRAW);drawTextured(horizonBuffer,hz.length/11);drawTextured(p3GroundBuffer,p3GroundCount);}
 if(environmentOn){drawColor(envColor.b,envColor.count);if(atlasReady){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);drawTextured(envTexBuffer,envTexCount,1);}}
 gl.disable(gl.BLEND);for(const m of overlayMeshes)drawColor(m.b,m.count);
 if(cameraMode!==1){const cc=transformCarColored(car.x,car.y,car.heading);gl.bindBuffer(gl.ARRAY_BUFFER,carColorBuffer);gl.bufferData(gl.ARRAY_BUFFER,cc,gl.DYNAMIC_DRAW);drawColor(carColorBuffer,cc.length/6);if(carAtlasReady){const ct=transformCarTextured(car.x,car.y,car.heading);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,carTexture);gl.bindBuffer(gl.ARRAY_BUFFER,carTexBuffer);gl.bufferData(gl.ARRAY_BUFFER,ct,gl.DYNAMIC_DRAW);drawTextured(carTexBuffer,ct.length/11);}const pw=playerWheelMesh();gl.bindBuffer(gl.ARRAY_BUFFER,dyn);gl.bufferData(gl.ARRAY_BUFFER,pw,gl.DYNAMIC_DRAW);drawColor(dyn,pw.length/6);}
 const ai=dynamicMesh();if(ai.length){gl.bindBuffer(gl.ARRAY_BUFFER,dyn);gl.bufferData(gl.ARRAY_BUFFER,ai,gl.DYNAMIC_DRAW);drawColor(dyn,ai.length/6);}
 if(environmentOn&&atlasReady){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);const sp=spriteMesh(eye);gl.bindBuffer(gl.ARRAY_BUFFER,spriteBuffer);gl.bufferData(gl.ARRAY_BUFFER,sp,gl.DYNAMIC_DRAW);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);drawTextured(spriteBuffer,sp.length/11,1);gl.depthMask(true);gl.disable(gl.BLEND);}
}

// ---- Phase 5.0 Race Weekend -------------------------------------------------
// Uses the original Detroit PASS1.LP and PASS2.LP lines extracted from the
// supplied demo. Player handling remains the Phase 4.1 baseline from Phase 4.6.
const P5_LINES=window.ICR2_LINES||{};
const P5_PASS1=(P5_LINES.pass1||[]).map(p=>p.slice(0,3));
const P5_PASS2=(P5_LINES.pass2||[]).map(p=>p.slice(0,3));
const P5_PIT=(P5_LINES.pit||[]).map(p=>p.slice(0,3));
const raceUI={
 status:document.getElementById('raceStatus'),banner:document.getElementById('raceBanner'),
 results:document.getElementById('resultsOverlay'),resultsBody:document.getElementById('resultsBody'),
 resultsSummary:document.getElementById('resultsSummary'),resultsClose:document.getElementById('resultsClose'),
 resultsRestart:document.getElementById('resultsRestart'),laps:document.getElementById('setRaceLaps')
};
settings.raceLaps=Number(settings.raceLaps||3);saveSettings();
let raceClock=0,playerFinished=false,playerFinishTime=Infinity,resultsDelay=0,resultsShown=false,resultsDismissed=false,bannerTimer=0;
function p5Mix(a,b,t){return a+(b-a)*t;}
function p5PathPoint(o,p){
 const r=lerpPath(race,p),b=o.passBlend||0;
 if(b>0&&P5_PASS1.length===N){const q=lerpPath(P5_PASS1,p);return[p5Mix(r[0],q[0],b),p5Mix(r[1],q[1],b),p5Mix(r[2]||0,q[2]||0,b)];}
 if(b<0&&P5_PASS2.length===N){const q=lerpPath(P5_PASS2,p),t=-b;return[p5Mix(r[0],q[0],t),p5Mix(r[1],q[1],t),p5Mix(r[2]||0,q[2]||0,t)];}
 return r;
}
function p5LineSpeed(o,idx){
 let mph=S[idx].speed_mph,b=o.passBlend||0;
 if(b>0&&P5_LINES.pass1?.[idx])mph=p5Mix(mph,P5_LINES.pass1[idx][3],b);
 else if(b<0&&P5_LINES.pass2?.[idx])mph=p5Mix(mph,P5_LINES.pass2[idx][3],-b);
 return mph;
}
aiPose=function(o){
 const p=p5PathPoint(o,o.prog),p2=p5PathPoint(o,o.prog+1),h=Math.atan2(p2[1]-p[1],p2[0]-p[0]),idx=(Math.floor(o.prog)%N+N)%N,f=trackFrame(idx),lane=o.gridLane||0;
 return{x:p[0]+f.nx*lane,y:p[1]+f.ny*lane,h};
};
function p5GridOpponents(startSpeed){
 const grid=[{idx:8,lane:-1.28},{idx:8,lane:1.28},{idx:6,lane:-1.28},{idx:6,lane:1.28},{idx:4,lane:-1.28},{idx:4,lane:1.28},{idx:2,lane:1.28}];
 opponents=[];
 for(let i=0;i<7;i++){const g=grid[i];opponents.push({name:AI_NAMES[i],color:AI_COLORS[i],prog:g.idx,completed:0,speed:startSpeed,gridLane:g.lane,skill:.965+i*.006,launchDelay:settings.startMode==='standing'?(.06+(i%2)*.045+Math.floor(i/2)*.018):0,passTarget:0,passBlend:0,passHold:0,finished:false,finishTime:Infinity});}
}
reset=function(){
 lap=1;lapClock=0;lastLap=0;bestLap=Infinity;escapeTimer=0;startGoTimer=0;raceClock=0;playerFinished=false;playerFinishTime=Infinity;resultsDelay=0;resultsShown=false;resultsDismissed=false;bannerTimer=0;
 const rolling=settings.startMode==='rolling',startSpeed=rolling?17.5:0;
 setCarAtIndex(2,-1.28,startSpeed);lastIdx=2;p5GridOpponents(startSpeed);
 raceStarted=rolling;startCountdown=rolling?0:3.25;if(rolling){startGoTimer=1.15;bannerTimer=1.4;}
 safeState={x:car.x,y:car.y,heading:car.heading,vx:car.vx,vy:car.vy};
 if(raceUI.results)raceUI.results.style.display='none';if(raceUI.banner)raceUI.banner.style.display='none';
 updateStartSignal();p5UpdateRaceUI();
};
function p5PlayerScore(){const idx=nearestIndex(car.x,car.y)[0];return(Math.max(0,lap-1))*N+idx;}
function p5VehicleList(except){
 const out=[];for(const a of opponents){if(a===except)continue;out.push({score:a.completed*N+a.prog,speed:a.speed,pass:a.passBlend||0,finished:a.finished});}
 if(!playerFinished)out.push({score:p5PlayerScore(),speed:Math.hypot(car.vx,car.vy),pass:0,finished:false,player:true});
 return out;
}
function p5ChoosePass(o,i,baseTarget){
 if(o.finished)return 0;
 const score=o.completed*N+o.prog,vehicles=p5VehicleList(o);let lead=null;
 for(const v of vehicles){const gap=v.score-score;if(gap>1.0&&gap<15&&(!lead||gap<lead.gap))lead={...v,gap};}
 if(o.passHold>0)return o.passTarget;
 if(lead&&baseTarget>lead.speed+1.1){
  let pref=(i%2===0)?1:-1;
  const blocked=side=>vehicles.some(v=>{const gap=Math.abs(v.score-score);return gap<8&&Math.sign(v.pass)===side;});
  if(blocked(pref)&&!blocked(-pref))pref=-pref;
  if(!blocked(pref)){o.passHold=1.6;return pref;}
 }
 return 0;
}
updateAI=function(dt){
 if(!raceStarted&&settings.startMode==='standing')return;
 for(let i=0;i<opponents.length;i++){
  const o=opponents[i];
  if(o.finished){o.passTarget=0;o.passBlend+=(0-o.passBlend)*Math.min(1,dt*1.5);o.speed+=(Math.min(25,o.speed)-o.speed)*Math.min(1,dt*.8);o.prog=(o.prog+o.speed*dt/T.lp_resolution_m)%N;continue;}
  if(o.launchDelay>0){o.launchDelay=Math.max(0,o.launchDelay-dt);continue;}
  o.gridLane=(o.gridLane||0)*Math.exp(-dt*.75);o.passHold=Math.max(0,(o.passHold||0)-dt);
  const idx=(Math.floor(o.prog)%N+N)%N,baseMph=Math.min(p5LineSpeed(o,idx)*o.skill*(settings.aiPace/100),settings.aiStraightCap),baseTarget=baseMph*.44704;
  o.passTarget=p5ChoosePass(o,i,baseTarget);o.passBlend+=(o.passTarget-o.passBlend)*Math.min(1,dt*.95);
  let desired=baseTarget,score=o.completed*N+o.prog;
  for(const v of p5VehicleList(o)){const gap=v.score-score;if(gap>0&&gap<7&&Math.abs((v.pass||0)-o.passBlend)<.55)desired=Math.min(desired,v.speed*.975);}
  const delta=desired-o.speed,maxAccel=o.speed<18?8.8:o.speed<36?6.3:4.2,maxBrake=13.5;o.speed+=Math.max(-maxBrake*dt,Math.min(maxAccel*dt,delta));o.speed=Math.max(0,o.speed);
  const prev=o.prog;o.prog+=o.speed*dt/T.lp_resolution_m;
  if(o.prog>=N){o.prog-=N;o.completed++;if(o.completed>=settings.raceLaps){o.finished=true;o.finishTime=raceClock;o.passTarget=0;}}
  if(prev<0&&o.prog>=0)o.completed++;
 }
};
raceOrder=function(){
 const idx=nearestIndex(car.x,car.y)[0],rows=[{name:'YOU',score:(lap-1)*N+idx,player:true,finished:playerFinished,finishTime:playerFinishTime,laps:Math.min(lap-1,settings.raceLaps)}];
 for(const o of opponents)rows.push({name:o.name,score:o.completed*N+o.prog,player:false,finished:o.finished,finishTime:o.finishTime,laps:Math.min(o.completed,settings.raceLaps)});
 rows.sort((a,b)=>{if(a.finished!==b.finished)return a.finished?-1:1;if(a.finished&&b.finished)return a.finishTime-b.finishTime;return b.score-a.score;});
 return{rows,pos:rows.findIndex(r=>r.player)+1};
};
function p5StatusText(){if(playerFinished)return'CHECKERED';if(!raceStarted)return settings.startMode==='standing'?'GRID':'ROLLING';return'GREEN';}
function p5UpdateRaceUI(){
 if(raceUI.status)raceUI.status.textContent=p5StatusText();
 ui.lap.textContent=Math.min(lap,settings.raceLaps)+' / '+settings.raceLaps;ui.dashlap.textContent=Math.min(lap,settings.raceLaps);
}
function p5ShowBanner(text,seconds=1.8){if(!raceUI.banner)return;raceUI.banner.textContent=text;raceUI.banner.style.display='block';bannerTimer=seconds;}
function p5UpdateResults(){
 if(!raceUI.resultsBody)return;const order=raceOrder(),leader=order.rows.find(r=>r.finished),leaderTime=leader?.finishTime||0;
 raceUI.resultsBody.innerHTML=order.rows.map((r,i)=>{let status,time;if(r.finished){status='FINISHED';time=i===0?formatTime(r.finishTime):'+'+Math.max(0,r.finishTime-leaderTime).toFixed(3);}else{status='LAP '+Math.min(settings.raceLaps,r.laps+1)+' / '+settings.raceLaps;time='Running';}return'<tr class="'+(r.player?'you':'')+'"><td>'+(i+1)+'</td><td>'+r.name+'</td><td>'+status+'</td><td>'+time+'</td></tr>';}).join('');
 const pos=order.pos;raceUI.resultsSummary.textContent=(T.short_name||T.name||'Race')+' · '+settings.raceLaps+' laps · '+(settings.startMode==='standing'?'Standing':'Rolling')+' start · You: P'+pos+' · Best lap '+formatTime(bestLap);
}
function p5ShowResults(){if(resultsDismissed||!raceUI.results)return;resultsShown=true;raceUI.results.style.display='flex';p5UpdateResults();keys.clear();}
function p5HideResults(){resultsShown=false;resultsDismissed=true;if(raceUI.results)raceUI.results.style.display='none';canvas.focus({preventScroll:true});}
const p46FixedUpdate=fixedUpdate;
fixedUpdate=function(dt){
 if(!settingsOpen&&raceStarted)raceClock+=dt;
 const wasStarted=raceStarted;p46FixedUpdate(dt);
 if(!wasStarted&&raceStarted){p5ShowBanner('GREEN FLAG',1.5);}
 if(!playerFinished&&lap>settings.raceLaps){playerFinished=true;playerFinishTime=raceClock;resultsDelay=1.4;p5ShowBanner('CHECKERED FLAG',2.2);}
 if(playerFinished&&resultsDelay>0){resultsDelay=Math.max(0,resultsDelay-dt);if(resultsDelay===0&&!resultsShown&&!resultsDismissed)p5ShowResults();}
 if(bannerTimer>0){bannerTimer=Math.max(0,bannerTimer-dt);if(bannerTimer===0&&raceUI.banner)raceUI.banner.style.display='none';}
 if(resultsShown)p5UpdateResults();p5UpdateRaceUI();
};
const p46SyncSettingsUI=syncSettingsUI;
syncSettingsUI=function(){p46SyncSettingsUI();if(raceUI.laps)raceUI.laps.value=String(settings.raceLaps||3);};
raceUI.laps?.addEventListener('change',e=>{settings.raceLaps=Number(e.target.value)||3;saveSettings();});
raceUI.resultsClose?.addEventListener('click',p5HideResults);
raceUI.resultsRestart?.addEventListener('click',()=>{if(raceUI.results)raceUI.results.style.display='none';reset();canvas.focus({preventScroll:true});});
// Reinitialize once with the Phase 5 grid/race state.
syncSettingsUI();reset();
// -----------------------------------------------------------------------------

// ---- Phase 6.0 Detroit Reference Build -------------------------------------
// The undamaged player car remains the exact Phase 4.1 handling baseline.
// New systems are layered around it: pits, resources/damage, mirrors, replay,
// stronger collision recovery, AI pit strategy, UI and material-specific UV fixes.
settings.handlingPreset='classic';saveSettings();

const P6_DEFAULTS={startingFuel:32,autoLimiter:false,mirrors:true,drivingLine:false,materialFix:'calibrated',aiPitStrategy:'auto'};
function p6LoadSetup(){try{return Object.assign({},P6_DEFAULTS,JSON.parse(localStorage.getItem('icr2_phase76_reference')||'{}'));}catch(_){return Object.assign({},P6_DEFAULTS);}}
let p6Setup=p6LoadSetup(),p6SetupOpen=false;
function p6SaveSetup(){try{localStorage.setItem('icr2_phase76_reference',JSON.stringify(p6Setup));}catch(_){}}
const p6UI={
 fuel:document.getElementById('fuel'),tires:document.getElementById('tires'),damage:document.getElementById('damage'),pitStatus:document.getElementById('pitStatus'),
 dashfuel:document.getElementById('dashfuel'),dashtires:document.getElementById('dashtires'),dashdamage:document.getElementById('dashdamage'),
 pitPanel:document.getElementById('pitPanel'),pitTitle:document.getElementById('pitTitle'),pitText:document.getElementById('pitText'),pitProgress:document.getElementById('pitProgress'),
 setupOverlay:document.getElementById('setupOverlay'),setupBtn:document.getElementById('setupBtn'),setupClose:document.getElementById('setupClose'),setupDefaults:document.getElementById('setupDefaults'),
 fuelSelect:document.getElementById('setFuel'),pitLimiter:document.getElementById('setPitLimiter'),mirrors:document.getElementById('setMirrors'),drivingLine:document.getElementById('setDrivingLine'),materialFix:document.getElementById('setMaterialFix'),pitStrategy:document.getElementById('setPitStrategy'),
 mirrorLeft:document.getElementById('mirrorLeftFrame'),mirrorRight:document.getElementById('mirrorRightFrame'),replayBadge:document.getElementById('replayBadge'),ruleNotice:document.getElementById('ruleNotice')
};
function p6SyncSetupUI(){
 if(p6UI.fuelSelect)p6UI.fuelSelect.value=String(p6Setup.startingFuel);
 if(p6UI.pitLimiter)p6UI.pitLimiter.checked=!!p6Setup.autoLimiter;
 if(p6UI.mirrors)p6UI.mirrors.checked=!!p6Setup.mirrors;
 if(p6UI.drivingLine)p6UI.drivingLine.checked=!!p6Setup.drivingLine;
 if(p6UI.materialFix)p6UI.materialFix.value=p6Setup.materialFix;
 if(p6UI.pitStrategy)p6UI.pitStrategy.value=p6Setup.aiPitStrategy;
 const hs=document.getElementById('setHandling');if(hs){hs.value='classic';hs.disabled=true;}
}
function p6ToggleSetup(force){p6SetupOpen=force===undefined?!p6SetupOpen:!!force;if(p6UI.setupOverlay)p6UI.setupOverlay.style.display=p6SetupOpen?'flex':'none';if(p6SetupOpen){keys.clear();if(settingsOpen)toggleSettings(false);}else canvas.focus({preventScroll:true});}
p6UI.setupBtn?.addEventListener('click',()=>p6ToggleSetup());p6UI.setupClose?.addEventListener('click',()=>p6ToggleSetup(false));
p6UI.fuelSelect?.addEventListener('change',e=>{p6Setup.startingFuel=Number(e.target.value)||32;p6SaveSetup();});
p6UI.pitLimiter?.addEventListener('change',e=>{p6Setup.autoLimiter=e.target.checked;p6SaveSetup();});
p6UI.mirrors?.addEventListener('change',e=>{p6Setup.mirrors=e.target.checked;p6SaveSetup();});
p6UI.drivingLine?.addEventListener('change',e=>{p6Setup.drivingLine=e.target.checked;p6SaveSetup();});
p6UI.materialFix?.addEventListener('change',e=>{p6Setup.materialFix=e.target.value;p6SaveSetup();p6RebuildEnvironmentBuffers();updateTag();});
p6UI.pitStrategy?.addEventListener('change',e=>{p6Setup.aiPitStrategy=e.target.value;p6SaveSetup();});
p6UI.setupDefaults?.addEventListener('click',()=>{p6Setup=Object.assign({},P6_DEFAULTS);p6SaveSetup();p6SyncSetupUI();p6RebuildEnvironmentBuffers();updateTag();});
p6SyncSetupUI();

let p6NoticeTimer=0;
function p6Notice(text,seconds=2.2){if(!p6UI.ruleNotice)return;p6UI.ruleNotice.textContent=text;p6UI.ruleNotice.style.display='block';p6NoticeTimer=seconds;}
function p6SoundCue(freq=520,dur=.08,gain=.045){if(!audio||!soundOn)return;const now=audio.ctx.currentTime,o=audio.ctx.createOscillator(),g=audio.ctx.createGain();o.type='square';o.frequency.setValueAtTime(freq,now);g.gain.setValueAtTime(gain,now);g.gain.exponentialRampToValueAtTime(.001,now+dur);o.connect(g);g.connect(audio.master);o.start(now);o.stop(now+dur+.01);}

// Material-specific 3DO UV correction. PMP sprites use their independent,
// already-correct path and are never touched here.
const P6_TEXT_MATERIALS=new Set(['adwall','badwall','bill1','bridge','buildng','ind','trucks1','trucks2','wadwall','wbdwall']);
const p6RectName=new Map();for(const [n,r] of Object.entries(E.rects))p6RectName.set(r.map(v=>Number(v).toFixed(7)).join(','),n);
const p6EnvNormalBuffer=gl.createBuffer(),p6EnvTextBuffer=gl.createBuffer();let p6EnvNormalCount=0,p6EnvTextCount=0;
function p6MaterialOp(name){
 const mode=p6Setup.materialFix;if(mode==='legacy')return'';if(mode==='u')return'u';if(mode==='uv')return'uv';
 if(name==='buildng'||name==='ind')return'u';
 if(name==='trucks1'||name==='trucks2')return'uv';
 if(name==='bridge'||name==='bill1'||name==='adwall'||name==='badwall'||name==='wadwall'||name==='wbdwall')return'uv';
 return'';
}
function p6AdjustedTriangle(src,off,op,name=''){
 const t=src.slice(off,off+33);
 // bill1 contains both advertising panels and the 100/200/300 brake-marker strip.
 // The marker strip already uses the correct original UV orientation, while the ad faces
 // require the 3DO face correction. Keep the two cases independent.
 if(name==='bill1'){const invu=t[9]||1,invv=t[10]||1,fu=[t[3],t[14],t[25]].map(u=>((u*invu)%1+1)%1),fv=[t[4],t[15],t[26]].map(v=>((v*invv)%1+1)%1);const markerStrip=Math.min(...fu)>.72&&Math.max(...fu)<.90&&Math.min(...fv)>.48;if(markerStrip)op='';}
 if(!op)return t;
 const us=[t[3],t[14],t[25]],vs=[t[4],t[15],t[26]],umin=Math.min(...us),umax=Math.max(...us),vmin=Math.min(...vs),vmax=Math.max(...vs);
 for(const b of [0,11,22]){if(op.includes('u'))t[b+3]=umin+umax-t[b+3];if(op.includes('v'))t[b+4]=vmin+vmax-t[b+4];}
 return t;
}
function p6RebuildEnvironmentBuffers(){
 const normal=[],text=[],src=E.textured,lagunaObjectU=new Set(['bridge1','bridge2','bridge3','bill']),lagunaWallUV=new Set(['adwall','badwall','wadwall','wbdwall','bill1']),lagunaBrokenHill=new Set(['hill1','hill1bf','hill2f']);
 for(let off=0;off+32<src.length;off+=33){
  const key=[src[off+5],src[off+6],src[off+7],src[off+8]].map(v=>Number(v).toFixed(7)).join(','),name=p6RectName.get(key)||'',isText=P6_TEXT_MATERIALS.has(name),v0=off/11,isGenericObject=T.id!=='detroit'&&Number.isFinite(E.object_textured_start)&&v0>=E.object_textured_start;
  // Laguna's standalone hill sheets duplicate the already-correct horizon and
  // render as floating caps in a free 3D camera. Omit only this broken class.
  if(T.id==='laguna'&&lagunaBrokenHill.has(name))continue;
  // Crowd seating is nearly coplanar with the grandstand deck in the stock
  // model. A tiny vertical bias prevents the crowd texture disappearing into
  // the dark stand surface after modern depth buffering.
  if(T.id==='laguna'&&name==='crowd1'){const tri=src.slice(off,off+33);for(const b of [0,11,22])tri[b+1]+=.055;text.push(...tri);continue;}
  if(isGenericObject){
   let op='';
   if(T.id==='laguna'&&lagunaObjectU.has(name))op='u';
   else if(T.id==='laguna'&&lagunaWallUV.has(name))op='uv';
   else if(T.id==='michigan')op=(name==='trucks1'||name==='trucks2')?'uv':'u';
   text.push(...p6AdjustedTriangle(src,off,op,name));
  }else if(T.id==='laguna'&&lagunaWallUV.has(name))text.push(...p6AdjustedTriangle(src,off,'uv',name));
  else if(T.id==='laguna'&&lagunaObjectU.has(name))text.push(...p6AdjustedTriangle(src,off,'u',name));
  else if(isText)text.push(...p6AdjustedTriangle(src,off,p6MaterialOp(name),name));
  else normal.push(...src.slice(off,off+33));
 }
 gl.bindBuffer(gl.ARRAY_BUFFER,p6EnvNormalBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normal),gl.STATIC_DRAW);p6EnvNormalCount=normal.length/11;
 gl.bindBuffer(gl.ARRAY_BUFFER,p6EnvTextBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(text),gl.STATIC_DRAW);p6EnvTextCount=text.length/11;
}
p6RebuildEnvironmentBuffers();

// Player resources, damage and pit service.
const P6_PIT_STALL=38,P6_PIT_LIMIT_MPH=60;
let p6Resources={fuel:p6Setup.startingFuel,tires:100,damage:0},p6Pit={requested:false,service:0,total:0,penalty:0,speeding:0},p6PenaltyUnserved=0,p6LastGear='N';
const p6BaseHandlingProfile=handlingProfile;
handlingProfile=function(){const h=p6BaseHandlingProfile();const t=Math.max(0,Math.min(100,p6Resources.tires));if(t<60)h.grip*=.90+t/600;return h;};
const P62_PIT_STALL_WALL_OFFSET=2.25;
function p6PitRawPoint(idx=P6_PIT_STALL){return P5_PIT.length===N?P5_PIT[idx]:race[idx];}
function p6PitHeading(idx=P6_PIT_STALL){const a=p6PitRawPoint(idx),b=p6PitRawPoint((idx+2)%N);return Math.atan2(b[1]-a[1],b[0]-a[0]);}
function p6PitPoint(idx=P6_PIT_STALL){const p=p6PitRawPoint(idx),h=p6PitHeading(idx),nx=-Math.sin(h),ny=Math.cos(h),f=trackFrame(idx),d=(x,y)=>(x-f.c[0])*(x-f.c[0])+(y-f.c[1])*(y-f.c[1]),a=[p[0]+nx*P62_PIT_STALL_WALL_OFFSET,p[1]+ny*P62_PIT_STALL_WALL_OFFSET],b=[p[0]-nx*P62_PIT_STALL_WALL_OFFSET,p[1]-ny*P62_PIT_STALL_WALL_OFFSET],q=d(a[0],a[1])>d(b[0],b[1])?a:b;return[q[0],q[1],p[2]||0];}
function p6PitBoxMesh(){const p=p6PitPoint(),h=p6PitHeading(),tx=Math.cos(h),ty=Math.sin(h),nx=-ty,ny=tx,L=5.8,W=2.7,z=(p[2]||0)+.14,col=[.95,.78,.08],a=[];const P=(u,v)=>V(p[0]+tx*u+nx*v,p[1]+ty*u+ny*v,z),q=[P(-L/2,-W/2),P(L/2,-W/2),P(L/2,W/2),P(-L/2,W/2)];pushTri(q[0],q[1],q[2],col,a);pushTri(q[0],q[2],q[3],col,a);return new Float32Array(a);}
const p6PitBox=colorBuffer(p6PitBoxMesh());
function p6TogglePit(){if(p6Pit.service>0)return;p6Pit.requested=!p6Pit.requested;p6SoundCue(p6Pit.requested?690:360,.09,.04);p6Notice(p6Pit.requested?'PIT REQUESTED · ENTER PIT LANE':'PIT REQUEST CANCELLED',1.7);p6UpdatePitUI();}
function p6UpdatePitUI(){
 const speed=Math.hypot(car.vx,car.vy)*2.23694,st=drivingStatus(car.x,car.y),pt=p6PitPoint(),dist=Math.hypot(car.x-pt[0],car.y-pt[1]);let status='—';
 if(p6Pit.service>0)status='SERVICE';else if(p6Pit.requested)status=st.pit?'PIT LANE':'REQUESTED';else if(st.pit)status='PIT LANE';
 if(p6UI.pitStatus)p6UI.pitStatus.textContent=status;if(!p6UI.pitPanel)return;
 const show=p6Pit.requested||p6Pit.service>0||st.pit;p6UI.pitPanel.style.display=show?'block':'none';if(!show)return;
 if(p6Pit.service>0){const done=1-p6Pit.service/Math.max(.001,p6Pit.total);p6UI.pitTitle.textContent='PIT SERVICE';p6UI.pitText.textContent='Fuel + tires + damage repair · '+p6Pit.service.toFixed(1)+' s';p6UI.pitProgress.style.width=(done*100).toFixed(1)+'%';}
 else if(st.pit){p6UI.pitTitle.textContent='PIT LANE · LIMIT '+P6_PIT_LIMIT_MPH+' MPH';p6UI.pitText.textContent=(p6Pit.requested?'Stall '+Math.round(dist)+' m away · ':'')+Math.round(speed)+' mph'+(p6Pit.penalty?' · +'+p6Pit.penalty+' s penalty':'');p6UI.pitProgress.style.width=Math.min(100,speed/P6_PIT_LIMIT_MPH*100)+'%';}
 else{p6UI.pitTitle.textContent='PIT REQUESTED';p6UI.pitText.textContent='Enter the pit lane and stop in the highlighted yellow stall.';p6UI.pitProgress.style.width='0%';}
}
function p6UpdateResourceUI(){const f=Math.max(0,p6Resources.fuel),t=Math.max(0,p6Resources.tires),d=Math.max(0,p6Resources.damage);if(p6UI.fuel)p6UI.fuel.textContent=f.toFixed(1)+' L';if(p6UI.tires)p6UI.tires.textContent=Math.round(t)+'%';if(p6UI.damage)p6UI.damage.textContent=Math.round(d)+'%';if(p6UI.dashfuel)p6UI.dashfuel.textContent=f.toFixed(1);if(p6UI.dashtires)p6UI.dashtires.textContent=Math.round(t);if(p6UI.dashdamage)p6UI.dashdamage.textContent=Math.round(d);}
const p6BaseImpact=playImpact;
playImpact=function(strength=.7){p6BaseImpact(strength);p6Resources.damage=Math.min(100,p6Resources.damage+Math.max(0,strength)*5.5);};

// Stronger wall containment: preserve the original wall geometry, use a slightly
// larger vehicle envelope, resolve corner overlaps repeatedly, and recover as a
// final safety net if a numerical edge case still escapes the actual wall bounds.
resolveWallCollision=function(oldx,oldy){
 const w=P3.walls,radius=1.08,impactSpeed=Math.hypot(car.vx,car.vy);let collided=false;
 for(let i=0;i<w.length;i+=4){const ax=w[i],ay=w[i+1],bx=w[i+2],by=w[i+3];if(segCross(oldx,oldy,car.x,car.y,ax,ay,bx,by)){const sx=bx-ax,sy=by-ay,d=Math.hypot(sx,sy)||1;let nx=-sy/d,ny=sx/d;const oldSide=orient(ax,ay,bx,by,oldx,oldy);if(oldSide<0){nx=-nx;ny=-ny;}car.x=oldx+nx*.09;car.y=oldy+ny*.09;reflectVelocity(nx,ny,.50);collided=true;break;}}
 for(let pass=0;pass<3;pass++){let best=null;for(let i=0;i<w.length;i+=4){const ax=w[i],ay=w[i+1],bx=w[i+2],by=w[i+3],sx=bx-ax,sy=by-ay,l2=sx*sx+sy*sy;if(l2<1e-8)continue;let tt=((car.x-ax)*sx+(car.y-ay)*sy)/l2;tt=Math.max(0,Math.min(1,tt));const qx=ax+tt*sx,qy=ay+tt*sy,dx=car.x-qx,dy=car.y-qy,d2=dx*dx+dy*dy;if(d2<radius*radius&&(!best||d2<best.d2)){const dd=Math.sqrt(Math.max(d2,1e-10)),oldSide=orient(ax,ay,bx,by,oldx,oldy);let nx=-sy/Math.sqrt(l2),ny=sx/Math.sqrt(l2);if(oldSide<0){nx=-nx;ny=-ny;}best={d2,d:dd,nx,ny};}}if(!best)break;const push=radius-best.d+.045;car.x+=best.nx*push;car.y+=best.ny*push;reflectVelocity(best.nx,best.ny,collided?.82:.68);collided=true;}
 if(collided){hitTimer=Math.max(hitTimer,.35);playImpact(Math.min(1,impactSpeed/40+.2));}return collided;
};
escapedTrackBounds=function(){const st=drivingStatus(car.x,car.y);if(st.pit)return false;if((st.idx>880||st.idx<180)&&P5_PIT.length===N){const pp=P5_PIT[st.idx];if(Math.hypot(car.x-pp[0],car.y-pp[1])<5.5)return false;}if(st.lat>st.f.lw+.85||st.lat<-st.f.rw-.85)return true;const bands=P3.surface[Math.min(P3.surface.length-1,st.idx)]||[];if(!bands.length)return false;let lo=Infinity,hi=-Infinity;for(const b of bands){lo=Math.min(lo,b[0]);hi=Math.max(hi,b[1]);}return st.lat<lo-.8||st.lat>hi+.8;};
const p6BaseRecover=recoverCar;
recoverCar=function(manual=false){p6BaseRecover(manual);if(!manual){car.vx=0;car.vy=0;}p6Notice(manual?'CAR RECOVERED':'AUTO RECOVERY',1.2);};

// AI racecraft + PIT.LP strategy. PASS1/PASS2 logic remains the Phase 5 layer.
const p6BasePathPoint=p5PathPoint,p6BaseLineSpeed=p5LineSpeed;
function p6AIPitBlend(o,idx){if(!o.pitting)return 0;if(idx>=900)return Math.max(0,Math.min(1,(idx-900)/55));if(idx<=100)return 1;if(idx<150)return Math.max(0,1-(idx-100)/50);return o.pitWrapped?0:1;}
p5PathPoint=function(o,p){const base=p6BasePathPoint(o,p),idx=((Math.floor(p)%N)+N)%N,b=p6AIPitBlend(o,idx);if(b>0&&P5_PIT.length===N){const q=lerpPath(P5_PIT,p);return[p5Mix(base[0],q[0],b),p5Mix(base[1],q[1],b),p5Mix(base[2]||0,q[2]||0,b)];}return base;};
p5LineSpeed=function(o,idx){const base=p6BaseLineSpeed(o,idx),b=p6AIPitBlend(o,idx);if(b>0&&P5_LINES.pit?.[idx])return p5Mix(base,Math.min(P5_LINES.pit[idx][3],P6_PIT_LIMIT_MPH),b);return base;};
updateAI=function(dt){
 if(!raceStarted&&settings.startMode==='standing')return;
 for(let i=0;i<opponents.length;i++){
  const o=opponents[i];
  if(o.finished){o.passTarget=0;o.passBlend+=(0-o.passBlend)*Math.min(1,dt*1.5);o.speed+=(Math.min(25,o.speed)-o.speed)*Math.min(1,dt*.8);o.prog=(o.prog+o.speed*dt/T.lp_resolution_m)%N;continue;}
  if(o.launchDelay>0){o.launchDelay=Math.max(0,o.launchDelay-dt);continue;}
  if(o.pitService>0){o.pitService=Math.max(0,o.pitService-dt);o.speed=0;o.prog=o.pitStall;if(o.pitService===0){o.pitServiced=true;p6SoundCue(430,.05,.018);}continue;}
  o.gridLane=(o.gridLane||0)*Math.exp(-dt*.75);o.passHold=Math.max(0,(o.passHold||0)-dt);
  let idx=(Math.floor(o.prog)%N+N)%N;
  if(p6Setup.aiPitStrategy==='auto'&&settings.raceLaps>=10&&!o.pitting&&!o.pitServiced&&o.completed>=o.pitLap&&idx>880){o.pitting=true;o.pitWrapped=false;o.passTarget=0;o.passHold=0;}
  if(o.pitting&&o.pitServiced&&o.pitWrapped&&idx>150){o.pitting=false;o.passTarget=0;o.passBlend=0;}
  const baseMph=Math.min(p5LineSpeed(o,idx)*o.skill*(settings.aiPace/100),settings.aiStraightCap),baseTarget=baseMph*.44704;
  o.passTarget=o.pitting?0:p5ChoosePass(o,i,baseTarget);o.passBlend+=(o.passTarget-o.passBlend)*Math.min(1,dt*(o.pitting?1.8:.95));
  let desired=baseTarget,score=o.completed*N+o.prog;
  if(o.pitting)desired=Math.min(desired,P6_PIT_LIMIT_MPH*.44704);
  for(const v of p5VehicleList(o)){const gap=v.score-score;if(gap>0&&gap<7&&Math.abs((v.pass||0)-o.passBlend)<.55)desired=Math.min(desired,v.speed*.972);}
  if(o.pitting&&o.pitWrapped&&!o.pitServiced){const stall=o.pitStall;if(o.prog>=stall-5&&o.prog<=stall+4)desired=0;if(o.prog>stall+4){o.prog=stall;o.speed=0;o.pitService=4.1+(i%3)*.25;continue;}}
  const delta=desired-o.speed,launchBoost=(settings.startMode==='standing'&&raceClock<5.5)?1.32:1,maxAccel=(o.speed<18?8.4:o.speed<36?6.0:4.0)*(o.launchTrait||1)*launchBoost,maxBrake=13.5;o.speed+=Math.max(-maxBrake*dt,Math.min(maxAccel*dt,delta));o.speed=Math.max(0,o.speed);
  if(o.pitting&&o.pitWrapped&&!o.pitServiced&&o.prog>=o.pitStall-1.2&&o.speed<.75){o.prog=o.pitStall;o.speed=0;o.pitService=4.1+(i%3)*.25;continue;}
  const prev=o.prog;o.prog+=o.speed*dt/T.lp_resolution_m;
  if(o.prog>=N){o.prog-=N;o.completed++;if(o.pitting)o.pitWrapped=true;if(o.completed>=settings.raceLaps){o.finished=true;o.finishTime=raceClock;o.passTarget=0;}}
 }
};

// Replay recorder: 18 seconds at 20 Hz. Simulation is paused during playback.
let p6Replay=[],p6ReplayRecordClock=0,p6ReplayActive=false,p6ReplayCursor=0,p6ReplayClock=0,p6ReplayLive=null,p6ReplayCamera=0;
function p6RecordReplay(dt){p6ReplayRecordClock+=dt;if(p6ReplayRecordClock<.05)return;p6ReplayRecordClock-=.05;p6Replay.push({car:{...car},opponents:opponents.map(o=>({...o}))});if(p6Replay.length>360)p6Replay.shift();}
function p6ApplyReplayFrame(){if(!p6Replay.length)return;const s=p6Replay[Math.min(p6Replay.length-1,Math.floor(p6ReplayCursor))];car={...s.car};opponents=s.opponents.map(o=>({...o}));}
function p6EnterReplay(){if(p6ReplayActive||p6Replay.length<20||resultsShown)return;p6ReplayLive={car,opponents};p6ReplayCamera=cameraMode;p6ReplayActive=true;p6ReplayCursor=Math.max(0,p6Replay.length-240);p6ReplayClock=0;cameraMode=2;updateCameraLabel();if(p6UI.replayBadge)p6UI.replayBadge.style.display='block';keys.clear();p6ApplyReplayFrame();}
function p6ExitReplay(){if(!p6ReplayActive)return;p6ReplayActive=false;if(p6ReplayLive){car=p6ReplayLive.car;opponents=p6ReplayLive.opponents;}cameraMode=p6ReplayCamera;updateCameraLabel();p6ReplayLive=null;if(p6UI.replayBadge)p6UI.replayBadge.style.display='none';canvas.focus({preventScroll:true});}
function p6ToggleReplay(){p6ReplayActive?p6ExitReplay():p6EnterReplay();}

// Functional cockpit mirrors: two small rear-facing passes of the same WebGL scene.
function p6MirrorRects(){
 // Match the live mirror render to the red mirror pods in cockpit_upper.png (640x44),
 // but enlarge them substantially for usability.
 const upperW=Math.min(innerWidth,1280),scale=upperW/640,upperH=44*scale,upperLeft=(innerWidth-upperW)/2,upperTop=innerHeight-innerHeight*.19-upperH;
 const srcY=8,srcW=92,srcH=22,leftSrcX=13,rightSrcX=535;
 const w=srcW*scale*1.95,h=srcH*scale*2.10,top=upperTop+srcY*scale,left=upperLeft+leftSrcX*scale-(w-srcW*scale)*0.18,right=upperLeft+rightSrcX*scale-(w-srcW*scale)*0.82;
 for(const [el,x] of [[p6UI.mirrorLeft,left],[p6UI.mirrorRight,right]])if(el){el.style.left=x+'px';el.style.top=top+'px';el.style.width=w+'px';el.style.height=h+'px';}
 const sx=canvas.width/Math.max(1,innerWidth),sy=canvas.height/Math.max(1,innerHeight),border=3*scale;const conv=x=>Math.round(x*sx),convY=(y,hh)=>Math.round(canvas.height-(y+hh)*sy);
 return[{x:conv(left+border),y:convY(top+border,h-2*border),w:Math.max(8,conv(w-2*border)),h:Math.max(8,Math.round((h-2*border)*sy)),side:1},{x:conv(right+border),y:convY(top+border,h-2*border),w:Math.max(8,conv(w-2*border)),h:Math.max(8,Math.round((h-2*border)*sy)),side:-1}];
}
function p6SetMirrorFrames(show){if(p6UI.mirrorLeft)p6UI.mirrorLeft.style.display=show?'block':'none';if(p6UI.mirrorRight)p6UI.mirrorRight.style.display=show?'block':'none';}
function p62CopyMirror(r,which){
 const out=p62MirrorViews[which];if(!out)return;const w=r.w,h=r.h;if(out.width!==w)out.width=w;if(out.height!==h)out.height=h;
 const px=new Uint8Array(w*h*4);gl.readPixels(r.x,r.y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);const ctx=out.getContext('2d'),img=ctx.createImageData(w,h),dst=img.data,row=w*4;
 for(let y=0;y<h;y++)dst.set(px.subarray((h-1-y)*row,(h-y)*row),y*row);ctx.putImageData(img,0,0);
}
function p6DrawWorld(eye,vp,showPlayer=true,showGuides=true){
 setVP(vp);const cx=car.x,cz=car.y,fg=farGroundMesh(cx,cz);gl.bindBuffer(gl.ARRAY_BUFFER,farGroundBuffer);gl.bufferData(gl.ARRAY_BUFFER,fg,gl.DYNAMIC_DRAW);drawColor(farGroundBuffer,fg.length/6);
 if(environmentOn&&atlasReady){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);const hz=horizonMesh(cx,cz);gl.bindBuffer(gl.ARRAY_BUFFER,horizonBuffer);gl.bufferData(gl.ARRAY_BUFFER,hz,gl.DYNAMIC_DRAW);drawTextured(horizonBuffer,hz.length/11);drawTextured(p3GroundBuffer,p3GroundCount);}
 if(environmentOn){drawColor(envColor.b,envColor.count);if(atlasReady){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);if(p6EnvNormalCount)drawTextured(p6EnvNormalBuffer,p6EnvNormalCount,1);if(p6EnvTextCount)drawTextured(p6EnvTextBuffer,p6EnvTextCount,1);}}
 gl.disable(gl.BLEND);if(showGuides&&p6Setup.drivingLine)drawColor(overlayMeshes[0].b,overlayMeshes[0].count);if(showGuides)drawColor(overlayMeshes[1].b,overlayMeshes[1].count);if(showGuides&&p6Pit.requested)drawColor(p6PitBox.b,p6PitBox.count);
 if(showPlayer){const cc=transformCarColored(car.x,car.y,car.heading);gl.bindBuffer(gl.ARRAY_BUFFER,carColorBuffer);gl.bufferData(gl.ARRAY_BUFFER,cc,gl.DYNAMIC_DRAW);drawColor(carColorBuffer,cc.length/6);if(carAtlasReady){const ct=transformCarTextured(car.x,car.y,car.heading);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,carTexture);gl.bindBuffer(gl.ARRAY_BUFFER,carTexBuffer);gl.bufferData(gl.ARRAY_BUFFER,ct,gl.DYNAMIC_DRAW);drawTextured(carTexBuffer,ct.length/11);}const pw=playerWheelMesh();gl.bindBuffer(gl.ARRAY_BUFFER,dyn);gl.bufferData(gl.ARRAY_BUFFER,pw,gl.DYNAMIC_DRAW);drawColor(dyn,pw.length/6);}
 const ai=dynamicMesh();if(ai.length){gl.bindBuffer(gl.ARRAY_BUFFER,dyn);gl.bufferData(gl.ARRAY_BUFFER,ai,gl.DYNAMIC_DRAW);drawColor(dyn,ai.length/6);}
 if(environmentOn&&atlasReady){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);const sp=spriteMesh(eye);gl.bindBuffer(gl.ARRAY_BUFFER,spriteBuffer);gl.bufferData(gl.ARRAY_BUFFER,sp,gl.DYNAMIC_DRAW);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);drawTextured(spriteBuffer,sp.length/11,1);gl.depthMask(true);gl.disable(gl.BLEND);}
}
render=function(){
 resize();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.SCISSOR_TEST);gl.clearColor(P3.sky_rgb[0],P3.sky_rgb[1],P3.sky_rgb[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 let eye,target,P;const cx=car.x,cz=car.y,elev=(typeof p73CamElev==='number'?p73CamElev:(typeof p7ElevationAt==='function'?p7ElevationAt(cx,cz):0)),lookElev=(typeof p73CamLookElev==='number'?p73CamLookElev:elev),c=Math.cos(car.heading),s=Math.sin(car.heading),asp=canvas.width/canvas.height;if(cameraMode===0){eye=[cx-c*13,6.0+elev,cz-s*13];target=[cx+c*38,1.25+lookElev,cz+s*38];P=perspective(1.00,asp,.18,6000);}else if(cameraMode===1){eye=[cx+c*.72,1.05+elev,cz+s*.72];target=[cx+c*85,1.02+lookElev,cz+s*85];P=perspective(.88,asp,.06,6000);}else if(cameraMode===2){eye=[cx-c*28-s*16,13+elev,cz-s*28+c*16];target=[cx+c*24,1.0+lookElev,cz+s*24];P=perspective(.82,asp,.2,6000);}else{const span=Math.max(trackBounds.w,trackBounds.h)*.62,halfY=span,halfX=halfY*asp;eye=[trackBounds.cx,1800+elev,trackBounds.cy];target=[trackBounds.cx,elev,trackBounds.cy];P=ortho(-halfX,halfX,-halfY,halfY,.2,4000);}
 const upVec=cameraMode===3?[0,0,-1]:[0,1,0],vp=mul(P,lookAt(eye,target,upVec));p6DrawWorld(eye,vp,cameraMode!==1,true);
 const showMirrors=cameraMode===1&&p6Setup.mirrors&&!p6ReplayActive;p6SetMirrorFrames(showMirrors);if(showMirrors){const L=[-s,c],rects=p6MirrorRects();gl.enable(gl.SCISSOR_TEST);for(let mi=0;mi<rects.length;mi++){const r=rects[mi];gl.viewport(r.x,r.y,r.w,r.h);gl.scissor(r.x,r.y,r.w,r.h);gl.clearColor(P3.sky_rgb[0],P3.sky_rgb[1],P3.sky_rgb[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const side=r.side,me=[cx+c*.25+L[0]*side*.92,1.04+elev,cz+s*.25+L[1]*side*.92],mt=[cx-c*58+L[0]*side*7.5,1.0+lookElev,cz-s*58+L[1]*side*7.5],MP=perspective(.82,r.w/r.h,.08,1400);MP[0]*=-1;p6DrawWorld(me,mul(MP,lookAt(me,mt,[0,1,0])),false,false);p62CopyMirror(r,mi===0?'left':'right');}gl.disable(gl.SCISSOR_TEST);gl.viewport(0,0,canvas.width,canvas.height);}
};

// Expanded reference UI/status text.
updateTag=function(){ui.tag.innerHTML=`Phase 7.1 · full-game importer · Classic handling baseline<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · 3DO ${p6Setup.materialFix}`;};
updateTag();

const p6BaseReset=reset;
reset=function(){
 if(p6ReplayActive)p6ExitReplay();p6BaseReset();settings.handlingPreset='classic';p6Resources={fuel:Number(p6Setup.startingFuel)||32,tires:100,damage:0};p6Pit={requested:false,service:0,total:0,penalty:0,speeding:0};p6PenaltyUnserved=0;p6LastGear='N';p6Replay=[];p6ReplayRecordClock=0;
 for(let i=0;i<opponents.length;i++){const o=opponents[i];o.launchTrait=1.03+(i%4)*.02;o.pitLap=4+(i%3);o.pitStall=26+i*5;o.pitting=false;o.pitWrapped=false;o.pitServiced=false;o.pitService=0;}
 p6UpdateResourceUI();p6UpdatePitUI();p6SetMirrorFrames(false);updateTag();
};

const p6BaseFixedUpdate=fixedUpdate;
fixedUpdate=function(dt){
 if(p6ReplayActive){p6ReplayClock+=dt;while(p6ReplayClock>=.05){p6ReplayClock-=.05;if(p6ReplayCursor<p6Replay.length-1){p6ReplayCursor++;p6ApplyReplayFrame();}}return;}
 if(p6SetupOpen)return;
 const beforeFinished=playerFinished,px=car.x,py=car.y,servicing=p6Pit.service>0,savedDrive=[];
 if(servicing){for(const k of ['w','s','arrowup','arrowdown'])if(keys.has(k)){savedDrive.push(k);keys.delete(k);}car.vx=0;car.vy=0;}
 p6BaseFixedUpdate(dt);
 for(const k of savedDrive)keys.add(k);
 if(p6NoticeTimer>0){p6NoticeTimer=Math.max(0,p6NoticeTimer-dt);if(p6NoticeTimer===0&&p6UI.ruleNotice)p6UI.ruleNotice.style.display='none';}
 const dist=Math.hypot(car.x-px,car.y-py),st=drivingStatus(car.x,car.y),speed=Math.hypot(car.vx,car.vy),mph=speed*2.23694;
 if(raceStarted&&!playerFinished&&!servicing){p6Resources.fuel=Math.max(0,p6Resources.fuel-dist*.00056);p6Resources.tires=Math.max(0,p6Resources.tires-dist*(.00042+.0008*Math.min(1,Math.abs(car.steer)/.12)));}
 if(p6Resources.fuel<=0){car.vx*=Math.exp(-dt*1.8);car.vy*=Math.exp(-dt*1.8);}
 const dmg=p6Resources.damage/100,dmgCap=p712DamageCapBase()*(1-.18*dmg);/*7.12 hook: 64.8 m/s on Classic road courses*/if(speed>dmgCap&&dmg>0){const q=dmgCap/speed;car.vx*=q;car.vy*=q;}
 const p75SpeedZone=(typeof p75PitSpeedZoneActive==='function'?p75PitSpeedZoneActive(st):st.pit);if(st.pit&&p75SpeedZone){if(p6Setup.autoLimiter&&mph>P6_PIT_LIMIT_MPH){const q=(P6_PIT_LIMIT_MPH*.44704)/Math.max(.01,Math.hypot(car.vx,car.vy));car.vx*=q;car.vy*=q;}else if(!p6Setup.autoLimiter&&mph>P6_PIT_LIMIT_MPH){p6Pit.speeding+=dt;if(p6Pit.speeding>=5&&p6Pit.penalty===0){p6Pit.penalty=10;p6PenaltyUnserved=10;p6Notice('PIT SPEEDING · +10 s PENALTY',3.2);p6SoundCue(180,.35,.075);}}else p6Pit.speeding=0;}else p6Pit.speeding=0;
 const pt=p6PitPoint(),pitDist=Math.hypot(car.x-pt[0],car.y-pt[1]),p6AtStall=st.pit||(typeof p76PitStallEligible==='function'&&p76PitStallEligible(car.x,car.y));
 if(p6Pit.requested&&p6Pit.service<=0&&p6AtStall&&pitDist<4.2&&Math.hypot(car.vx,car.vy)<2.2){p6Pit.total=5.0+p6Pit.penalty;p6Pit.service=p6Pit.total;car.x=pt[0];car.y=pt[1];car.heading=p6PitHeading();car.vx=car.vy=0;p6Notice('PIT SERVICE STARTED',1.4);p6SoundCue(760,.08,.045);}
 if(p6Pit.service>0){car.x=pt[0];car.y=pt[1];car.heading=p6PitHeading();car.vx=car.vy=0;p6Pit.service=Math.max(0,p6Pit.service-dt);if(p6Pit.service===0){p6Resources.fuel=Number(p6Setup.startingFuel)||32;p6Resources.tires=100;p6Resources.damage=0;p6Pit.requested=false;p6Pit.penalty=0;p6PenaltyUnserved=0;p6Notice('PIT SERVICE COMPLETE · GO',2);p6SoundCue(880,.12,.05);}}
 const [g]=gearRpm(Math.hypot(car.vx,car.vy),(keys.has('w')||keys.has('arrowup'))?1:0);if(g!==p6LastGear&&g!=='N'&&p6LastGear!=='N'){p6SoundCue(330,.035,.018);}p6LastGear=g;
 if(!beforeFinished&&playerFinished&&p6PenaltyUnserved>0){playerFinishTime+=p6PenaltyUnserved;p6Notice('UNSERVED PIT PENALTY ADDED: +'+p6PenaltyUnserved+' s',3);p6PenaltyUnserved=0;}
 p6RecordReplay(dt);p6UpdateResourceUI();p6UpdatePitUI();
};

// Extra controls deliberately do not alter the base steering/grip model.
document.addEventListener('keydown',e=>{const k=keyName(e);if(e.repeat)return;if(k==='u'||k==='f4'){e.preventDefault();p6ToggleSetup();return;}if(k==='v'||k==='f5'){e.preventDefault();p6ToggleReplay();return;}if(k==='p'&&!settingsOpen&&!p6SetupOpen&&!p6ReplayActive){e.preventDefault();p6TogglePit();return;}if(k==='escape'&&p6ReplayActive){e.preventDefault();p6ExitReplay();}}, {capture:true});

// Phase 6.1 HUD refinements: nearby-car distances and a hideable controls panel.
const p61UI={gapAhead:document.getElementById('gapAhead'),gapBehind:document.getElementById('gapBehind'),gapPosition:document.getElementById('gapPosition'),help:document.getElementById('help'),helpBtn:document.getElementById('helpBtn')};
const p62MirrorViews={left:document.getElementById('mirrorLeftView'),right:document.getElementById('mirrorRightView')};
let p61HelpOpen=false;
function p61ToggleHelp(force){p61HelpOpen=force===undefined?!p61HelpOpen:!!force;if(p61UI.help)p61UI.help.style.display=p61HelpOpen?'block':'none';if(p61UI.helpBtn)p61UI.helpBtn.textContent=(p61HelpOpen?'H · Hide controls':'H · Controls');}
p61UI.helpBtn?.addEventListener('click',()=>p61ToggleHelp());p61ToggleHelp(false);
document.addEventListener('keydown',e=>{const k=keyName(e);if(e.repeat)return;if(k==='h'&&!settingsOpen&&!p6SetupOpen&&!p6ReplayActive){e.preventDefault();p61ToggleHelp();}}, {capture:true});
function p61GapText(){
 const ps=p5PlayerScore(),res=T.lp_resolution_m||3.27,playerSpeed=Math.hypot(car.vx,car.vy);let ahead=null,behind=null;
 for(const o of opponents){if(o.finished&&playerFinished)continue;const ds=o.completed*N+o.prog-ps;if(ds>0&&(!ahead||ds<ahead.ds))ahead={o,ds};if(ds<0&&(!behind||ds>behind.ds))behind={o,ds};}
 const fmt=x=>{if(!x)return'—';const metres=Math.max(0,Math.abs(x.ds)*res),meanSpeed=Math.max(4,(playerSpeed+Math.max(0,x.o.speed))/2),secs=metres/meanSpeed;return x.o.name+' · '+Math.round(metres)+' m · '+secs.toFixed(1)+' s';};
 return{ahead:fmt(ahead),behind:fmt(behind)};
}
const p61BaseFixedUpdate=fixedUpdate;
fixedUpdate=function(dt){p61BaseFixedUpdate(dt);if(p6ReplayActive)return;const g=p61GapText(),ord=raceOrder();if(p61UI.gapAhead)p61UI.gapAhead.textContent=g.ahead;if(p61UI.gapBehind)p61UI.gapBehind.textContent=g.behind;if(p61UI.gapPosition)p61UI.gapPosition.textContent='P'+ord.pos+' / '+ord.rows.length;};


// ---- Phase 6.3 final-reference polish ---------------------------------------
// Player handling remains untouched. This layer moves the service stall,
// makes severe damage consequential, adds timing-sector splits to the leader,
// and introduces a front-end/menu without changing the clean-car physics.

// Move the service box deeper into the actual pit stall/service apron.
// PIT.LP remains the drive-through route.
const P63_PIT_STALL_WALL_OFFSET=5.50;
p6PitPoint=function(idx=P6_PIT_STALL){
 const p=p6PitRawPoint(idx),h=p6PitHeading(idx),nx=-Math.sin(h),ny=Math.cos(h),f=trackFrame(idx);
 const d=(x,y)=>(x-f.c[0])*(x-f.c[0])+(y-f.c[1])*(y-f.c[1]);
 const a=[p[0]+nx*P63_PIT_STALL_WALL_OFFSET,p[1]+ny*P63_PIT_STALL_WALL_OFFSET];
 const b=[p[0]-nx*P63_PIT_STALL_WALL_OFFSET,p[1]-ny*P63_PIT_STALL_WALL_OFFSET];
 const q=d(a[0],a[1])>d(b[0],b[1])?a:b;
 return[q[0],q[1],p[2]||0];
};
function p63RefreshPitBox(){
 const data=p6PitBoxMesh();gl.bindBuffer(gl.ARRAY_BUFFER,p6PitBox.b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);p6PitBox.count=data.length/6;
}
p63RefreshPitBox();
// A service stall is deliberately offset from PIT.LP, so allow the whole pit
// apron as legal recovery space rather than treating the parked car as escaped.
escapedTrackBounds=function(){
 const st=drivingStatus(car.x,car.y);
 if(st.pit)return false;
 if((st.idx>880||st.idx<180)&&P5_PIT.length===N){
  const pp=P5_PIT[st.idx];if(Math.hypot(car.x-pp[0],car.y-pp[1])<8.5)return false;
 }
 if(st.lat>st.f.lw+.85||st.lat<-st.f.rw-.85)return true;
 const bands=P3.surface[Math.min(P3.surface.length-1,st.idx)]||[];if(!bands.length)return false;
 let lo=Infinity,hi=-Infinity;for(const b of bands){lo=Math.min(lo,b[0]);hi=Math.max(hi,b[1]);}
 return st.lat<lo-.8||st.lat>hi+.8;
};

// Three real timing-loop splits per lap. The comparison is the earliest car to
// cross that sector on the same race lap, i.e. the race leader at that timing line.
const p63UI={
 sectorPanel:document.getElementById('sectorPanel'),sectorPosition:document.getElementById('sectorPosition'),
 sectorRows:document.getElementById('sectorRows'),
 damageWarning:document.getElementById('damageWarning'),
 intro:document.getElementById('introOverlay'),introStart:document.getElementById('introStart'),
 introOptionsBtn:document.getElementById('introOptionsBtn'),introOptions:document.getElementById('introOptions'),
 introStartMode:document.getElementById('introStartMode'),introRaceLaps:document.getElementById('introRaceLaps'),
 introAIPace:document.getElementById('introAIPace'),introAIValue:document.getElementById('introAIValue')
};
const P63_SECTOR_INDEX=[Math.round(N/3),Math.round(2*N/3),N];
let p63Timing=null,p63IntroOpen=true;
function p63Boundary(seq){const li=Math.floor(seq/3),s=seq%3;return li*N+(s===0?P63_SECTOR_INDEX[0]:s===1?P63_SECTOR_INDEX[1]:N);}
function p63FirstSeq(score){let seq=Math.max(0,Math.floor(score/N)*3);while(seq<settings.raceLaps*3&&p63Boundary(seq)<=score+.0001)seq++;return seq;}
function p63ResetTiming(){
 const ps=p5PlayerScore(),os=opponents.map(o=>o.completed*N+o.prog);
 p63Timing={leader:new Map(),playerSplits:Array.from({length:settings.raceLaps},()=>[null,null,null]),lastGap:{YOU:0},
  player:{prev:ps,next:p63FirstSeq(ps)},ai:opponents.map((o,i)=>({prev:os[i],next:p63FirstSeq(os[i])}))};
 for(const o of opponents)p63Timing.lastGap[o.name]=null;
 p63UpdateSectorPanel();
}
function p63CollectCrossings(state,score,name,player=false){
 const out=[],limit=settings.raceLaps*3;
 while(state.next<limit&&score+1e-6>=p63Boundary(state.next)){
  if(state.prev<p63Boundary(state.next)+1e-6)out.push({seq:state.next,time:raceClock,name,player});
  state.next++;
 }
 state.prev=score;return out;
}
function p63UpdateTiming(){
 if(!p63Timing||!raceStarted)return;
 let events=[];
 for(let i=0;i<opponents.length;i++){const o=opponents[i];events.push(...p63CollectCrossings(p63Timing.ai[i],o.completed*N+o.prog,o.name,false));}
 events.push(...p63CollectCrossings(p63Timing.player,p5PlayerScore(),'YOU',true));
 for(const ev of events){const old=p63Timing.leader.get(ev.seq);if(old===undefined||ev.time<old)p63Timing.leader.set(ev.seq,ev.time);}
 for(const ev of events){const lead=p63Timing.leader.get(ev.seq);const gap=Math.max(0,ev.time-lead);p63Timing.lastGap[ev.name]=gap;if(ev.player){const li=Math.floor(ev.seq/3),si=ev.seq%3;if(p63Timing.playerSplits[li])p63Timing.playerSplits[li][si]=gap;}}
 p63UpdateSectorPanel();
}
function p63SplitGapText(v){if(v===null||v===undefined)return'—';if(v<.0005)return'LEADER';return'+'+v.toFixed(3)+' s';}
function p63UpdateSectorPanel(){
 if(!p63UI.sectorPanel)return;const ord=raceOrder();
 if(p63UI.sectorPosition)p63UI.sectorPosition.textContent='P'+ord.pos+' / '+ord.rows.length+' · LAP '+Math.min(lap,settings.raceLaps);
 if(!p63UI.sectorRows)return;
 const rows=ord.rows.map((r,i)=>{
  const gap=(p63Timing&&p63Timing.lastGap&&Object.prototype.hasOwnProperty.call(p63Timing.lastGap,r.name))?p63Timing.lastGap[r.name]:(i===0?0:null);
  const cls='standingRow '+(r.player?'you ':'')+(gap===0?'leader':'behind');
  return '<div class="'+cls.trim()+'"><span class="pos">'+(i+1)+'</span><span class="name">'+r.name+'</span><strong class="gap">'+p63SplitGapText(gap)+'</strong></div>';
 }).join('');
 p63UI.sectorRows.innerHTML=rows;
}

// Severe damage now has an obvious race consequence while 0% damage remains
// byte-for-byte on the locked handling baseline. At 100% the car can limp to
// the pits but cannot continue at racing speed.
function p63DamageCapMph(d){
 if(d<70)return Infinity;
 if(d<85)return 145-(d-70)*(25/15);   // 145 -> 120
 if(d<95)return 120-(d-85)*(45/10);   // 120 -> 75
 return 75-(d-95)*(40/5);             // 75 -> 35 at 100%
}
function p63ApplyDamageConsequences(dt){
 const d=Math.max(0,Math.min(100,p6Resources.damage)),cap=p63DamageCapMph(d)*.44704,s=Math.hypot(car.vx,car.vy);
 if(Number.isFinite(cap)&&s>cap){const q=cap/Math.max(.001,s);car.vx*=q;car.vy*=q;}
 if(d>=90){const limp=.15+.85*(100-d)/10;car.vx*=Math.exp(-dt*(.20+.42*(1-limp)));car.vy*=Math.exp(-dt*(.20+.42*(1-limp)));}
 const critical=d>=85;
 if(p63UI.damageWarning)p63UI.damageWarning.style.display=critical?'block':'none';
 if(p6UI.damage)p6UI.damage.classList.toggle('critical',critical);
 if(p6UI.dashdamage)p6UI.dashdamage.classList.toggle('critical',critical);
}

// Front-end. The simulation stays paused until Start Race; rendering continues
// behind the menu so the transition into the race is immediate.
function p63SyncIntro(){
 if(p63UI.introStartMode)p63UI.introStartMode.value=settings.startMode;
 if(p63UI.introRaceLaps)p63UI.introRaceLaps.value=String(settings.raceLaps);
 if(p63UI.introAIPace)p63UI.introAIPace.value=String(settings.aiPace);
 if(p63UI.introAIValue)p63UI.introAIValue.textContent=Math.round(settings.aiPace)+'%';
}
function p63SetIntro(open){p63IntroOpen=!!open;if(p63UI.intro)p63UI.intro.style.display=p63IntroOpen?'flex':'none';if(p63IntroOpen)keys.clear();else canvas.focus({preventScroll:true});}
p63UI.introOptionsBtn?.addEventListener('click',()=>{const show=p63UI.introOptions?.style.display!=='block';if(p63UI.introOptions)p63UI.introOptions.style.display=show?'block':'none';});
p63UI.introStartMode?.addEventListener('change',e=>{settings.startMode=e.target.value;saveSettings();syncSettingsUI();});
p63UI.introRaceLaps?.addEventListener('change',e=>{settings.raceLaps=Number(e.target.value)||3;saveSettings();syncSettingsUI();});
p63UI.introAIPace?.addEventListener('input',e=>{settings.aiPace=Number(e.target.value)||110;saveSettings();syncSettingsUI();p63SyncIntro();});
p63UI.introStart?.addEventListener('click',()=>{ensureAudio();p63SetIntro(false);reset();});
p63SyncIntro();p63SetIntro(true);

// Keep the compact results panel live while the player drives a victory lap.
const p63BaseShowResults=p5ShowResults;
p5ShowResults=function(){p63BaseShowResults();if(raceUI.results)raceUI.results.style.display='flex';};

// Install the final reset/update wrappers.
const p63BaseReset=reset;
reset=function(){p63BaseReset();p63ResetTiming();p63RefreshPitBox();p63SyncIntro();};
const p63BaseFixedUpdate=fixedUpdate;
fixedUpdate=function(dt){
 if(p63IntroOpen)return;
 p63BaseFixedUpdate(dt);
 if(p6ReplayActive)return;
 p63ApplyDamageConsequences(dt);
 p63UpdateTiming();
};

updateTag=function(){ui.tag.innerHTML=`Phase 7.1 · full-game importer · Classic handling baseline<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · 3DO ${p6Setup.materialFix}`;};
updateTag();
// -----------------------------------------------------------------------------


// ---- Phase 7.0 generic full-game track layer -------------------------------
// This layer removes the remaining Detroit-only pit/race assumptions. The
// player handling model is unchanged; only track content and race routing vary.
const P7_PIT=T.pit||{};
function p7PitSegmentContains(idx){
 const e=(P7_PIT.entry_index??0),x=(P7_PIT.exit_index??0),i=(idx%N+N)%N;
 return e<=x?(i>=e&&i<=x):(i>=e||i<=x);
}
function p7PitBlendAt(idx){
 const b=P7_PIT.blend,i=(idx%N+N)%N;if(!p7PitSegmentContains(i))return 0;
 return b&&b.length===N?(b[i]||0):1;
}
function p7ForwardGap(from,to){let d=to-from;while(d<0)d+=N;while(d>=N)d-=N;return d;}
const P7_ELEV_FIT=S.map((sample,i)=>{
 const f=trackFrame(i),pts=[];
 for(const line of [P5_LINES.race,P5_LINES.pass1,P5_LINES.pass2]){
  const p=line&&line[i];if(!p)continue;const lat=(p[0]-f.c[0])*f.nx+(p[1]-f.c[1])*f.ny;pts.push([lat,Number(p[2]||0)]);
 }
 if(pts.length<2)return{m:0,b:Number(sample.center?.[2]||0)};
 let sx=0,sy=0,sxx=0,sxy=0;for(const [xv,yv] of pts){sx+=xv;sy+=yv;sxx+=xv*xv;sxy+=xv*yv;}
 const n=pts.length,den=n*sxx-sx*sx;if(Math.abs(den)<.04)return{m:0,b:sy/n};
 const m=(n*sxy-sx*sy)/den,b=(sy-m*sx)/n;return{m,b};
});
function p7ElevationAt(x,z){
 const idx=nearestIndex(x,z)[0],f=trackFrame(idx),dx=x-f.c[0],dz=z-f.c[1],lat=Math.max(-f.rw-3,Math.min(f.lw+3,dx*f.nx+dz*f.ny)),q=P7_ELEV_FIT[idx];
 return q?Number(q.b+q.m*lat):Number(S[idx]?.center?.[2]||0);
}
const P7_MIN_TRACK_Y=Number.isFinite(P3.ground_min_y)?P3.ground_min_y:(()=>{let m=Infinity;for(let i=1;i<P3.ground.length;i+=11)m=Math.min(m,Number(P3.ground[i]));return Number.isFinite(m)?m:-1;})(); // 8.1: importer records the pre-fit minimum
farGroundMesh=function(cx,cz){const R=5000,y=P7_MIN_TRACK_Y-1.5,col=P3.far_ground_rgb,a=[];pushTri([cx-R,y,cz-R],[cx+R,y,cz-R],[cx-R,y,cz+R],col,a);pushTri([cx-R,y,cz+R],[cx+R,y,cz-R],[cx+R,y,cz+R],col,a);return new Float32Array(a);};
// Visible fallback surface while a generic track atlas is still loading (or if it fails).
const p7GroundFallbackData=(()=>{const a=[],g=P3.ground||[],gr=E.rects?.grass;for(let i=0;i+10<g.length;i+=11){const isGrass=gr&&Math.abs(g[i+5]-gr[0])<1e-7&&Math.abs(g[i+6]-gr[1])<1e-7;const c=isGrass?[.40,.50,.29]:[.49,.51,.52];a.push(g[i],g[i+1]+.006,g[i+2],...c);}return new Float32Array(a);})();
const p7GroundFallbackBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,p7GroundFallbackBuffer);gl.bufferData(gl.ARRAY_BUFFER,p7GroundFallbackData,gl.STATIC_DRAW);
const p7BaseDrawWorld=p6DrawWorld;p6DrawWorld=function(eye,vp,showPlayer=true,showGuides=true){p7BaseDrawWorld(eye,vp,showPlayer,showGuides);if(!atlasReady&&p7GroundFallbackData.length){setVP(vp);drawColor(p7GroundFallbackBuffer,p7GroundFallbackData.length/6);}};
const p7BaseLocalPt=localPt;
localPt=function(x,z,h,u,v,y){const q=p7BaseLocalPt(x,z,h,u,v,y);q[1]+=p7ElevationAt(x,z);return q;};
transformCarColored=function(x,z,h){const src=CAR.colored,a=new Float32Array(src.length),c=Math.cos(h),ss=Math.sin(h),e=p7ElevationAt(x,z);for(let i=0;i<src.length;i+=6){const u=src[i],yy=src[i+1],v=src[i+2];a[i]=x+u*c-v*ss;a[i+1]=yy+e;a[i+2]=z+u*ss+v*c;a[i+3]=src[i+3];a[i+4]=src[i+4];a[i+5]=src[i+5];}return a;};
transformCarTextured=function(x,z,h){const src=CAR.textured,a=new Float32Array(src.length),c=Math.cos(h),ss=Math.sin(h),e=p7ElevationAt(x,z);for(let i=0;i<src.length;i+=11){const u=src[i],yy=src[i+1],v=src[i+2];a[i]=x+u*c-v*ss;a[i+1]=yy+e;a[i+2]=z+u*ss+v*c;for(let k=3;k<11;k++)a[i+k]=src[i+k];}return a;};
function p7PitPointRaw(idx){const p=P5_PIT.length===N?P5_PIT[(idx%N+N)%N]:race[(idx%N+N)%N];return p;}

// Generic pit classification uses proximity to the imported PIT.LP and the
// importer-generated pit separation envelope, so either left- or right-side
// pit lanes work without track-specific lateral signs or magic indices.
drivingStatus=function(x,y){
 const [idx]=nearestIndex(x,y),f=trackFrame(idx),dx=x-f.c[0],dy=y-f.c[1],lat=dx*f.nx+dy*f.ny;
 const bands=P3.surface[Math.min(P3.surface.length-1,idx)]||[];let family=-1;
 for(const b of bands){if(lat>=b[0]&&lat<=b[1]){family=b[2];break;}}
 const inside=(family===5||family===6),pp=p7PitPointRaw(idx),pit=p7PitBlendAt(idx)>.05&&Math.hypot(x-pp[0],y-pp[1])<10.5;
 return{inside,pit,idx,lat,f,family};
};

p6PitRawPoint=function(idx=(P7_PIT.stall_index??38)){return p7PitPointRaw(idx);};
p6PitHeading=function(idx=(P7_PIT.stall_index??38)){const a=p6PitRawPoint(idx),b=p6PitRawPoint((idx+2)%N);return Math.atan2(b[1]-a[1],b[0]-a[0]);};
p6PitPoint=function(idx=(P7_PIT.stall_index??38)){
 const p=p6PitRawPoint(idx),h=p6PitHeading(idx),nx=-Math.sin(h),ny=Math.cos(h),f=trackFrame(idx),off=Number(P7_PIT.service_offset_m||5.5);
 const d=(x,y)=>(x-f.c[0])*(x-f.c[0])+(y-f.c[1])*(y-f.c[1]),a=[p[0]+nx*off,p[1]+ny*off],b=[p[0]-nx*off,p[1]-ny*off],q=d(a[0],a[1])>d(b[0],b[1])?a:b;
 return[q[0],q[1],p[2]||0];
};
p6AIPitBlend=function(o,idx){return o.pitting?p7PitBlendAt(idx):0;};

escapedTrackBounds=function(){
 const st=drivingStatus(car.x,car.y);if(st.pit)return false;
 if(P5_PIT.length===N&&p7PitSegmentContains(st.idx)){const pp=P5_PIT[st.idx];if(Math.hypot(car.x-pp[0],car.y-pp[1])<13.5)return false;}
 // Generic tracks can have decorative/surface bands narrower than the legal
 // road. Use the imported solid-wall envelope as the authoritative escape test
 // and leave a generous tolerance so banking/elevation interpolation cannot
 // trigger false recovery on the racing surface.
 return st.lat>st.f.lw+5.0||st.lat<-st.f.rw-5.0;
};
function p7RecoverToRace(manual=false){
 const idx=nearestIndex(car.x,car.y)[0],p=race[idx]||center[idx],p2=race[(idx+4)%N]||center[(idx+4)%N],h=Math.atan2(p2[1]-p[1],p2[0]-p[0]);
 car.x=p[0];car.y=p[1];car.heading=h;car.vx=0;car.vy=0;car.steer=0;escapeTimer=0;hitTimer=.35;
 safeState={x:car.x,y:car.y,heading:car.heading,vx:0,vy:0};
 p6Notice(manual?'CAR RECOVERED':'AUTO RECOVERY',1.2);
}
recoverCar=p7RecoverToRace;

// Generic AI pit logic. PASS1/PASS2 racecraft remains shared with Detroit;
// only pit entry/blend/stall/exit comes from imported track metadata.
updateAI=function(dt){
 if(!raceStarted&&settings.startMode==='standing')return;
 const entry=P7_PIT.entry_index??Math.floor(N*.91),exit=P7_PIT.exit_index??Math.floor(N*.12);
 for(let i=0;i<opponents.length;i++){
  const o=opponents[i];
  if(o.finished){o.passTarget=0;o.passBlend+=(0-o.passBlend)*Math.min(1,dt*1.5);o.speed+=(Math.min(25,o.speed)-o.speed)*Math.min(1,dt*.8);o.prog=(o.prog+o.speed*dt/T.lp_resolution_m)%N;continue;}
  if(o.launchDelay>0){o.launchDelay=Math.max(0,o.launchDelay-dt);continue;}
  if(o.pitService>0){o.pitService=Math.max(0,o.pitService-dt);o.speed=0;o.prog=o.pitStall;if(o.pitService===0){o.pitServiced=true;o.pitDoneScore=o.completed*N+o.prog;p6SoundCue(430,.05,.018);}continue;}
  o.gridLane=(o.gridLane||0)*Math.exp(-dt*.75);o.passHold=Math.max(0,(o.passHold||0)-dt);
  let idx=(Math.floor(o.prog)%N+N)%N;
  const entryGap=p7ForwardGap(idx,entry);
  if(p6Setup.aiPitStrategy==='auto'&&settings.raceLaps>=10&&!o.pitting&&!o.pitServiced&&o.completed>=o.pitLap&&entryGap<28){o.pitting=true;o.passTarget=0;o.passHold=0;}
  const baseMph=Math.min(p5LineSpeed(o,idx)*o.skill*(settings.aiPace/100),settings.aiStraightCap),baseTarget=baseMph*.44704;
  o.passTarget=o.pitting?0:p5ChoosePass(o,i,baseTarget);o.passBlend+=(o.passTarget-o.passBlend)*Math.min(1,dt*(o.pitting?1.8:.95));
  let desired=baseTarget,score=o.completed*N+o.prog;if(o.pitting)desired=Math.min(desired,P6_PIT_LIMIT_MPH*.44704);
  for(const v of p5VehicleList(o)){const gap=v.score-score;if(gap>0&&gap<7&&Math.abs((v.pass||0)-o.passBlend)<.55)desired=Math.min(desired,v.speed*.972);}
  if(o.pitting&&!o.pitServiced){const gap=p7ForwardGap(o.prog,o.pitStall);if(gap<6)desired=0;if(gap<1.15&&o.speed<.8){o.prog=o.pitStall;o.speed=0;o.pitService=4.1+(i%3)*.25;continue;}}
  const delta=desired-o.speed,launchBoost=(settings.startMode==='standing'&&raceClock<5.5)?1.32:1,maxAccel=p712AIAccel(o.speed)*(o.launchTrait||1)*launchBoost,maxBrake=13.5;/*7.12 hook: Classic returns the 7.11 constants*/
  o.speed+=Math.max(-maxBrake*dt,Math.min(maxAccel*dt,delta));o.speed=Math.max(0,o.speed);
  const prev=o.prog;o.prog+=o.speed*dt/T.lp_resolution_m;
  if(o.prog>=N){o.prog-=N;o.completed++;}
  idx=(Math.floor(o.prog)%N+N)%N;
  if(o.pitting&&o.pitServiced&&o.pitDoneScore!=null&&(o.completed*N+o.prog)-o.pitDoneScore>25&&p7PitBlendAt(idx)<.04){o.pitting=false;o.passTarget=0;o.passBlend=0;}
  if(o.completed>=settings.raceLaps){o.finished=true;o.finishTime=raceClock;o.passTarget=0;}
 }
};

// Track selection is deliberately a reload: content changes, engine code does not.
const p7TrackSelect=document.getElementById('introTrack'),p7TrackName=document.getElementById('introTrackName'),p7HudTitle=document.getElementById('hudTitle');
if(p7TrackName)p7TrackName.textContent=T.name||T.short_name||'ICR2 Track';
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 7.4';
if(p7TrackSelect){p7TrackSelect.value=T.id||window.ICR2_SELECTED_TRACK||'detroit';p7TrackSelect.addEventListener('change',e=>{const q=new URLSearchParams(location.search);q.set('track',e.target.value);location.search=q.toString();});}

const p7BaseReset=reset;
reset=function(){
 p7BaseReset();
 const base=P7_PIT.stall_index??38;
 for(let i=0;i<opponents.length;i++){const o=opponents[i];o.pitStall=(base+(i-3)*3+N)%N;o.pitDoneScore=null;}
 p63RefreshPitBox();
};
updateTag=function(){ui.tag.innerHTML=`Phase 7.2 · ${T.short_name||T.name} · shared engine<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · ${T.id==='detroit'?'reference fidelity':'generic importer v2'}`;};
updateTag();
// -----------------------------------------------------------------------------


// ---- Phase 7.3 imported-track hardening -----------------------------------
// Pit classification now asks "am I actually on PIT.LP rather than RACE.LP?"
// instead of only asking whether a PIT.LP point is nearby. This prevents the
// main racing surface beside a pit entry from inheriting the pit limiter.
const P73_PIT_BASE_THRESHOLD=Number(P7_PIT.separation_threshold_m||Math.max(4.0,Number(P7_PIT.max_separation_m||0)*.35));
const P73_PIT_SEP_MIN=Math.max(6.0,P73_PIT_BASE_THRESHOLD*1.15);
function p73PitMetrics(x,z,baseIdx){
 const seed=(baseIdx===undefined?nearestIndex(x,z)[0]:baseIdx),span=36;let best=null;
 if(P5_PIT.length!==N)return{active:false,pit:false,pitDist:1e9,raceDist:1e9,sep:0,idx:seed};
 for(let d=-span;d<=span;d+=2){const i=(seed+d+N)%N;if(!p7PitSegmentContains(i))continue;const pp=P5_PIT[i],dx=x-pp[0],dz=z-pp[1],pd2=dx*dx+dz*dz;if(!best||pd2<best.pd2)best={i,pp,pd2};}
 if(!best)return{active:false,pit:false,pitDist:1e9,raceDist:1e9,sep:0,idx:seed};
 const rp=race[best.i]||center[best.i],pitDist=Math.sqrt(best.pd2),raceDist=Math.hypot(x-rp[0],z-rp[1]),sep=Math.hypot(best.pp[0]-rp[0],best.pp[1]-rp[1]);
 const pit=sep>P73_PIT_SEP_MIN&&pitDist<5.25&&pitDist+1.75<raceDist;
 return{active:true,pit,pitDist,raceDist,sep,idx:best.i,point:best.pp};
}
const p73BaseRaceElevation=p7ElevationAt;
p7ElevationAt=function(x,z){
 const baseIdx=nearestIndex(x,z)[0],m=p73PitMetrics(x,z,baseIdx);
 // A wider elevation hand-off than the HUD classification avoids a height pop
 // while the car is physically merging into/out of the pit road.
 if(m.active&&m.sep>Math.max(3.5,P73_PIT_SEP_MIN*.55)&&m.pitDist<7.5&&m.pitDist+1.0<m.raceDist)return Number(m.point?.[2]||0);
 return p73BaseRaceElevation(x,z);
};
drivingStatus=function(x,y){
 const [idx]=nearestIndex(x,y),f=trackFrame(idx),dx=x-f.c[0],dy=y-f.c[1],lat=dx*f.nx+dy*f.ny;
 const bands=P3.surface[Math.min(P3.surface.length-1,idx)]||[];let family=-1;
 for(const b of bands){if(lat>=b[0]&&lat<=b[1]){family=b[2];break;}}
 const inside=(family===5||family===6),pm=p73PitMetrics(x,y,idx);
 return{inside,pit:pm.pit,idx,lat,f,family,pitMetrics:pm};
};
escapedTrackBounds=function(){
 const st=drivingStatus(car.x,car.y),pm=st.pitMetrics||p73PitMetrics(car.x,car.y,st.idx);
 // Any car genuinely near the physical pit route gets recovery immunity even
 // before the stricter HUD/limiter classification turns on.
 if(pm.active&&pm.pitDist<9.0&&pm.sep>3.0)return false;
 return st.lat>st.f.lw+5.5||st.lat<-st.f.rw-5.5;
};

// Smooth only the camera's vertical reference. Car/world geometry still uses
// the imported elevations exactly, so this removes cockpit chatter without
// flattening crests or banking.
let p73CamElev=0,p73CamLookElev=0;
function p73ResetCameraElevation(){
 p73CamElev=p7ElevationAt(car.x,car.y);const c=Math.cos(car.heading),s=Math.sin(car.heading);p73CamLookElev=p7ElevationAt(car.x+c*24,car.y+s*24);
}
const p73BaseFixedUpdate=fixedUpdate;
fixedUpdate=function(dt){
 p73BaseFixedUpdate(dt);if(p6ReplayActive||p63IntroOpen)return;
 const c=Math.cos(car.heading),s=Math.sin(car.heading),target=p7ElevationAt(car.x,car.y),look=p7ElevationAt(car.x+c*24,car.y+s*24),a=1-Math.exp(-dt*5.0),b=1-Math.exp(-dt*3.8);
 p73CamElev+=(target-p73CamElev)*a;p73CamLookElev+=(look-p73CamLookElev)*b;
};
const p73BaseReset=reset;
reset=function(){p73BaseReset();p73ResetCameraElevation();};

// Imported TRK walls get a low-cost visible fallback. Original 3DO walls can
// still render on top, but the player never has to guess where a solid barrier
// is if a stock material/LOD is missing.
const p73WallData=(()=>{const src=P3.walls3d||[],a=[],col=[.72,.73,.71];for(let i=0;i+5<src.length;i+=6){const A=[src[i],src[i+1],src[i+2]],B=[src[i+3],src[i+4],src[i+5]],AT=[A[0],A[1]+1.05,A[2]],BT=[B[0],B[1]+1.05,B[2]];pushTri(A,B,AT,col,a);pushTri(AT,B,BT,col,a);}return new Float32Array(a);})();
const p73WallBuffer=gl.createBuffer();if(p73WallData.length){gl.bindBuffer(gl.ARRAY_BUFFER,p73WallBuffer);gl.bufferData(gl.ARRAY_BUFFER,p73WallData,gl.STATIC_DRAW);}
const p73BaseDrawWorld=p6DrawWorld;
p6DrawWorld=function(eye,vp,showPlayer=true,showGuides=true){p73BaseDrawWorld(eye,vp,showPlayer,showGuides);if(T.id!=='detroit'&&p73WallData.length){setVP(vp);drawColor(p73WallBuffer,p73WallData.length/6);}};

updateTag=function(){ui.tag.innerHTML=`Phase 7.3 · ${T.short_name||T.name} · shared engine<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · ${T.id==='detroit'?'reference fidelity':'generic importer v3'}`;};
updateTag();
// -----------------------------------------------------------------------------


// ---- Phase 7.4 exact road-plane / pit-corridor layer -----------------------
// The original TRK cross sections are now the authoritative vertical surface.
// This fixes banked-oval surface classification, gives the car actual roll and
// pitch, and replaces proximity-only pit detection with physical corridors.

function p74Norm3(v){const d=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/d,v[1]/d,v[2]/d];}
function p74Cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function p74Dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function p74WrapProgress(p){while(p<0)p+=N;while(p>=N)p-=N;return p;}
function p74PathPoint(path,prog){const p=p74WrapProgress(prog),i=Math.floor(p),j=(i+1)%N,t=p-i,a=path[i],b=path[j];return[a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,(a[2]||0)*(1-t)+(b[2]||0)*t];}

// Use the LP sequence direction as the positive longitudinal direction.  It
// already matches Papyrus DLAT: positive lateral is track-left.  Do not infer
// the sign from a wall point: ovals can temporarily have only one solid wall.
trackFrame=function(idx){
 idx=(idx%N+N)%N;const im=(idx-2+N)%N,ip=(idx+2)%N,c=center[idx],pm=center[im],pp=center[ip];
 let tx=pp[0]-pm[0],ty=pp[1]-pm[1],td=Math.hypot(tx,ty)||1;tx/=td;ty/=td;const nx=-ty,ny=tx;
 const bands=P3.surface[Math.min(P3.surface.length-1,idx)]||[];let lo=Infinity,hi=-Infinity;
 for(const b of bands){lo=Math.min(lo,b[0],b[1]);hi=Math.max(hi,b[0],b[1]);}
 const lw=Number.isFinite(hi)?Math.max(1,hi):25,rw=Number.isFinite(lo)?Math.max(1,-lo):25;
 return{c,tx,ty,nx,ny,lw,rw};
};

function p74TrackCoord(x,z){
 const seed=nearestIndex(x,z)[0];let best=null;
 for(let d=-5;d<=5;d++){
  const i=(seed+d+N)%N,j=(i+1)%N,a=center[i],b=center[j],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;if(l2<1e-8)continue;
  let t=((x-a[0])*dx+(z-a[1])*dz)/l2;t=Math.max(0,Math.min(1,t));const qx=a[0]+dx*t,qz=a[1]+dz*t,ex=x-qx,ez=z-qz,d2=ex*ex+ez*ez;
  if(!best||d2<best.d2)best={i,t,d2,qx,qz};
 }
 if(!best){const i=seed,f=trackFrame(i);return{idx:i,progress:i,lat:(x-f.c[0])*f.nx+(z-f.c[1])*f.ny,cx:f.c[0],cz:f.c[1],tx:f.tx,tz:f.ty,nx:f.nx,nz:f.ny};}
 const progress=best.i+best.t,pm=p74PathPoint(center,progress-1.5),pp=p74PathPoint(center,progress+1.5);let tx=pp[0]-pm[0],tz=pp[1]-pm[1],td=Math.hypot(tx,tz)||1;tx/=td;tz/=td;
 const nx=-tz,nz=tx,lat=(x-best.qx)*nx+(z-best.qz)*nz;return{idx:best.i,progress,lat,cx:best.qx,cz:best.qz,tx,tz,nx,nz};
}

const P74_XSECT=(T.xsect_dlats_m||[]).map(Number);
function p74AltAtSample(idx,lat){
 idx=(idx%N+N)%N;const vals=S[idx].xsect_alt_m;
 if(!vals||!P74_XSECT.length||vals.length!==P74_XSECT.length)return Number(S[idx].center?.[2]||0);
 if(P74_XSECT.length===1)return Number(vals[0]||0);
 if(lat<=P74_XSECT[0])return Number(vals[0]);if(lat>=P74_XSECT[P74_XSECT.length-1])return Number(vals[vals.length-1]);
 for(let k=0;k<P74_XSECT.length-1;k++)if(lat>=P74_XSECT[k]&&lat<=P74_XSECT[k+1]){const den=P74_XSECT[k+1]-P74_XSECT[k],t=den?((lat-P74_XSECT[k])/den):0;return Number(vals[k])*(1-t)+Number(vals[k+1])*t;}
 return Number(vals[0]||0);
}
function p74RaceAltAtProgress(prog,lat){const p=p74WrapProgress(prog),i=Math.floor(p),j=(i+1)%N,t=p-i;return p74AltAtSample(i,lat)*(1-t)+p74AltAtSample(j,lat)*t;}
function p74RaceSurface(x,z){
 const q=p74TrackCoord(x,z),e=p74RaceAltAtProgress(q.progress,q.lat),ds=Math.max(.25,T.lp_resolution_m||3.27),dp=.75;
 const ea=p74RaceAltAtProgress(q.progress-dp,q.lat),eb=p74RaceAltAtProgress(q.progress+dp,q.lat),mlong=(eb-ea)/(2*dp*ds);
 const dl=.5,el=p74RaceAltAtProgress(q.progress,q.lat-dl),er=p74RaceAltAtProgress(q.progress,q.lat+dl),mlat=(er-el)/(2*dl);
 const T3=[q.tx,mlong,q.tz],L3=[q.nx,mlat,q.nz];let normal=p74Norm3(p74Cross3(L3,T3));if(normal[1]<0)normal=normal.map(v=>-v);
 return{...q,elev:e,normal,tangent:p74Norm3(T3),lateral:p74Norm3(L3)};
}

function p74PitMetrics(x,z,tc){
 tc=tc||p74TrackCoord(x,z);if(P5_PIT.length!==N)return{pit:false,active:false,pitDist:1e9,raceDist:1e9,sep:0,progress:tc.progress};
 const pitp=p74PathPoint(P5_PIT,tc.progress),rp=p74PathPoint(race,tc.progress),pitDist=Math.hypot(x-pitp[0],z-pitp[1]),raceDist=Math.hypot(x-rp[0],z-rp[1]),sep=Math.hypot(pitp[0]-rp[0],pitp[1]-rp[1]);
 const si=(Math.round(tc.progress)%N+N)%N,sample=S[si]||{},pc=sample.pit_corridor;let corridor=false;
 if(pc&&pc.length===2&&p7PitSegmentContains(si))corridor=tc.lat>=Math.min(pc[0],pc[1])-.45&&tc.lat<=Math.max(pc[0],pc[1])+.45;
 // On tracks whose pit road shares one continuous paved apron with the circuit,
 // only a very narrow PIT.LP corridor counts. This prevents Laguna's Turn 1
 // racing surface from becoming a 60 mph zone.
 const narrow=!pc&&p7PitSegmentContains(si)&&sep>3.5&&pitDist<1.75&&pitDist+.65<raceDist;
 return{pit:corridor||narrow,active:!!pc||p7PitSegmentContains(si),pitDist,raceDist,sep,progress:tc.progress,point:pitp,corridor};
}
function p74PitSurface(x,z,tc,pm){
 tc=tc||p74TrackCoord(x,z);pm=pm||p74PitMetrics(x,z,tc);if(!pm.pit)return null;
 const p=pm.progress,a=p74PathPoint(P5_PIT,p-.8),b=p74PathPoint(P5_PIT,p+.8),dx=b[0]-a[0],dz=b[1]-a[1],dh=b[2]-a[2],d2=Math.hypot(dx,dz)||1,tx=dx/d2,tz=dz/d2,mlong=dh/(1.6*Math.max(.25,T.lp_resolution_m||3.27));
 const T3=p74Norm3([tx,mlong,tz]),L3=[-tz,0,tx];let normal=p74Norm3(p74Cross3(L3,T3));if(normal[1]<0)normal=normal.map(v=>-v);
 return{...tc,elev:Number(pm.point[2]||0),normal,tangent:T3,lateral:p74Norm3(L3),pit:true};
}
function p74RoadSurface(x,z){const tc=p74TrackCoord(x,z),pm=p74PitMetrics(x,z,tc);return p74PitSurface(x,z,tc,pm)||p74RaceSurface(x,z);}
p7ElevationAt=function(x,z){return p74RoadSurface(x,z).elev;};

// Physical surface classification follows the same signed DLAT frame as the
// TRK.  Concrete/asphalt/paint are normalized to the existing paved physics;
// grass/dry-grass/dirt/sand share the off-road model.
drivingStatus=function(x,z){
 const tc=p74TrackCoord(x,z),idx=(Math.round(tc.progress)%N+N)%N,f=trackFrame(idx),bands=P3.surface[Math.min(P3.surface.length-1,idx)]||[];let rawFamily=-1;
 for(const b of bands){if(tc.lat>=Math.min(b[0],b[1])&&tc.lat<=Math.max(b[0],b[1])){rawFamily=b[2];break;}}
 const sample=S[idx]||{},mc=sample.main_corridor;if(mc&&tc.lat>=Math.min(mc[0],mc[1])-.25&&tc.lat<=Math.max(mc[0],mc[1])+.25&&rawFamily<4)rawFamily=5;
 const pm=p74PitMetrics(x,z,tc);if(pm.pit)rawFamily=5;const family=rawFamily>=4?(rawFamily===6?6:5):0;
 return{inside:family===5||family===6,pit:pm.pit,idx,lat:tc.lat,f,family,rawFamily,pitMetrics:pm,trackCoord:tc};
};
escapedTrackBounds=function(){
 const st=drivingStatus(car.x,car.y),bands=P3.surface[Math.min(P3.surface.length-1,st.idx)]||[];if(st.pit)return false;let lo=Infinity,hi=-Infinity;
 for(const b of bands){lo=Math.min(lo,b[0],b[1]);hi=Math.max(hi,b[0],b[1]);}
 if(!Number.isFinite(lo)||!Number.isFinite(hi))return false;return st.lat<lo-5.5||st.lat>hi+5.5;
};

function p74Basis(x,z,h){
 const surf=p74RoadSurface(x,z),n=surf.normal,fh=[Math.cos(h),0,Math.sin(h)],dn=p74Dot3(fh,n);let forward=p74Norm3([fh[0]-n[0]*dn,fh[1]-n[1]*dn,fh[2]-n[2]*dn]);
 let lateral=p74Norm3(p74Cross3(forward,n)),up=p74Norm3(p74Cross3(lateral,forward));if(up[1]<0){lateral=lateral.map(v=>-v);up=up.map(v=>-v);}return{surf,forward,lateral,up};
}
localPt=function(x,z,h,u,v,y){const b=p74Basis(x,z,h),e=b.surf.elev;return[x+b.forward[0]*u+b.lateral[0]*v+b.up[0]*y,e+b.forward[1]*u+b.lateral[1]*v+b.up[1]*y,z+b.forward[2]*u+b.lateral[2]*v+b.up[2]*y];};
transformCarColored=function(x,z,h){const src=CAR.colored,a=new Float32Array(src.length),b=p74Basis(x,z,h),e=b.surf.elev;for(let i=0;i<src.length;i+=6){const u=src[i],yy=src[i+1],v=src[i+2];a[i]=x+b.forward[0]*u+b.lateral[0]*v+b.up[0]*yy;a[i+1]=e+b.forward[1]*u+b.lateral[1]*v+b.up[1]*yy;a[i+2]=z+b.forward[2]*u+b.lateral[2]*v+b.up[2]*yy;a[i+3]=src[i+3];a[i+4]=src[i+4];a[i+5]=src[i+5];}return a;};
transformCarTextured=function(x,z,h){const src=CAR.textured,a=new Float32Array(src.length),b=p74Basis(x,z,h),e=b.surf.elev;for(let i=0;i<src.length;i+=11){const u=src[i],yy=src[i+1],v=src[i+2];a[i]=x+b.forward[0]*u+b.lateral[0]*v+b.up[0]*yy;a[i+1]=e+b.forward[1]*u+b.lateral[1]*v+b.up[1]*yy;a[i+2]=z+b.forward[2]*u+b.lateral[2]*v+b.up[2]*yy;for(let k=3;k<11;k++)a[i+k]=src[i+k];}return a;};

// Smooth the camera's full local up vector, not just its height. This keeps the
// Corkscrew readable while allowing the car/world to bank naturally.
let p74CamUp=[0,1,0];
function p74ResetCameraPlane(){const s=p74RoadSurface(car.x,car.y);p74CamUp=s.normal.slice();p73CamElev=s.elev;const c=Math.cos(car.heading),q=Math.sin(car.heading);p73CamLookElev=p74RoadSurface(car.x+c*30,car.y+q*30).elev;}
const p74BaseFixedUpdate=fixedUpdate;
fixedUpdate=function(dt){p74BaseFixedUpdate(dt);if(p6ReplayActive||p63IntroOpen)return;const s=p74RoadSurface(car.x,car.y),a=1-Math.exp(-dt*3.2);p74CamUp=p74Norm3([p74CamUp[0]+(s.normal[0]-p74CamUp[0])*a,p74CamUp[1]+(s.normal[1]-p74CamUp[1])*a,p74CamUp[2]+(s.normal[2]-p74CamUp[2])*a]);};
const p74BaseReset=reset;reset=function(){p74BaseReset();p74ResetCameraPlane();};

// Same world renderer, but cockpit/chase camera attitude now understands the
// road plane. The cockpit look-ahead is shortened to avoid amplifying rapid
// Corkscrew elevation changes several dozen metres in front of the car.
render=function(){
 resize();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.SCISSOR_TEST);gl.clearColor(P3.sky_rgb[0],P3.sky_rgb[1],P3.sky_rgb[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const cx=car.x,cz=car.y,c=Math.cos(car.heading),s=Math.sin(car.heading),asp=canvas.width/canvas.height,elev=(typeof p73CamElev==='number'?p73CamElev:p7ElevationAt(cx,cz));let eye,target,P,upVec=[0,1,0];
 if(cameraMode===0){eye=[cx-c*13,6.0+elev,cz-s*13];const q=p74RoadSurface(cx+c*32,cz+s*32);target=[cx+c*38,1.25+q.elev,cz+s*38];P=perspective(1.00,asp,.18,6000);}
 else if(cameraMode===1){const qx=cx+c*30,qz=cz+s*30,look=(typeof p73CamLookElev==='number'?p73CamLookElev:p74RoadSurface(qx,qz).elev);eye=[cx+c*.72,1.05+elev,cz+s*.72];target=[qx,1.02+look,qz];P=perspective(.88,asp,.06,6000);upVec=p74CamUp;}
 else if(cameraMode===2){eye=[cx-c*28-s*16,13+elev,cz-s*28+c*16];const q=p74RoadSurface(cx+c*24,cz+s*24);target=[cx+c*24,1.0+q.elev,cz+s*24];P=perspective(.82,asp,.2,6000);}
 else{const span=Math.max(trackBounds.w,trackBounds.h)*.62,halfY=span,halfX=halfY*asp;eye=[trackBounds.cx,1800+elev,trackBounds.cy];target=[trackBounds.cx,elev,trackBounds.cy];P=ortho(-halfX,halfX,-halfY,halfY,.2,4000);upVec=[0,0,-1];}
 const vp=mul(P,lookAt(eye,target,upVec));p6DrawWorld(eye,vp,cameraMode!==1,true);
 const showMirrors=cameraMode===1&&p6Setup.mirrors&&!p6ReplayActive;p6SetMirrorFrames(showMirrors);if(showMirrors){const L=[-s,c],rects=p6MirrorRects();gl.enable(gl.SCISSOR_TEST);for(let mi=0;mi<rects.length;mi++){const r=rects[mi];gl.viewport(r.x,r.y,r.w,r.h);gl.scissor(r.x,r.y,r.w,r.h);gl.clearColor(P3.sky_rgb[0],P3.sky_rgb[1],P3.sky_rgb[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const side=r.side,me=[cx+c*.25+L[0]*side*.92,1.04+elev,cz+s*.25+L[1]*side*.92],backx=cx-c*45+L[0]*side*6,backz=cz-s*45+L[1]*side*6,bq=p74RoadSurface(backx,backz),mt=[backx,1.0+bq.elev,backz],MP=perspective(.82,r.w/r.h,.08,1400);MP[0]*=-1;p6DrawWorld(me,mul(MP,lookAt(me,mt,p74CamUp)),false,false);p62CopyMirror(r,mi===0?'left':'right');}gl.disable(gl.SCISSOR_TEST);gl.viewport(0,0,canvas.width,canvas.height);}
};

if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 7.4';
updateTag=function(){ui.tag.innerHTML=`Phase 7.4 · ${T.short_name||T.name} · shared engine<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · ${T.id==='detroit'?'reference fidelity':'exact TRK road plane'}`;};
updateTag();
// -----------------------------------------------------------------------------


// ---- Phase 7.5 stock pit metadata / oval balance / scenery polish ----------
// Stock TRACK.TXT PIT parameters are now authoritative. The automatic limiter
// defaults off: drivers get a flashing 60 mph warning and five seconds to slow
// before a 10 second penalty is issued.
function p75PlayerDrag(){return T.oval?0.00098:0.0031;}
function p75PlayerEngine(){return T.oval?13.0:12.4;}
function p75PlayerMaxSpeed(){return T.oval?125:94;}
function p75CircularContains(i,a,b){i=(i%N+N)%N;a=(a%N+N)%N;b=(b%N+N)%N;return a<=b?(i>=a&&i<=b):(i>=a||i<=b);}
function p75PitSpeedZoneActive(st){
 if(!st||!st.pit)return false;const a=P7_PIT.speed_start_index,b=P7_PIT.speed_end_index;if(a==null||b==null)return true;
 return p75CircularContains(st.idx,a,b);
}
// Exact stock stall position from TRACK.TXT, when available.
const p75BasePitPoint=p6PitPoint;
p6PitPoint=function(idx=(P7_PIT.stall_index??38)){
 const q=P7_PIT.stall_world;if(Array.isArray(q)&&q.length>=3)return[Number(q[0]),Number(q[1]),Number(q[2])];
 return p75BasePitPoint(idx);
};
function p75RefreshPitBox(){const data=p6PitBoxMesh();gl.bindBuffer(gl.ARRAY_BUFFER,p6PitBox.b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);p6PitBox.count=data.length/6;}

// Flashing manual pit-speed warning; outside the actual speed-limit interval the
// player is simply told they are on pit entry/exit.
const p75BasePitUI=p6UpdatePitUI;
p6UpdatePitUI=function(){
 const speed=Math.hypot(car.vx,car.vy)*2.23694,st=drivingStatus(car.x,car.y),pt=p6PitPoint(),dist=Math.hypot(car.x-pt[0],car.y-pt[1]),zone=p75PitSpeedZoneActive(st);let status='—';
 if(p6Pit.service>0)status='SERVICE';else if(p6Pit.requested)status=st.pit?'PIT LANE':'REQUESTED';else if(st.pit)status='PIT LANE';
 if(p6UI.pitStatus)p6UI.pitStatus.textContent=status;if(!p6UI.pitPanel)return;
 const show=p6Pit.requested||p6Pit.service>0||st.pit;p6UI.pitPanel.style.display=show?'block':'none';p6UI.pitPanel.classList.remove('speedWarn');if(!show)return;
 if(p6Pit.service>0){const done=1-p6Pit.service/Math.max(.001,p6Pit.total);p6UI.pitTitle.textContent='PIT SERVICE';p6UI.pitText.textContent='Fuel + tires + damage repair · '+p6Pit.service.toFixed(1)+' s';p6UI.pitProgress.style.width=(done*100).toFixed(1)+'%';return;}
 if(st.pit){
  if(zone){const over=speed>P6_PIT_LIMIT_MPH&&!p6Setup.autoLimiter,left=Math.max(0,5-p6Pit.speeding);p6UI.pitTitle.textContent='PIT LIMIT · '+P6_PIT_LIMIT_MPH+' MPH';p6UI.pitText.textContent=(p6Pit.requested?'Stall '+Math.round(dist)+' m · ':'')+Math.round(speed)+' mph'+(over?' · SLOW DOWN · '+left.toFixed(1)+' s':'')+(p6Pit.penalty?' · +10 s penalty':'');if(over)p6UI.pitPanel.classList.add('speedWarn');}
  else{p6UI.pitTitle.textContent='PIT ENTRY / EXIT';p6UI.pitText.textContent=(p6Pit.requested?'Stall '+Math.round(dist)+' m · ':'')+Math.round(speed)+' mph · 60 mph line ahead';}
  p6UI.pitProgress.style.width=Math.min(100,speed/P6_PIT_LIMIT_MPH*100)+'%';return;
 }
 p6UI.pitTitle.textContent='PIT REQUESTED';p6UI.pitText.textContent='Enter the pit lane and stop in the highlighted yellow stall.';p6UI.pitProgress.style.width='0%';
};

// Near-track PMP billboards should sit on the local TRK surface. This removes
// bushes that float over the road on large-elevation tracks while preserving
// genuinely distant hillside scenery.
const p75BaseSpriteMesh=spriteMesh;
spriteMesh=function(eye){
 const a=[];for(const s of E.sprites){let [x,yground,zbase,w,h,name]=s;const r=E.rects[name],dim=E.dims[name];if(!r||!dim)continue;
  if(T.id!=='detroit'&&typeof p74TrackCoord==='function'){const tc=p74TrackCoord(x,yground);if(Math.abs(tc.lat)<55){const e=p74RaceAltAtProgress(tc.progress,tc.lat);if(Math.abs(zbase-e)>2.0)zbase=e;}}
  const nx=eye[0]-x,nz=eye[2]-yground,nd=Math.hypot(nx,nz)||1,rx=nz/nd,rz=-nx/nd,hw=w*.5;const L=[x-rx*hw,zbase,yground-rz*hw],R=[x+rx*hw,zbase,yground+rz*hw],LT=[L[0],zbase+h,L[2]],RT=[R[0],zbase+h,R[2]],uw=Math.max(.001,dim[0]-.01),vh=Math.max(.001,dim[1]-.01),inv=[1/dim[0],1/dim[1]];const verts=[[L,0,vh],[R,uw,vh],[LT,0,0],[LT,0,0],[R,uw,vh],[RT,uw,0]];for(const [p,u,v] of verts)a.push(...p,u,v,...r,...inv);
 }return new Float32Array(a);
};

// Fresh track-aware defaults for the race settings UI.
if(T.oval){settings.aiStraightCap=Math.max(settings.aiStraightCap,255);const cap=document.getElementById('setAICap');if(cap){cap.max='270';cap.value=String(settings.aiStraightCap);}syncSettingsUI();}
p75RefreshPitBox();
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 7.5';
updateTag=function(){ui.tag.innerHTML=`Phase 7.5 · ${T.short_name||T.name} · shared engine<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · ${T.id==='detroit'?'reference fidelity':(T.oval?'oval setup + stock pits':'stock pits + scenery polish')}`;};
updateTag();
// -----------------------------------------------------------------------------


// ---- Phase 7.6 boundary / stock-pit-rules / terrain fidelity ----------------
// Detroit keeps its proven pit classifier. Imported tracks use the stock pit
// wall/stall DLATs to determine which side of the median the car occupies.
const p76BasePitMetrics=p74PitMetrics;
p74PitMetrics=function(x,z,tc){
 if(T.id==='detroit')return p76BasePitMetrics(x,z,tc);
 tc=tc||p74TrackCoord(x,z);
 if(P5_PIT.length!==N)return{pit:false,active:false,pitDist:1e9,raceDist:1e9,sep:0,progress:tc.progress};
 const si=(Math.round(tc.progress)%N+N)%N,pitp=p74PathPoint(P5_PIT,tc.progress),rp=p74PathPoint(race,tc.progress),pitDist=Math.hypot(x-pitp[0],z-pitp[1]),raceDist=Math.hypot(x-rp[0],z-rp[1]),sep=Math.hypot(pitp[0]-rp[0],pitp[1]-rp[1]);
 const inAccess=p75CircularContains(si,P7_PIT.entry_index??0,P7_PIT.exit_index??0),wall=Number(P7_PIT.pitwall_dlat_m),stall=Number(P7_PIT.stall_dlat_m),side=Math.sign(stall-wall)||1,sideGap=(tc.lat-wall)*side;
 const sample=S[si]||{},pc=sample.pit_corridor,corridor=!!(pc&&pc.length===2&&tc.lat>=Math.min(pc[0],pc[1])-.55&&tc.lat<=Math.max(pc[0],pc[1])+.55);
 const onPitSide=Number.isFinite(wall)&&Number.isFinite(stall)?sideGap>.20:false;
 const pit=inAccess&&(corridor||(onPitSide&&pitDist<Math.max(7.0,sep+3.0)));
 return{pit,active:inAccess,pitDist,raceDist,sep,progress:tc.progress,point:pitp,corridor,onPitSide,sideGap};
};

// The stock speed-limit line is enforced whenever the car is physically on the
// pit side of the wall, whether or not a stop has been requested.
p75PitSpeedZoneActive=function(st){
 if(!st)return false;
 const a=P7_PIT.speed_start_index,b=P7_PIT.speed_end_index;
 if(T.id==='detroit'){if(!st.pit)return false;return a==null||b==null?true:p75CircularContains(st.idx,a,b);}
 const pm=st.pitMetrics||p74PitMetrics(car.x,car.y,st.trackCoord);
 return !!pm.pit&&(a==null||b==null?true:p75CircularContains(st.idx,a,b));
};

// Stock stall positions are authoritative. Allow service to start from the
// yellow stall even if the pit-corridor classifier is within a few centimetres
// of a topology boundary.
function p76PitStallEligible(x,z){
 if(!p6Pit.requested)return false;
 const pt=p6PitPoint(),tc=p74TrackCoord(x,z),i=(Math.round(tc.progress)%N+N)%N;
 return p75CircularContains(i,P7_PIT.entry_index??0,P7_PIT.exit_index??0)&&Math.hypot(x-pt[0],z-pt[1])<4.5;
}

// Preserve the original sprite world altitude. Phase 7.5's road-plane
// re-grounding could drag hillside vegetation onto the road plane at Laguna.
spriteMesh=function(eye){
 const a=[];
 for(const s of E.sprites){
  const [x,yground,zbase,w,h,name]=s,r=E.rects[name],dim=E.dims[name];if(!r||!dim)continue;
  const nx=eye[0]-x,nz=eye[2]-yground,nd=Math.hypot(nx,nz)||1,rx=nz/nd,rz=-nx/nd,hw=w*.5,base=zbase-.03;
  const L=[x-rx*hw,base,yground-rz*hw],R=[x+rx*hw,base,yground+rz*hw],LT=[L[0],base+h,L[2]],RT=[R[0],base+h,R[2]],uw=Math.max(.001,dim[0]-.01),vh=Math.max(.001,dim[1]-.01),inv=[1/dim[0],1/dim[1]];
  for(const [q,u,v] of [[L,0,vh],[R,uw,vh],[LT,0,0],[LT,0,0],[R,uw,vh],[RT,uw,0]])a.push(...q,u,v,...r,...inv);
 }
 return new Float32Array(a);
};

p6RebuildEnvironmentBuffers();p75RefreshPitBox();
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 7.6';
updateTag=function(){ui.tag.innerHTML=`Phase 7.6 · ${T.short_name||T.name} · shared engine<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · ${T.id==='detroit'?'reference fidelity':(T.oval?'full TRK walls + oval setup':'full TRK walls + stock pits')}`;};
updateTag();
// -----------------------------------------------------------------------------

// Reinitialize with Phase 6 resources/strategy after installing the wrappers.
p6SyncSetupUI();reset();
// -----------------------------------------------------------------------------


// ---- Phase 7.7 Laguna terrain-containment correction -----------------------
// Laguna's tight, vertically stacked layout can place another track/terrain
// section close in plan view. A global nearest-section lookup can therefore
// jump to the wrong part of the circuit after an off-track excursion. Keep a
// continuity-based player progress reference and recover before the car can
// pass underneath a neighbouring terrain shelf. This does not affect Detroit
// or Michigan physics.
let p77LagunaProgress=3,p77LagunaOutside=0;
function p77TrackCoordNear(x,z,seed){
 const si=((Math.round(seed)%N)+N)%N;let best=null;
 for(let d=-36;d<=36;d++){
  const i=(si+d+N)%N,j=(i+1)%N,a=center[i],b=center[j],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;if(l2<1e-8)continue;
  let q=((x-a[0])*dx+(z-a[1])*dz)/l2;q=Math.max(0,Math.min(1,q));const qx=a[0]+dx*q,qz=a[1]+dz*q,ex=x-qx,ez=z-qz,d2=ex*ex+ez*ez;
  if(!best||d2<best.d2)best={i,t:q,d2,qx,qz};
 }
 if(!best)return p74TrackCoord(x,z);
 const progress=best.i+best.t,pm=p74PathPoint(center,progress-1.5),pp=p74PathPoint(center,progress+1.5);let tx=pp[0]-pm[0],tz=pp[1]-pm[1],td=Math.hypot(tx,tz)||1;tx/=td;tz/=td;
 const nx=-tz,nz=tx,lat=(x-best.qx)*nx+(z-best.qz)*nz;return{idx:best.i,progress,lat,cx:best.qx,cz:best.qz,tx,tz,nx,nz};
}
function p77LagunaContainment(dt){
 if(T.id!=='laguna'||p6ReplayActive||p63IntroOpen)return;
 const tc=p77TrackCoordNear(car.x,car.y,p77LagunaProgress),idx=(Math.round(tc.progress)%N+N)%N,bands=P3.surface[Math.min(P3.surface.length-1,idx)]||[];
 let lo=Infinity,hi=-Infinity;for(const b of bands){lo=Math.min(lo,b[0],b[1]);hi=Math.max(hi,b[0],b[1]);}
 const outside=Number.isFinite(lo)&&Number.isFinite(hi)&&(tc.lat<lo-2.0||tc.lat>hi+2.0);
 if(outside){p77LagunaOutside+=dt;if(p77LagunaOutside>.22){recoverCar(false);p77LagunaOutside=0;}}
 else{p77LagunaOutside=0;p77LagunaProgress=p74WrapProgress(tc.progress);}
}
const p77BaseFixedUpdate=fixedUpdate;
fixedUpdate=function(dt){p77BaseFixedUpdate(dt);p77LagunaContainment(dt);};
const p77BaseReset=reset;
reset=function(){p77BaseReset();p77LagunaProgress=3;p77LagunaOutside=0;};

// ---- Phase 7.8 Laguna material / horizon / reverse polish -----------------
// Laguna has a large elevation range.  The old far-ground and horizon planes
// followed the player's current altitude, which could slice through the stock
// hill 3DOs and leave only their tops visible.  Keep those distant layers at a
// fixed world altitude for Laguna; Detroit/Michigan keep their proven path.
const P78_MIN_TRACK_ELEV=Math.min(...S.map(q=>Number(q.center?.[2]||0)));
const p78BaseFarGroundMesh=farGroundMesh,p78BaseHorizonMesh=horizonMesh;
farGroundMesh=function(cx,cz){
 if(T.id!=='laguna')return p78BaseFarGroundMesh(cx,cz);
 const R=1500,y=P78_MIN_TRACK_ELEV-.55,col=P3.far_ground_rgb,a=[];
 pushTri([cx-R,y,cz-R],[cx+R,y,cz-R],[cx-R,y,cz+R],col,a);pushTri([cx-R,y,cz+R],[cx+R,y,cz-R],[cx+R,y,cz+R],col,a);return new Float32Array(a);
};
horizonMesh=function(cx,cz){
 if(T.id!=='laguna')return p78BaseHorizonMesh(cx,cz);
 const a=[],r=1200,baseY=P78_MIN_TRACK_ELEV,bottom=baseY-10,top=baseY+82,rect=E.rects.horiz,dim=E.dims.horiz;if(!rect||!dim)return new Float32Array();const inv=[1/dim[0],1/dim[1]];
 for(let i=0;i<8;i++){const a0=(i/8)*Math.PI*2+Math.PI/8,a1=((i+1)/8)*Math.PI*2+Math.PI/8,p0=[cx+Math.cos(a0)*r,bottom,cz+Math.sin(a0)*r],p1=[cx+Math.cos(a1)*r,bottom,cz+Math.sin(a1)*r],t0=[p0[0],top,p0[2]],t1=[p1[0],top,p1[2]],v0=1+i*200,v1=1+(i+1)*200,verts=[[t0,30,v0],[t1,30,v1],[p0,1,v0],[p0,1,v0],[t1,30,v1],[p1,1,v1]];for(const [p,u,v] of verts)a.push(...p,u,v,...rect,...inv);}
 return new Float32Array(a);
};
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 7.8';
updateTag=function(){ui.tag.innerHTML=`Phase 7.8 · ${T.short_name||T.name} · shared engine<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · ${T.id==='detroit'?'reference fidelity':(T.id==='laguna'?'Laguna terrain/material calibration':'full TRK walls + stock pits')}`;};
updateTag();
// -----------------------------------------------------------------------------

// ---- Phase 7.9 Laguna presentation / camera / reverse polish -------------
// Keep Corkscrew vegetation outside the road envelope. Camera-facing clump
// sheets are capped by their lateral clearance so they cannot sweep across the
// tarmac as the camera moves past them.
const p79BaseSpriteMesh=spriteMesh;
spriteMesh=function(eye){
 if(T.id!=='laguna')return p79BaseSpriteMesh(eye);
 const a=[];
 for(const s of E.sprites){
  let [x,yground,zbase,w,h,name]=s;const r=E.rects[name],dim=E.dims[name];if(!r||!dim)continue;
  if(name==='clump2'||name==='clump1ad'){
   const tc=p74TrackCoord(x,yground),frac=p74WrapProgress(tc.progress)/N;
   // Preserve side-of-track placement while limiting the camera-facing width.
   const safeHalf=Math.max(2.4,Math.abs(tc.lat)-6.0);w=Math.min(w,safeHalf*2.0);
   if(frac>.58&&frac<.80){w*=.72;h*=.86;}
  }
  const nx=eye[0]-x,nz=eye[2]-yground,nd=Math.hypot(nx,nz)||1,rx=nz/nd,rz=-nx/nd,hw=w*.5,base=zbase-.03;
  const L=[x-rx*hw,base,yground-rz*hw],R=[x+rx*hw,base,yground+rz*hw],LT=[L[0],base+h,L[2]],RT=[R[0],base+h,R[2]],uw=Math.max(.001,dim[0]-.01),vh=Math.max(.001,dim[1]-.01),inv=[1/dim[0],1/dim[1]];
  for(const [q,u,v] of [[L,0,vh],[R,uw,vh],[LT,0,0],[LT,0,0],[R,uw,vh],[RT,uw,0]])a.push(...q,u,v,...r,...inv);
 }
 return new Float32Array(a);
};

// The smoothed cockpit height must never lag below the current road plane on a
// fast uphill transition. It may smooth downward, but uphill motion is clamped
// to the exact local surface so the eye cannot briefly pass under the road.
const p79BaseFixedUpdate=fixedUpdate;
fixedUpdate=function(dt){
 p79BaseFixedUpdate(dt);
 if(T.id!=='laguna'||p6ReplayActive||p63IntroOpen)return;
 const surf=p74RoadSurface(car.x,car.y),speed=Math.hypot(car.vx,car.vy);
 p73CamElev=Math.max(p73CamElev,surf.elev-.03);
 const c=Math.cos(car.heading),q=Math.sin(car.heading),ahead=Math.min(18,5+speed*.22),look=p74RoadSurface(car.x+c*ahead,car.y+q*ahead).elev;
 const k=1-Math.exp(-dt*(4.2+Math.min(5,speed*.08)));p73CamLookElev+=(look-p73CamLookElev)*k;
};

p6RebuildEnvironmentBuffers();
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 7.9';
updateTag=function(){ui.tag.innerHTML=`Phase 7.9 · ${T.short_name||T.name} · shared engine<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · ${T.id==='laguna'?'Laguna scenery/camera polish':(T.id==='detroit'?'reference fidelity':'full TRK walls + stock pits')}`;};
updateTag();
// -----------------------------------------------------------------------------

// ---- Phase 7.10 Laguna background / wall-sign / reverse cleanup ----------
// Laguna's legacy hill-sheet objects are filtered by the importer in 7.10.
// Wall-advert UVs are isolated from bridge/object signs above. Reverse now uses
// a real sustained negative drive torque rather than toggling back into braking.
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 7.10';
updateTag=function(){ui.tag.innerHTML=`Phase 7.10 · ${T.short_name||T.name} · shared engine<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · ${T.id==='laguna'?'Laguna background/sign/reverse cleanup':(T.id==='detroit'?'reference fidelity':'full TRK walls + stock pits')}`;};
updateTag();
// Phase 7.11: content-only expansion and corrected live version labels.
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 7.11';
updateTag=function(){ui.tag.innerHTML=`Phase 7.11 · ${T.short_name||T.name} · shared engine<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'} · ${T.id==='detroit'?'Detroit reference':(T.id==='laguna'?'Laguna calibration':(T.id==='michigan'?'Michigan calibration':'NEW TRACK · experimental'))}`;};
updateTag();
// -----------------------------------------------------------------------------

// ---- Phase 7.12 performance trims + engine stabilization -------------------
// CLASSIC: every hook below returns the exact 7.11 value (same constants and
// arithmetic). tools/test/classic_lockstep.js runs this build and the 7.11
// build side by side with identical inputs and requires bit-identical car and
// AI state on all packaged tracks.
// HIGH-SPEED RACE TRIM: identical to Classic at or below 100 mph; above that a
// low-drag aero map, the circuit's stock DEFAULT.ST1 gearing with a soft rev
// limiter, and the Classic speed-sensitive steering lock continued past 141 mph
// (lateral capability tapers to the stock car's 4.4 g by 180 mph). The maths is
// in perf_trims.js; see docs/PERFORMANCE_TRIMS.md.
// Hooks placed in earlier layers: p7 updateAI -> p712AIAccel(),
// p6 damage cap -> p712DamageCapBase().
var p712Perf=null;
const P712_API=window.ICR2_PERF||null,P712_STOCK=(window.ICR2_STOCK_SETUPS||{})[T.id]||null,P712_TRIM_IDS=['classic','highspeed'];
function p712Trim(){return(P712_API&&settings&&settings.perfTrim==='highspeed')?'highspeed':'classic';}
function p712IsHS(){return p712Perf!==null&&p712Perf.trim==='highspeed';}
function p712Rebuild(){p712Perf=P712_API?P712_API.buildProfile(p712Trim(),T,P712_STOCK,window.ICR2_GEAR_SPEED_K):null;}
// AI longitudinal limit: 7.11 constants in Classic; in High-Speed the AI may use
// the same net acceleration curve as the player's car where that is stronger.
function p712AIAccel(s){const a=s<18?8.4:s<36?6.0:4.0;if(!p712IsHS())return a;const net=p712Perf.engine(s)-.16-p712Perf.drag(s)*s*s;return net>a?net:a;}
// Phase 6.0 damage speed cap. 7.11 used a fixed 64.8 m/s (145 mph) whenever
// damage > 0, which silently capped the 256 mph oval car after any wall touch.
// It now scales with the active car's clean top speed (exactly 64.8 on Classic
// road courses). Test-only: window.ICR2_COMPAT_711=true restores both
// deliberate 7.11 behaviours changed in this layer (damage cap, grid slot).
function p712Compat(){return window.ICR2_COMPAT_711===true;}
function p712DamageCapBase(){if(!p712Perf||p712Compat())return 64.8;const k=p712Perf.damageCapScale;return k===1?64.8:64.8*k;}
const p712BaseDamageCapMph=p63DamageCapMph;
p63DamageCapMph=function(d){const c=p712BaseDamageCapMph(d);if(!p712Perf||p712Compat())return c;const k=p712Perf.damageCapScale;return(k===1||!Number.isFinite(c))?c:c*k;};

// Player grid slot. 7.11 placed the player at TRK centreline + lateral offset.
// At Long Beach the centreline is the pit median (off-road band, wall 0.08 m
// away), so the car spawned touching a wall and took damage before the green
// flag. The 7.11 slot is kept wherever it lies inside the main paved corridor
// with >= 1.5 m wall clearance (Detroit, Laguna, Michigan, Road America,
// Milwaukee); otherwise the player uses the race-line frame of the AI grid.
function p712WallClearance(x,y){const w=P3.walls;let best=Infinity;for(let k=0;k<w.length;k+=4){const ax=w[k],ay=w[k+1],sx=w[k+2]-ax,sy=w[k+3]-ay,l2=sx*sx+sy*sy;if(l2<1e-10)continue;let t=((x-ax)*sx+(y-ay)*sy)/l2;t=t<0?0:t>1?1:t;const d=Math.hypot(x-ax-t*sx,y-ay-t*sy);if(d<best)best=d;}return best;}
function p712GridSlotValid(idx,lateral){const i=(idx%N+N)%N,f=trackFrame(i),p=center[i],mc=S[i].main_corridor;if(mc&&mc.length===2&&(lateral<Math.min(mc[0],mc[1])||lateral>Math.max(mc[0],mc[1])))return false;return p712WallClearance(p[0]+f.nx*lateral,p[1]+f.ny*lateral)>=1.5;}
const p712BaseSetCarAtIndex=setCarAtIndex;
setCarAtIndex=function(idx,lateral=0,speed=0){if(p712Compat()||p712GridSlotValid(idx,lateral))return p712BaseSetCarAtIndex(idx,lateral,speed);const i=(idx%N+N)%N,f=trackFrame(i),p=race[i],p2=race[(i+4)%N],h=Math.atan2(p2[1]-p[1],p2[0]-p[0]);car={x:p[0]+f.nx*lateral,y:p[1]+f.ny*lateral,heading:h,vx:Math.cos(h)*speed,vy:Math.sin(h)*speed,steer:0,wheelSpin:0};};

// Player car hooks (all read by the Phase 4.1 fixedUpdate core).
const p712BaseDrag=p75PlayerDrag,p712BaseEngine=p75PlayerEngine,p712BaseMaxSpeed=p75PlayerMaxSpeed;
p75PlayerDrag=function(){return p712IsHS()?p712Perf.drag(Math.hypot(car.vx,car.vy)):p712BaseDrag();};
p75PlayerEngine=function(){return p712IsHS()?p712Perf.engine(Math.hypot(car.vx,car.vy)):p712BaseEngine();};
p75PlayerMaxSpeed=function(){return p712IsHS()?p712Perf.maxSpeed:p712BaseMaxSpeed();};
const p712BaseHandlingProfile=handlingProfile;
handlingProfile=function(){const h=p712BaseHandlingProfile();if(p712IsHS())h.steer*=p712Perf.steerScale(Math.hypot(car.vx,car.vy));return h;};
const p712BaseGearRpm=gearRpm;
gearRpm=function(mps,throttle){return p712IsHS()?p712Perf.gearRpm(mps,throttle):p712BaseGearRpm(mps,throttle);};

// Settings: trim + per-trim AI straight-line cap and AI pace, remembered per
// track. High-Speed defaults: cap = 6th-gear top speed, pace = 100% (the AI
// drives the stock LP speeds). Measured with the headless test driver, 100%
// reproduces the Classic/110% race balance within ~3% on all six circuits.
const P712_HS_AI_PACE=100;
function p712DefaultAICap(trim){if(trim==='highspeed'&&P712_API){const p=P712_API.buildProfile('highspeed',T,P712_STOCK,window.ICR2_GEAR_SPEED_K);return p.aiCapMph;}return DEFAULT_SETTINGS.aiStraightCap;}
function p712EnsureAICaps(){
 const m=(settings.aiCapByTrim&&typeof settings.aiCapByTrim==='object')?settings.aiCapByTrim:{},q=(settings.aiPaceByTrim&&typeof settings.aiPaceByTrim==='object')?settings.aiPaceByTrim:{},hs=settings.perfTrim==='highspeed';
 if(!Number.isFinite(m.classic))m.classic=(hs?DEFAULT_SETTINGS.aiStraightCap:Number(settings.aiStraightCap))||DEFAULT_SETTINGS.aiStraightCap;
 if(!Number.isFinite(m.highspeed))m.highspeed=p712DefaultAICap('highspeed');
 if(!Number.isFinite(q.classic))q.classic=(hs?DEFAULT_SETTINGS.aiPace:Number(settings.aiPace))||DEFAULT_SETTINGS.aiPace;
 if(!Number.isFinite(q.highspeed))q.highspeed=P712_HS_AI_PACE;
 settings.aiCapByTrim=m;settings.aiPaceByTrim=q;
}
function p712StoreAI(){const t=p712Trim();if(settings.aiCapByTrim&&typeof settings.aiCapByTrim==='object'&&Number.isFinite(Number(settings.aiStraightCap)))settings.aiCapByTrim[t]=Number(settings.aiStraightCap);if(settings.aiPaceByTrim&&typeof settings.aiPaceByTrim==='object'&&Number.isFinite(Number(settings.aiPace)))settings.aiPaceByTrim[t]=Number(settings.aiPace);}
function p712LoadAI(t){settings.aiStraightCap=settings.aiCapByTrim[t];settings.aiPace=settings.aiPaceByTrim[t];}
const p712BaseSaveSettings=saveSettings;
saveSettings=function(){p712StoreAI();p712BaseSaveSettings();};
const p712UI={intro:document.getElementById('introTrim'),panel:document.getElementById('setTrim'),hud:document.getElementById('trimLabel'),note:document.getElementById('trimNote')};
function p712SyncUI(){const t=p712Trim();if(p712UI.intro)p712UI.intro.value=t;if(p712UI.panel)p712UI.panel.value=t;if(p712UI.hud)p712UI.hud.textContent=p712IsHS()?'HIGH-SPEED':'CLASSIC';if(p712UI.note)p712UI.note.textContent=p712IsHS()?('Stock '+(P712_STOCK?P712_STOCK.name:T.name)+' gearing · 6th tops out at '+Math.round(p712Perf.vGearMph)+' mph · identical to Classic below 100 mph'):'Phase 4.1 reference car · 141 mph top speed';}
function p712SetTrim(trim){trim=P712_TRIM_IDS.includes(trim)?trim:'classic';p712EnsureAICaps();p712StoreAI();settings.perfTrim=trim;p712LoadAI(trim);p712Rebuild();saveSettings();syncSettingsUI();if(typeof p63SyncIntro==='function')p63SyncIntro();p712SyncUI();updateTag();}
p712UI.intro?.addEventListener('change',e=>p712SetTrim(e.target.value));
p712UI.panel?.addEventListener('change',e=>p712SetTrim(e.target.value));
document.getElementById('settingsDefaults')?.addEventListener('click',()=>{settings.perfTrim='classic';p712EnsureAICaps();p712Rebuild();saveSettings();syncSettingsUI();p63SyncIntro();p712SyncUI();updateTag();});
if(!P712_TRIM_IDS.includes(settings.perfTrim))settings.perfTrim='classic';
p712EnsureAICaps();p712LoadAI(p712Trim());p712Rebuild();saveSettings();syncSettingsUI();p63SyncIntro();p712SyncUI();

// High-Speed only: the smoothed cockpit height lags ~1 m on steep climbs at
// 180+ mph, which can put the eye under the road. Clamp it to the exact road
// plane (Laguna already does this in 7.9). Classic camera is untouched.
const p712BaseFixedUpdate=fixedUpdate;
fixedUpdate=function(dt){p712BaseFixedUpdate(dt);if(!p712IsHS()||p6ReplayActive||p63IntroOpen||T.id==='laguna')return;const s=p74RoadSurface(car.x,car.y);if(p73CamElev<s.elev-.03)p73CamElev=s.elev-.03;};

// Render-only performance: p74Basis (exact road plane + orientation) is a pure
// function of (x,z,heading) but was evaluated for every vertex of every car
// mesh, three times per cockpit frame. Reuse the last result for identical
// inputs; output is bit-identical (verified by the render-buffer hash test).
const p712BaseBasis=p74Basis;let p712BX=NaN,p712BZ=NaN,p712BH=NaN,p712BV=null;
p74Basis=function(x,z,h){if(x===p712BX&&z===p712BZ&&h===p712BH&&p712BV)return p712BV;const b=p712BaseBasis(x,z,h);p712BX=x;p712BZ=z;p712BH=h;p712BV=b;return b;};

if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 7.12';
updateTag=function(){ui.tag.innerHTML=`Phase 7.12 · ${T.short_name||T.name} · ${p712IsHS()?'High-Speed race trim':'Classic handling'}<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'}`;};
updateTag();
// -----------------------------------------------------------------------------

// ---- Phase 8.0 true world orientation + stock texture mapping --------------
// Papyrus data is a standard right-handed world (x,y ground, z up): Michigan
// and Milwaukee run counter-clockwise from above (left turns), Road America
// clockwise, and every stock sign UV reads correctly from the track in that
// frame (tools/analyze_texture_orientation.py). The importer's (x,y,z)->(x,z,y)
// axis swap is a reflection, so every circuit was drawn as a mirror image and
// text read backwards unless a per-material U/V flip (Phases 2.4-7.10)
// compensated - which only worked for some faces.
// Fix, without touching the simulation:
//  * the final projection is mirrored once (clip-space x), giving the true
//    world image for every view (main, mirrors, map);
//  * left/right steering keys are exchanged at the input layer, so the same
//    physics (bit-identical) now turns the way the screen shows;
//  * all texture flips are removed: stock UVs everywhere, as Papyrus draws them;
//  * camera-facing PMP sprites swap U so they stay unmirrored;
//  * the horizon is the stock HORIZ.3DO ring per circuit, with stock UVs;
//  * sprites write depth (alpha-tested) and are drawn far to near, so barriers
//    no longer show through hedges/trees drawn as sprites;
//  * faces Papyrus draws one-sided (F05 culling nodes, back-to-back advert and
//    panel pairs) come from culling_data.js and are back-face culled;
//  * terrain_data.js fills the landscape beyond the TRK shoulders;
//  * High-Speed race trim becomes the default.
// window.ICR2_COMPAT_711=true restores the 7.11 presentation (tests only).
function p80Compat(){return p712Compat();}
function p80SteerSwapped(){return !p80Compat();}
const p80BaseSetVP=setVP;
function p80Det4(m){const a=m[0],b=m[1],c=m[2],d=m[3],e=m[4],f=m[5],g=m[6],h=m[7],i=m[8],j=m[9],k=m[10],l=m[11],n=m[12],o=m[13],p=m[14],q=m[15];
 return a*(f*(k*q-l*p)-g*(j*q-l*o)+h*(j*p-k*o))-b*(e*(k*q-l*p)-g*(i*q-l*n)+h*(i*p-k*n))+c*(e*(j*q-l*o)-f*(i*q-l*n)+h*(i*o-j*n))-d*(e*(j*p-k*o)-f*(i*p-k*n)+g*(i*o-j*n));}
let p80VPDet=-1,p80LastVP=null;
setVP=function(vp){if(p80Compat())return p80BaseSetVP(vp);const o=new Float32Array(vp);o[0]=-o[0];o[4]=-o[4];o[8]=-o[8];o[12]=-o[12];p80VPDet=p80Det4(o);p80LastVP=o;p80BaseSetVP(o);};
const P80_KEY_SWAP={a:'d',d:'a',arrowleft:'arrowright',arrowright:'arrowleft'};
const p80BaseKeyName=keyName;
keyName=function(e){const k=p80BaseKeyName(e);return(!p80Compat()&&P80_KEY_SWAP[k])||k;};

// Stock UVs for every 3DO face. Only the 7.9 Laguna crowd depth bias (a
// coplanar-surface z-fight fix, not a texture flip) is kept.
// One-sided faces: Papyrus draws a face guarded by a flavour-5 BSP node only
// from the front (its Newell side), and boards carry the advert and a plain
// panel on the two sides of the same plane. tools/build_face_culling.py lists
// those triangles per circuit (culling_data.js), resolving back-to-back
// advert/panel pairs with the stock BSP order; *_rev triangles are seen from
// the side opposite their stored winding (some boards are wound that way), so
// their winding is reversed here. They go to separate buffers drawn with
// back-face culling, so boards no longer z-fight (striped/blank signs) and an
// advert is not seen mirrored from behind. All other faces stay two-sided.
const P80_CULL=(window.ICR2_CULL&&Array.isArray(window.ICR2_CULL.textured)&&Array.isArray(window.ICR2_CULL.colored))?window.ICR2_CULL:null;
function p80CullMap(front,rev){const m=new Map();for(const i of front||[])m.set(i,1);for(const i of rev||[])m.set(i,-1);return m;}
// Push triangle t (stride floats per vertex) to dst, swapping vertices 1/2 when reversed.
function p80PushTri(dst,src,t,stride,rev){const b=t*stride*3;for(const v of (rev?[0,2,1]:[0,1,2]))for(let k=0;k<stride;k++)dst.push(src[b+v*stride+k]);}
const p80EnvTex1Buffer=gl.createBuffer(),p80EnvCol2Buffer=gl.createBuffer(),p80EnvCol1Buffer=gl.createBuffer();let p80EnvTex1Count=0,p80EnvCol2Count=0,p80EnvCol1Count=0;
const p80BaseRebuildEnv=p6RebuildEnvironmentBuffers;
p6RebuildEnvironmentBuffers=function(){
 if(p80Compat())return p80BaseRebuildEnv();
 const src=E.textured,out=[],out1=[],crowd=T.id==='laguna'?E.rects.crowd1:null,oneT=p80CullMap(P80_CULL&&P80_CULL.textured,P80_CULL&&P80_CULL.textured_rev);
 for(let off=0;off+32<src.length;off+=33){
  const tri=src.slice(off,off+33),side=oneT.get(off/33);
  if(crowd&&Math.abs(tri[5]-crowd[0])<1e-7&&Math.abs(tri[6]-crowd[1])<1e-7&&Math.abs(tri[7]-crowd[2])<1e-7)for(const b of [0,11,22])tri[b+1]+=.055;
  if(side)p80PushTri(out1,tri,0,11,side<0);else for(let k=0;k<33;k++)out.push(tri[k]);
 }
 gl.bindBuffer(gl.ARRAY_BUFFER,p6EnvNormalBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.STATIC_DRAW);p6EnvNormalCount=out.length/11;
 gl.bindBuffer(gl.ARRAY_BUFFER,p80EnvTex1Buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out1),gl.STATIC_DRAW);p80EnvTex1Count=out1.length/11;
 gl.bindBuffer(gl.ARRAY_BUFFER,p6EnvTextBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(0),gl.STATIC_DRAW);p6EnvTextCount=0;
 const C=E.colored,oneC=p80CullMap(P80_CULL&&P80_CULL.colored,P80_CULL&&P80_CULL.colored_rev),c2=[],c1=[];
 for(let t=0;(t+1)*18<=C.length;t++){const side=oneC.get(t);if(side)p80PushTri(c1,C,t,6,side<0);else for(let k=t*18;k<t*18+18;k++)c2.push(C[k]);}
 gl.bindBuffer(gl.ARRAY_BUFFER,p80EnvCol2Buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c2),gl.STATIC_DRAW);p80EnvCol2Count=c2.length/6;
 gl.bindBuffer(gl.ARRAY_BUFFER,p80EnvCol1Buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c1),gl.STATIC_DRAW);p80EnvCol1Count=c1.length/6;
};
// Importer triangles are counter-clockwise seen from the face's visible side
// in the (right-handed) web frame. Window-space winding then depends only on
// the sign of det(VP): negative for an ordinary projection, positive after one
// x mirror (the 8.0 true-orientation flip), negative again in the rear-view
// mirrors (which add their own flip).
function p80OneSided(on){if(!on){gl.disable(gl.CULL_FACE);return;}gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(p80VPDet<0?gl.CCW:gl.CW);}
p6RebuildEnvironmentBuffers();

// Billboards are built facing the camera in the pre-mirror frame; swap U so
// the image is not reversed after the projection mirror. Sprites write depth
// (so walls and barriers no longer show through hedges), therefore they are
// also sorted far to near: a soft, partly transparent edge then blends with
// the trees behind it instead of punching a sky-coloured outline into them.
const p80BaseSpriteMesh=spriteMesh;
spriteMesh=function(eye){const a=p80BaseSpriteMesh(eye);if(p80Compat())return a;const n=Math.floor(a.length/66),d=new Float64Array(n),ord=new Array(n);
 for(let q=0;q<n;q++){const b=q*66;let m=0;for(let k=0;k<6;k++)m=Math.max(m,a[b+k*11+3]);for(let k=0;k<6;k++)a[b+k*11+3]=m-a[b+k*11+3];const cx=(a[b]+a[b+11])*.5-eye[0],cz=(a[b+2]+a[b+13])*.5-eye[2];d[q]=cx*cx+cz*cz;ord[q]=q;}
 ord.sort((i,j)=>d[j]-d[i]||i-j);const o=new Float32Array(n*66);for(let k=0;k<n;k++)o.set(a.subarray(ord[k]*66,ord[k]*66+66),k*66);return o;};

// Stock horizon ring: each circuit's HORIZ.3DO side faces (angle, top/bottom,
// u, v), drawn with the same texel convention as every other 3DO face.
const P80_HORIZON=(P712_STOCK&&Array.isArray(P712_STOCK.horizon)&&P712_STOCK.horizon.length)?P712_STOCK.horizon:null;
function p80HorizonMesh(cx,cz){
 const rect=E.rects.horiz,dim=E.dims.horiz;if(!rect||!dim||!P80_HORIZON)return null;
 const lag=T.id==='laguna',r=lag?1200:900,baseY=lag?P78_MIN_TRACK_ELEV:p7ElevationAt(cx,cz),bottom=baseY-(lag?10:12),top=baseY+(lag?82:70),inv=[1/dim[0],1/dim[1]],a=[];
 for(const face of P80_HORIZON){
  const P=face.map(([deg,isTop,u,v])=>{const t=deg*Math.PI/180;return[[cx+Math.cos(t)*r,isTop?top:bottom,cz+Math.sin(t)*r],u,v];});
  for(const i of [0,1,2,0,2,3]){const [p,u,v]=P[i];a.push(...p,u,v,...rect,...inv);}
 }
 return new Float32Array(a);
}

// Generic landscape from tools/build_terrain.py (Delaunay terrain between the
// TRK shoulder edges, 10 cm below them). Fills the see-through gaps beyond the
// stock cross-sections on every circuit that ships a terrain_data.js.
const P80_TERRAIN=(()=>{const t=window.ICR2_TERRAIN;if(!t||!Array.isArray(t.verts)||!Array.isArray(t.tris))return null;
 const V=t.verts,F=t.tris,k=Number(t.texels_per_m)||10,mats=(t.materials||[]).map(n=>[E.rects[n],E.dims[n]]),out=new Float32Array(F.length/4*3*11);let o=0;
 for(let i=0;i<F.length;i+=4){const m=mats[F[i+3]];if(!m||!m[0]||!m[1])continue;const r=m[0],iw=1/m[1][0],ih=1/m[1][1];for(let j=0;j<3;j++){const b=F[i+j]*3,x=V[b],y=V[b+1],z=V[b+2];out[o++]=x;out[o++]=y;out[o++]=z;out[o++]=x*k;out[o++]=z*k;out[o++]=r[0];out[o++]=r[1];out[o++]=r[2];out[o++]=r[3];out[o++]=iw;out[o++]=ih;}}
 return out.subarray(0,o);})();
const p80TerrainBuffer=gl.createBuffer();let p80TerrainCount=0;
if(P80_TERRAIN&&P80_TERRAIN.length){gl.bindBuffer(gl.ARRAY_BUFFER,p80TerrainBuffer);gl.bufferData(gl.ARRAY_BUFFER,P80_TERRAIN,gl.STATIC_DRAW);p80TerrainCount=P80_TERRAIN.length/11;}

// World draw with explicit passes: all opaque geometry first (incl. the TRK
// wall fallback, which 7.3-7.12 drew after the sprites), then alpha-tested
// sprites with depth writes.
const p80BaseDrawWorld=p6DrawWorld;
p6DrawWorld=function(eye,vp,showPlayer=true,showGuides=true){
 if(p80Compat())return p80BaseDrawWorld(eye,vp,showPlayer,showGuides);
 setVP(vp);const cx=car.x,cz=car.y,fg=farGroundMesh(cx,cz);gl.bindBuffer(gl.ARRAY_BUFFER,farGroundBuffer);gl.bufferData(gl.ARRAY_BUFFER,fg,gl.DYNAMIC_DRAW);drawColor(farGroundBuffer,fg.length/6);
 if(environmentOn&&atlasReady){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);const hz=p80HorizonMesh(cx,cz);if(hz){gl.bindBuffer(gl.ARRAY_BUFFER,horizonBuffer);gl.bufferData(gl.ARRAY_BUFFER,hz,gl.DYNAMIC_DRAW);drawTextured(horizonBuffer,hz.length/11,1);}else{const h0=horizonMesh(cx,cz);gl.bindBuffer(gl.ARRAY_BUFFER,horizonBuffer);gl.bufferData(gl.ARRAY_BUFFER,h0,gl.DYNAMIC_DRAW);drawTextured(horizonBuffer,h0.length/11);}drawTextured(p3GroundBuffer,p3GroundCount);if(p80TerrainCount)drawTextured(p80TerrainBuffer,p80TerrainCount);}
 if(!atlasReady&&p7GroundFallbackData.length)drawColor(p7GroundFallbackBuffer,p7GroundFallbackData.length/6);
 if(environmentOn){if(p80EnvCol2Count)drawColor(p80EnvCol2Buffer,p80EnvCol2Count);if(p80EnvCol1Count){p80OneSided(true);drawColor(p80EnvCol1Buffer,p80EnvCol1Count);p80OneSided(false);}if(atlasReady){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);if(p6EnvNormalCount)drawTextured(p6EnvNormalBuffer,p6EnvNormalCount,1);if(p6EnvTextCount)drawTextured(p6EnvTextBuffer,p6EnvTextCount,1);if(p80EnvTex1Count){p80OneSided(true);drawTextured(p80EnvTex1Buffer,p80EnvTex1Count,1);p80OneSided(false);}}}
 if(T.id!=='detroit'&&p73WallData.length)drawColor(p73WallBuffer,p73WallData.length/6);
 gl.disable(gl.BLEND);if(showGuides&&p6Setup.drivingLine)drawColor(overlayMeshes[0].b,overlayMeshes[0].count);if(showGuides)drawColor(overlayMeshes[1].b,overlayMeshes[1].count);if(showGuides&&p6Pit.requested)drawColor(p6PitBox.b,p6PitBox.count);
 if(showPlayer){const cc=transformCarColored(car.x,car.y,car.heading);gl.bindBuffer(gl.ARRAY_BUFFER,carColorBuffer);gl.bufferData(gl.ARRAY_BUFFER,cc,gl.DYNAMIC_DRAW);drawColor(carColorBuffer,cc.length/6);if(carAtlasReady){const ct=transformCarTextured(car.x,car.y,car.heading);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,carTexture);gl.bindBuffer(gl.ARRAY_BUFFER,carTexBuffer);gl.bufferData(gl.ARRAY_BUFFER,ct,gl.DYNAMIC_DRAW);drawTextured(carTexBuffer,ct.length/11);}const pw=playerWheelMesh();gl.bindBuffer(gl.ARRAY_BUFFER,dyn);gl.bufferData(gl.ARRAY_BUFFER,pw,gl.DYNAMIC_DRAW);drawColor(dyn,pw.length/6);}
 const ai=dynamicMesh();if(ai.length){gl.bindBuffer(gl.ARRAY_BUFFER,dyn);gl.bufferData(gl.ARRAY_BUFFER,ai,gl.DYNAMIC_DRAW);drawColor(dyn,ai.length/6);}
 if(environmentOn&&atlasReady){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTexture);const sp=spriteMesh(eye);gl.bindBuffer(gl.ARRAY_BUFFER,spriteBuffer);gl.bufferData(gl.ARRAY_BUFFER,sp,gl.DYNAMIC_DRAW);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(true);drawTextured(spriteBuffer,sp.length/11,1);gl.disable(gl.BLEND);}
};

// High-Speed race trim is the default from 8.0 (Classic stays one click away).
// Settings saved by 7.12 (which stored 'classic' on first load) are migrated
// once; later explicit choices persist.
function p80DefaultTrim(){return p80Compat()?'classic':'highspeed';}
if(!p80Compat()&&settings.trimDefaultsVersion!==80){settings.trimDefaultsVersion=80;p712SetTrim(p80DefaultTrim());}
document.getElementById('settingsDefaults')?.addEventListener('click',()=>{settings.trimDefaultsVersion=80;p712SetTrim(p80DefaultTrim());});

if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 8.0';
updateTag=function(){ui.tag.innerHTML=`Phase 8.0 · ${T.short_name||T.name} · ${p712IsHS()?'High-Speed race trim':'Classic handling'}<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?'textures ready':'loading textures…'} · ${soundOn?'sound ON':'sound OFF'}`;};
updateTag();
// -----------------------------------------------------------------------------

// ---- Phase 8.1 texture sampling: per-pixel tiling, mipmaps, wrap-padded atlas ----
// Up to 8.0 the shader wrapped texture coordinates per *vertex*
// (fract(uv/size) in the vertex shader). Any face whose UVs cross a tile edge
// was then squeezed or reversed: the streaky TRK grass and shoulders, the
// shimmer that came with it, and grandstands whose crowd face spans exactly
// one tile height (v 0..h -> fract = 0 at both ends) collapsed to a single
// row of dark texels, i.e. "stands without crowds". 8.1 wraps per pixel.
// It also re-packs the atlas at load time with 16 px of wrapped padding per
// texture (16 px aligned), so filtering is seamless across tile edges and
// mipmaps up to level 4 never mix two textures, then samples with explicit
// gradients (EXT_shader_texture_lod) so the mip level is right at tile seams.
// Without the extensions it falls back to per-pixel wrapping without mipmaps.
const P81_EXT_DERIV=!p80Compat()&&gl.getExtension?gl.getExtension('OES_standard_derivatives'):null;
const P81_EXT_LOD=!p80Compat()&&gl.getExtension?gl.getExtension('EXT_shader_texture_lod'):null;
const P81_EXT_ANISO=!p80Compat()&&gl.getExtension?(gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')):null;
const P81_GRAD=!!(P81_EXT_DERIV&&P81_EXT_LOD),P81_PAD=16,P81_MAXLOD=4;
// Vertex layout for the 8.1 program (same 11 floats, so every existing draw
// call and count is unchanged): the uv pair holds the tile coordinate
// uv/size (V already negated for flipped draws) and the invsz pair holds the
// triangle's tile origin when the triangle lies within one tile (else a
// sentinel). The shader clamps to that tile before wrapping, so MSAA edge
// samples that extrapolate a little past a triangle never wrap to the far
// side of a sign or sprite (which would draw stray dotted lines).
const P81_NOCLAMP=-60000;
function p81Convert(a,flip){const o=new Float32Array(a.length);o.set(a);
 for(let t=0;t+32<a.length;t+=33){const tx=[0,0,0],ty=[0,0,0];
  for(let k=0;k<3;k++){const b=t+k*11,iw=a[b+9],ih=a[b+10];tx[k]=a[b+3]*iw;ty[k]=flip?-a[b+4]*ih:a[b+4]*ih;}
  const lx=Math.floor(Math.min(...tx)),hx=Math.floor(Math.max(...tx)-1e-6),ly=Math.floor(Math.min(...ty)),hy=Math.floor(Math.max(...ty)-1e-6);
  const ox=lx===hx?lx:P81_NOCLAMP,oy=ly===hy?ly:P81_NOCLAMP;
  for(let k=0;k<3;k++){const b=t+k*11;o[b+3]=tx[k];o[b+4]=ty[k];o[b+9]=ox;o[b+10]=oy;}}
 return o;}
const p81Converted=new Set();
const p81Prog=program(
`attribute vec3 p;attribute vec2 uv;attribute vec4 rect;attribute vec2 invsz;uniform mat4 vp;varying vec2 vt;varying vec2 vlo;varying vec4 vrect;varying float depth;void main(){vt=uv;vlo=invsz;vrect=rect;vec4 q=vp*vec4(p,1.0);gl_Position=q;depth=q.w;}`,
(P81_GRAD?'#extension GL_OES_standard_derivatives : enable\n#extension GL_EXT_shader_texture_lod : enable\n':'')+
`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D atlas;uniform float mipOn;uniform vec2 atlasPx;varying vec2 vt;varying vec2 vlo;varying vec4 vrect;varying float depth;
void main(){vec2 c=mix(vt,clamp(vt,vlo,vlo+0.99998),step(-50000.0,vlo));vec2 f=fract(c);vec2 tuv=vec2(vrect.x,1.0-vrect.y-vrect.w)+f*vrect.zw;vec4 t;`+
(P81_GRAD?`if(mipOn>0.5){vec2 gx=dFdx(vt)*vrect.zw,gy=dFdy(vt)*vrect.zw;float r=sqrt(max(dot(gx*atlasPx,gx*atlasPx),dot(gy*atlasPx,gy*atlasPx)));float k=min(1.0,${(1<<P81_MAXLOD).toFixed(1)}/max(r,1e-6));t=texture2DGradEXT(atlas,tuv,gx*k,gy*k);}else t=texture2D(atlas,tuv);`:`t=texture2D(atlas,tuv);`)+
`if(t.a<.08)discard;float fog=smoothstep(450.0,1800.0,depth);gl_FragColor=vec4(mix(t.rgb,vec3(.518,.769,.941),fog*.72),t.a);}`);
const p81Loc={p:gl.getAttribLocation(p81Prog,'p'),uv:gl.getAttribLocation(p81Prog,'uv'),rect:gl.getAttribLocation(p81Prog,'rect'),inv:gl.getAttribLocation(p81Prog,'invsz'),vp:gl.getUniformLocation(p81Prog,'vp'),atlas:gl.getUniformLocation(p81Prog,'atlas'),mip:gl.getUniformLocation(p81Prog,'mipOn'),px:gl.getUniformLocation(p81Prog,'atlasPx')};
let p81AtlasMip=false,p81AtlasPx=[E.atlas_size||2048,E.atlas_size||2048],p81Bound=null;
const p81BindTexture=gl.bindTexture.bind(gl);gl.bindTexture=function(target,tex){if(target===gl.TEXTURE_2D)p81Bound=tex;return p81BindTexture(target,tex);};
const p81BaseDrawTextured=drawTextured;
drawTextured=function(buf,count,flipV=0){
 if(p80Compat()||!p80LastVP||!p81Converted.has(buf))return p81BaseDrawTextured(buf,count,flipV);
 gl.useProgram(p81Prog);gl.uniformMatrix4fv(p81Loc.vp,false,p80LastVP);gl.uniform1i(p81Loc.atlas,0);
 gl.uniform1f(p81Loc.mip,p81AtlasMip&&p81Bound===atlasTexture?1:0);gl.uniform2f(p81Loc.px,p81AtlasPx[0],p81AtlasPx[1]);
 gl.bindBuffer(gl.ARRAY_BUFFER,buf);const st=44;gl.enableVertexAttribArray(p81Loc.p);gl.vertexAttribPointer(p81Loc.p,3,gl.FLOAT,false,st,0);gl.enableVertexAttribArray(p81Loc.uv);gl.vertexAttribPointer(p81Loc.uv,2,gl.FLOAT,false,st,12);gl.enableVertexAttribArray(p81Loc.rect);gl.vertexAttribPointer(p81Loc.rect,4,gl.FLOAT,false,st,20);gl.enableVertexAttribArray(p81Loc.inv);gl.vertexAttribPointer(p81Loc.inv,2,gl.FLOAT,false,st,36);gl.drawArrays(gl.TRIANGLES,0,count);};

// Keep tiled coordinates small (precision): shift each triangle of a tiled
// layer by whole tiles so its smallest u and v lie in the first tile.
function p81NormaliseTiles(a){for(let t=0;t+32<a.length;t+=33){let mu=Infinity,mv=Infinity;for(let k=0;k<3;k++){const b=t+k*11;mu=Math.min(mu,a[b+3]*a[b+9]);mv=Math.min(mv,a[b+4]*a[b+10]);}const su=Math.floor(mu),sv=Math.floor(mv);if(!su&&!sv)continue;for(let k=0;k<3;k++){const b=t+k*11;if(a[b+9])a[b+3]-=su/a[b+9];if(a[b+10])a[b+4]-=sv/a[b+10];}}return a;}
function p81Upload(buf,data,flip,usage){gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,p81Convert(data,flip),usage||gl.STATIC_DRAW);p81Converted.add(buf);}
function p81UploadGround(){if(p80Compat())return;p81Upload(p3GroundBuffer,p81NormaliseTiles(new Float32Array(P3.ground)),0);}
function p81UploadTerrain(){if(p80Compat())return;const t=window.ICR2_TERRAIN;if(!t||!Array.isArray(t.verts)||!Array.isArray(t.tris)||!p80TerrainCount)return;
 const V=t.verts,F=t.tris,k=Number(t.texels_per_m)||10,mats=(t.materials||[]).map(n=>[E.rects[n],E.dims[n]]),out=new Float32Array(F.length/4*3*11);let o=0;
 for(let i=0;i<F.length;i+=4){const m=mats[F[i+3]];if(!m||!m[0]||!m[1])continue;const r=m[0],iw=1/m[1][0],ih=1/m[1][1];for(let j=0;j<3;j++){const b=F[i+j]*3,x=V[b],y=V[b+1],z=V[b+2];out[o++]=x;out[o++]=y;out[o++]=z;out[o++]=x*k;out[o++]=z*k;out[o++]=r[0];out[o++]=r[1];out[o++]=r[2];out[o++]=r[3];out[o++]=iw;out[o++]=ih;}}
 p81Upload(p80TerrainBuffer,p81NormaliseTiles(out.slice(0,o)),0);p80TerrainCount=o/11;}
// The 8.0 environment split (two-sided / one-sided, Laguna crowd bias), uploaded in the 8.1 layout.
const p81Base80Rebuild=p6RebuildEnvironmentBuffers;
p6RebuildEnvironmentBuffers=function(){
 if(p80Compat())return p81Base80Rebuild();
 const src=E.textured,out=[],out1=[],crowd=T.id==='laguna'?E.rects.crowd1:null,oneT=p80CullMap(P80_CULL&&P80_CULL.textured,P80_CULL&&P80_CULL.textured_rev);
 for(let off=0;off+32<src.length;off+=33){const tri=src.slice(off,off+33),side=oneT.get(off/33);
  if(crowd&&Math.abs(tri[5]-crowd[0])<1e-7&&Math.abs(tri[6]-crowd[1])<1e-7&&Math.abs(tri[7]-crowd[2])<1e-7)for(const b of [0,11,22])tri[b+1]+=.055;
  if(side)p80PushTri(out1,tri,0,11,side<0);else for(let k=0;k<33;k++)out.push(tri[k]);}
 p81Upload(p6EnvNormalBuffer,new Float32Array(out),1);p6EnvNormalCount=out.length/11;
 p81Upload(p80EnvTex1Buffer,new Float32Array(out1),1);p80EnvTex1Count=out1.length/11;
 gl.bindBuffer(gl.ARRAY_BUFFER,p6EnvTextBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(0),gl.STATIC_DRAW);p6EnvTextCount=0;
 const C=E.colored,oneC=p80CullMap(P80_CULL&&P80_CULL.colored,P80_CULL&&P80_CULL.colored_rev),c2=[],c1=[];
 for(let t=0;(t+1)*18<=C.length;t++){const side=oneC.get(t);if(side)p80PushTri(c1,C,t,6,side<0);else for(let k=t*18;k<t*18+18;k++)c2.push(C[k]);}
 gl.bindBuffer(gl.ARRAY_BUFFER,p80EnvCol2Buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c2),gl.STATIC_DRAW);p80EnvCol2Count=c2.length/6;
 gl.bindBuffer(gl.ARRAY_BUFFER,p80EnvCol1Buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(c1),gl.STATIC_DRAW);p80EnvCol1Count=c1.length/6;};
if(!p80Compat()){p6RebuildEnvironmentBuffers();p81UploadGround();p81UploadTerrain();
 p81Converted.add(spriteBuffer);p81Converted.add(horizonBuffer);}
const p81BaseSpriteMesh=spriteMesh;spriteMesh=function(eye){const a=p81BaseSpriteMesh(eye);return p80Compat()?a:p81Convert(a,1);};
const p81BaseHorizonMesh=p80HorizonMesh;p80HorizonMesh=function(cx,cz){const a=p81BaseHorizonMesh(cx,cz);return(a&&!p80Compat())?p81Convert(a,1):a;};
const p81BaseOldHorizon=horizonMesh;horizonMesh=function(cx,cz){const a=p81BaseOldHorizon(cx,cz);return p80Compat()?a:p81Convert(a,0);};

// Re-pack the atlas: every texture gets a 16 px aligned slot filled with its
// own image wrapped around (so tiling and filtering are seamless), and fully
// transparent texels take their neighbours' colour (no dark mip fringes).
function p81RepackAtlas(img){
 const S=img.width|0;if(!S||S!==(img.height|0))return null;
 const src=document.createElement('canvas');src.width=S;src.height=S;const sc=src.getContext&&src.getContext('2d',{willReadFrequently:true});if(!sc||typeof sc.getImageData!=='function')return null;
 sc.drawImage(img,0,0);const sd=sc.getImageData(0,0,S,S).data;
 const items=Object.keys(E.dims).filter(n=>E.rects[n]).map(n=>{const [w,h]=E.dims[n],r=E.rects[n];return{n,w:w|0,h:h|0,x0:Math.round(r[0]*S),y0:Math.round(r[1]*S)};}).filter(it=>it.w>0&&it.h>0).sort((a,b)=>b.h-a.h||b.w-a.w||(a.n<b.n?-1:1));
 const P=P81_PAD,A=1<<P81_MAXLOD;let x=0,y=0,rowh=0;
 for(const it of items){it.sw=Math.ceil((it.w+2*P)/A)*A;it.sh=Math.ceil((it.h+2*P)/A)*A;if(x+it.sw>S){x=0;y+=rowh;rowh=0;}if(y+it.sh>S)return null;it.sx=x;it.sy=y;x+=it.sw;rowh=Math.max(rowh,it.sh);}
 const od=new Uint8Array(S*S*4);
 const s32=new Uint32Array(sd.buffer,sd.byteOffset,S*S),o32=new Uint32Array(od.buffer,od.byteOffset,S*S);
 const billboards=new Set((E.sprites||[]).map(q=>q[5]));   // camera-facing PMP sprites: transparent border, not wrapped
 for(const it of items){const clamp=billboards.has(it.n);let alpha=false;
  for(let dy=0;dy<it.sh;dy++){const ry=dy-P,o0=(it.sy+dy)*S+it.sx;
   if(clamp&&(ry<0||ry>=it.h)){o32.fill(0,o0,o0+it.sw);continue;}
   const srow=(it.y0+(((ry%it.h)+it.h)%it.h))*S+it.x0;
   for(let dx=0;dx<it.sw;){const rx=dx-P,sx=((rx%it.w)+it.w)%it.w,run=Math.min(it.w-sx,it.sw-dx);
    if(clamp&&(rx<0||rx>=it.w)){const n=rx<0?Math.min(-rx,it.sw-dx):it.sw-dx;o32.fill(0,o0+dx,o0+dx+n);dx+=n;continue;}
    o32.set(s32.subarray(srow+sx,srow+sx+run),o0+dx);dx+=run;}}
  for(let dy=0;dy<it.h&&!alpha;dy++){const r0=(it.y0+dy)*S+it.x0;for(let dx=0;dx<it.w;dx++)if(sd[(r0+dx)*4+3]<255){alpha=true;break;}}
  if(alpha||clamp)p81Bleed(od,S,it.sx,it.sy,it.sw,it.sh);}
 const rects={};for(const it of items)rects[it.n]=[(it.sx+P)/S,(it.sy+P)/S,it.w/S,it.h/S];
 return{pixels:od,rects,size:S};}
function p81Bleed(d,S,x0,y0,w,h){let todo=[];for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)if(!d[(y*S+x)*4+3])todo.push(x,y);
 for(let pass=0;pass<4&&todo.length;pass++){const fill=[],rest=[];
  for(let k=0;k<todo.length;k+=2){const x=todo[k],y=todo[k+1];let r=0,g=0,b=0,n=0;
   for(let q=0;q<4;q++){const ax=x+(q===0?-1:q===1?1:0),ay=y+(q===2?-1:q===3?1:0);if(ax<x0||ay<y0||ax>=x0+w||ay>=y0+h)continue;const j=(ay*S+ax)*4;if(d[j+3]||d[j]||d[j+1]||d[j+2]){r+=d[j];g+=d[j+1];b+=d[j+2];n++;}}
   if(n)fill.push((y*S+x)*4,r/n,g/n,b/n);else rest.push(x,y);}
  for(let k=0;k<fill.length;k+=4){d[fill[k]]=fill[k+1];d[fill[k]+1]=fill[k+2];d[fill[k]+2]=fill[k+3];}todo=rest;}}
function p81RemapRects(newRects){
 const key=r=>r.map(v=>Number(v).toFixed(6)).join(','),map=new Map();
 for(const [n,r] of Object.entries(E.rects))if(newRects[n])map.set(key(r),newRects[n]);
 const remap=a=>{for(let i=0;i+10<a.length;i+=11){const nr=map.get(key([a[i+5],a[i+6],a[i+7],a[i+8]]));if(nr){a[i+5]=nr[0];a[i+6]=nr[1];a[i+7]=nr[2];a[i+8]=nr[3];}}};
 remap(E.textured);remap(P3.ground);for(const n of Object.keys(newRects))E.rects[n]=newRects[n];}
const p81BaseAtlasOnload=atlasImg.onload;
atlasImg.onload=function(){
 let pack=null;const t0=performance.now();if(!p80Compat()){try{pack=p81RepackAtlas(atlasImg);}catch(e){pack=null;}}window.ICR2_ATLAS_REPACK_MS=Math.round(performance.now()-t0);
 if(!pack){p81BaseAtlasOnload&&p81BaseAtlasOnload.call(this);return;}
 p81RemapRects(pack.rects);p81AtlasPx=[pack.size,pack.size];
 gl.bindTexture(gl.TEXTURE_2D,atlasTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,pack.size,pack.size,0,gl.RGBA,gl.UNSIGNED_BYTE,pack.pixels);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 if(P81_GRAD){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);if(P81_EXT_ANISO)gl.texParameterf(gl.TEXTURE_2D,P81_EXT_ANISO.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(P81_EXT_ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT)||1));p81AtlasMip=true;}
 else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 p81UploadGround();p81UploadTerrain();p6RebuildEnvironmentBuffers();atlasReady=true;updateTag();};
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 8.1';
updateTag=function(){ui.tag.innerHTML=`Phase 8.1 · ${T.short_name||T.name} · ${p712IsHS()?'High-Speed race trim':'Classic handling'}<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?(p81AtlasMip?'textures ready (mipmapped)':'textures ready'):'loading textures…'} · ${soundOn?'sound ON':'sound OFF'}`;};
updateTag();
// -----------------------------------------------------------------------------


// ---- Phase 8.2 lap-line debounce ---------------------------------------------
// Every stock LP ends with a record lying exactly on record 0, so right at the
// line the nearest record can flip N-1 -> 0 -> N-1 -> 1. The base counter adds
// a lap on every "last 18% -> first 18%" transition, which counted the first
// crossing twice at Surfers Paradise (a 3-lap race ended after two laps). The
// base already treats a lap shorter than 5 s as not a lap (no lap time is
// recorded), so for 5 s after a lap is counted, or after the start, a jump back
// over the line no longer arms the counter. Driving backwards over the line
// and forwards again no longer counts a lap either. Off in 7.11 compat mode.
const p82BaseFixedUpdate=fixedUpdate;
fixedUpdate=function(dt){
 if(!p80Compat()&&raceStarted&&lapClock<5&&lastIdx>N*.5)lastIdx=0;
 p82BaseFixedUpdate(dt);
};
// ---- Phase 8.2 AI pit stops ----------------------------------------------------
// Since the 7.0 generic pit layer, AI cars in 10-lap races switched to pit mode
// but almost never completed a stop (Detroit 1 of 7, Long Beach 0 of 7, in 7.11
// too). They held the 60 mph limit until 6 LP records (19.7 m) from the stall,
// then braked at 13.5 m/s^2, which needs 26.6 m, so they rolled through the
// stall and lapped at pit speed for the rest of the race; a car stopped short
// of the stall would also have waited forever (desired speed 0 inside 6
// records). Pitting cars now brake on a profile that ends at the stall and stop
// if within 1.15 records either side of it.
// AI cars also followed any car within 7 records ahead regardless of lane, so a
// car racing down the straight queued behind a pitting car. The pit lane and
// the track are now separate lanes for the following/passing logic: a car
// counts as in the pit lane once it is more than halfway onto the PIT.LP line
// (the player: drivingStatus().pit). Off in 7.11 compat mode.
const P82_STALL_DECEL=8.0,p82BaseUpdateAI=updateAI,p82BaseVehicleList=p5VehicleList;let p82PlayerInPit=false;
function p82InPitLane(o){return !!o.pitting&&p7PitBlendAt(Math.floor(o.prog))>.5;}
p5VehicleList=function(except){
 if(p80Compat()||!except)return p82BaseVehicleList(except);
 const lane=p82InPitLane(except),out=[];
 for(const a of opponents){if(a===except||p82InPitLane(a)!==lane)continue;out.push({score:a.completed*N+a.prog,speed:a.speed,pass:a.passBlend||0,finished:a.finished});}
 if(!playerFinished&&p82PlayerInPit===lane)out.push({score:p5PlayerScore(),speed:Math.hypot(car.vx,car.vy),pass:0,finished:false,player:true});
 return out;
};
updateAI=function(dt){
 if(p80Compat())return p82BaseUpdateAI(dt);
 if(!raceStarted&&settings.startMode==='standing')return;
 p82PlayerInPit=!!drivingStatus(car.x,car.y).pit;
 const entry=P7_PIT.entry_index??Math.floor(N*.91);
 for(let i=0;i<opponents.length;i++){
  const o=opponents[i];
  if(o.finished){o.passTarget=0;o.passBlend+=(0-o.passBlend)*Math.min(1,dt*1.5);o.speed+=(Math.min(25,o.speed)-o.speed)*Math.min(1,dt*.8);o.prog=(o.prog+o.speed*dt/T.lp_resolution_m)%N;continue;}
  if(o.launchDelay>0){o.launchDelay=Math.max(0,o.launchDelay-dt);continue;}
  if(o.pitService>0){o.pitService=Math.max(0,o.pitService-dt);o.speed=0;o.prog=o.pitStall;if(o.pitService===0){o.pitServiced=true;o.pitDoneScore=o.completed*N+o.prog;p6SoundCue(430,.05,.018);}continue;}
  o.gridLane=(o.gridLane||0)*Math.exp(-dt*.75);o.passHold=Math.max(0,(o.passHold||0)-dt);
  let idx=(Math.floor(o.prog)%N+N)%N;
  const entryGap=p7ForwardGap(idx,entry);
  if(p6Setup.aiPitStrategy==='auto'&&settings.raceLaps>=10&&!o.pitting&&!o.pitServiced&&o.completed>=o.pitLap&&entryGap<28){o.pitting=true;o.passTarget=0;o.passHold=0;}
  const baseMph=Math.min(p5LineSpeed(o,idx)*o.skill*(settings.aiPace/100),settings.aiStraightCap),baseTarget=baseMph*.44704;
  o.passTarget=o.pitting?0:p5ChoosePass(o,i,baseTarget);o.passBlend+=(o.passTarget-o.passBlend)*Math.min(1,dt*(o.pitting?1.8:.95));
  let desired=baseTarget,score=o.completed*N+o.prog;if(o.pitting)desired=Math.min(desired,P6_PIT_LIMIT_MPH*.44704);
  for(const v of p5VehicleList(o)){const gap=v.score-score;if(gap>0&&gap<7&&Math.abs((v.pass||0)-o.passBlend)<.55)desired=Math.min(desired,v.speed*.972);}
  if(o.pitting&&!o.pitServiced){
   let gap=p7ForwardGap(o.prog,o.pitStall);if(gap>N-2)gap-=N;          // signed: just past the stall is negative
   desired=Math.min(desired,Math.sqrt(2*P82_STALL_DECEL*Math.max(0,gap*T.lp_resolution_m)));
   if(Math.abs(gap)<1.15&&o.speed<1.2){o.prog=o.pitStall;o.speed=0;o.pitService=4.1+(i%3)*.25;continue;}
  }
  const delta=desired-o.speed,launchBoost=(settings.startMode==='standing'&&raceClock<5.5)?1.32:1,maxAccel=p712AIAccel(o.speed)*(o.launchTrait||1)*launchBoost,maxBrake=13.5;
  o.speed+=Math.max(-maxBrake*dt,Math.min(maxAccel*dt,delta));o.speed=Math.max(0,o.speed);
  o.prog+=o.speed*dt/T.lp_resolution_m;
  if(o.prog>=N){o.prog-=N;o.completed++;}
  idx=(Math.floor(o.prog)%N+N)%N;
  if(o.pitting&&o.pitServiced&&o.pitDoneScore!=null&&(o.completed*N+o.prog)-o.pitDoneScore>25&&p7PitBlendAt(idx)<.04){o.pitting=false;o.passTarget=0;o.passBlend=0;}
  if(o.completed>=settings.raceLaps){o.finished=true;o.finishTime=raceClock;o.passTarget=0;}
 }
};
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 8.2';
updateTag=function(){ui.tag.innerHTML=`Phase 8.2 · ${T.short_name||T.name} · ${p712IsHS()?'High-Speed race trim':'Classic handling'}<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?(p81AtlasMip?'textures ready (mipmapped)':'textures ready'):'loading textures…'} · ${soundOn?'sound ON':'sound OFF'}`;};
updateTag();
// -----------------------------------------------------------------------------
// ---- Phase 8.3 all fifteen circuits ---------------------------------------------
// Phoenix, Nazareth and New England are content only (generic importer); the
// engine change is the version label.
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 8.3';
updateTag=function(){ui.tag.innerHTML=`Phase 8.3 · ${T.short_name||T.name} · ${p712IsHS()?'High-Speed race trim':'Classic handling'}<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?(p81AtlasMip?'textures ready (mipmapped)':'textures ready'):'loading textures…'} · ${soundOn?'sound ON':'sound OFF'}`;};
updateTag();
// -----------------------------------------------------------------------------
// ---- Phase 8.4 the 1995 field -----------------------------------------------
// The stock CARS95 field (tools/build_field.py -> field_data.js): the 1995 roster
// with per-driver pace from DRIVERS2.TXT, the full-detail stock car in every
// livery with its own helmet, stock field sizes and the stock pit stall layout.
// Everything here is off in 7.11 compat mode (the 8-car field of 7.11 remains).
const P84F=window.ICR2_FIELD||null,P84_STOCK=(window.ICR2_STOCK_SETUPS||{})[T.id]||{};
function p84On(){return !p80Compat()&&!!P84F;}

// -- roster ------------------------------------------------------------------
// AI order: the driver file's order without the player's #95; the two "Papyrus
// Racing" entries (#95 player identity, #100 spare) go last. The first seven are
// the 7.x field (Johansson ... Fittipaldi).
const P84_DRIVERS=(()=>{if(!P84F)return[];const r=P84F.roster.filter(d=>d.number!==P84F.player.number);
 const order=r.filter(d=>d.team!=='Papyrus Racing').concat(r.filter(d=>d.team==='Papyrus Racing'));
 const count={};for(const d of order)count[d.short]=(count[d.short]||0)+1;
 const mid=a=>(a[0]+a[1])/2,rate=(d,u)=>{const v=(a,t)=>a[0]+(a[1]-a[0])*t;return .5*(v(d.power,u[0])+v(d.traction,u[1]))-.5*(v(d.drag,u[2])-500);};
 const mids=order.map(d=>rate(d,[.5,.5,.5])),hi=Math.max(...mids),lo=Math.min(...mids);
 return order.map(d=>({...d,label:count[d.short]>1?d.name.split(' ')[0][0]+'. '+d.short:d.short,rate:u=>(rate(d,u)-lo)/Math.max(1,hi-lo),agg:Math.max(0,Math.min(1,(mid(d.aggression)-125)/874))}));
})();
let p84RaceSeq=0;
function p84Rand(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function p84Hash(str){let h=2166136261;for(const ch of str)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;}
// Pace: 0.955 (weakest stock entry) .. 1.0 (best), from power/traction/drag drawn
// within each driver's stock range (middle half of it) for every race.
const P84_SKILL_MIN=.955;
function p84FieldSize(){const st=Number(P84_STOCK.field_size)||32,v=settings.fieldSize||'stock';return Math.max(2,Math.min(32,v==='stock'?st:Math.min(st,Number(v)||8)));}
// Back = the left lane of the last row (record 2, lane -1.28), where 7.x put the player.
function p84GridSlot(M){const g=settings.gridSlot||'back';return g==='front'?0:g==='middle'?2*Math.floor((M-1)/4):(M%2===0?M-2:M-1);}

// -- pit lane: the stock PIT.LP span and stall layout --------------------------
// The 7.0 blend (separation / its lap maximum) left pitting cars 15-25% short of
// the pit line and jumped them sideways at the entry. Pitting cars now follow
// PIT.LP from where it leaves the racing line (separation < 2.5 m) to where it
// rejoins, with short ramps; where the lines never meet, over 30 records.
const P84_PIT=(()=>{if(!P5_PIT||P5_PIT.length!==N||P7_PIT.entry_index==null||P7_PIT.exit_index==null)return null;
 const sep=i=>{const a=race[(i%N+N)%N],b=P5_PIT[(i%N+N)%N];return Math.hypot(a[0]-b[0],a[1]-b[1]);},e=P7_PIT.entry_index,x=P7_PIT.exit_index;
 let s=e,k=0;while(k<160&&sep(s-1)>2.5){s--;k++;}const sRamp=k>=160?30:6;if(k>=160)s=e-30;
 let t=x,j=0;while(j<160&&sep(t+1)>2.5){t++;j++;}const tRamp=j>=160?30:6;if(j>=160)t=x+30;
 const start=(s%N+N)%N,end=(t%N+N)%N,len=((end-start)%N+N)%N,B=new Float32Array(N);
 const ss=v=>v<=0?0:v>=1?1:v*v*(3-2*v);
 for(let q=0;q<=len;q++){const i=(start+q)%N;B[i]=Math.min(ss(q/sRamp),ss((len-q)/tRamp));}
 // speed zone and stalls
 const zs=P7_PIT.speed_start_index??e,ze=P7_PIT.speed_end_index??x;
 const ps=P84_STOCK.pit_stalls||{},L=Number(T.track_length_papy)||N*65536,stalls=[];
 if(ps.count>1){const span=((ps.last_dlong-ps.first_dlong)%L+L)%L,step=span/(ps.count-1);
  for(let q=0;q<40;q++){const d=((ps.first_dlong+q*step)%L+L)%L;stalls.push(d/65536);}}
 return{start,end,blend:B,zs,ze,stalls,count:ps.count||0};
})();
function p84InSpan(i,a,b){i=(i%N+N)%N;return a<=b?(i>=a&&i<=b):(i>=a||i<=b);}
function p84PitBlendAt(idx){if(!P84_PIT)return p7PitBlendAt(idx);const f=((idx%N)+N)%N,i=Math.floor(f),t=f-i,B=P84_PIT.blend;return B[i]+(B[(i+1)%N]-B[i])*t;}   // interpolated between records
const p84BasePitBlend=p6AIPitBlend,p84BaseLineSpeed=p5LineSpeed,p84BasePathPoint=p5PathPoint;
// Path: the blend at the exact progress (the 6.0 version stepped it per record).
p5PathPoint=function(o,p){if(!p84On()||!P84_PIT)return p84BasePathPoint(o,p);const base=p6BasePathPoint(o,p),b=o.pitting?p84PitBlendAt(p):0;
 if(b>0&&P5_PIT.length===N){const q=lerpPath(P5_PIT,p);return[p5Mix(base[0],q[0],b),p5Mix(base[1],q[1],b),p5Mix(base[2]||0,q[2]||0,b)];}return base;};
p6AIPitBlend=function(o,idx){if(!p84On()||!P84_PIT)return p84BasePitBlend(o,idx);return o.pitting?p84PitBlendAt(idx):0;};
// PIT.LP speeds while following the pit line; the 60 mph limit only in the zone.
p5LineSpeed=function(o,idx){if(!p84On()||!P84_PIT)return p84BaseLineSpeed(o,idx);const base=p6BaseLineSpeed(o,idx),b=p6AIPitBlend(o,idx);
 if(b>0&&P5_LINES.pit?.[idx]){const pit=P5_LINES.pit[idx][3],lim=p84InSpan(idx,P84_PIT.zs,P84_PIT.ze)?Math.min(pit,P6_PIT_LIMIT_MPH):pit;return p5Mix(base,lim,b);}return base;};
const p84BaseInPitLane=p82InPitLane;
p82InPitLane=function(o){if(!p84On()||!P84_PIT)return p84BaseInPitLane(o);return !!o.pitting&&p84PitBlendAt(o.prog)>.5;};

// -- building the field ----------------------------------------------------------
// Each grid row is two cars 3.2 m apart, centred on the racing line where that
// leaves both cars on the main paved corridor, out of the pit lane and at least
// 1.6 m from any wall. Where the line runs close to a wall (the ovals' start
// lines), the row moves sideways by the smallest shift that fits; the cars then
// drift onto the line after the start as before.
const P84_GRID_HALF=1.6;
function p84GridRow(idx){const i=(idx%N+N)%N,f=trackFrame(i),c=center[i],r=Number(S[i].dlat_m)||0,mc=S[i].main_corridor;
 const lo=mc&&mc.length===2?Math.min(mc[0],mc[1]):-Infinity,hi=mc&&mc.length===2?Math.max(mc[0],mc[1]):Infinity;
 const ok=lat=>{if(lat<lo+1.3||lat>hi-1.3)return false;const x=c[0]+f.nx*lat,y=c[1]+f.ny*lat;if(p712WallClearance(x,y)<1.6)return false;const st=drivingStatus(x,y);return st.inside&&!st.pit;};
 for(const w of [P84_GRID_HALF,1.28])for(let k=0;k<=48;k++){const sh=(k%2?1:-1)*Math.ceil(k/2)*.25;if(ok(r+sh-w)&&ok(r+sh+w))return{shift:sh,w};}
 return{shift:0,w:1.28};}
const p84BaseGrid=p5GridOpponents;
p5GridOpponents=function(startSpeed){
 if(!p84On())return p84BaseGrid(startSpeed);
 const M=p84FieldSize(),slot=p84GridSlot(M),rows=Math.ceil(M/2),front=2+2*(rows-1),rnd=p84Rand(p84Hash(T.id)^Math.imul(++p84RaceSeq,2654435761));
 const pool=P84_DRIVERS.slice(0,M-1).map(d=>{const u=[.25+.5*rnd(),.25+.5*rnd(),.25+.5*rnd()];return{d,skill:P84_SKILL_MIN+(1-P84_SKILL_MIN)*Math.max(0,Math.min(1,d.rate(u)))};});
 pool.sort((a,b)=>b.skill-a.skill);                       // until qualifying: fastest at the front
 opponents=[];let k=0,g0=null;
 for(let p=0;p<M;p++){
  const row=Math.floor(p/2),idx=front-2*row,g=p%2===0?p84GridRow(idx):g0,lane=g.shift+(p%2===0?-g.w:g.w);g0=g;
  if(p===slot){p84PlayerGrid={idx,lane};continue;}
  const {d,skill}=pool[k++],lv=P84F.liveries[d.livery];
  opponents.push({name:d.label,car:d.car,number:d.number,team:d.team,livery:d.livery,color:lv?lv.colors.slice(3,6):[.8,.2,.1],prog:idx,completed:0,speed:startSpeed,gridLane:lane,skill,aggression:d.agg,
   launchDelay:settings.startMode==='standing'?(.06+(p%2)*.045+row*.018):0,passTarget:0,passBlend:0,passHold:0,finished:false,finishTime:Infinity});
 }
};
let p84PlayerGrid=null;
const p84BaseReset=reset;
reset=function(){
 p84PlayerGrid=null;p84BaseReset();
 if(!p84On())return;
 // The player's grid slot, in the same frame as the AI grid (racing line +
 // lane offset; 7.x placed the player from the centreline, beside the grid).
 if(p84PlayerGrid){const g=p84PlayerGrid,i=((g.idx%N)+N)%N,p=race[i],q=race[(i+4)%N],f=trackFrame(i),h=Math.atan2(q[1]-p[1],q[0]-p[0]),sp=Math.hypot(car.vx,car.vy);
  car={x:p[0]+f.nx*g.lane,y:p[1]+f.ny*g.lane,heading:h,vx:Math.cos(h)*sp,vy:Math.sin(h)*sp,steer:0,wheelSpin:0};lastIdx=i;
  safeState={x:car.x,y:car.y,heading:car.heading,vx:car.vx,vy:car.vy};if(typeof p74ResetCameraPlane==='function')p74ResetCameraPlane();}
 // stock stalls: the player's is the first, AI take the next ones in grid order
 if(P84_PIT&&P84_PIT.stalls.length){const n=P84_PIT.stalls.length,c=Math.max(2,P84_PIT.count);
  // More cars than stock stalls (Michigan: 32 cars, 29 stalls): the extra cars share
  // a stock stall with an earlier car and stop on a different lap.
  for(let i=0;i<opponents.length;i++){const q=i+1<c?i+1:1+(i%(c-1)),o=opponents[i];
   o.pitStall=P84_PIT.stalls[q%n]%N;o.pitLap=3+(i%5);o.pitDoneScore=null;
   if(q!==i+1&&opponents[q-1]&&opponents[q-1].pitLap===o.pitLap)o.pitLap+=1;}}
};

// -- AI update: 8.2 version with the stock pit span and speed zone ------------------
// Also (8.4):
//  * The AI sees where the player really is. 7.x gave the player pass value 0
//    (always on the racing line), so with the player alongside on the grid or in
//    traffic, AI cars drove into the player: 45 contacts in 30 standing starts
//    from the back and middle of the grid. AI cars now brake for the player
//    ahead in their own path (up to 300 m) with their real braking (13.5 m/s²,
//    6 m margin): AI cars brake late for corners, so they used to arrive at
//    a slow corner far faster than a player already braking there),
//    do not move sideways towards the player while alongside (grid lane, pass
//    line), and do not choose a pass on the player's side.
//  * Progress over the last LP records. Every stock LP ends with a record on
//    top of record 0, and the record before it is short (0.4-2.7 m), so AI cars
//    stood still for one record at every crossing of the line (a visible hitch)
//    and ran 3-6 m more than a lap. They now cross the short record at their
//    speed and skip the duplicate.
const p84BaseUpdateAI=updateAI;
const P84_LAST=Math.max(.02,Math.min(1,(Number(T.track_length_papy)||N*65536)/65536-(N-2)));
function p84Advance(p,dist,res){let i=Math.floor(p);if(i>=N-1)return N;
 while(dist>0){const seg=(i===N-2?P84_LAST:1)*res,rem=(i+1-p)*seg;if(dist<rem)return p+dist/seg;dist-=rem;p=i+1;i++;if(i>=N-1)return N;}return p;}
// Lateral offsets (m, + = left of travel) of PASS1/PASS2 from RACE at each record.
const P84_OFF=(()=>{const o1=new Float32Array(N),o2=new Float32Array(N);for(let i=0;i<N;i++){const a=race[(i-1+N)%N],b=race[(i+1)%N],r=race[i];let tx=b[0]-a[0],ty=b[1]-a[1];const d=Math.hypot(tx,ty)||1;tx/=d;ty/=d;
 if(P5_PASS1.length===N)o1[i]=-(P5_PASS1[i][0]-r[0])*ty+(P5_PASS1[i][1]-r[1])*tx;if(P5_PASS2.length===N)o2[i]=-(P5_PASS2[i][0]-r[0])*ty+(P5_PASS2[i][1]-r[1])*tx;}return{o1,o2};})();
function p84BlendLat(b,idx){return b>0?b*P84_OFF.o1[idx]:-b*P84_OFF.o2[idx];}
// The player relative to an AI car (its heading frame): lon ahead, lat to the left.
function p84PlayerRel(o){const q=aiPose(o),tx=Math.cos(q.h),ty=Math.sin(q.h),rx=car.x-q.x,ry=car.y-q.y;return{lon:rx*tx+ry*ty,lat:-rx*ty+ry*tx};}
// Where the player is across the track at their own record: offset from the
// racing line (m, + = left) and speed along it. An AI car's path there is its
// pass-line blend plus grid lane, so paths that converge further up the road
// are seen early (a player moving across in front of a faster car).
let p84PScore=0,p84InAI=false,p84P=null;
function p84PlayerOnLine(){const pi=((p84PScore%N)+N)%N,a=race[(pi-1+N)%N],b=race[(pi+1)%N],r=race[pi];let tx=b[0]-a[0],ty=b[1]-a[1];const d=Math.hypot(tx,ty)||1;tx/=d;ty/=d;
 return{pi,lat:-(car.x-r[0])*ty+(car.y-r[1])*tx,v:Math.max(0,car.vx*tx+car.vy*ty)};}
// The player's race score (a nearest-record search) once per AI update instead
// of twice per AI car.
const p84BasePlayerScore=p5PlayerScore;
p5PlayerScore=function(){return p84InAI?p84PScore:p84BasePlayerScore();};
updateAI=function(dt){
 if(!p84On()||!P84_PIT)return p84BaseUpdateAI(dt);
 if(!raceStarted&&settings.startMode==='standing')return;
 p82PlayerInPit=!!drivingStatus(car.x,car.y).pit;
 const lim=P6_PIT_LIMIT_MPH*.44704,res=T.lp_resolution_m;p84PScore=p84BasePlayerScore();p84P=p84PlayerOnLine();p84InAI=true;try{p84UpdateAIBody(dt,lim,res);}finally{p84InAI=false;}
};
function p84UpdateAIBody(dt,lim,res){
 for(let i=0;i<opponents.length;i++){
  const o=opponents[i];o._near=null;
  if(o.finished){o.passTarget=0;o.passBlend+=(0-o.passBlend)*Math.min(1,dt*1.5);o.speed+=(Math.min(25,o.speed)-o.speed)*Math.min(1,dt*.8);o.prog=p84Advance(o.prog,o.speed*dt,res)%N;continue;}
  if(o.launchDelay>0){o.launchDelay=Math.max(0,o.launchDelay-dt);continue;}
  if(o.pitService>0){o.pitService=Math.max(0,o.pitService-dt);o.speed=0;o.prog=o.pitStall;if(o.pitService===0){o.pitServiced=true;o.pitDoneScore=o.completed*N+o.prog;p6SoundCue(430,.05,.018);}continue;}
  let idx=(Math.floor(o.prog)%N+N)%N;
  const score=o.completed*N+o.prog;
  // The player, when within 16 records behind or 90 ahead (an AI car braking at
  // 13.5 m/s² from 200 mph needs about 280 m) and in the same lane (track / pit lane).
  // Distance along the lap, either way round (a car lapping the player sees them ahead).
  let ds=(((p84PScore-score)%N)+N)%N;if(ds>N/2)ds-=N;let near=null;
  if(!playerFinished&&p82PlayerInPit===p82InPitLane(o)&&ds>-16&&ds<90){const P=p84P,g=o.gridLane||0,aiLat=p84BlendLat(o.passBlend,P.pi)+g;
   // In this car's path: its line (pass blend + grid lane) passes within 2.4 m
   // of the player's offset anywhere from the player to 20 records beyond, so a
   // pass line that merges into the player's line in the next corner counts.
   let gap=Infinity;for(let k=0;k<=20;k+=2){const j=(P.pi+k)%N;gap=Math.min(gap,Math.abs(p84BlendLat(o.passBlend,j)+g-P.lat));}
   near={lonM:ds*res,aiLat,pLat:P.lat,v:P.v,inPath:gap<2.4,rel:Math.abs(ds)<4?p84PlayerRel(o):null};}
  o._near=near;
  const beside=!!(near&&near.rel&&Math.abs(near.rel.lon)<6.5&&Math.abs(near.rel.lat)<3.8);
  const g0=o.gridLane||0,g1=g0*Math.exp(-dt*.75);if(!(beside&&(g1-g0)*near.rel.lat>0))o.gridLane=g1;   // hold the grid lane while the player is alongside on that side
  o.passHold=Math.max(0,(o.passHold||0)-dt);
  const startGap=p7ForwardGap(idx,P84_PIT.start);
  if(p6Setup.aiPitStrategy==='auto'&&settings.raceLaps>=10&&!o.pitting&&!o.pitServiced&&o.completed>=o.pitLap&&startGap<12){o.pitting=true;o.passTarget=0;o.passHold=0;}
  const baseMph=Math.min(p5LineSpeed(o,idx)*o.skill*(settings.aiPace/100),settings.aiStraightCap),baseTarget=baseMph*.44704;
  o.passTarget=o.pitting?0:p5ChoosePass(o,i,baseTarget);
  const nb=o.passBlend+(o.passTarget-o.passBlend)*Math.min(1,dt*(o.pitting?1.8:.95));
  if(!(beside&&!o.pitting&&(p84BlendLat(nb,idx)-p84BlendLat(o.passBlend,idx))*near.rel.lat>0))o.passBlend=nb;     // no sideways move into the player
  let desired=baseTarget;
  if(o.pitting){if(p84InSpan(idx,P84_PIT.zs,P84_PIT.ze))desired=Math.min(desired,lim);
   else if(!o.pitServiced){const dz=p7ForwardGap(o.prog,P84_PIT.zs)*res;if(dz<400)desired=Math.min(desired,Math.sqrt(lim*lim+2*9*dz));}}
  for(const v of p5VehicleList(o)){if(v.player)continue;const gap=v.score-score;if(gap>0&&gap<7&&Math.abs((v.pass||0)-o.passBlend)<.55)desired=Math.min(desired,v.speed*.972);}
  let forPlayer=false;
  // (an AI car already overlapping the player, less than 1.5 records behind,
  // only brakes when directly behind; otherwise it may complete its pass)
  if(near&&(ds>1.5?near.inPath:(ds>0&&Math.abs(near.pLat-near.aiLat)<2.0))){const v=Math.sqrt(near.v*near.v+2*13.5*Math.max(0,near.lonM-7));if(v<desired){desired=v;forPlayer=true;}}   // the player ahead in this car's path
  if(o.pitting&&!o.pitServiced){
   let gap=p7ForwardGap(o.prog,o.pitStall);if(gap>N-2)gap-=N;
   desired=Math.min(desired,Math.sqrt(2*P82_STALL_DECEL*Math.max(0,gap*res)));
   if(Math.abs(gap)<1.15&&o.speed<1.2){o.prog=o.pitStall;o.speed=0;o.pitService=4.1+(i%3)*.25;continue;}
  }
  // AI cars brake at 13.5 m/s² for their own targets (the 7.x model the AI
  // pace is tuned to; the stock speed profile falls faster, so they reach slow
  // corners fast), but up to 30 m/s² (about 3 g, an IndyCar's real braking)
  // to avoid running into the player.
  const delta=desired-o.speed,launchBoost=(settings.startMode==='standing'&&raceClock<5.5)?1.32:1,maxAccel=p712AIAccel(o.speed)*(o.launchTrait||1)*launchBoost,maxBrake=forPlayer?30:13.5;
  o.speed+=Math.max(-maxBrake*dt,Math.min(maxAccel*dt,delta));o.speed=Math.max(0,o.speed);
  o.prog=p84Advance(o.prog,o.speed*dt,res);
  if(o.prog>=N){o.prog-=N;o.completed++;}
  idx=(Math.floor(o.prog)%N+N)%N;
  if(o.pitting&&o.pitServiced&&o.pitDoneScore!=null&&(o.completed*N+o.prog)-o.pitDoneScore>25&&p84PitBlendAt(o.prog)<=1e-4){o.pitting=false;o.passTarget=0;o.passBlend=0;}
  if(o.completed>=settings.raceLaps){o.finished=true;o.finishTime=raceClock;o.passTarget=0;}
 }
}
// Aggression (stock DRIVERS2 range): aggressive drivers go for a pass with a
// smaller speed advantage (0.55 .. 1.65 m/s; the 7.x field used 1.1 throughout).
// A pass side is blocked by an AI car whose pass value has that sign (7.x rule),
// or by the player: within 45 m, the player within 2.6 m of that pass line;
// within 12 m, the player anywhere on the way across to it.
const p84BaseChoosePass=p5ChoosePass;
p5ChoosePass=function(o,i,baseTarget){
 if(!p84On()||o.aggression==null)return p84BaseChoosePass(o,i,baseTarget);
 if(o.finished)return 0;
 const score=o.completed*N+o.prog,vehicles=p5VehicleList(o);let lead=null;
 for(const v of vehicles){const gap=v.score-score;if(gap>1.0&&gap<15&&(!lead||gap<lead.gap))lead={...v,gap};}
 if(o.passHold>0)return o.passTarget;
 if(lead&&baseTarget>lead.speed+1.65-1.1*o.aggression){
  let pref=(i%2===0)?1:-1;const near=o._near;
  const playerBlocks=side=>{if(!near||Math.abs(near.lonM)>45)return false;const cur=near.aiLat,tgt=p84BlendLat(side,p84P.pi)+(o.gridLane||0),pl=near.pLat;if(Math.abs(pl-tgt)<2.6)return true;
   if(Math.abs(near.lonM)<12){const s=Math.sign(tgt-cur)||1,d=(pl-cur)*s;return d>-1&&d<Math.abs(tgt-cur)+2.6;}return false;};
  const blocked=side=>vehicles.some(v=>{if(v.player)return false;const gap=Math.abs(v.score-score);return gap<8&&Math.sign(v.pass)===side;})||playerBlocks(side);
  if(blocked(pref)&&!blocked(-pref))pref=-pref;
  if(!blocked(pref)){o.passHold=1.6;return pref;}
 }
 return 0;
};

// -- drawing: stock car, liveries, helmets (GPU transforms) ---------------------
const P84G=(()=>{if(!P84F)return null;try{
 const S=P84F.slots,colP=program(
`attribute vec3 p;attribute vec3 c;attribute float s;uniform mat4 vp;uniform mat4 m;uniform vec3 pal[${S}];varying vec3 col;varying float depth;void main(){col=c;if(s>=0.0)col=pal[int(s+0.5)];vec4 q=vp*(m*vec4(p,1.0));gl_Position=q;depth=q.w;}`,
`precision mediump float;varying vec3 col;varying float depth;void main(){float fog=smoothstep(450.0,1800.0,depth);gl_FragColor=vec4(mix(col,vec3(.518,.769,.941),fog*.72),1.0);}`);
 const texP=program(
`attribute vec3 p;attribute vec2 t;attribute float k;uniform mat4 vp;uniform mat4 m;uniform vec4 rect;uniform vec2 size;uniform vec4 wrect;uniform vec2 wsize;varying vec2 tuv;varying float depth;void main(){vec4 r=rect;vec2 z=size;if(k>0.5){r=wrect;z=wsize;}tuv=r.xy+clamp(t+vec2(0.5),vec2(0.5),z-vec2(0.5))/z*r.zw;vec4 q=vp*(m*vec4(p,1.0));gl_Position=q;depth=q.w;}`,
`precision mediump float;uniform sampler2D atlas;varying vec2 tuv;varying float depth;void main(){vec4 c=texture2D(atlas,tuv);if(c.a<.5)discard;float fog=smoothstep(450.0,1800.0,depth);gl_FragColor=vec4(mix(c.rgb,vec3(.518,.769,.941),fog*.72),1.0);}`);
 const sprP=program(
`attribute vec3 p;attribute vec2 t;uniform mat4 vp;varying vec2 tuv;varying float depth;void main(){tuv=t;vec4 q=vp*vec4(p,1.0);gl_Position=q;depth=q.w;}`,
`precision mediump float;uniform sampler2D atlas;varying vec2 tuv;varying float depth;void main(){vec4 c=texture2D(atlas,tuv);if(c.a<.5)discard;float fog=smoothstep(450.0,1800.0,depth);gl_FragColor=vec4(mix(c.rgb,vec3(.518,.769,.941),fog*.72),1.0);}`);
 const L=(()=>({col:{p:gl.getAttribLocation(colP,'p'),c:gl.getAttribLocation(colP,'c'),s:gl.getAttribLocation(colP,'s'),vp:gl.getUniformLocation(colP,'vp'),m:gl.getUniformLocation(colP,'m'),pal:gl.getUniformLocation(colP,'pal')},
  tex:{p:gl.getAttribLocation(texP,'p'),t:gl.getAttribLocation(texP,'t'),k:gl.getAttribLocation(texP,'k'),vp:gl.getUniformLocation(texP,'vp'),m:gl.getUniformLocation(texP,'m'),rect:gl.getUniformLocation(texP,'rect'),size:gl.getUniformLocation(texP,'size'),wrect:gl.getUniformLocation(texP,'wrect'),wsize:gl.getUniformLocation(texP,'wsize'),atlas:gl.getUniformLocation(texP,'atlas')},
  spr:{p:gl.getAttribLocation(sprP,'p'),t:gl.getAttribLocation(sprP,'t'),vp:gl.getUniformLocation(sprP,'vp'),atlas:gl.getUniformLocation(sprP,'atlas')}}))();
 const buf=a=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);return b;};
 // AI meshes: body + front wheels at their pivots; player: body + steerable wheels.
 const lods=P84F.lods.map(l=>{
  const addPivot=(arr,stride,pv)=>{const o=arr.slice();for(let i=0;i<o.length;i+=stride){o[i]+=pv[0];o[i+1]+=pv[1];o[i+2]+=pv[2];}return o;};
  let aiCol=l.colored.slice(),aiTex=l.textured.slice();for(const w of l.front){aiCol=aiCol.concat(addPivot(w.colored,7,w.pivot));aiTex=aiTex.concat(addPivot(w.textured,6,w.pivot));}
  return{from:l.from_m,ai:{col:buf(new Float32Array(aiCol)),nc:aiCol.length/7,tex:buf(new Float32Array(aiTex)),nt:aiTex.length/6},
   body:{col:buf(new Float32Array(l.colored)),nc:l.colored.length/7,tex:buf(new Float32Array(l.textured)),nt:l.textured.length/6},
   wheels:l.front.map(w=>({pivot:w.pivot,col:buf(new Float32Array(w.colored)),nc:w.colored.length/7,tex:buf(new Float32Array(w.textured)),nt:w.textured.length/6}))};});
 const pal={},rects={};for(const [k,v] of Object.entries(P84F.liveries)){pal[k]=new Float32Array(v.colors);rects[k]={rect:new Float32Array(v.rect),size:new Float32Array(v.size)};}
 const tex=gl.createTexture();let ready=false;const img=new Image();
 img.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);ready=true;};
 img.src=P84F.atlas_data;
 return{L,colP,texP,sprP,lods,pal,rects,tex,get ready(){return ready;},sprBuf:gl.createBuffer(),wheel:{rect:new Float32Array(P84F.wheel.slice(0,4)),size:new Float32Array(P84F.wheel.slice(4,6))}};
}catch(e){console.warn('8.4 car renderer unavailable, keeping the 7.x cars:',e);return null;}})();
let p84Pass=null;const p84M=new Float32Array(16),p84W=new Float32Array(16);
function p84CarMatrix(x,z,h,out){const b=p74Basis(x,z,h),e=b.surf.elev,f=b.forward,u=b.up,l=b.lateral;
 out[0]=f[0];out[1]=f[1];out[2]=f[2];out[3]=0;out[4]=u[0];out[5]=u[1];out[6]=u[2];out[7]=0;out[8]=l[0];out[9]=l[1];out[10]=l[2];out[11]=0;out[12]=x;out[13]=e;out[14]=z;out[15]=1;return out;}
function p84WheelMatrix(M,pv,steer,out){const c=Math.cos(steer),s=Math.sin(steer);
 // M * T(pivot) * Ry(steer) in the car frame [forward, up, lateral]
 for(let r=0;r<3;r++){out[r]=M[r]*c-M[8+r]*s;out[4+r]=M[4+r];out[8+r]=M[r]*s+M[8+r]*c;out[12+r]=M[12+r]+M[r]*pv[0]+M[4+r]*pv[1]+M[8+r]*pv[2];}
 out[3]=0;out[7]=0;out[11]=0;out[15]=1;return out;}
function p84Lod(d){const ls=P84G.lods;let k=0;for(let i=0;i<ls.length;i++)if(d>=ls[i].from*2.0)k=i;return ls[k];}
function p84DrawMesh(mesh,M,livery){
 const G=P84G,A=G.L,vp=p80LastVP;
 gl.useProgram(G.colP);gl.uniformMatrix4fv(A.col.vp,false,vp);gl.uniformMatrix4fv(A.col.m,false,M);gl.uniform3fv(A.col.pal,G.pal[livery]);
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.col);gl.enableVertexAttribArray(A.col.p);gl.vertexAttribPointer(A.col.p,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(A.col.c);gl.vertexAttribPointer(A.col.c,3,gl.FLOAT,false,28,12);gl.enableVertexAttribArray(A.col.s);gl.vertexAttribPointer(A.col.s,1,gl.FLOAT,false,28,24);
 gl.drawArrays(gl.TRIANGLES,0,mesh.nc);
 if(!G.ready||!mesh.nt)return;
 gl.useProgram(G.texP);gl.uniformMatrix4fv(A.tex.vp,false,vp);gl.uniformMatrix4fv(A.tex.m,false,M);const r=G.rects[livery];gl.uniform4fv(A.tex.rect,r.rect);gl.uniform2fv(A.tex.size,r.size);gl.uniform4fv(A.tex.wrect,G.wheel.rect);gl.uniform2fv(A.tex.wsize,G.wheel.size);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,G.tex);gl.uniform1i(A.tex.atlas,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.tex);gl.enableVertexAttribArray(A.tex.p);gl.vertexAttribPointer(A.tex.p,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(A.tex.t);gl.vertexAttribPointer(A.tex.t,2,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(A.tex.k);gl.vertexAttribPointer(A.tex.k,1,gl.FLOAT,false,24,20);
 gl.drawArrays(gl.TRIANGLES,0,mesh.nt);
}
// Helmet: billboard at the stock helmet point, view chosen like helmet.3do's
// plane tree (bearing of the camera in the car frame), in the driver's colours.
const P84H=P84F?P84F.helmet:null,P84_HSEC=P84H?P84H.sectors.slice().sort((a,b)=>a[0]-b[0]):[];
function p84HelmetQuad(M,livery,eye,out){
 const hp=P84H.pos,wx=M[12]+M[0]*hp[0]+M[4]*hp[1]+M[8]*hp[2],wy=M[13]+M[1]*hp[0]+M[5]*hp[1]+M[9]*hp[2],wz=M[14]+M[2]*hp[0]+M[6]*hp[1]+M[10]*hp[2];
 const dx=eye[0]-wx,dy=eye[1]-wy,dz=eye[2]-wz,fu=dx*M[0]+dy*M[1]+dz*M[2],lv=dx*M[8]+dy*M[9]+dz*M[10];
 let deg=Math.atan2(lv,fu)*180/Math.PI;if(deg<0)deg+=360;let view=P84_HSEC[P84_HSEC.length-1][1];for(const [a,v] of P84_HSEC)if(deg>=a)view=v;
 const r=P84F.liveries[livery].helmet[view],wpx=r[2]*P84F.atlas_size[0],hpx=r[3]*P84F.atlas_size[1],mpp=P84H.m_per_px,ax=P84H.anchor_px[0],ay=P84H.anchor_px[1];
 const hd=Math.hypot(dx,dz)||1,rx=dz/hd,rz=-dx/hd,up=[M[4],M[5],M[6]];
 // Image x runs towards -right on screen-facing billboards after the 8.0
 // projection mirror (as spriteMesh), so the anchor is mirrored with it.
 const xL=ax*mpp,xR=(ax-wpx)*mpp,top=ay*mpp,bot=(ay-hpx)*mpp;
 const P=(sx,sy)=>[wx+rx*sx+up[0]*sy,wy+up[1]*sy,wz+rz*sx+up[2]*sy];
 const A=P(xL,top),B=P(xR,top),C=P(xR,bot),D=P(xL,bot),u0=r[0],u1=r[0]+r[2],v0=r[1],v1=r[1]+r[3];
 for(const [q,u,v] of [[A,u0,v0],[B,u1,v0],[C,u1,v1],[A,u0,v0],[C,u1,v1],[D,u0,v1]])out.push(q[0],q[1],q[2],u,v);
}
function p84DrawCars(pass){
 const G=P84G;if(!G||!p80LastVP)return;
 const eye=pass&&pass.eye||[car.x,0,car.y],helm=[];
 const draw=(x,z,h,livery,player,steer)=>{
  const d=Math.hypot(eye[0]-x,eye[2]-z);if(d>1700)return;
  const M=p84CarMatrix(x,z,h,p84M),lod=p84Lod(d);
  if(player&&lod.wheels.length){p84DrawMesh(lod.body,M,livery);for(const w of lod.wheels){p84DrawMesh(w,p84WheelMatrix(M,w.pivot,steer,p84W),livery);}}
  else p84DrawMesh(lod.ai,M,livery);
  if(G.ready&&d<220&&lod.wheels.length)p84HelmetQuad(M,livery,eye,helm);
 };
 if(pass&&pass.showPlayer)draw(car.x,car.y,car.heading,P84F.player.livery,true,-car.steer*1.25);
 if(ghostOn)for(const o of opponents){if(!o.livery)continue;const p=aiPose(o);draw(p.x,p.y,p.h,o.livery,false,0);}
 if(helm.length){const A=G.L.spr;gl.useProgram(G.sprP);gl.uniformMatrix4fv(A.vp,false,p80LastVP);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,G.tex);gl.uniform1i(A.atlas,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,G.sprBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(helm),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(A.p);gl.vertexAttribPointer(A.p,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(A.t);gl.vertexAttribPointer(A.t,2,gl.FLOAT,false,20,12);gl.drawArrays(gl.TRIANGLES,0,helm.length/5);}
}
const p84BaseDrawWorld=p6DrawWorld;
p6DrawWorld=function(eye,vp,showPlayer=true,showGuides=true){p84Pass={eye,showPlayer};return p84BaseDrawWorld(eye,vp,showPlayer,showGuides);};
// The 7.x car texture (car_atlas.png) cannot be uploaded from a file:// page
// (Chromium/Edge: cross-origin image); it threw a page error at load and the
// 7.x player car lost its livery decals. The 8.4 cars use the embedded atlas,
// so that upload is only attempted, never fatal.
if(p84On()&&P84G){const f=carImg.onload;carImg.onload=function(){try{f();}catch(e){}};}
const p84BaseDynamicMesh=dynamicMesh,p84BaseCarColored=transformCarColored,p84BaseCarTextured=transformCarTextured,p84BaseWheels=playerWheelMesh,P84_EMPTY=new Float32Array(0);
dynamicMesh=function(){if(!p84On()||!P84G)return p84BaseDynamicMesh();p84DrawCars(p84Pass);return P84_EMPTY;};
transformCarColored=function(x,z,h){return(p84On()&&P84G)?P84_EMPTY:p84BaseCarColored(x,z,h);};
transformCarTextured=function(x,z,h){return(p84On()&&P84G)?P84_EMPTY:p84BaseCarTextured(x,z,h);};
playerWheelMesh=function(){return(p84On()&&P84G)?P84_EMPTY:p84BaseWheels();};

// -- HUD for a full field -----------------------------------------------------------
function p84Label(r){if(r.player)return'YOU';const o=opponents.find(q=>q.name===r.name);return o&&o.car?'<span class="carNo">'+o.car+'</span>'+r.name:r.name;}
function p84Window(rows){const pi=rows.findIndex(r=>r.player),keep=new Set();const n=rows.length;
 if(n<=10){for(let i=0;i<n;i++)keep.add(i);return keep;}
 for(let i=0;i<3;i++)keep.add(i);for(let i=Math.max(0,pi-3);i<=Math.min(n-1,pi+3);i++)keep.add(i);keep.add(n-1);return keep;}
const p84BaseSectorPanel=p63UpdateSectorPanel;
p63UpdateSectorPanel=function(){
 if(!p84On())return p84BaseSectorPanel();
 if(!p63UI.sectorPanel)return;const ord=raceOrder();
 if(p63UI.sectorPosition)p63UI.sectorPosition.textContent='P'+ord.pos+' / '+ord.rows.length+' · LAP '+Math.min(lap,settings.raceLaps);
 if(!p63UI.sectorRows)return;const keep=p84Window(ord.rows);let last=-1,html='';
 ord.rows.forEach((r,i)=>{if(!keep.has(i))return;if(last>=0&&i>last+1)html+='<div class="standingRow gapRow">···</div>';last=i;
  let gap=(p63Timing&&p63Timing.lastGap&&Object.prototype.hasOwnProperty.call(p63Timing.lastGap,r.name))?p63Timing.lastGap[r.name]:(i===0?0:null);
  const g2=(gap===0&&i>0)?null:gap,cls='standingRow '+(r.player?'you ':'')+(g2===0?'leader':'behind');gap=g2;
  html+='<div class="'+cls.trim()+'"><span class="pos">'+(i+1)+'</span><span class="name">'+p84Label(r)+'</span><strong class="gap">'+p63SplitGapText(gap)+'</strong></div>';});
 p63UI.sectorRows.innerHTML=html;
};
const p84BaseResults=p5UpdateResults;
p5UpdateResults=function(){
 if(!p84On())return p84BaseResults();
 if(!raceUI.resultsBody)return;const order=raceOrder(),leader=order.rows.find(r=>r.finished),leaderTime=leader?.finishTime||0;
 raceUI.resultsBody.innerHTML=order.rows.map((r,i)=>{let status,time;if(r.finished){status='FINISHED';time=i===0?formatTime(r.finishTime):'+'+Math.max(0,r.finishTime-leaderTime).toFixed(3);}else{status='LAP '+Math.min(settings.raceLaps,r.laps+1)+' / '+settings.raceLaps;time='Running';}
  const o=r.player?null:opponents.find(q=>q.name===r.name);return'<tr class="'+(r.player?'you':'')+'"><td>'+(i+1)+'</td><td>'+(r.player?'YOU':'<span class="carNo">'+(o?o.car:'')+'</span>'+r.name+'<span class="team">'+(o?o.team:'')+'</span>')+'</td><td>'+status+'</td><td>'+time+'</td></tr>';}).join('');
 const pos=order.pos;raceUI.resultsSummary.textContent=(T.short_name||T.name||'Race')+' · '+settings.raceLaps+' laps · '+(order.rows.length)+' cars · '+(settings.startMode==='standing'?'Standing':'Rolling')+' start · You: P'+pos+' · Best lap '+formatTime(bestLap);
};
// When the results open, scroll the list so your own row is in view.
const p84BaseShowResults=p5ShowResults;
p5ShowResults=function(){p84BaseShowResults();if(!p84On())return;const panel=document.getElementById('resultsPanel'),row=panel&&typeof panel.querySelector==='function'?panel.querySelector('tr.you'):null;
 if(row&&panel.clientHeight)panel.scrollTop=Math.max(0,row.offsetTop-panel.clientHeight*.5);};
// Running order (O): the whole field in up to three columns, centred at the top
// (the gap panel already shows the cars around you), refreshed 8 times a second.
const p84BaseFixedUpdate=fixedUpdate;let p84OrderTick=0;
function p84RunningOrder(){const ord=raceOrder(),n=ord.rows.length,cols=n<=12?1:n<=24?2:3,rows=Math.ceil(n/cols);
 let h='<b>RUNNING ORDER</b> · '+n+' cars<div class="orderGrid" style="grid-template-rows:repeat('+rows+',auto)">';
 ord.rows.forEach((r,i)=>{h+='<div'+(r.player?' class="you"':'')+'><strong>'+(i+1)+'</strong>'+p84Label(r)+'</div>';});
 ui.standings.innerHTML=h+'</div>Last '+formatTime(lastLap)+' · Best '+formatTime(bestLap);}
fixedUpdate=function(dt){
 if(!p84On())return p84BaseFixedUpdate(dt);
 const so=standingsOn;standingsOn=false;try{p84BaseFixedUpdate(dt);}finally{standingsOn=so;}   // the core's 8-row list is replaced below
 const n=opponents.length+1;
 if(ui.position&&/ 8$/.test(ui.position.textContent))ui.position.textContent=ui.position.textContent.replace(/ 8$/,' '+n);
 if(ui.dashpos&&/\/8$/.test(ui.dashpos.textContent))ui.dashpos.textContent=ui.dashpos.textContent.replace(/\/8$/,'/'+n);
 if(standingsOn&&ui.standings){if(p84OrderTick++%15===0)p84RunningOrder();}else p84OrderTick=0;
};
if(p84On()&&ui.standings&&ui.standings.classList)ui.standings.classList.add('p84Order');

// -- settings: field size and grid slot -------------------------------------------
if(settings.fieldSize===undefined)settings.fieldSize='stock';
if(settings.gridSlot===undefined)settings.gridSlot='back';
function p84SyncFieldUI(){const st=Number(P84_STOCK.field_size)||32;
 for(const id of ['introField','setField']){const el=document.getElementById(id);if(!el)continue;const o=typeof el.querySelector==='function'?el.querySelector('option[value="stock"]'):null;if(o)o.textContent='Full field · '+st+' cars (stock)';el.value=String(settings.fieldSize);}
 for(const id of ['introGrid','setGrid']){const el=document.getElementById(id);if(el)el.value=settings.gridSlot;}}
for(const id of ['introField','setField'])document.getElementById(id)?.addEventListener('change',e=>{settings.fieldSize=e.target.value;saveSettings();p84SyncFieldUI();});
for(const id of ['introGrid','setGrid'])document.getElementById(id)?.addEventListener('change',e=>{settings.gridSlot=e.target.value;saveSettings();p84SyncFieldUI();});
document.getElementById('settingsDefaults')?.addEventListener('click',()=>{settings.fieldSize='stock';settings.gridSlot='back';saveSettings();p84SyncFieldUI();});
if(p84On()){p84SyncFieldUI();reset();}
else for(const id of ['introField','setField','introGrid','setGrid']){const el=document.getElementById(id);if(el)el.disabled=true;}
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 8.4.1';
updateTag=function(){ui.tag.innerHTML=`Phase 8.4.1 · ${T.short_name||T.name} · ${p712IsHS()?'High-Speed race trim':'Classic handling'}<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?(p81AtlasMip?'textures ready (mipmapped)':'textures ready'):'loading textures…'} · ${opponents.length+1} cars · ${soundOn?'sound ON':'sound OFF'}`;};
updateTag();
// -----------------------------------------------------------------------------
// ---- Phase 8.5 mobile: touch and tilt controls, arcade assists, landscape HUD ----
// Active on touch-first devices (coarse pointer and no mouse), with ?mobile=1,
// or when the page sets window.ICR2_MOBILE (tests). ?mobile=0 turns it off.
// A desktop with a mouse is unchanged, and none of this runs in 7.11 compat
// mode: the core's steering hook (p85SteerInput) then returns the key value.
const P85_STORE='icr2_phase85_mobile';
const P85_DEFAULTS={v:2,controls:'touch',autoAccel:true,brakeAssist:true,lineAssist:'light',tiltRange:12,tiltZero:0,renderScale:'auto',haptics:true};
let p85Prefs=(()=>{try{const st=JSON.parse(localStorage.getItem(P85_STORE)||'{}');
 // 8.5.2: tilt was too insensitive at 26° for full lock; move players off the old default
 if(!st.v){if(st.tiltRange===26)delete st.tiltRange;st.v=2;}
 return Object.assign({},P85_DEFAULTS,st);}catch(e){return Object.assign({},P85_DEFAULTS);}})();
// One-tap assist levels (start screen and pause panel); anything else shows as Custom.
const P85_ASSIST_SETS={full:{autoAccel:true,brakeAssist:true,lineAssist:'light'},braking:{autoAccel:true,brakeAssist:true,lineAssist:'off'},off:{autoAccel:false,brakeAssist:false,lineAssist:'off'}};
function p85AssistSet(){for(const[k,v]of Object.entries(P85_ASSIST_SETS))if(Object.keys(v).every(q=>p85Prefs[q]===v[q]))return k;return'custom';}
function p85Save(){try{localStorage.setItem(P85_STORE,JSON.stringify(p85Prefs));}catch(e){}}
const P85_MOBILE=(()=>{if(p80Compat())return false;let q=null;try{q=new URLSearchParams(location.search).get('mobile');}catch(e){}
 if(q==='1'||window.ICR2_MOBILE===true)return true;if(q==='0'||window.ICR2_MOBILE===false)return false;
 try{return matchMedia('(pointer: coarse)').matches&&!matchMedia('(any-pointer: fine)').matches;}catch(e){return false;}})();
function p85On(){return P85_MOBILE&&!p80Compat();}
const P85_LINE={off:0,light:.3,strong:.8};

// -- input state (screen space: + = right on screen) ---------------------------
const p85In={pad:null,padX0:0,padSteer:0,gas:0,brake:0,beta:null,gamma:null,tiltDeg:null,tiltOk:false};
let p85Phys=0,p85Hooked=false,p85LastHit=0,p85Stuck=0;const p85AiPrev=new WeakMap();

// Tilt: the wheel angle is the direction of "up" (from W3C beta/gamma, which iOS
// and Android report the same way) in the plane of the screen, so it does not
// depend on how far back the phone is tilted. angle 90 = top of the phone to the left.
function p85TiltDegrees(beta,gamma,screenAngle){
 const D=Math.PI/180,b=beta*D,g=gamma*D,ux=-Math.cos(b)*Math.sin(g),uy=Math.sin(b),a=screenAngle*D;
 const right=ux*Math.cos(a)-uy*Math.sin(a),up=ux*Math.sin(a)+uy*Math.cos(a);   // screen axes in device x/y
 return Math.atan2(-right,up)/D;}
function p85ScreenAngle(){try{if(screen.orientation&&typeof screen.orientation.angle==='number')return screen.orientation.angle;}catch(e){}
 const w=window.orientation;return typeof w==='number'?w:0;}
// The wheel angle is smoothed lightly as sensor events arrive (p85TiltEvent); full
// lock at tiltRange (12° by default, 5-30°), after a 0.8° dead zone against sensor noise.
function p85TiltEvent(beta,gamma){const d=p85TiltDegrees(beta,gamma,p85ScreenAngle());
 if(p85In.tiltDeg==null||!isFinite(p85In.tiltDeg))p85In.tiltDeg=d;else{const e=((d-p85In.tiltDeg+540)%360)-180;p85In.tiltDeg+=.5*e;}}
function p85TiltSteer(){if(p85In.beta==null||p85In.tiltDeg==null)return 0;const deg=p85In.tiltDeg-(p85Prefs.tiltZero||0);
 const dz=.8,r=Math.max(5,p85Prefs.tiltRange||12),m=Math.max(0,Math.abs(deg)-dz)/(r-dz);return Math.sign(deg)*Math.min(1,m);}

// -- arcade assists: the racing line and its speeds (as tools/test/autopilot.js) ----
// The assists follow the stock RACE.LP line pushed to at least 2.6 m from any
// wall (it passes within 1 m of some, e.g. Detroit's pit wall), lightly smoothed.
let P85A=null;
function p85Assist(){if(P85A)return P85A;const W=P3.walls,cell=20,grid=new Map(),key=(a,b)=>a+','+b;
 for(let k=0;k<W.length;k+=4){const x0=Math.min(W[k],W[k+2]),x1=Math.max(W[k],W[k+2]),y0=Math.min(W[k+1],W[k+3]),y1=Math.max(W[k+1],W[k+3]);
  for(let gx=Math.floor(x0/cell);gx<=Math.floor(x1/cell);gx++)for(let gy=Math.floor(y0/cell);gy<=Math.floor(y1/cell);gy++){const kk=key(gx,gy);if(!grid.has(kk))grid.set(kk,[]);grid.get(kk).push(k);}}
 const L=race.map(p=>[p[0],p[1]]),n=L.length;
 for(let it=0;it<3;it++)for(const p of L){const gx=Math.floor(p[0]/cell),gy=Math.floor(p[1]/cell);let best=null;
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const k of grid.get(key(gx+a,gy+b))||[]){const ax=W[k],ay=W[k+1],sx=W[k+2]-ax,sy=W[k+3]-ay,l2=sx*sx+sy*sy||1e-9,t=Math.max(0,Math.min(1,((p[0]-ax)*sx+(p[1]-ay)*sy)/l2)),qx=ax+t*sx,qy=ay+t*sy,d=Math.hypot(p[0]-qx,p[1]-qy);if(!best||d<best.d)best={d,qx,qy};}
  if(best&&best.d<2.6&&best.d>1e-6){const f=(2.6-best.d)/best.d;p[0]+=(p[0]-best.qx)*f;p[1]+=(p[1]-best.qy)*f;}}
 const line=L.map((p,i)=>{const a=L[(i-1+n)%n],c=L[(i+1)%n];return[(a[0]+2*p[0]+c[0])/4,(a[1]+2*p[1]+c[1])/4];}),kap=new Float64Array(n);
 for(let i=0;i<n;i++){const a=line[(i-3+n)%n],b=line[i],c=line[(i+3)%n],h1=Math.atan2(b[1]-a[1],b[0]-a[0]),h2=Math.atan2(c[1]-b[1],c[0]-b[0]);
  const ds=(Math.hypot(b[0]-a[0],b[1]-a[1])+Math.hypot(c[0]-b[0],c[1]-b[1]))/2||1;kap[i]=Math.atan2(Math.sin(h2-h1),Math.cos(h2-h1))/ds;}
 return P85A={line,kap,env:null,key:'',grid,cell};}
// Distance (m) from a point to the nearest collision wall within one grid cell (20 m), else 99.
// True when no collision wall crosses the straight line from (x0,y0) to (x1,y1).
function p85Clear(x0,y0,x1,y1){const A=p85Assist(),W=P3.walls,seen=new Set(),n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/(A.cell/2)));
 for(let q=0;q<=n;q++){const x=x0+(x1-x0)*q/n,y=y0+(y1-y0)*q/n,gx=Math.floor(x/A.cell),gy=Math.floor(y/A.cell);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const k of A.grid.get((gx+a)+','+(gy+b))||[]){if(seen.has(k))continue;seen.add(k);if(segCross(x0,y0,x1,y1,W[k],W[k+1],W[k+2],W[k+3]))return false;}}
 return true;}
function p85WallDist(x,y){const A=p85Assist(),W=P3.walls,gx=Math.floor(x/A.cell),gy=Math.floor(y/A.cell);let d=99;
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const k of A.grid.get((gx+a)+','+(gy+b))||[]){const ax=W[k],ay=W[k+1],sx=W[k+2]-ax,sy=W[k+3]-ay,l2=sx*sx+sy*sy||1e-9,t=Math.max(0,Math.min(1,((x-ax)*sx+(y-ay)*sy)/l2));d=Math.min(d,Math.hypot(x-ax-t*sx,y-ay-t*sy));}
 return d;}
// The pit path the AI cars take (8.4: the racing line blended into PIT.LP from
// where it leaves the racing line to where it rejoins), on the cleared line.
let P85P;
function p85PitAssist(){if(P85P!==undefined)return P85P;if(!P84_PIT||P5_PIT.length!==N)return P85P=null;
 const A=p85Assist(),B=P84_PIT.blend,line=A.line.map((p,i)=>B[i]>0?[p[0]+(P5_PIT[i][0]-p[0])*B[i],p[1]+(P5_PIT[i][1]-p[1])*B[i]]:p),kap=new Float64Array(N);
 for(let i=0;i<N;i++){const a=line[(i-3+N)%N],b=line[i],c=line[(i+3)%N],h1=Math.atan2(b[1]-a[1],b[0]-a[0]),h2=Math.atan2(c[1]-b[1],c[0]-b[0]);
  const ds=(Math.hypot(b[0]-a[0],b[1]-a[1])+Math.hypot(c[0]-b[0],c[1]-b[1]))/2||1;kap[i]=Math.atan2(Math.sin(h2-h1),Math.cos(h2-h1))/ds;}
 return P85P={line,kap,blend:B};}
const P85_BRAKE_PLAN=15;   // m/s² planned for the brake assist (the car brakes at 24)
function p85MaxSteer(v){return(.30-.245*Math.min(1,v/43))*handlingProfile().steer;}
// v² envelope: the highest speed at each record from which every stock target
// speed ahead (and the steering lock) can still be met at P85_BRAKE_PLAN.
function p85Envelope(A=p85Assist()){const key=(p712IsHS()?'hs':'c')+'|'+N;if(A.key===key&&A.env)return A.env;
 const E=new Float64Array(N),hs=p712IsHS()&&p712Perf,pitMph=i=>(P5_LINES.pit&&P5_LINES.pit[i])?P5_LINES.pit[i][3]:S[i].speed_mph;
 const lock=v=>(.30-.245*Math.min(1,v/43))*(hs?p712Perf.steerScale(v):1);
 for(let i=0;i<N;i++){let k=0;for(let d=-2;d<=2;d++)k=Math.max(k,Math.abs(A.kap[(i+d+N)%N]));const R=k>1e-6?1/k:1e9;
  let lo=0,hi=130;if(3.1/Math.tan(lock(hi))>R){for(let it=0;it<36;it++){const m=(lo+hi)/2;if(3.1/Math.tan(lock(m))<=R)lo=m;else hi=m;}}else lo=hi;
  const b=A.blend?A.blend[i]:0,mph=S[i].speed_mph*(1-b)+(b>0?pitMph(i)*b:0),v=Math.min(mph*.44704,lo*.95);E[i]=v*v;}
 // braking distance from the line's own record spacing (shorter on the inside of
 // corners and in pit lanes than the 3.28 m centreline spacing)
 for(let p=0;p<2;p++)for(let i=N-1;i>=0;i--){const nx=E[(i+1)%N]+2*P85_BRAKE_PLAN*p85Seg(A,i);if(nx<E[i])E[i]=nx;}
 A.env=E;A.key=key;return E;}
function p85Seg(A,i){const a=A.line[i],b=A.line[(i+1)%N];return Math.hypot(b[0]-a[0],b[1]-a[1]);}
// Steering angle (rad, physics sign) that follows the racing line (Stanley-style,
// as the test autopilot), limited to the current lock.
function p85LineSteer(idx,v,A=p85Assist(),latOff=0){
 const line=A.line,res=T.lp_resolution_m||3.2768;let idx2=idx,bd=Infinity;
 for(let d=-6;d<=6;d++){const i=(idx+d+N)%N,q=line[i],dd=(car.x-q[0])**2+(car.y-q[1])**2;if(dd<bd){bd=dd;idx2=i;}}idx=idx2;
 const p=line[idx],q=line[(idx+1)%N],ph=Math.atan2(q[1]-p[1],q[0]-p[0]);
 const lat=-(car.x-p[0])*Math.sin(ph)+(car.y-p[1])*Math.cos(ph),lead=Math.round(Math.max(1,v*.22/res));
 const j=(idx+lead)%N,hl=(idx+Math.round(lead*.5))%N,a=line[hl],b=line[(hl+1)%N],hj=Math.atan2(b[1]-a[1],b[0]-a[0]);
 let k=0;for(let d=-1;d<=1;d++)k+=A.kap[(j+d+N)%N];k/=3;
 const he=Math.atan2(Math.sin(hj-car.heading),Math.cos(hj-car.heading)),lock=p712IsHS()&&p712Perf?p712Perf.steerScale(v):1;
 const want=Math.atan(3.1*k)+lock*(.8*he+Math.atan(-2.4*Math.max(latOff?-6:-3,Math.min(latOff?6:3,lat-latOff))/(v+3)));
 const m=p85MaxSteer(v);return Math.max(-m,Math.min(m,want));}

// -- per tick: touch/tilt -> keys and steering (outermost fixedUpdate wrapper) --------
// An analogue input is a steering *angle*: the pad position or the phone's tilt
// sets where the front wheels point, and the command drives the core's steering
// rack (2.4/s, made for held keys) so that the wheels get there in about 0.07 s.
const P85_RACK_GAIN=6;
const p85Keys={w:false,s:false};
function p85SetKey(k,on){if(on&&!p85Keys[k]){keys.add(k);p85Keys[k]=true;}else if(!on&&p85Keys[k]){keys.delete(k);p85Keys[k]=false;}}
function p85Tick(dt){
 const v=Math.hypot(car.vx,car.vy),idx=lastIdx%N,screenSteer=p85Prefs.controls==='tilt'?p85TiltSteer():(p85In.pad!=null?p85In.padSteer:0);
 const touching=p85Prefs.controls==='tilt'?p85In.beta!=null:p85In.pad!=null;
 let user=p80SteerSwapped()?-screenSteer:screenSteer;
 if(!touching){const kl=keys.has('a')||keys.has('arrowleft'),kr=keys.has('d')||keys.has('arrowright');user=(kr?1:0)-(kl?1:0);}
 let s=raceStarted&&v>4?(P85_LINE[p85Prefs.lineAssist]||0):0;const m=Math.max(1e-3,p85MaxSteer(v));
 // Pit stops: with a stop requested, and on the way out of the pit lane, the
 // assists follow the AI's pit path instead of the racing line; near your box the
 // steering assist (at least 0.8) aims at the box and the brake assist stops you in it.
 const PA=p85PitAssist(),pitting=p6Pit.requested&&p6Pit.service<=0,stallIdx=P7_PIT.stall_index??(PA?P84_PIT.end:0);let usePit=false,inPit=false,box=null;
 // braking: with a stop requested, plan with the pit path's speeds from anywhere
 // except the pit exit, so the car is slow enough at the pit entry
 const planPit=PA&&pitting&&!p84InSpan(idx,stallIdx,P84_PIT.end);
 if(PA&&PA.blend[idx]>0){const q=PA.line[idx],r=p85Assist().line[idx];inPit=drivingStatus(car.x,car.y).pit;
  // in: only with a stop requested; out (box to rejoin): whenever nearer the pit path
  usePit=p84InSpan(idx,P84_PIT.start,stallIdx)?pitting:(car.x-q[0])**2+(car.y-q[1])**2<(car.x-r[0])**2+(car.y-r[1])**2;}
 if(pitting&&usePit){const pt=p6PitPoint(),dx=pt[0]-car.x,dy=pt[1]-car.y,d=Math.hypot(dx,dy),ah=dx*Math.cos(car.heading)+dy*Math.sin(car.heading);
  // the box's offset from the pit path, which the steering target moves over to in the last 40 m
  let bi=idx,bd=Infinity;for(let k=-10;k<=60;k++){const i=(idx+k+N)%N,q=PA.line[i],dd=(pt[0]-q[0])**2+(pt[1]-q[1])**2;if(dd<bd){bd=dd;bi=i;}}
  const q=PA.line[bi],q2=PA.line[(bi+1)%N],ph=Math.atan2(q2[1]-q[1],q2[0]-q[0]),lat=-(pt[0]-q[0])*Math.sin(ph)+(pt[1]-q[1])*Math.cos(ph);
  // (only once nothing stands between the car and the box)
  box={d,ah,latOff:d<45&&p85Clear(car.x,car.y,pt[0],pt[1])?lat*Math.max(0,Math.min(1,1-(d-8)/32)):0};if(s>0&&ah>-1&&d<45)s=Math.max(s,P85_LINE.strong);}
 // edge guard: when the car is heading for a wall (on its current arc, 0.2 or
 // 0.4 s ahead it would be within 2 m of one), the light assist ramps up, to
 // full weight at 1 m (the car's collision radius is 0.96 m)
 if(s>0&&s<P85_LINE.strong){const w=v/3.1*Math.tan(car.steer);let d=99;
  for(const t of [.2,.4]){const h=car.heading+w*t/2;d=Math.min(d,p85WallDist(car.x+Math.cos(h)*v*t,car.y+Math.sin(h)*v*t));}
  if(d<2)s+=(1-s)*Math.min(1,2-d);}
 if(touching||s>0){let want=Math.max(-1,Math.min(1,user))*m;
  if(s>0){let ls=p85LineSteer(idx,v,usePit?PA:undefined,box&&box.ah>-1&&box.d<45?box.latOff:0);
   // Beside another car, the steering assist does not pull you into it: closer
   // than 3 m it blends from the line towards running parallel to that car,
   // edging away. (A positive steer turns towards +lat.)
   const fx=Math.cos(car.heading),fy=Math.sin(car.heading);
   for(const o of opponents){if(o.finished)continue;const q=aiPose(o),dx=q.x-car.x,dy=q.y-car.y,ah=dx*fx+dy*fy,lat=-dx*fy+dy*fx;
    if(Math.abs(ah)>=5||Math.abs(lat)>=3||Math.sign(lat)!==Math.sign(ls-want))continue;
    const w=Math.max(0,Math.min(1,(Math.abs(lat)-1.6)/1.4)),hold=Math.max(-m,Math.min(m,Math.atan2(Math.sin(q.h-car.heading),Math.cos(q.h-car.heading))-Math.sign(lat)*.03));
    const c=hold+w*(ls-hold);ls=lat>0?Math.min(ls,c):Math.max(ls,c);}
   want+=s*(ls-want);}
  p85Phys=Math.max(-1,Math.min(1,(car.steer+P85_RACK_GAIN*(want-car.steer))/m));p85Hooked=true;}
 else{p85Phys=user;p85Hooked=false;}
 // pedals
 let gas=p85In.gas>0,brake=p85In.brake>0;
 if(p85Prefs.autoAccel&&raceStarted&&!brake)gas=true;
 if(p85Prefs.brakeAssist&&raceStarted&&v>8&&!brake){const AL=usePit||planPit?PA:p85Assist(),E=p85Envelope(AL);let va=Math.sqrt(Math.min(E[idx],E[(idx+1)%N]+2*P85_BRAKE_PLAN*p85Seg(AL,idx)));
  // and for a car right in front of you (steer out of its path to pass). Its speed
  // along your heading is measured from its movement: o.speed is per LP record,
  // and records are closer together on the inside of a corner.
  const fx=Math.cos(car.heading),fy=Math.sin(car.heading);
  for(const o of opponents){if(o.finished)continue;const q=aiPose(o),dx=q.x-car.x,dy=q.y-car.y,ah=dx*fx+dy*fy,pr=p85AiPrev.get(o);
   p85AiPrev.set(o,{x:q.x,y:q.y,t:raceClock});if(ah<=0||ah>45)continue;
   if(Math.abs(-dx*fy+dy*fx)<2.2){const gap=raceClock-(pr?pr.t:-1);
    const along=gap>1e-4&&gap<.1?((q.x-pr.x)*fx+(q.y-pr.y)*fy)/gap:o.speed*Math.cos(q.h-car.heading);
    va=Math.min(va,Math.sqrt(Math.max(0,along)**2+2*P85_BRAKE_PLAN*Math.max(0,ah-7)));}}
  if(inPit&&usePit)va=Math.min(va,P6_PIT_LIMIT_MPH*.44704*.97);   // the pit speed limit, also without the limiter
  if(v>va+.8){brake=true;gas=false;}else if(v>va-1.0)gas=false;}
 // pit stop requested: in the pit lane the brake assist stops you at your box as
 // you steer into it (service starts within 4.2 m of the box below 2.2 m/s)
 if(p85Prefs.brakeAssist&&raceStarted&&box&&!p85In.brake){
  if(box.d<4.2){if(v>.3){brake=true;gas=false;}}
  else if(box.ah>-1&&box.d<150){const vp=Math.sqrt(2*P85_BRAKE_PLAN*Math.max(0,box.d-1.5));if(v>vp+.3){brake=true;gas=false;}else if(v>vp-.5)gas=false;}}
 p85SetKey('w',gas);p85SetKey('s',brake);
 // haptics on contact
 if(p85Prefs.haptics&&hitTimer>p85LastHit+.05&&typeof navigator!=='undefined'&&navigator.vibrate){try{navigator.vibrate(hitTimer>.2?28:12);}catch(e){}}p85LastHit=hitTimer;
 // with auto-accelerate, a car pinned against a wall or facing the wrong way is put
 // back on the racing line after 2 s (as X / the reset button does)
 if(p85Prefs.autoAccel&&raceStarted&&!playerFinished&&!(p6Pit&&p6Pit.service>0)&&!p85In.brake){
  const c0=center[idx],c1=center[(idx+2)%N],back=Math.cos(Math.atan2(c1[1]-c0[1],c1[0]-c0[0])-car.heading)<-.5;
  if((v<5&&hitTimer>0)||back){p85Stuck+=dt;if(p85Stuck>2){p85Stuck=0;recoverCar(false);}}else p85Stuck=0;}
 else p85Stuck=0;}
p85SteerInput=function(k){return(p85On()&&p85Hooked)?p85Phys:k;};
const p85BaseFixedUpdate=fixedUpdate;let p85HudTick=0;
const p85Portrait=(()=>{try{return matchMedia('(orientation: portrait)');}catch(e){return{matches:false};}})();
fixedUpdate=function(dt){
 if(!p85On())return p85BaseFixedUpdate(dt);
 if(p85Portrait.matches&&!p63IntroOpen)return;              // paused while the phone is upright
 if(!settingsOpen&&!p6SetupOpen)p85Tick(dt);
 p85BaseFixedUpdate(dt);
 if(++p85HudTick%6===0)p85UpdateHud();
};

// -- render resolution: capped on phones (3x screens would draw 9x the pixels) -------
const p85BaseResize=resize;
resize=function(){if(!p85On())return p85BaseResize();const dpr=devicePixelRatio||1,cap=p85Prefs.renderScale==='auto'?1.5:Number(p85Prefs.renderScale)||1.5;
 const d=Math.min(dpr,cap),w=Math.floor(innerWidth*d),h=Math.floor(innerHeight*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);};

// -- DOM: touch layer, compact HUD, buttons, rotate screen, settings -----------------------
function p85El(tag,attrs,parent,html){const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);if(html!=null)e.innerHTML=html;(parent||document.body).appendChild(e);return e;}
const P85UI={};
function p85Layout(){if(!P85UI.layer)return;const tilt=p85Prefs.controls==='tilt',auto=!!p85Prefs.autoAccel;
 P85UI.layer.className='p85'+(tilt?' tilt':' touch')+(auto?' auto':'');
 P85UI.gas.style.display=auto?'none':'flex';P85UI.brakeL.style.display=tilt?'flex':'none';P85UI.pad.style.display='block';}
function p85UpdateHud(){const H=P85UI.hud;if(!H)return;const t=id=>{const e=document.getElementById(id);return e?e.textContent:'';};
 H.speed.textContent=t('speed');H.gear.textContent=t('gear');H.pos.textContent='P'+t('position').replace(/\s/g,'');
 H.lap.textContent='LAP '+t('lap').replace(/\s/g,'');H.time.textContent=t('laptime');
 const dmg=parseFloat(t('damage'))||0,fuel=parseFloat(t('fuel'));H.extra.textContent=(dmg>=5?'DMG '+Math.round(dmg)+'%  ':'')+(fuel<8?'FUEL '+fuel.toFixed(1)+' L':'');
 if(P85UI.knob){const s=p85Prefs.controls==='tilt'?p85TiltSteer():p85In.padSteer;P85UI.knob.style.transform='translateX('+(s*46).toFixed(1)+'px)';}
 if(P85UI.tiltNote)P85UI.tiltNote.style.display=(p85Prefs.controls==='tilt'&&p85In.beta==null)?'block':'none';}
function p85Fullscreen(){const d=document.documentElement;try{if(!document.fullscreenElement&&d.requestFullscreen&&!matchMedia('(display-mode: standalone)').matches&&!matchMedia('(display-mode: fullscreen)').matches)
  d.requestFullscreen({navigationUI:'hide'}).then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape').catch(()=>{})).catch(()=>{});}catch(e){}}
function p85RequestTilt(){
 const go=()=>{if(P85UI.tiltBound)return;P85UI.tiltBound=true;addEventListener('deviceorientation',e=>{if(e.beta==null||e.gamma==null)return;p85In.beta=e.beta;p85In.gamma=e.gamma;p85TiltEvent(e.beta,e.gamma);p85In.tiltOk=true;});};
 try{const DO=window.DeviceOrientationEvent;if(DO&&typeof DO.requestPermission==='function'){DO.requestPermission().then(r=>{if(r==='granted')go();else{p85Prefs.controls='touch';p85Save();p85SyncSettings();p85Layout();}}).catch(()=>{});}else go();}catch(e){go();}}
const P85_ASSIST_SELECT='<select id="ID"><option value="full">All on (arcade)</option><option value="braking">Braking help only</option><option value="off">Off: you drive</option><option value="custom" disabled>Custom</option></select>';
function p85ApplyAssists(k){const v=P85_ASSIST_SETS[k];if(!v)return;Object.assign(p85Prefs,v);p85Save();p85SyncSettings();p85Layout();}
function p85SyncSettings(){const set=(id,v)=>{const e=document.getElementById(id);if(e){if(e.type==='checkbox')e.checked=!!v;else e.value=String(v);}};
 set('p85Controls',p85Prefs.controls);set('introControls',p85Prefs.controls);set('p85Assists',p85AssistSet());set('introAssists',p85AssistSet());set('p85Auto',p85Prefs.autoAccel);set('p85BrakeAssist',p85Prefs.brakeAssist);set('p85Line',p85Prefs.lineAssist);
 set('p85TiltRange',p85Prefs.tiltRange);set('p85Scale',p85Prefs.renderScale);set('p85Haptics',p85Prefs.haptics);
 const o=document.getElementById('p85TiltRangeOut');if(o)o.textContent=p85Prefs.tiltRange+'°';}
function p85BuildUI(){
 document.body.classList.add('mobile');
 const css=`
body.mobile #hud,body.mobile #tag,body.mobile #sectorPanel,body.mobile #gapPanel,body.mobile #help,body.mobile #helpBtn,body.mobile #setupBtn,body.mobile #settingsBtn,body.mobile #referenceBadge,body.mobile #standings{display:none!important}
body.mobile canvas,#p85Layer{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
body.mobile{-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}
#p85Layer{position:fixed;inset:0;z-index:10}
#p85Pad{position:absolute;left:0;top:0;bottom:0;width:46%}
#p85Layer.tilt #p85Pad{pointer-events:none;left:50%;width:150px;margin-left:-75px;top:auto;bottom:0;height:30px}
#p85Layer.tilt #p85PadTrack{left:0;top:auto;transform:none;bottom:max(8px,env(safe-area-inset-bottom));height:10px;border-radius:5px;opacity:.8}
#p85Layer.tilt #p85Knob{width:18px;height:18px;margin:-9px 0 0 -9px}
#p85PadTrack{position:absolute;left:max(22px,env(safe-area-inset-left));top:50%;transform:translateY(-50%);width:150px;height:56px;border-radius:28px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.25)}
#p85Knob{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 2px 8px rgba(0,0,0,.4)}
.p85Pedal{position:absolute;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;border-radius:50%;font:800 13px system-ui,sans-serif;letter-spacing:.08em;color:#fff;border:2px solid rgba(255,255,255,.4);text-shadow:0 1px 3px #000}
#p85Gas{right:max(18px,env(safe-area-inset-right));width:104px;height:104px;background:rgba(40,150,70,.42)}
#p85Brake{right:calc(max(18px,env(safe-area-inset-right)) + 116px);width:88px;height:88px;background:rgba(190,40,30,.45)}
#p85Layer.auto #p85Brake{right:max(18px,env(safe-area-inset-right));width:104px;height:104px}
#p85BrakeL{left:max(18px,env(safe-area-inset-left));width:104px;height:104px;background:rgba(190,40,30,.45)}
.p85Pedal.on{filter:brightness(1.7);transform:translateY(-50%) scale(.96)}
#p85Hud{position:fixed;left:max(10px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));z-index:12;display:flex;gap:12px;align-items:baseline;padding:5px 12px;border-radius:10px;background:rgba(6,10,8,.62);font:700 13px system-ui,sans-serif;font-variant-numeric:tabular-nums;pointer-events:none}
#p85Hud .spd{font-size:26px;font-weight:850}#p85Hud .u{font-size:11px;opacity:.7;margin-left:2px}#p85Hud .ex{color:#ffb08a}
#p85Btns{position:fixed;right:max(10px,env(safe-area-inset-right));top:max(8px,env(safe-area-inset-top));z-index:19;display:flex;gap:8px}
#p85Btns button{min-width:48px;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(6,10,8,.7);color:#fff;font:800 12px system-ui,sans-serif}
#p85TiltNote{position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:12;display:none;padding:8px 12px;border-radius:8px;background:rgba(0,0,0,.7);font:700 12px system-ui,sans-serif;pointer-events:none}
#p85Rotate{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:#08110c;color:#fff;font:700 18px system-ui,sans-serif;text-align:center}
#p85Rotate .ph{width:46px;height:78px;border:4px solid #fff;border-radius:9px;animation:p85r 2.2s ease-in-out infinite}
@keyframes p85r{0%,25%{transform:rotate(0)}55%,100%{transform:rotate(-90deg)}}
@media (orientation: portrait){body.mobile #p85Rotate{display:flex}}
body.mobile #introCard{max-height:calc(100dvh - 16px);overflow:auto;grid-template-columns:1fr}
body.mobile .introHero{display:none}
body.mobile .introCopy{padding:16px 22px}
body.mobile .introCopy h1{font-size:30px;margin:6px 0 2px}
body.mobile .introSub{font-size:15px;margin-bottom:12px}
body.mobile .introButtons button{padding:14px 22px;font-size:15px}
body.mobile #introOptions{max-width:none;display:none}
body.mobile #introOptions label{grid-template-columns:120px 1fr;margin:7px 0}
body.mobile #introOptions select{min-height:34px;font-size:14px}
body.mobile #settingsPanel,body.mobile #setupPanel{max-height:calc(100dvh - 16px);padding:12px 14px}
body.mobile .setting{grid-template-columns:130px 1fr 44px;margin:7px 0}
body.mobile .setting select{min-height:32px}
body.mobile #resultsOverlay{width:min(720px,calc(100vw - 16px))}
body.mobile #resultsPanel{max-height:calc(100dvh - 24px)}
body.mobile .resultsActions button,body.mobile .settingsActions button{min-height:40px;padding:8px 14px}
body.mobile #cockpitUpper,body.mobile #cockpitRim{width:100vw}
body.mobile #startSignal{font-size:64px}
body.mobile #pitPanel{left:50%;transform:translateX(-50%);bottom:auto;top:56px}
.p85Group{margin:10px 0 2px;font-size:11px;font-weight:800;letter-spacing:.08em;opacity:.7}`;
 p85El('style',{},document.head,css);
 // touch layer
 const L=P85UI.layer=p85El('div',{id:'p85Layer'});
 P85UI.pad=p85El('div',{id:'p85Pad'},L,'<div id="p85PadTrack"><div id="p85Knob"></div></div>');P85UI.knob=document.getElementById('p85Knob');
 P85UI.gas=p85El('div',{id:'p85Gas',class:'p85Pedal'},L,'GAS');P85UI.brake=p85El('div',{id:'p85Brake',class:'p85Pedal'},L,'BRAKE');P85UI.brakeL=p85El('div',{id:'p85BrakeL',class:'p85Pedal'},L,'BRAKE');
 const owner=new Map();
 const release=id=>{const w=owner.get(id);if(!w)return;owner.delete(id);if(w==='pad'){p85In.pad=null;p85In.padSteer=0;}else{p85In[w]=Math.max(0,p85In[w]-1);p85PedalLook();}};
 L.addEventListener('pointerdown',e=>{e.preventDefault();ensureAudio();const t=e.target.closest?e.target.closest('#p85Gas,#p85Brake,#p85BrakeL,#p85Pad'):null;
  let w=null;if(t){w=t.id==='p85Gas'?'gas':t.id==='p85Pad'?'pad':'brake';}
  else if(p85Prefs.controls!=='tilt'&&e.clientX<innerWidth*.46)w='pad';
  else if(e.clientX>=innerWidth*.5)w=p85Prefs.autoAccel?'brake':(e.clientY>innerHeight*.45?(e.clientX>innerWidth-150?'gas':'brake'):null);
  else if(p85Prefs.controls==='tilt')w='brake';
  if(!w)return;try{L.setPointerCapture(e.pointerId);}catch(_){}owner.set(e.pointerId,w);
  if(w==='pad'){p85In.pad=e.pointerId;p85In.padX0=e.clientX;p85In.padSteer=0;}else{p85In[w]++;p85PedalLook();}},{passive:false});
 L.addEventListener('pointermove',e=>{if(owner.get(e.pointerId)!=='pad')return;e.preventDefault();const dx=e.clientX-p85In.padX0,dz=4,R=90;
  p85In.padSteer=Math.sign(dx)*Math.min(1,Math.max(0,Math.abs(dx)-dz)/(R-dz));},{passive:false});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])L.addEventListener(ev,e=>release(e.pointerId));
 addEventListener('blur',()=>{for(const id of [...owner.keys()])release(id);});
 L.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('gesturestart',e=>e.preventDefault());
 // compact HUD and buttons
 const H=p85El('div',{id:'p85Hud'},null,'<span><span class="spd" id="p85Spd">0</span><span class="u">MPH</span></span><span id="p85Gear">N</span><span id="p85Pos">P1</span><span id="p85Lap">LAP 1/3</span><span id="p85Time">0:00.000</span><span class="ex" id="p85Ex"></span>');
 P85UI.hud={speed:document.getElementById('p85Spd'),gear:document.getElementById('p85Gear'),pos:document.getElementById('p85Pos'),lap:document.getElementById('p85Lap'),time:document.getElementById('p85Time'),extra:document.getElementById('p85Ex')};
 const B=p85El('div',{id:'p85Btns'});
 const btn=(id,label,title,fn)=>{const b=p85El('button',{type:'button',id,'aria-label':title},B,label);b.addEventListener('click',e=>{e.preventDefault();fn();});return b;};
 btn('p85Cam','CAM','Camera',()=>{cameraMode=(cameraMode+1)%cameraNames.length;updateCameraLabel();});
 btn('p85Pit','PIT','Pit request',()=>{if(!settingsOpen&&!p6SetupOpen&&!p6ReplayActive)p6TogglePit();});
 btn('p85Reset','↺','Put the car back on track',()=>{if(raceStarted&&!settingsOpen&&!p6SetupOpen&&!p6ReplayActive&&!playerFinished)recoverCar(true);});
 btn('p85Pause','❚❚','Pause and settings',()=>toggleSettings(true));
 P85UI.tiltNote=p85El('div',{id:'p85TiltNote'},null,'Tilt steering: waiting for motion sensor…');
 p85El('div',{id:'p85Rotate'},null,'<div class="ph"></div><div>Turn your phone sideways</div><div style="font-size:13px;opacity:.7">The race is paused in portrait.</div>');
 // start screen: controls choice; the race settings panel: touch controls block
 const opts=document.getElementById('introOptions');
 if(opts){const lab=document.createElement('label');lab.innerHTML='Controls <select id="introControls"><option value="touch">Touch steering</option><option value="tilt">Tilt steering</option></select>';opts.insertBefore(lab,opts.firstChild);
  lab.querySelector('select').addEventListener('change',e=>{p85Prefs.controls=e.target.value;p85Save();p85SyncSettings();p85Layout();});
  const lab2=document.createElement('label');lab2.innerHTML='Assists '+P85_ASSIST_SELECT.replace('ID','introAssists');opts.insertBefore(lab2,lab.nextSibling||null);
  lab2.querySelector('select').addEventListener('change',e=>p85ApplyAssists(e.target.value));}
 const panel=document.getElementById('settingsPanel'),acts=panel&&panel.querySelector('.settingsActions');
 if(panel&&acts){const box=document.createElement('div');box.innerHTML=`<div class="p85Group">TOUCH CONTROLS</div>
<div class="setting"><label for="p85Assists">Assists</label>${P85_ASSIST_SELECT.replace('ID','p85Assists')}<output></output></div>
<div class="setting"><label for="p85Controls">Steering</label><select id="p85Controls"><option value="touch">Touch: left thumb pad</option><option value="tilt">Tilt the phone</option></select><output></output></div>
<div class="setting check"><label for="p85Auto">Auto-accelerate</label><input id="p85Auto" type="checkbox"></div>
<div class="setting check"><label for="p85BrakeAssist">Brake assist</label><input id="p85BrakeAssist" type="checkbox"></div>
<div class="setting"><label for="p85Line">Steering assist</label><select id="p85Line"><option value="off">Off</option><option value="light">Light</option><option value="strong">Strong</option></select><output></output></div>
<div class="setting"><label for="p85TiltRange">Tilt for full lock</label><input id="p85TiltRange" type="range" min="5" max="30" step="1"><output id="p85TiltRangeOut"></output></div>
<div class="setting check"><label for="p85Centre">Tilt centre</label><button id="p85Centre" type="button" style="justify-self:start">Set current angle as straight</button></div>
<div class="setting"><label for="p85Scale">Resolution</label><select id="p85Scale"><option value="auto">Auto (up to 1.5×)</option><option value="1">1× (fastest)</option><option value="2">2× (sharpest)</option></select><output></output></div>
<div class="setting check"><label for="p85Haptics">Vibrate on contact</label><input id="p85Haptics" type="checkbox"></div>
<div class="setting check"><label for="p85Setup">Race setup</label><button id="p85Setup" type="button" style="justify-self:start">Fuel, mirrors, pit strategy…</button></div>`;
  panel.insertBefore(box,acts);
  const on=(id,ev,fn)=>document.getElementById(id)?.addEventListener(ev,fn);
  on('p85Controls','change',e=>{p85Prefs.controls=e.target.value;p85Save();if(p85Prefs.controls==='tilt')p85RequestTilt();p85SyncSettings();p85Layout();});
  on('p85Assists','change',e=>p85ApplyAssists(e.target.value));
  on('p85Auto','change',e=>{p85Prefs.autoAccel=e.target.checked;p85Save();p85Layout();p85SyncSettings();});
  on('p85BrakeAssist','change',e=>{p85Prefs.brakeAssist=e.target.checked;p85Save();p85SyncSettings();});
  on('p85Line','change',e=>{p85Prefs.lineAssist=e.target.value;p85Save();p85SyncSettings();});
  on('p85TiltRange','input',e=>{p85Prefs.tiltRange=Number(e.target.value);p85Save();p85SyncSettings();});
  on('p85Centre','click',()=>{if(p85In.tiltDeg!=null){p85Prefs.tiltZero=Math.round(p85In.tiltDeg*2)/2;p85Save();}});
  on('p85Scale','change',e=>{p85Prefs.renderScale=e.target.value;p85Save();});
  on('p85Haptics','change',e=>{p85Prefs.haptics=e.target.checked;p85Save();});
  on('p85Setup','click',()=>p6ToggleSetup(true));}
 document.getElementById('introStart')?.addEventListener('click',()=>{ensureAudio();p85Fullscreen();if(p85Prefs.controls==='tilt')p85RequestTilt();},{capture:true});
 p85SyncSettings();p85Layout();}
function p85PedalLook(){if(!P85UI.gas)return;P85UI.gas.classList.toggle('on',p85In.gas>0);P85UI.brake.classList.toggle('on',p85In.brake>0);P85UI.brakeL.classList.toggle('on',p85In.brake>0);}
if(p85On()){
 try{p85BuildUI();}catch(e){console.warn('8.5 mobile UI:',e);}
 // Mirrors cost a second and third scene pass: off by default on a phone. The
 // pit limiter is on, since auto-accelerate would otherwise speed in the pit lane.
 try{if(localStorage.getItem('icr2_phase76_reference')===null){p6Setup.mirrors=false;p6Setup.autoLimiter=true;p6SaveSetup();if(typeof p6SyncSetupUI==='function')p6SyncSetupUI();}}catch(e){}
 if(p85Prefs.controls==='tilt'&&!(window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function'))p85RequestTilt();
}
if(p7HudTitle)p7HudTitle.textContent='ICR2 MODERN · PHASE 8.5';
updateTag=function(){ui.tag.innerHTML=`Phase 8.5 · ${T.short_name||T.name} · ${p712IsHS()?'High-Speed race trim':'Classic handling'}<br>${environmentOn?'environment ON':'environment OFF'} · ${atlasReady?(p81AtlasMip?'textures ready (mipmapped)':'textures ready'):'loading textures…'} · ${opponents.length+1} cars · ${soundOn?'sound ON':'sound OFF'}`;};
updateTag();
// -----------------------------------------------------------------------------
let last=performance.now(),acc=0;const FIXED=1/120;function frame(now){let dt=Math.min(.10,(now-last)/1000);last=now;acc+=dt;let n=0;while(acc>=FIXED&&n<12){fixedUpdate(FIXED);acc-=FIXED;n++;}render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
