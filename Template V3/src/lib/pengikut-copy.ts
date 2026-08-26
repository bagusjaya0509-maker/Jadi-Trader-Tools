import { useEffect, useRef } from 'react';
import { daftarAnalisa, bukaIsi, type RingkasAnalisa } from '@/lib/analisa';
import { daftarLangganan } from '@/lib/copy-langganan';
import { daftarSimbolMt5 } from '@/lib/pasar';
import { simbolDasarMt5 } from '@/lib/simbol';
import { kirimPerintahMt5, tungguHasilMt5 } from '@/lib/mt5-order';
import { kontrakBerlaku, deteksiJenisAkun, lotUntukCopy } from '@/lib/ukuran-posisi';
import { useAkunMt5 } from '@/lib/akun';
import { catatCopy, petaCopy, tandaSinyal, tandaiBatalSelesai } from '@/lib/tanda-copy';

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
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI_SUDAH = (uid: string) => `jt.copy.sudah.${uid}`;
const KUNCI_JALAN = (uid: string) => `jt.copy.jalan.${uid}`;

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

  useEffect(() => {
    if (!uid) return;
    let hidup = true;

    async function putaran() {
      if (!hidup || sibuk.current) return;
      const langganan = daftarLangganan(uid);
      if (langganan.length === 0) return;

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
            /* DITANDAI DULU, baru dikirim. Kalau tab ditutup di tengah
               pengiriman, sinyal ini hilang — dan kehilangan satu salinan
               jauh lebih murah daripada mengirimnya dua kali saat aplikasi
               dibuka lagi. */
            tandai(uid!, s.id);
            try {
              const { isi } = await bukaIsi(s.id);
              if (!(isi.entry > 0) || !(isi.sl > 0)) continue;

              const cari = s.pasangan.replace(/^MT5:/i, '').toUpperCase();
              const simbol = simbolku.find((x) => x.toUpperCase() === cari)
                          ?? simbolku.find((x) => simbolDasarMt5(x) === cari);
              if (!simbol) continue;

              const h = lotUntukCopy({
                lotDiminta: 0,
                rugiMaks: l.rugiMaks,
                kontrak: kontrakBerlaku(l.kontrak, jenis),
                jarakHarga: Math.abs(isi.entry - isi.sl),
              });
              if (h.lot < 0.01) continue;

              /* SISI SL/TP DIPERIKSA di sini juga, walau panel manual sudah
                 memeriksanya. Tidak ada manusia yang melihat layar saat ini
                 berjalan, jadi sinyal yang salah tulis tidak boleh lolos
                 hanya karena pemeriksanya ada di tempat lain. */
              const benar = s.arah === 'BUY'
                ? isi.sl < isi.entry && (!isi.tp || isi.tp > isi.entry)
                : isi.sl > isi.entry && (!isi.tp || isi.tp < isi.entry);
              if (!benar) continue;

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
              }
            } catch { /* satu sinyal gagal tidak boleh menghentikan sisanya */ }
          }
        }

        /* ── SINYAL YANG DITARIK ANALISNYA ────────────────────────────
           Yang dibatalkan HANYA order yang belum terisi. Sinyal yang
           ditarik setelah harganya kena artinya analisnya berhenti
           memantau, bukan bahwa posisi yang sudah berjalan harus ditutup
           rugi pada detik itu juga — menutup paksa posisi hidup adalah
           keputusan uang yang tidak pernah diminta siapa pun.

           Tiketnya diikat dulu lewat petaCopy: catatan salinan lahir
           beberapa detik sebelum tiketnya ada, dan tanpa pengikatan itu
           tidak ada yang bisa ditunjuk untuk dibatalkan. */
        const ditarik = semua.filter((s) => perAnalis.has(s.uid) && s.hasil === 'batal');
        if (ditarik.length) {
          petaCopy(uid!, [...akun.posisi, ...akun.pending].map((p) => ({
            tiket: p.tiket, simbol: p.simbol, arah: p.arah, lot: p.lot,
          })));
          for (const s of ditarik) {
            if (!hidup) break;
            const t = tandaSinyal(uid!, s.id);
            if (!t || t.batalSelesai || !t.tiket) continue;
            if (!akun.pending.some((o) => o.tiket === t.tiket)) {
              /* Sudah jadi posisi: dibiarkan berjalan, dan penandanya
                 ditutup supaya putaran berikutnya tidak memeriksanya lagi.
                 Kalau tiketnya tidak ada di kedua daftar, itu bisa berarti
                 EA sedang tersendat — dibiarkan, putaran berikutnya
                 melihatnya lagi. */
              if (akun.posisi.some((o) => o.tiket === t.tiket)) tandaiBatalSelesai(uid!, s.id);
              continue;
            }
            try {
              const { id } = await kirimPerintahMt5({ aksi: 'TUTUP', tiket: t.tiket });
              const r = await tungguHasilMt5(id);
              if (r.status === 'sukses') tandaiBatalSelesai(uid!, s.id);
            } catch { /* satu gagal tidak menghentikan sisanya */ }
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
