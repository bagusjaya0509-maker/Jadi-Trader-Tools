import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCustomToken, signOut,
  type User,
} from 'firebase/auth';
import { auth, penyediaGoogle, UID_PEMILIK } from '@/lib/firebase';
import { catatKabarPribadi } from '@/lib/kabar-pribadi';

/* ════════════════════════════════════════════════════════════════════════
   AUTENTIKASI + STATUS LANGGANAN
   ════════════════════════════════════════════════════════════════════════
   Keduanya digabung dalam satu context karena hampir setiap layar butuh
   keduanya sekaligus, dan memisahkannya berarti dua provider yang selalu
   dipasang berbarengan — abstraksi yang tidak pernah dipakai sendiri.

   MASA COBA. Dokumen `langganan/{uid}` dibuat SEKALI saat login pertama,
   dengan `mulai` = `serverTimestamp()`. Waktu server, bukan waktu perangkat:
   aturan Firestore menolak nilai yang bukan `request.time`, jadi memundurkan
   jam di HP tidak memperpanjang masa coba. Aturan itu juga menolak `update`
   dari pengguna biasa — masa coba tidak bisa di-reset sendiri.

   Kalau pembuatan dokumen gagal (offline, atau aturan menolak), aplikasi
   TIDAK mengunci pengguna. Jurnal seseorang bukan sandera dari kegagalan
   jaringan; yang dilakukan cuma menandai statusnya 'tidakDiketahui' dan
   membiarkan jalan — penjagaan sesungguhnya tetap di sisi server, yang akan
   menolak tulisan kalau memang tidak berhak.
   ════════════════════════════════════════════════════════════════════════ */

/* ── Login Discord: KODE TUKAR datang lewat hash, bukan tokennya ────────
   Backend VPS menyelesaikan OAuth Discord lalu mengarahkan balik ke sini
   dengan `#discord=<kode acak>`. Kode itu ditukar lewat POST menjadi token
   Firebase yang sesungguhnya.

   Sebelum 15 Agu 2026 yang dikirim adalah tokennya langsung. Chrome lalu
   memasang layar merah "Situs berbahaya" pada URL itu — dan tuduhannya
   bisa dimengerti: domain yang baru berumur beberapa hari, dialihkan dari
   discord.com, membawa JWT yang isinya menyebut identitytoolkit.googleapis.com.
   Bagi pemindai otomatis itu persis bentuk kit phishing yang memanen login
   Google.

   Perbaikannya sekaligus menutup lubang yang sebenarnya: token asli tidak
   lagi tersangkut di riwayat peramban, log server, maupun header Referer.

   Diproses SEKALI saat modul dimuat, sebelum router sempat menganggap hash
   itu alamat halaman. */
