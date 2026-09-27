/* ── KENAPA 60, BUKAN 45 ────────────────────────────────────────────────
   Gerbang frame di main.js berbunyi:

     if(now-lastDraw<1000/profilMutu.fps-1)return;

   dan requestAnimationFrame di layar 60 Hz cuma bisa datang pada kelipatan
   16,67 ms. Jadi ambangnya dibulatkan ke atas oleh kenyataan itu:

     fps 30 -> ambang 32,3 ms -> nyata 30 fps
     fps 45 -> ambang 21,2 ms -> nyata 30 fps   <-- sama saja dengan Ringan
     fps 60 -> ambang 15,7 ms -> nyata 60 fps

   Angka 45 tidak pernah menghasilkan 45. Frame pada 16,67 ms ditolak
   (16,67 < 21,2), yang berikutnya pada 33,3 ms lolos — persis setengah.
   Jadi "Seimbang" selama ini menggambar 30 fps sambil tetap membayar bloom
   dan pantulan yang tidak dibayar "Ringan": ongkos profil menengah,
   kehalusan profil terendah.

   60 melepas gerbangnya: rAF sendiri yang menentukan lajunya, dan kalau
   GPU tidak sanggup ia turun sendiri — turun yang wajar, bukan dipaksa ke
   separuh. Diukur, bukan ditaksir: hitungannya ada di atas.

   30 di profil Ringan DIBIARKAN — ia memang habis dibagi 60, jadi
   pacunya rata. Yang cacat cuma angka di tengah. */
export const QUALITY={
  low:{label:'Ringan',pixelRatio:.85,shadowSize:1024,fps:30,ao:false,bloom:false,samples:0,reflectionSize:0,screenInterval:1.3,bayangan:true,bayanganRobot:false,lampu:'hemat',kantorPerluasan:true,kantorAtas:true,lampuAtap:true},
  medium:{label:'Seimbang',pixelRatio:1,shadowSize:2048,fps:60,ao:false,bloom:true,samples:0,reflectionSize:128,screenInterval:.9,bayangan:true,bayanganRobot:true,lampu:'sedang',kantorPerluasan:true,kantorAtas:true,lampuAtap:true},
  high:{label:'Tinggi',pixelRatio:1.5,shadowSize:4096,fps:60,ao:true,bloom:true,samples:2,reflectionSize:256,screenInterval:.65,bayangan:true,bayanganRobot:true,lampu:'semua',kantorPerluasan:true,kantorAtas:true,lampuAtap:true},
};
const KEY='jaditrader-floor-quality';
export function readQuality(){
  try{const saved=localStorage.getItem(KEY);if(QUALITY[saved])return saved;}catch{}
  return innerWidth<760?'low':'medium';
}
export function saveQuality(value){try{localStorage.setItem(KEY,value);}catch{}}

/* ══ SETELAN MANUAL DI ATAS PROFIL ═══════════════════════════════════════
   Diminta pemilik 26 Sep 2026, sesudah menimbang tulis-ulang di engine game
   dan memilih ini dulu: "pengaturan kualitas ruang trabar-nya kamu buat
   dalam 1 panel setting yang bisa diatur, jadi yang sekarang ga hilang tapi
   bisa kita atur manual."

   Bentuknya LAPISAN, bukan pengganti. Tiga profil di atas tetap jadi titik
   berangkat; yang disimpan di sini cuma medan yang benar-benar DIUBAH
   tangan. Dua akibatnya, dan dua-duanya disengaja:

     · Memilih profil = membuang seluruh lapisan ini. Profil adalah
       "kembalikan ke keadaan yang saya tahu", dan profil yang diam-diam
       masih membawa sisa setelan lama tidak pernah bisa dipakai begitu.

     · Medan yang tidak disentuh ikut berubah saat profilnya berganti.
       Menyalin seluruh profil ke lapisan ini pada sentuhan pertama akan
       membekukan sepuluh angka hanya karena orangnya menggeser satu.

   Kuncinya TERPISAH dari kunci profil supaya yang satu bisa dihapus tanpa
   merusak yang lain. */
const KEY_KUSTOM='jaditrader-floor-mutu-kustom';

/** Medan yang boleh ditimpa tangan. Ditulis tegas, bukan menerima apa pun
 *  yang kebetulan ada di localStorage: berkas setelan yang rusak atau
 *  disunting tangan tidak boleh bisa menyuntikkan medan asing ke profil
 *  yang dipakai renderer. */
const MEDAN_SAH=new Set([
  'pixelRatio','shadowSize','fps','ao','bloom','reflectionSize','screenInterval',
  'bayangan','bayanganRobot','lampu','kantorPerluasan','kantorAtas','lampuAtap',
]);

export function bacaKustom(){
  try{
    const j=JSON.parse(localStorage.getItem(KEY_KUSTOM)||'{}');
    const bersih={};
    for(const [k,v] of Object.entries(j||{})) if(MEDAN_SAH.has(k)) bersih[k]=v;
    return bersih;
  }catch{ return {}; }
}
export function simpanKustom(obj){
  try{
    if(!obj||!Object.keys(obj).length) localStorage.removeItem(KEY_KUSTOM);
    else localStorage.setItem(KEY_KUSTOM,JSON.stringify(obj));
  }catch{}
}
