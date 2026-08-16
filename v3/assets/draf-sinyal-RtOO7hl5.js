import{f as n}from"./index-CIZOCNgS.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=n("Ban",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m4.9 4.9 14.2 14.2",key:"1m5liu"}]]),r="jt.drafSinyal",a=1800*1e3;function c(t){try{return sessionStorage.setItem(r,JSON.stringify({...t,waktu:Date.now()})),!0}catch{try{return sessionStorage.setItem(r,JSON.stringify({...t,sampul:"",waktu:Date.now()})),!0}catch{return!1}}}function i(){try{const t=sessionStorage.getItem(r);if(!t)return null;sessionStorage.removeItem(r);const e=JSON.parse(t);return!e||typeof e.entry!="number"||Date.now()-(e.waktu||0)>a?null:e}catch{return null}}export{u as B,i as a,c as s};
