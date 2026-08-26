import{z as o,o as h,D as y,P as k}from"./index-DEhFjn7b.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=o("Ban",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m4.9 4.9 14.2 14.2",key:"1m5liu"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=o("ChevronsUpDown",[["path",{d:"m7 15 5 5 5-5",key:"1hf1tw"}],["path",{d:"m7 9 5-5 5 5",key:"sgt6xg"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=o("Minus",[["path",{d:"M5 12h14",key:"1ays0h"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=o("Settings2",[["path",{d:"M20 7h-9",key:"3s1dr2"}],["path",{d:"M14 17H5",key:"gfn3mx"}],["circle",{cx:"17",cy:"17",r:"3",key:"18b49y"}],["circle",{cx:"7",cy:"7",r:"3",key:"dfmy0x"}]]),i="jt.drafSinyal",p=1800*1e3;function M(t){try{return sessionStorage.setItem(i,JSON.stringify({...t,waktu:Date.now()})),!0}catch{try{return sessionStorage.setItem(i,JSON.stringify({...t,sampul:"",waktu:Date.now()})),!0}catch{return!1}}}function D(){try{const t=sessionStorage.getItem(i);if(!t)return null;sessionStorage.removeItem(i);const e=JSON.parse(t);return!e||typeof e.entry!="number"||Date.now()-(e.waktu||0)>p?null:e}catch{return null}}function l(){return(y().url.trim()||k).replace(/\/+$/,"")}async function b(t){const e=h.currentUser;if(!e)throw new Error("Masuk dulu dengan akun Google.");const n=await e.getIdToken(),r=await fetch(`${l()}/api/mt5/perintah/kirim`,{method:"POST",headers:{Authorization:"Bearer "+n,"Content-Type":"application/json"},body:JSON.stringify(t)}),a=await r.json().catch(()=>({}));if(!r.ok)throw new Error((a==null?void 0:a.error)||`Backend menjawab ${r.status}`);return{id:String(a.id)}}async function A(t,e=22){const n=h.currentUser;if(!n)return{status:"tak-diketahui",pesan:"Sesi login habis."};const r=await n.getIdToken(),a=Date.now();for(;;){await new Promise(c=>setTimeout(c,2e3));try{const u=await(await fetch(`${l()}/api/mt5/perintah/status`,{headers:{Authorization:"Bearer "+r}})).json(),s=((u==null?void 0:u.perintah)??[]).find(m=>m.id===t);if(s&&["sukses","gagal","kedaluwarsa"].includes(s.status))return{status:s.status,pesan:String(s.pesan||"")}}catch{}if(Date.now()-a>e*1e3)return{status:"menunggu",pesan:"EA belum melapor — pastikan MT5 terbuka dan AutoTrading menyala."}}}export{f as B,g as C,w as M,S,D as a,b as k,M as s,A as t};
