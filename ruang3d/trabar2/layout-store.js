// The server is authoritative; this object only holds the active editing draft.
export class LayoutStore{
 constructor(status){this.status=status;this.objects={};this.revision=0;this.ready=false;this.auth=false;this.dirty=false;this.saving=false;this.generation=0;this.timer=null;this.conflict=false;}
 async load(){
  this.status('Memuat tata letak…');
  try{const r=await fetch('/api/room-layout',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(r.status===401){this.status('Masuk untuk menyimpan tata letak.','signin');return null;}
   if(!r.ok)throw Error();const data=await r.json();this.objects=data.objects;this.revision=data.revision;this.ready=true;this.auth=true;this.dirty=false;this.conflict=false;this.status(data.updatedAt?'Tata letak tersimpan dimuat.':'Tata letak siap disimpan.');return this.objects;
  }catch{this.status('Tata letak belum bisa dimuat. Coba lagi.','load-error');return null;}
 }
 record(id,value){if(!this.ready||!this.auth)return;this.objects[id]=value;this.generation++;this.dirty=true;this.status('Perubahan belum tersimpan…');clearTimeout(this.timer);this.timer=setTimeout(()=>this.save(),500);}
 async save(){
  clearTimeout(this.timer);if(!this.ready||!this.auth||!this.dirty||this.saving||this.conflict)return;
  this.saving=true;const generation=this.generation;this.status('Menyimpan…');
  try{const body=JSON.stringify({revision:this.revision,objects:this.objects});const r=await fetch('/api/room-layout',{method:'PUT',headers:{'Content-Type':'application/json'},body,keepalive:body.length<60000,signal:AbortSignal.timeout(10000)});
   if(r.status===409){this.conflict=true;this.status('Ada perubahan di tab lain. Muat versi tersimpan untuk melanjutkan.','conflict');return;}
   if(r.status===401){this.auth=false;this.status('Masuk kembali untuk menyimpan.','signin');return;}
   if(!r.ok)throw Error();const data=await r.json();this.revision=data.revision;this.dirty=this.generation!==generation;this.status(this.dirty?'Menyimpan perubahan berikutnya…':'Tersimpan di akun Anda.');
  }catch{this.status('Belum tersimpan. Klik Simpan lagi.','save-error');}
  finally{this.saving=false;if(this.dirty&&this.generation!==generation&&!this.conflict&&this.auth)this.timer=setTimeout(()=>this.save(),100);}
 }
}
