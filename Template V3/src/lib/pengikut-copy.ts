import { useEffect, useRef } from 'react';
import { daftarAnalisa, bukaIsi, catatDicopy, type RingkasAnalisa } from '@/lib/analisa';
import { daftarLangganan } from '@/lib/copy-langganan';
import { daftarSimbolMt5 } from '@/lib/pasar';
import { simbolDasarMt5 } from '@/lib/simbol';
import { kirimPerintahMt5, tungguHasilMt5 } from '@/lib/mt5-order';
import { kontrakBawaan, kontrakBerlaku, deteksiJenisAkun, lotUntukCopy } from '@/lib/ukuran-posisi';
import { useAkunMt5 } from '@/lib/akun';
import { bacaTanda, catatCopy, petaCopy, tandaSinyal, tandaiBatalSelesai } from '@/lib/tanda-copy';
import { statusPengikutVps } from '@/lib/pengikut-vps';

/* ════════════════════════════════════════════════════════════════════════
   PENGIKUT COPY — menyalin sinyal baru ke akun MT5 sendiri
   ════════════════════════════════════════════════════════════════════════
   Sinyal terbit di kanal analis, dan orang yang mengikutinya mendapat
   order yang sama di terminalnya sendiri, dengan lot dihitung dari batas
   ruginya sendiri.

   ── DI PERAMBAN, DAN ITU DIAKUI ─────────────────────────────────────────
   Ini berjalan selama aplikasinya terbuka. Sinyal yang terbit saat semua
   tab tertutup TIDAK tersalin — dan itu keterbatasan yang nyata, bukan
   yang disamarkan: `waktuJalan` mencatat kapan terakhir ia benar-benar
   memindai supaya layar bisa mengatakannya apa adanya.

   Pemindahan ke VPS nanti tidak mengubah aturannya, cuma tempatnya
   berjalan. Semua keputusan di bawah — apa yang boleh disalin, berapa
   lotnya, apa yang dilewati — sengaja ditulis sebagai fungsi murni supaya
   ikut pindah utuh.

   ── EMPAT PAGAR, SEMUANYA WAJIB ─────────────────────────────────────────
   Ini mengirim order dengan uang sungguhan tanpa ada yang menekan tombol,
   jadi pagarnya bukan kehati-hatian tambahan melainkan syarat berdirinya:

   1. HANYA yang diikuti, dan HANYA Trade-Fi. Kripto butuh kunci API bursa
      — jalur keamanan yang sama sekali berbeda, dan menyatukannya berarti
      satu sakelar punya dua arti.
   2. HANYA sinyal yang terbit SESUDAH langganannya dimulai. Tanpa ini,
      menekan "Ikuti" akan membuka semua sinyal lama analis itu sekaligus
      — puluhan order dalam satu detik, dari satu klik yang tidak
      menjanjikan apa pun seperti itu.
   3. SEKALI SAJA per sinyal, dicatat permanen. Dicatat SEBELUM dikirim:
      pemuatan ulang di tengah pengiriman tidak boleh membuat order kedua,
      dan kehilangan satu salinan jauh lebih murah daripada mengirim dua.
   4. Satu per satu, berurutan. Sepuluh sinyal terbit berbarengan tidak
      boleh jadi sepuluh permintaan serentak ke terminal yang sama.
   5. Yang ditarik analisnya ditarik juga di sini — order menunggu maupun
      posisi yang terlanjur terisi. Mengikuti berarti mengikuti sampai
      keluarnya; salinan yang ditinggalkan berjalan sendiri adalah posisi
      yang tidak ada lagi yang memantaunya.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI_SUDAH = (uid: string) => `jt.copy.sudah.${uid}`;
const KUNCI_JALAN = (uid: string) => `jt.copy.jalan.${uid}`;
const KUNCI_LOG = (uid: string) => `jt.copy.log.${uid}`;

/* ── CATATAN KEJADIAN ─────────────────────────────────────────────────
   Sebelum ini, sinyal yang tidak jadi disalin hilang tanpa jejak: setiap
   pemeriksaan yang gagal cuma `continue`, dan yang terlihat di layar
   adalah tidak terjadi apa-apa. Tidak terjadi apa-apa punya sepuluh sebab
   yang berbeda — EA mati, simbolnya tidak ada di broker, sinyalnya terbit
   sebelum diikuti, lotnya membulat jadi nol — dan menyamakan semuanya
   membuat fiturnya mustahil dipercaya: orang tidak bisa membedakan
   "sistemnya rusak" dari "memang tidak seharusnya masuk". */
