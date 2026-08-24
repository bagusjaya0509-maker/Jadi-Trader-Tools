import{z as r}from"./index-BBDDf5nb.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=r("Ban",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m4.9 4.9 14.2 14.2",key:"1m5liu"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=r("ChevronsUpDown",[["path",{d:"m7 15 5 5 5-5",key:"1hf1tw"}],["path",{d:"m7 9 5-5 5 5",key:"sgt6xg"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=r("Minus",[["path",{d:"M5 12h14",key:"1ays0h"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=r("Settings2",[["path",{d:"M20 7h-9",key:"3s1dr2"}],["path",{d:"M14 17H5",key:"gfn3mx"}],["circle",{cx:"17",cy:"17",r:"3",key:"18b49y"}],["circle",{cx:"7",cy:"7",r:"3",key:"dfmy0x"}]]),n="jt.drafSinyal",s=1800*1e3;function m(t){try{return sessionStorage.setItem(n,JSON.stringify({...t,waktu:Date.now()})),!0}catch{try{return sessionStorage.setItem(n,JSON.stringify({...t,sampul:"",waktu:Date.now()})),!0}catch{return!1}}}function l(){try{const t=sessionStorage.getItem(n);if(!t)return null;sessionStorage.removeItem(n);const e=JSON.parse(t);return!e||typeof e.entry!="number"||Date.now()-(e.waktu||0)>s?null:e}catch{return null}}export{o as B,i as C,u as M,y as S,l as a,m as s};
