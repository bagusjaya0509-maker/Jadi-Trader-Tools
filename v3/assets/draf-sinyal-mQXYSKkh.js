import{t as n}from"./index-Ce06iTCk.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=n("Ban",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m4.9 4.9 14.2 14.2",key:"1m5liu"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=n("Settings2",[["path",{d:"M20 7h-9",key:"3s1dr2"}],["path",{d:"M14 17H5",key:"gfn3mx"}],["circle",{cx:"17",cy:"17",r:"3",key:"18b49y"}],["circle",{cx:"7",cy:"7",r:"3",key:"dfmy0x"}]]),r="jt.drafSinyal",a=1800*1e3;function u(t){try{return sessionStorage.setItem(r,JSON.stringify({...t,waktu:Date.now()})),!0}catch{try{return sessionStorage.setItem(r,JSON.stringify({...t,sampul:"",waktu:Date.now()})),!0}catch{return!1}}}function y(){try{const t=sessionStorage.getItem(r);if(!t)return null;sessionStorage.removeItem(r);const e=JSON.parse(t);return!e||typeof e.entry!="number"||Date.now()-(e.waktu||0)>a?null:e}catch{return null}}export{o as B,i as S,y as a,u as s};