export interface LogCopy {
  waktu: number;
  sinyal: string;
  pasangan: string;
  analis: string;
  hasil: 'terkirim' | 'dilewati' | 'gagal';
  sebab: string;
}

export function bacaLogCopy(uid?: string | null): LogCopy[] {
  if (!uid) return [];
  try {
    const j = JSON.parse(localStorage.getItem(KUNCI_LOG(uid)) || '[]');
    return Array.isArray(j) ? (j as LogCopy[]).slice().reverse() : [];
  } catch { return []; }
}

function catat(uid: string, e: Omit<LogCopy, 'waktu'>) {
  try {
    const d: LogCopy[] = JSON.parse(localStorage.getItem(KUNCI_LOG(uid)) || '[]');
    /* Sebab yang sama untuk sinyal yang sama tidak ditulis ulang. Sinyal
       yang dilewati karena alasan menetap akan diperiksa lagi tiap menit,
       dan tanpa ini catatannya penuh oleh satu kejadian yang sama. */
    const akhir = d[d.length - 1];
    if (akhir && akhir.sinyal === e.sinyal && akhir.sebab === e.sebab) return;
    d.push({ ...e, waktu: Date.now() });
    localStorage.setItem(KUNCI_LOG(uid), JSON.stringify(d.slice(-40)));
  } catch { /* mode privat */ }
}

/** Sinyal yang SUDAH pernah disalin. Dibatasi 500 terakhir — daftar yang
 *  tumbuh selamanya akhirnya melewati batas localStorage, dan yang gagal
 *  ditulis di situ adalah justru penjaga yang mencegah order ganda. */
function bacaSudah(uid: string): string[] {
  try {
    const j = JSON.parse(localStorage.getItem(KUNCI_SUDAH(uid)) || '[]');
    return Array.isArray(j) ? j.map(String) : [];
  } catch { return []; }
}

function tandai(uid: string, id: string) {
  try {
    const d = bacaSudah(uid);
    if (d.includes(id)) return;
    d.push(id);
    localStorage.setItem(KUNCI_SUDAH(uid), JSON.stringify(d.slice(-500)));
  } catch { /* mode privat */ }
}

export function bacaWaktuPindai(uid?: string | null): number {
  if (!uid) return 0;
  try { return Number(localStorage.getItem(KUNCI_JALAN(uid))) || 0; } catch { return 0; }
}

/** Keputusan "sinyal ini disalin atau tidak" — fungsi murni, tanpa jaringan.
 *  Ditulis terpisah supaya bisa diuji dan supaya ia ikut pindah utuh saat
 *  pengikutnya dipindah ke server. */
export function layakSalin(s: RingkasAnalisa, sejak: number, sudah: string[]): boolean {
  if (sudah.includes(s.id)) return false;
  /* Kripto lewat. Bukan karena rumusnya beda — karena jalurnya butuh kunci
     API bursa, dan itu keamanan yang berbeda jenis. */
  if (/USDT$/i.test(s.pasangan)) return false;
  /* Sudah selesai atau ditarik: tidak ada yang bisa diikuti lagi. */
  if (s.hasil === 'sl' || s.hasil === 'tp' || s.hasil === 'batal') return false;
  /* Terbit SEBELUM langganan dimulai — bukan sinyal yang ia daftar untuk
     ikuti, melainkan riwayat. */
  if (!(s.dibuat > sejak)) return false;
  return true;
}

/**
 * Menyalakan pengikut. Dipanggil sekali di kerangka aplikasi supaya ia
 * hidup di halaman mana pun, bukan cuma saat Copy Signal sedang dibuka.
 *
 * @param uid Pengguna yang sedang masuk. Kosong = tidak berjalan.
 * @param jeda Selang pindai, milidetik.
 */