if (typeof window !== 'undefined' && window.location.hash.startsWith('#discord=')) {
  const kode = decodeURIComponent(window.location.hash.slice(9));
  /* Hash dibersihkan LEBIH DULU, sebelum permintaan jaringan berangkat.
     Kalau ditunda sampai jawabannya datang, kode itu sempat terekam di
     riwayat — dan kalau permintaannya gagal, ia tertinggal di sana. */
  window.history.replaceState(null, '', window.location.pathname + '#/dashboard');

  void (async () => {
    try {
      /* Menerima DUA bentuk, dan itu disengaja selama masa peralihan.
         Frontend dan backend tidak bisa berganti pada detik yang sama:
         yang satu tayang lewat GitHub Actions, yang satu lewat restart pm2.
         Kalau sisi ini hanya mengerti bentuk baru, setiap orang yang login
         di sela kedua deploy itu gagal masuk tanpa tahu kenapa.

         Token Firebase adalah JWT — selalu punya titik pemisah. Kode tukar
         adalah base64url acak tanpa titik. Membedakannya cukup dengan itu.

         Cabang lama boleh dibuang setelah backend baru terbukti jalan. */
      let token = kode;
      if (!kode.includes('.')) {
        const { dasarBackend } = await import('@/lib/koneksi');
        const r = await fetch(`${dasarBackend()}/api/auth/discord/tukar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kode }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.token) throw new Error(j.error || `Server menjawab ${r.status}`);
        token = j.token;
      }
      await signInWithCustomToken(auth, token);
    } catch (e) {
      console.error('Login Discord gagal:', e);
    }
  })();
}

/* ── PRATINJAU 24 JAM — JALUR TERPISAH, BUKAN BAWAAN LOGIN ───────────────
   Pratinjau TIDAK diberikan hanya karena orang login. Ia dimulai dengan
   sengaja lewat tombol Preview di halaman /template, dan penandanya
   dokumen tersendiri: field `pratinjau`.

   Pemisahan ini bukan kerapian, ia menentukan corongnya. Kalau setiap
   login otomatis dapat 24 jam, orang yang mendarat di /akses — tempat
   kuota event 30 hari ditawarkan — tidak punya alasan mengambilnya:
   ia sudah masuk. Event kuotanya jadi tidak ada gunanya.

   `mulai` SENGAJA tidak dipakai untuk ini. Field itu ditulis pada login
   pertama siapa pun, jadi memakainya berarti kembali ke masa coba
   otomatis yang dicabut 13 Agu 2026 karena persis membocorkan gerbang.

   Yang tetap terbuka, sadar dan diterima: orang bisa membuat akun Google
   baru untuk mendapat 24 jam lagi. Tidak ada sistem berlogin gratis yang
   bisa menutup itu — tapi imbalannya sehari, bukan sebulan.            */
const JAM_PRATINJAU = 24;
const MS_JAM = 3_600_000;
const MS_HARI = 86_400_000;

export type StatusLangganan = 'pratinjau' | 'aktif' | 'habis' | 'tidakDiketahui';

export interface Langganan {
  status: StatusLangganan;
  /** Akun LAMA — sudah ada sebelum gerbang persetujuan dipasang.
   *  Tidak pernah diminta meminta akses, jadi tidak boleh tiba-tiba terkunci
   *  di luar oleh aturan yang belum ada waktu ia mendaftar. */
  warisan: boolean;
  /** Sisa hari langganan. null kalau tidak diketahui. */
  sisaHari: number | null;
  /** Sisa waktu dalam milidetik — dipakai pratinjau, yang umurnya diukur
   *  jam bukan hari. `sisaHari` membulatkan ke atas, jadi ia menulis "1
   *  hari lagi" untuk sisa dua menit. */
  sisaMs: number | null;
  berakhir: Date | null;
}

interface Isi {
  pengguna: User | null;
  memuat: boolean;
  pemilik: boolean;
  langganan: Langganan;
  masuk: () => Promise<void>;
  keluar: () => Promise<void>;
  galat: string | null;
}

/* Gerbang persetujuan mulai berlaku 13 Agustus 2026. Akun yang `mulai`-nya
   lebih awal dari ini mendaftar di masa ketika masuk saja sudah cukup —
   mengunci mereka sekarang berarti menghukum orang karena datang duluan.
   Kalau ada yang perlu dicabut, cabut satu per satu lewat panel, bukan
   dengan aturan yang menyapu semuanya sekaligus. */
const WARISAN_SEBELUM = Date.parse('2026-08-13T00:00:00Z');

const KosongLangganan: Langganan = { status: 'tidakDiketahui', sisaHari: null, sisaMs: null, berakhir: null, warisan: false };
const Konteks = createContext<Isi | null>(null);

/** Timestamp dioper sebagai argumen karena kelasnya baru ada setelah impor
 *  dinamis di bawah — mengimpornya di puncak berkas justru membatalkan
 *  seluruh gunanya. */
function keTanggal(v: any, Timestamp: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate() as Date;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') { const d = new Date(v); return isNaN(+d) ? null : d; }
  return null;
}

/* Firestore diimpor DINAMIS di sini, dan itu bukan gaya-gayaan: berkas ini
   ada di jalur muat awal, sementara fungsi ini hanya berjalan SESUDAH ada
   yang benar-benar masuk. Dengan impor statis, ±450 kB pustaka Firestore
   ikut terunduh oleh setiap pengunjung halaman depan — termasuk yang cuma
   melihat sekilas lalu pergi. Jedanya jatuh saat login, ketika orangnya
   memang sedang menunggu sesuatu. */
/** Pasang PEMANTAU hidup pada `langganan/{uid}`.
 *
 *  Dulu ini `getDoc` sekali saat login, dan itu punya akibat yang baru
 *  terasa di pemakaian nyata: pemilik menekan "Setujui", backend menulis
 *  `bayarSampai` ke Firestore — tapi tab pengguna yang sedang terbuka tidak
 *  pernah diberi tahu. Orangnya tetap melihat layar terkunci sampai ia
 *  menekan muat ulang, dan tidak ada yang memberitahunya bahwa ia harus.
 *  Yang paling merugikan: sebagian menyerah sebelum sempat me-refresh.
 *
 *  `onSnapshot` menutup celah itu — begitu dokumennya berubah di server,
 *  layarnya ikut berubah tanpa disentuh.
 *
 *  Memulangkan fungsi pembatal; pemanggil WAJIB memanggilnya saat pengguna
 *  berganti atau keluar. Pemantau yang tidak dicabut akan terus menulis ke
 *  state komponen yang sudah tidak dipakai, dan pada pergantian akun ia
 *  menimpa data akun baru dengan data akun lama. */
async function pantauLangganan(
  uid: string,
  saatBerubah: (l: Langganan) => void,
): Promise<() => void> {
  const { doc, getDoc, setDoc, serverTimestamp, Timestamp, onSnapshot } =
    await import('firebase/firestore');
  /* Lewat pintu yang sama dengan data.ts. Fungsi INI biasanya berjalan
     lebih dulu (status login diperiksa sejak awal), jadi kalau ia memanggil
     getFirestore sendiri, instans tanpa cache sudah terlanjur dibuat dan
     cache-nya diam-diam tidak pernah aktif. */
  const { ambilDb } = await import('@/lib/firestore');
  const db = ambilDb();
  const ref = doc(db, 'langganan', uid);

  let cuplikan = await getDoc(ref);
  if (!cuplikan.exists()) {
    /* hasOnly(['mulai']) di aturan — jangan tambahkan field lain di sini,
       create-nya akan ditolak seluruhnya. */
    await setDoc(ref, { mulai: serverTimestamp() });
    /* Dibaca ULANG: `serverTimestamp()` cuma penanda saat dikirim, nilainya
       baru ada setelah server mengisinya. Tanpa pembacaan kedua, masa coba
       dihitung dari `null` dan orangnya langsung terlihat 'habis'. */
    cuplikan = await getDoc(ref);
  }

  /* HASIL PERTAMA DIKIRIM SEBELUM PEMANTAU DIPASANG — dan ini bukan
     optimasi, ini perbaikan bug yang menendang orang keluar.
     ────────────────────────────────────────────────────────────────────
     `onSnapshot` memulangkan fungsi pembatalnya SEKETIKA; callback datanya
     baru berbunyi beberapa milidetik kemudian. Jadi `await pantauLangganan()`
     selesai ketika status langganan MASIH 'tidakDiketahui' — pemanggil lalu
     menurunkan `memuat` ke false, gerbang dievaluasi pada status kosong itu,
     dan orang yang aksesnya sah dilempar ke halaman minta-akses. Datanya
     tiba sesaat sesudahnya, tapi navigasinya sudah terjadi.

     Gejalanya persis: login berhasil, tapi begitu halaman di-refresh
     orangnya kembali ke halaman login. Cuplikan yang SUDAH kita ambil di
     atas menutup celah itu tanpa satu pun pembacaan tambahan. */
  saatBerubah(hitungLangganan(cuplikan.data() ?? {}, Timestamp));

  return onSnapshot(
    ref,
    (snap) => saatBerubah(hitungLangganan(snap.data() ?? {}, Timestamp)),
    /* Pemantau gagal (jaringan putus, aturan berubah) TIDAK mengunci siapa
       pun: status terakhir yang diketahui dibiarkan apa adanya. Menjatuhkan
       orang ke 'habis' karena sinyal hilang sedetik adalah cara tercepat
       membuat aplikasi terasa tidak bisa dipercaya. */
    (e) => console.warn('Pemantau langganan berhenti:', e?.message ?? e),
  );
}

/** Mulai pratinjau 24 jam untuk akun yang sedang masuk.
 *
 *  Ditulis dengan `serverTimestamp()` dan HANYA kalau fieldnya belum ada —
 *  dua-duanya juga ditegakkan aturan Firestore, jadi pemeriksaan di sini
 *  bukan pengamannya, cuma penghemat satu penulisan yang pasti ditolak.
 *
 *  Memulangkan hasil yang JUJUR: `sudahPernah` untuk akun yang pratinjaunya
 *  sudah dipakai (termasuk yang sudah habis), dan melempar kalau server
 *  menolak. Yang paling berbahaya di sini adalah menelan galat lalu
 *  memasukkan orangnya seolah berhasil — layar terbuka sebentar, lalu
 *  terkunci lagi begitu status sungguhannya tiba. */
export async function mulaiPratinjau(uid: string): Promise<'mulai' | 'sudahPernah'> {
  const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
  const { ambilDb } = await import('@/lib/firestore');
  const db = ambilDb();
  const ref = doc(db, 'langganan', uid);

  const ada = await getDoc(ref);
  if (ada.exists() && ada.data()?.pratinjau) return 'sudahPernah';

  /* merge: dokumennya mungkin sudah ada dengan `mulai` di dalamnya.
     Menulis tanpa merge akan MENGHAPUS `mulai`, dan itu menghilangkan
     satu-satunya catatan kapan akun ini pertama datang. */
  await setDoc(ref, { pratinjau: serverTimestamp() }, { merge: true });
  return 'mulai';
}

/** Terjemahkan isi dokumen jadi status langganan. Murni — tidak menyentuh
 *  jaringan — supaya pembacaan pertama dan tiap pembaruan onSnapshot
 *  memakai aturan yang sama persis dan tidak mungkin berselisih. */
function hitungLangganan(data: any, Timestamp: any): Langganan {
  const bayarSampai = keTanggal(data.bayarSampai, Timestamp);
  const skrg = Date.now();

  const mulai = keTanggal(data.mulai, Timestamp);
  const warisan = !!mulai && +mulai < WARISAN_SEBELUM;

  if (bayarSampai && +bayarSampai > skrg) {
    return {
      status: 'aktif',
      sisaHari: Math.ceil((+bayarSampai - skrg) / MS_HARI),
      sisaMs: +bayarSampai - skrg,
      berakhir: bayarSampai,
      warisan,
    };
  }

  /* Pratinjau dihitung dari field `pratinjau` — DITULIS SAAT ORANGNYA
     MENEKAN tombol Preview, bukan saat ia login. Akun yang login biasa
     tidak punya field ini sama sekali, jadi ia jatuh ke 'habis' dan
     diarahkan ke /akses tempat kuota event ditawarkan. */
  const mulaiPratinjau = keTanggal(data.pratinjau, Timestamp);
  if (mulaiPratinjau) {
    const akhir = new Date(+mulaiPratinjau + JAM_PRATINJAU * MS_JAM);
    const sisaMs = +akhir - skrg;
    return {
      status: sisaMs > 0 ? 'pratinjau' : 'habis',
      sisaHari: Math.max(0, Math.ceil(sisaMs / MS_HARI)),
      sisaMs: Math.max(0, sisaMs),
      berakhir: akhir,
      warisan,
    };
  }

  /* Sudah pernah login tapi belum pernah mengambil pratinjau dan belum
     punya akses: 'habis' — bukan 'tidakDiketahui'. Bedanya penting,
     karena layar memakai 'tidakDiketahui' untuk "belum terbaca" dan
     menahan diri menampilkan apa pun. */
  if (mulai) {
    return { status: 'habis', sisaHari: 0, sisaMs: 0, berakhir: null, warisan };
  }

  return KosongLangganan;
}

export function PenyediaAuth({ children }: { children: React.ReactNode }) {
  const [pengguna, setPengguna] = useState<User | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [langganan, setLangganan] = useState<Langganan>(KosongLangganan);
  const [galat, setGalat] = useState<string | null>(null);

  /* ── Penutup jendela pratinjau ────────────────────────────────────────
     Status dihitung dari dokumen Firestore, dan dokumen itu TIDAK berubah
     saat waktu berjalan — onSnapshot tidak akan pernah berbunyi hanya
     karena 24 jam lewat. Tanpa pewaktu ini, tab yang dibiarkan terbuka
     memegang akses selamanya: pratinjau sehari yang jadi seumur hidup
     asal jangan menutup peramban.

     Yang dipakai satu setTimeout tepat ke detik berakhirnya, bukan
     interval yang menghitung tiap detik — layar tidak perlu tahu sisa
     waktunya sampai ke detik, ia cuma perlu tahu KAPAN berhenti. */
  useEffect(() => {
    if (langganan.status !== 'pratinjau' || !langganan.berakhir) return;
    const sisa = +langganan.berakhir - Date.now();
    if (sisa <= 0) return;
    const t = setTimeout(
      () => setLangganan((l) => (l.status === 'pratinjau' ? { ...l, status: 'habis', sisaMs: 0, sisaHari: 0 } : l)),
      /* +1 detik: pembulatan jam klien vs server bisa meleset beberapa
         milidetik, dan menutup terlalu cepat lebih menjengkelkan daripada
         menutup sedetik terlambat. */
      sisa + 1000,
    );
    return () => clearTimeout(t);
  }, [langganan.status, langganan.berakhir]);

  useEffect(() => {
    /* Pembatal pemantau Firestore yang sedang aktif. Disimpan di luar
       callback karena onAuthStateChanged bisa berbunyi lagi (ganti akun,
       token kedaluwarsa) sebelum pemantau lama sempat dicabut. */
    let cabutPantau: (() => void) | null = null;
    /* Pencabut denyut kehadiran. Hidup di scope efek ini, bukan di dalam
       callback: onAuthStateChanged berbunyi lagi tiap kali sesi berganti,
       dan denyut lama harus mati sebelum yang baru dipasang — kalau tidak,
       tiap pergantian akun meninggalkan satu interval yang tidak pernah
       berhenti sampai tabnya ditutup. */
    let cabutDenyut: (() => void) | null = null;
    /* Penanda giliran. Pemasangan pemantau itu async; kalau pengguna
       berganti di tengah jalan, pemantau yang terlambat datang harus
       membatalkan dirinya sendiri alih-alih memasang diri untuk akun yang
       sudah bukan pemilik layar. */
    let giliran = 0;

    const berhenti = onAuthStateChanged(auth, async (u) => {
      const punyaGiliran = ++giliran;
      cabutPantau?.();
      cabutPantau = null;
      cabutDenyut?.();
      cabutDenyut = null;

      setPengguna(u);
      if (u) {
        /* Catat kehadiran ke backend supaya halaman Traffic & Sales punya
           daftar klien. Emailnya diambil backend dari ID token yang sudah
           diverifikasi, jadi halaman ini tidak bisa mendaftarkan email orang
           lain. Sengaja tidak di-await: daftar klien tidak boleh menahan
           tampilnya aplikasi. */
        void import('@/lib/admin').then((m) => m.catatKlienHadir());

        /* ── DENYUT KEHADIRAN, tiap 2 menit ──────────────────────────
           Yang menyalakan titik hijau "sedang membuka" di kartu analis.
           Server menganggap kunjungan lebih baru dari 5 menit sebagai
           sedang aktif — dua kali jeda ini, jadi satu denyut yang meleset
           karena jaringan tidak langsung memadamkan lampunya.

           HANYA SAAT TABNYA TERLIHAT. Tab yang ditinggal terbuka semalaman
           bukan orang yang sedang membuka situs, dan lampu yang menyala
           untuk kursi kosong lebih buruk daripada tidak ada lampu.

           Denyut pertama dikirim visibilitychange/interval berikutnya —
           kunjungan barusan sudah ditulis catatKlienHadir() di atas. */
        const denyut = () => {
          if (document.visibilityState !== 'visible') return;
          void import('@/lib/admin').then((m) => m.denyutKlien());
        };
        const jamDenyut = window.setInterval(denyut, 120_000);
        document.addEventListener('visibilitychange', denyut);
        cabutDenyut = () => {
          window.clearInterval(jamDenyut);
          document.removeEventListener('visibilitychange', denyut);
        };

        /* Kabar "berhasil masuk" — dikunci pada `lastSignInTime`, BUKAN pada
           saat callback ini berbunyi. onAuthStateChanged juga berbunyi di
           tiap muat ulang halaman untuk sesi yang sudah ada; memakai
           Date.now() akan mencatat "berhasil masuk" setiap kali orangnya
           menekan F5, dan lonceng yang berisi dua puluh kabar palsu lebih
           buruk daripada lonceng kosong. */
        const kapanMasuk = Date.parse(u.metadata?.lastSignInTime ?? '') || 0;
        if (kapanMasuk) {
          catatKabarPribadi(u.uid, {
            id: `masuk:${kapanMasuk}`,
            jenis: 'masuk',
            judul: 'Berhasil masuk',
            detail: u.email ? `Sebagai ${u.email}` : 'Sesi kamu aktif di perangkat ini.',
            waktu: kapanMasuk,
          });
        }

        /* Status sebelumnya, untuk mengenali PERPINDAHAN ke aktif. Tanpa
           pembanding ini, kabar "akses disetujui" akan terbit tiap kali
           onSnapshot berbunyi pada akun yang memang sudah aktif. */
        let statusSebelum: StatusLangganan | null = null;

        try {
          const cabut = await pantauLangganan(u.uid, (l) => {
            if (punyaGiliran !== giliran) return;
            /* Inilah pasangan dari pemantau hidup di atas: begitu pemilik
               menekan Setujui, statusnya berubah tanpa muat ulang DAN
               loncengnya berbunyi menjelaskan kenapa layarnya berubah. */
            if (statusSebelum && statusSebelum !== 'aktif' && l.status === 'aktif') {
              catatKabarPribadi(u.uid, {
                id: `akses:${l.berakhir ? +l.berakhir : Date.now()}`,
                jenis: 'akses',
                judul: 'Akses kamu sudah aktif',
                detail: l.sisaHari != null
                  ? `Permintaanmu disetujui. Berlaku ${l.sisaHari} hari lagi.`
                  : 'Permintaanmu disetujui.',
              });
            }
            statusSebelum = l.status;
            setLangganan(l);
          });
          if (punyaGiliran === giliran) cabutPantau = cabut;
          else cabut();
        } catch (e) {
          console.warn('Status langganan tidak terbaca:', e);
          if (punyaGiliran === giliran) setLangganan(KosongLangganan);
        }
      } else {
        setLangganan(KosongLangganan);
      }
      if (punyaGiliran === giliran) setMemuat(false);
    });

    return () => { cabutPantau?.(); cabutDenyut?.(); berhenti(); };
  }, []);

  /* ── Hasil alur redirect ──────────────────────────────────────────────
     `masuk` jatuh ke signInWithRedirect saat popupnya diblokir — dan itu
     kejadian biasa di tablet. Kalau redirect-nya BERHASIL, onAuthStateChanged
     di atas menangkapnya sendiri; kalau GAGAL, galatnya cuma bisa diambil di
     sini. Tanpa panggilan ini orangnya dilempar balik ke halaman login tanpa
     satu kata pun penjelasan — persis keluhan "tadi tidak bisa login, tapi
     sekarang bisa" yang tidak menyisakan jejak untuk ditelusuri. */
  useEffect(() => {
    let hidup = true;
    getRedirectResult(auth).catch((e) => { if (hidup) setGalat(pesanAuth(e)); });
    return () => { hidup = false; };
  }, []);

  const nilai = useMemo<Isi>(() => ({
    pengguna,
    memuat,
    pemilik: pengguna?.uid === UID_PEMILIK,
    langganan,
    galat,
    masuk: async () => {
      setGalat(null);
      /* ── SAFARI LANGSUNG KE REDIRECT, TIDAK LEWAT POPUP ──────────────
         Laporan nyata: pengguna MacBook menekan Masuk dan cuma mendapat
         "Gagal masuk. Coba lagi." tanpa kode.

         Safari memperlakukan popup lebih keras daripada peramban lain.
         Jendela yang dibuka bukan sebagai akibat LANGSUNG dari klik —
         dan signInWithPopup membuka jendelanya sesudah beberapa langkah
         internal SDK — sering ditolak diam-diam, dengan galat yang tidak
         selalu bernama auth/popup-blocked. Saat kodenya bukan itu,
         cadangan redirect di bawah tidak pernah jalan.

         Redirect memang jalur yang benar di sini: sejak authDomain
         dipindah ke jaditrader.co.id (lihat lib/firebase.ts), seluruh
         alurnya satu origin, jadi ITP tidak punya storage pihak ketiga
         untuk diblokir. Popup tidak memberi keuntungan apa pun yang
         sepadan dengan risikonya di peramban ini.

         WebKit di iOS juga tertangkap: Chrome dan Firefox di iPhone
         semuanya Safari di balik kulitnya, dan mewarisi perilaku yang
         sama persis. */
      const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
      const webkit = /^((?!chrome|android).)*safari/i.test(ua) || /iPad|iPhone|iPod/.test(ua);

      try {
        if (webkit) {
          await signInWithRedirect(auth, penyediaGoogle);
          return;
        }
        await signInWithPopup(auth, penyediaGoogle);
      } catch (e: any) {
        if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
        /* Popup diblokir peramban adalah kejadian biasa, bukan kegagalan —
           alihkan ke mode redirect daripada menyalahkan pengguna.

           PUNYA try SENDIRI. Sebelumnya panggilan ini telanjang di dalam
           catch: kalau redirect-nya ikut gagal, penolakannya lolos keluar
           dari `masuk` tanpa pernah menyentuh setGalat — layarnya diam,
           dan tidak ada satu pun jejak yang bisa ditelusuri. */
        if (!webkit && (e?.code === 'auth/popup-blocked'
            || e?.code === 'auth/operation-not-supported-in-this-environment')) {
          try {
            await signInWithRedirect(auth, penyediaGoogle);
            return;
          } catch (e2) { setGalat(pesanAuth(e2)); return; }
        }
        setGalat(pesanAuth(e));
      }
    },
    keluar: () => signOut(auth),
  }), [pengguna, memuat, langganan, galat]);

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

/** Kalimat Indonesia untuk galat login, plus KODENYA.
 *
 *  Sebelumnya yang tampil `e.message` mentah dari SDK — kalimat Inggris
 *  seperti "Firebase: Error (auth/network-request-failed)." di tengah
 *  halaman berbahasa Indonesia. Orang yang membacanya tidak tahu apakah ia
 *  salah menekan sesuatu, akunnya bermasalah, atau situsnya yang rusak, dan
 *  22 Agu 2026 pemilik sendiri mengalaminya di tablet lalu cuma ingat
 *  samar-samar bunyinya.
 *
 *  Kodenya SENGAJA tetap ditampilkan di ujung kalimat. Ia satu-satunya
 *  bagian yang bisa ditelusuri kalau kejadiannya berulang, dan tangkapan
 *  layar tanpa kode tidak bisa dipakai memperbaiki apa pun. */
export function pesanAuth(e: unknown): string {
  const kode = String((e as { code?: unknown })?.code ?? '');
  const peta: Record<string, string> = {
    'auth/network-request-failed':
      'Jaringan terputus saat menghubungi Google. Coba lagi setelah sinyalnya stabil.',
    'auth/internal-error':
      'Google menolak permintaan login ini tanpa alasan yang jelas. Biasanya sementara — coba lagi sebentar.',
    'auth/web-storage-unsupported':
      'Peramban ini memblokir penyimpanan situs. Izinkan cookie untuk jaditrader.co.id, atau buka lewat Chrome.',
    'auth/operation-not-supported-in-this-environment':
      'Login Google tidak bisa berjalan di peramban dalam aplikasi. Buka lewat Chrome.',
    'auth/too-many-requests':
      'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
    'auth/user-disabled': 'Akun ini dinonaktifkan.',
    'auth/account-exists-with-different-credential':
      'Email ini sudah terdaftar lewat cara masuk yang berbeda.',
    'auth/popup-closed-by-user': 'Jendela login ditutup sebelum selesai.',
  };
  if (kode === 'auth/unauthorized-domain') {
    return 'Domain ini belum diizinkan di Firebase Console → Authentication → Settings → Authorized domains.';
  }
  const dasar = peta[kode];
  if (dasar) return `${dasar} (${kode})`;
  /* Kode yang belum dikenal: tampilkan KODENYA, bukan kalimat Inggris SDK.
     Kode pendek bisa dibacakan lewat telepon; kalimat SDK tidak. */
  if (kode) return `Gagal masuk — ${kode}. Kirim kode ini kalau berulang.`;

  /* ── TANPA `code` SAMA SEKALI ────────────────────────────────────────
     Inilah yang benar-benar dilihat pengguna MacBook: "Gagal masuk. Coba
     lagi." — kalimat yang tidak menyisakan APA PUN untuk ditelusuri, dan
     karena itu keluhannya tidak bisa ditindaklanjuti sama sekali.

     Galat tanpa `code` bukan galat Firebase: ia TypeError, galat jaringan
     mentah, atau apa pun yang dilempar di luar SDK. Namanya dan sepotong
     pesannya ditampilkan apa adanya. Bahasa Inggris di tengah kalimat
     Indonesia memang jelek — tapi jauh lebih jelek adalah tangkapan layar
     yang tidak bisa dipakai memperbaiki apa pun.

     Dipotong 90 huruf: yang berguna selalu di awal, dan jejak tumpukan
     sepanjang layar cuma menakuti orang yang membacanya. */
  const nama = String((e as { name?: unknown })?.name ?? '').trim();
  const pesan = String((e as { message?: unknown })?.message ?? '').trim().slice(0, 90);
  const jejak = [nama, pesan].filter(Boolean).join(': ');
  return jejak
    ? `Gagal masuk — ${jejak}. Kirim tulisan ini kalau berulang.`
    : 'Gagal masuk. Coba lagi.';
}

export function useAuth() {
  const k = useContext(Konteks);
  if (!k) throw new Error('useAuth dipakai di luar <PenyediaAuth>');
  return k;
}
