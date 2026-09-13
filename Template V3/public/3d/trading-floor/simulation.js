export class Navigation {
  constructor(data){Object.assign(this,data);this.walkable=[];this.component=new Int32Array(this.width*this.height).fill(-1);let best=[];let id=0;for(let j=0;j<this.height;j++)for(let i=0;i<this.width;i++){let k=j*this.width+i;if(!this.isFree(i,j)||this.component[k]>=0)continue;const region=[k];this.component[k]=id;for(let n=0;n<region.length;n++){const v=region[n],x=v%this.width,y=Math.floor(v/this.width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,kk=yy*this.width+xx;if(this.isFree(xx,yy)&&this.component[kk]<0){this.component[kk]=id;region.push(kk);}}}if(region.length>best.length)best=region;id++;}this.walkable=best;this.allowed=new Set(best);}
  isFree(x,z){return x>=0&&z>=0&&x<this.width&&z<this.height&&this.rows[z][x]==='.';}
  cell(x,z){return [Math.floor((x-this.origin[0])/this.step),Math.floor((z-this.origin[1])/this.step)];}
  world(k){return [this.origin[0]+(k%this.width+.5)*this.step,this.origin[1]+(Math.floor(k/this.width)+.5)*this.step];}
  nearest(x,z){let best=this.walkable[0],dist=Infinity;for(const k of this.walkable){const p=this.world(k),d=(p[0]-x)**2+(p[1]-z)**2;if(d<dist){dist=d;best=k;}}return best;}
  clear(a,b){const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/(this.step*.35)));for(let i=0;i<=steps;i++){const t=i/steps,[x,z]=this.cell(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);if(!this.allowed.has(z*this.width+x)||!this.isFree(x,z))return false;}return true;}
  path(start,end){const a=this.nearest(...start),b=this.nearest(...end);if(a===b)return [this.world(b)];const n=this.width*this.height,g=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),closed=new Set();g[a]=0;const open=[a];const target=this.world(b),h=k=>{const p=this.world(k);return Math.hypot(p[0]-target[0],p[1]-target[1])/this.step;};while(open.length){let idx=0;for(let i=1;i<open.length;i++)if(g[open[i]]+h(open[i])<g[open[idx]]+h(open[idx]))idx=i;const k=open.splice(idx,1)[0];if(k===b)break;if(closed.has(k))continue;closed.add(k);const x=k%this.width,z=Math.floor(k/this.width);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const xx=x+dx,zz=z+dz,kk=zz*this.width+xx;if(!this.isFree(xx,zz)||!this.allowed.has(kk)||closed.has(kk))continue;if(dx&&dz&&(!this.isFree(x+dx,z)||!this.isFree(x,z+dz)))continue;const score=g[k]+Math.hypot(dx,dz);if(score<g[kk]){g[kk]=score;prev[kk]=k;if(!open.includes(kk))open.push(kk);}}}if(prev[b]<0)return [this.world(a)];const raw=[];for(let k=b;k!==-1;k=prev[k]){raw.unshift(this.world(k));if(k===a)break;}const points=[raw[0]];let i=0;while(i<raw.length-1){let j=raw.length-1;while(j>i+1&&!this.clear(raw[i],raw[j]))j--;points.push(raw[j]);i=j;}return points;}
}

export const stations={
  futures:{label:'Futures desk',activity:'Menganalisis futures',kind:'type',position:[.72,.20],look:[1.15,-.95],duration:19},
  crypto:{label:'Crypto desk',activity:'Memantau BTC & ETH',kind:'type',position:[.49,5.05],look:[.49,3.96],duration:23},
  forex:{label:'Forex desk',activity:'Meninjau EUR/USD',kind:'review',position:[-2.80,-1.25],look:[-2.8,.05],duration:21},
  market:{label:'Market wall',activity:'Membaca market overview',kind:'review',position:[4.6,-.03],look:[7.1,-.05],duration:13},
  meeting:{label:'Ruang rapat',activity:'Menyiapkan briefing',kind:'review',position:[1.5,-4.25],look:[3.2,-6],duration:12},
  coffee:{label:'Coffee corner',activity:'Istirahat sejenak',kind:'coffee',position:[-2.05,-5.45],look:[-1.96,-6.43],duration:10},
  lounge:{label:'Lounge',activity:'Mengevaluasi sesi',kind:'review',position:[4.05,1.1],look:[5.7,1.5],duration:12},
};
export const roster=[
 {name:'ROBO–01',role:'Futures analyst',route:['futures','market','meeting','coffee','futures','crypto'],offset:0},
 {name:'ROBO–02',role:'Crypto researcher',route:['crypto','lounge','market','forex','coffee'],offset:8},
 {name:'ROBO–03',role:'Forex strategist',route:['forex','meeting','coffee','market','futures'],offset:13},
];
export function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
export function smooth(t){return t*t*(3-2*t);}
export function wrapAngle(v){return Math.atan2(Math.sin(v),Math.cos(v));}
export function marketSeries(seed=1,count=64,time=0){let v=100+seed*5;const points=[];for(let i=0;i<count;i++){const open=v;v+=Math.sin(i*.72+seed*2.6)*.55+Math.sin(i*1.77+seed)*.28+Math.sin(i*.09+seed)*.34;const close=v+(i===count-1?Math.sin(time*.7+seed)*.3:0);points.push({open,close,high:Math.max(open,close)+.24+Math.abs(Math.sin(i*3.1))*.42,low:Math.min(open,close)-.24-Math.abs(Math.cos(i*1.3))*.32,volume:12+Math.abs(Math.sin(i*.38+seed))*58});}return points;}