export function usePengikutCopy(uid: string | null | undefined, jeda = 60_000) {
  /* Keadaan akun dibaca lewat REF, bukan dependensi efek. Saldo dan
     ekuitasnya berubah tiap laporan EA; menjadikannya dependensi berarti
     seluruh pemindai dibongkar-pasang tiap kali angkanya bergerak — dan
     putaran yang sedang mengirim order ikut dibatalkan di tengah jalan. */
  const status = useAkunMt5();
  const akunRef = useRef(status);
  akunRef.current = status;
  /* Penjaga tumpang-tindih. Satu putaran bisa memakan puluhan detik kalau
     ada beberapa sinyal; tanpa ini putaran berikutnya berangkat di
     tengahnya dan keduanya mengirim sinyal yang sama. */
  const sibuk = useRef(false);

  /* MUNDUR SAAT SERVER YANG MEMEGANG. Untuk akun pemilik, pengikutnya
     hidup di VPS — dan dua pengikut untuk satu akun berarti SATU sinyal
     menjadi DUA order. Keputusannya milik server (/api/copy/pengikut);
     kalau servernya tidak terjangkau, jawabannya null dan sikap amannya
     adalah TETAP berjalan: pengikut ganda dicegah `sudah` per sisi, tapi
     pengikut nol berarti sinyal hilang tanpa ada yang mencatatnya. */
  const serverPegang = useRef(false);

  useEffect(() => {
    if (!uid) return;
    let hidup = true;
    void statusPengikutVps().then((s) => {
      if (hidup && s?.aktif) serverPegang.current = true;
    });

    async function putaran() {
      if (!hidup || sibuk.current || serverPegang.current) return;
      const langganan = daftarLangganan(uid);
      /* Tidak melanggan siapa pun BUKAN berarti tidak ada apa-apa yang perlu
         diurus: salinan manual juga meninggalkan catatan, dan penarikan
         sinyalnya tetap harus sampai. Berhenti di sini kalau keduanya kosong
         akan membuat satu-satunya orang yang menyalin dengan tangan menjadi
         satu-satunya orang yang tidak pernah ditarik. */
      if (langganan.length === 0 && bacaTanda(uid).length === 0) return;

      const akun = akunRef.current;
      /* EA belum melapor: tidak ada terminal yang bisa menerima perintah.
         Diam saja — mencoba mengirim cuma menumpuk perintah kedaluwarsa. */
      if (!akun || akun.terhubung !== true) return;

      sibuk.current = true;
      try {
        const semua = await daftarAnalisa();
        const sudah = bacaSudah(uid!);
        const perAnalis = new Map(langganan.map((l) => [l.analisUid, l]));

        const antre = semua
          .filter((s) => perAnalis.has(s.uid))
          .filter((s) => layakSalin(s, perAnalis.get(s.uid)!.sejak, sudah))
          /* Terlama duluan: urutan masuknya order harus sama dengan urutan
             analisnya memposting, bukan kebalikannya. */
          .sort((a, b) => a.dibuat - b.dibuat);

        if (antre.length) {
          const simbolku = await daftarSimbolMt5();
          const jenis = deteksiJenisAkun(akun.mataUang);

          for (const s of antre) {
            if (!hidup) break;
            const l = perAnalis.get(s.uid)!;
            const jejak = { sinyal: s.id, pasangan: s.pasangan, analis: l.analisNama || 'Analis' };
            try {
              const { isi } = await bukaIsi(s.id);
              if (!(isi.entry > 0) || !(isi.sl > 0)) {
                catat(uid!, { ...jejak, hasil: 'dilewati', sebab: 'Sinyalnya belum punya entry dan SL yang bisa dihitung.' });
                continue;
              }

              const cari = s.pasangan.replace(/^MT5:/i, '').toUpperCase();
              const simbol = simbolku.find((x) => x.toUpperCase() === cari)
                          ?? simbolku.find((x) => simbolDasarMt5(x) === cari);
              if (!simbol) {
                catat(uid!, { ...jejak, hasil: 'dilewati', sebab: `Terminalmu tidak punya simbol yang cocok dengan ${cari}. Tampilkan simbolnya di Market Watch MT5.` });
                continue;
              }

              /* KONTRAK DARI PASANGAN SINYALNYA, bukan dari langganan.
                 Langganan menyimpan satu angka kontrak yang dibekukan dari
                 pasangan CONTOH saat orangnya menekan "Ikuti" — dan ukuran
                 kontrak milik SIMBOLNYA, bukan milik orangnya. Yang ikut
                 dari kartu BTCUSDT membawa 100.000 ke sinyal emas yang
                 kontraknya 100: lot hasil hitungannya seribu kali terlalu
                 kecil, membulat ke nol, dan SEMUA sinyalnya dilewati dengan
                 pesan "lotnya harus 0.0001". Itu persis yang terjadi pada
                 pemiliknya, 26 Agu 2026 — dan yang membongkarnya justru
                 catatan kejadian yang menuliskan angkanya apa adanya. */
              const h = lotUntukCopy({
                lotDiminta: 0,
                rugiMaks: l.rugiMaks,
                kontrak: kontrakBerlaku(kontrakBawaan(cari), jenis),
                jarakHarga: Math.abs(isi.entry - isi.sl),
              });
              if (h.lot < 0.01) {
                catat(uid!, { ...jejak, hasil: 'dilewati', sebab: h.sebab || `Batas rugi $${l.rugiMaks} terlalu kecil untuk jarak SL sinyal ini — lotnya membulat jadi nol.` });
                continue;
              }

              /* SISI SL/TP DIPERIKSA di sini juga, walau panel manual sudah
                 memeriksanya. Tidak ada manusia yang melihat layar saat ini
                 berjalan, jadi sinyal yang salah tulis tidak boleh lolos
                 hanya karena pemeriksanya ada di tempat lain. */
              const benar = s.arah === 'BUY'
                ? isi.sl < isi.entry && (!isi.tp || isi.tp > isi.entry)
                : isi.sl > isi.entry && (!isi.tp || isi.tp < isi.entry);
              if (!benar) {
                catat(uid!, { ...jejak, hasil: 'dilewati', sebab: 'SL/TP sinyalnya ada di sisi yang salah terhadap entry.' });
                continue;
              }

              /* DITANDAI DI SINI, tepat sebelum berangkat — bukan di awal
                 putaran seperti sebelumnya.

                 Menandainya di awal memang mencegah order ganda, tapi ia
                 juga membakar sinyal yang BELUM PERNAH dikirim: satu
                 kegagalan sementara (daftar simbol EA belum sempat termuat,
                 jaringan tersendat) menandainya "sudah" selamanya, dan
                 sinyal itu tidak akan pernah dicoba lagi walau semenit
                 kemudian semuanya normal. Sifat yang penting cuma satu —
                 tercatat SEBELUM perintahnya berangkat — dan itu tetap
                 dipegang di sini. */
              tandai(uid!, s.id);

              const { id } = await kirimPerintahMt5({
                aksi: 'BUKA', simbol, arah: s.arah, lot: h.lot,
                sl: isi.sl, tp: isi.tp, entry: isi.entry,
              });
              const hasil = await tungguHasilMt5(id);
              /* DICATAT HANYA KALAU BENAR-BENAR TERPASANG. Tanda "salinan"
                 untuk order yang tidak pernah ada akan menempel di posisi
                 manual pertama yang kebetulan seukuran — keterangan palsu
                 tentang dari mana sebuah order berasal. */
              if (hasil.status === 'sukses') {
                catatCopy(uid!, {
                  simbol, arah: s.arah, lot: h.lot,
                  analis: l.analisNama || 'Analis',
                  sinyal: s.id,
                });
                catat(uid!, { ...jejak, hasil: 'terkirim', sebab: `${s.arah} ${h.lot} lot ${simbol} — ${hasil.pesan}` });
                void catatDicopy(s.id);
              } else {
                catat(uid!, { ...jejak, hasil: 'gagal', sebab: hasil.pesan || `Terminal menjawab: ${hasil.status}` });
              }
            } catch (e) {
              /* Satu sinyal gagal tidak boleh menghentikan sisanya — tapi
                 kegagalannya tetap harus terlihat. */
              catat(uid!, { ...jejak, hasil: 'gagal', sebab: e instanceof Error ? e.message : 'Gagal mengirim perintah.' });
            }
          }
        }

        /* ── SINYAL YANG DITARIK ANALISNYA ────────────────────────────
           Ditarik berarti DITARIK: order yang masih menunggu dibatalkan,
           dan salinan yang TERLANJUR TERISI ikut ditutup di harga pasar.

           Awalnya yang sudah jadi posisi sengaja dibiarkan berjalan —
           menutup paksa posisi hidup memang keputusan uang. Tapi
           membiarkannya berarti sesuatu yang lebih buruk: pemiliknya
           memegang posisi yang TIDAK ADA LAGI yang memantaunya. Analisnya
           sudah pergi dari rencana itu, dan yang menyalin tidak pernah
           menyatakan mau melanjutkan sendiri — ia menyatakan mau mengikuti.
           Posisi yatim seperti itu justru yang paling sering dibiarkan
           sampai kena SL. Diputuskan pemilik, 26 Agu 2026.

           KENAPA INI BISA TERJADI SAMA SEKALI, padahal analis cuma boleh
           menarik sinyal yang belum terisi: harga yang dilihat penilai dan
           harga di broker si penyalin bukan harga yang sama. Entry yang
           belum tersentuh di satu tempat sudah tersentuh di tempat lain,
           dan selisih beberapa detik saja sudah cukup. Itu bukan kasus
           langka yang bisa diabaikan — itu kasus BIASA di dua broker
           berbeda.

           Satu perintah untuk keduanya: EA memilih menutup posisi atau
           menghapus pending menurut tiketnya, karena cuma terminal yang
           tahu tiket itu milik yang mana.

           Tiketnya diikat dulu lewat petaCopy: catatan salinan lahir
           beberapa detik sebelum tiketnya ada, dan tanpa pengikatan itu
           tidak ada yang bisa ditunjuk untuk dibatalkan. */
        /* Bukan cuma analis yang dilangganani. Salinan MANUAL — satu sinyal
           yang ditekan sendiri lewat ikon salin — juga rencana orang lain,
           dan kalau orang itu menariknya, yang meniru tidak jadi lebih
           berhak meneruskannya hanya karena tombolnya ditekan tangan.
           Penandanya: ada catatan salinan lokal untuk sinyal itu. */
        const ditarik = semua.filter((s) => s.hasil === 'batal'
          && (perAnalis.has(s.uid) || !!tandaSinyal(uid!, s.id)));
        if (ditarik.length) {
          petaCopy(uid!, [...akun.posisi, ...akun.pending].map((p) => ({
            tiket: p.tiket, simbol: p.simbol, arah: p.arah, lot: p.lot,
          })));
          for (const s of ditarik) {
            if (!hidup) break;
            const t = tandaSinyal(uid!, s.id);
            if (!t || t.batalSelesai || !t.tiket) continue;

            const menggantung = akun.pending.some((o) => o.tiket === t.tiket);
            const berjalan = akun.posisi.some((o) => o.tiket === t.tiket);
            /* Tidak ada di kedua daftar. Bisa berarti ordernya memang sudah
               tidak ada, bisa berarti EA sedang tersendat — dan keduanya
               tidak bisa dibedakan dari sini. Dibiarkan tanpa penanda
               selesai: putaran berikutnya melihatnya lagi. */
            if (!menggantung && !berjalan) continue;

            const jejak = { sinyal: s.id, pasangan: s.pasangan, analis: t.analis };
            try {
              const { id } = await kirimPerintahMt5({ aksi: 'TUTUP', tiket: t.tiket });
              const r = await tungguHasilMt5(id);
              if (r.status === 'sukses') {
                tandaiBatalSelesai(uid!, s.id);
                catat(uid!, { ...jejak, hasil: 'terkirim', sebab: berjalan
                  ? `Analis menarik sinyalnya — posisi #${t.tiket} ikut ditutup di harga pasar.`
                  : `Analis menarik sinyalnya — order menunggu #${t.tiket} dibatalkan.` });
              } else {
                catat(uid!, { ...jejak, hasil: 'gagal', sebab: `Gagal menutup #${t.tiket}: ${r.pesan || r.status}` });
              }
            } catch (e) {
              /* Satu gagal tidak menghentikan sisanya — tapi kegagalan
                 MENUTUP posisi tidak boleh senyap: yang tertinggal adalah
                 uang yang mengambang tanpa siapa pun memantaunya. */
              catat(uid!, { ...jejak, hasil: 'gagal', sebab: e instanceof Error ? e.message : 'Gagal mengirim perintah tutup.' });
            }
          }
        }

        try { localStorage.setItem(KUNCI_JALAN(uid!), String(Date.now())); } catch { /* privat */ }
      } catch { /* jaringan tersendat — putaran berikutnya mencoba lagi */ }
      finally { sibuk.current = false; }
    }

    void putaran();
    const jam = setInterval(() => void putaran(), jeda);
    return () => { hidup = false; clearInterval(jam); };
  }, [uid, jeda]);
}
