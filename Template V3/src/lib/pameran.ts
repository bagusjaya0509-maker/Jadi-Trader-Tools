import { useEffect, useState } from 'react';
import { PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   ANGKA PAMERAN HALAMAN DEPAN
   ════════════════════════════════════════════════════════════════════════
   Hero menampilkan winrate, PNL, dan pertumbuhan porto. Sampai sekarang
   ketiganya diambil dari `data/contoh.ts` dan `data/porto.ts` — angka
   karangan yang dipajang di halaman jualan sebagai rekam jejak.

   Sumber sungguhannya sudah ada: `public/jurnalShowcase`, dokumen publik
   berisi jurnal yang memang sengaja dipamerkan. Yang dipakai di sini bukan
   SDK Firestore melainkan REST API biasa lewat `fetch`, dan itu bukan
   kerewelan: mengimpor SDK-nya menyeret ±450 kB ke halaman yang paling
   sering dibuka orang yang belum tentu masuk. Satu permintaan HTTP
   memberikan angka yang sama tanpa satu kilobyte tambahan di bundel.

   Kalau dokumennya belum ada atau jaringannya gagal, hero tetap tampil —
   angkanya saja yang kosong. Halaman depan tidak boleh gagal karena satu
   permintaan yang bersifat hiasan.
   ════════════════════════════════════════════════════════════════════════ */

/* Lewat CACHE VPS, bukan Firestore langsung. Kuota baca Firestore pernah
   HABIS (429) dan halaman depan tampil kosong: setiap pengunjung membaca
   Firestore sendiri-sendiri, dan kuotanya milik bersama. VPS menyegarkan
   sekali per menit untuk SEMUA pengunjung, dan menyajikan salinan terakhir
   yang baik bahkan saat kuota hulu sedang habis. */
const DOK = `${PROXY_BAWAAN}/api/publik/jurnalShowcase`;

export interface AngkaPameran {
  siap: boolean;
  jumlah: number;
  winrate: number;
  bersih: number;
  /** Kurva saldo kumulatif, untuk grafik hero. */
  kurva: number[];
  tumbuh: number;
  /** Total saldo — angka yang SAMA dengan kartu Total Saldo di Dashboard. */
  saldo: number;
  /** Transaksi paling lama; 0 kalau tidak diketahui. */
  sejak: number;
  /** Judul & subjudul hero yang diterbitkan pemilik — '' kalau belum. */
  judul: string;
  sub: string;
  /** true = angka ILUSTRASI berlabel, bukan jurnal siapa pun. */
  contoh: boolean;
}

const KOSONG: AngkaPameran = { siap: false, jumlah: 0, winrate: 0, bersih: 0, kurva: [], tumbuh: 0, saldo: 0, sejak: 0, judul: '', sub: '', contoh: false };
/* ── Kenapa angkanya tidak lagi di sini ───────────────────────────────
   Dulu berkas ini juga memuat PAMERAN_CONTOH: winrate 57,6%, 213
   transaksi, saldo 1.140,50 — angka ilustrasi yang digambar kartu hero.

   Itu jadi bug yang dilaporkan pemiliknya: kartu di halaman depan tidak
   pernah cocok dengan Dashboard, dan tidak bisa cocok. Ia mengimpor data
   contoh, Dashboard berubah, kartunya tidak. Ia menghapus datanya,
   Dashboard kosong, kartunya tetap. Konstanta tidak menghitung apa pun.

   Angka kartu hero sekarang datang dari useRingkasanAkun() di
   lib/ringkasan.ts — hook yang SAMA dengan yang dipakai Dashboard.
   usePosisiPameran() ikut dibuang: strip posisi terbuka sekarang memakai
   usePosisi(), yang sudah menegakkan kepemilikan.

   Yang TERSISA di berkas ini cuma TEKS hero (judul & subjudul) terbitan
   pemilik — itu memang setelan situs, bukan data akun. Medan angka di
   AngkaPameran dibiarkan supaya bentuk dokumennya tetap terbaca utuh. */

/** Firestore REST membungkus tiap nilai dalam objek bertipe. */
function nilai(f: any): any {
  if (f == null) return null;
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.integerValue !== undefined) return Number(f.integerValue);
  if (f.doubleValue !== undefined) return f.doubleValue;
  if (f.booleanValue !== undefined) return f.booleanValue;
  return null;
}

export function useAngkaPameran(): AngkaPameran {
  const [angka, setAngka] = useState<AngkaPameran>(KOSONG);

  /* Sumber UTAMA: `public/ringkasanAkun` — hasil hitungan Dashboard yang
     diterbitkan pemilik. Membaca angka yang sudah jadi berarti halaman depan
     dan Dashboard tidak mungkin berselisih; menghitung ulang di sini dari
     jurnal mentah adalah cara paling pasti untuk berselisih perlahan. */
  useEffect(() => {
    let hidup = true;
    let teksTerbit = { judul: '', sub: '' };
    fetch(DOK.replace('jurnalShowcase', 'ringkasanAkun'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!hidup) return;
        const f = j?.fields ?? {};
        /* Teks hero menumpang dokumen yang SAMA — dibaca sebelum pemeriksaan
           jumlah supaya pemilik yang baru menerbitkan teks (tapi belum pernah
           menerbitkan ringkasan angka) tetap terlihat teksnya. */
        teksTerbit = {
          judul: String(nilai(f.teksJudul) ?? ''),
          sub: String(nilai(f.teksSub) ?? ''),
        };
        const jumlah = Number(nilai(f.jumlah)) || 0;
        if (!jumlah) throw new Error('kosong');
        const kurva = (f.kurva?.arrayValue?.values ?? []).map((v: any) => Number(nilai(v)) || 0);
        setAngka({
          siap: true,
          contoh: false,
          jumlah,
          winrate: Number(nilai(f.winrate)) || 0,
          bersih: Number(nilai(f.bersih)) || 0,
          kurva: kurva.length > 1 ? kurva : [Number(nilai(f.saldo)) || 0],
          tumbuh: Number(nilai(f.tumbuh)) || 0,
          saldo: Number(nilai(f.saldo)) || 0,
          sejak: Number(nilai(f.sejak)) || 0,
          ...teksTerbit,
        });
      })
      /* Belum ada ringkasan (mis. pemiliknya belum pernah membuka Dashboard
         sejak fitur ini ada) — jatuh ke jurnal pameran seperti sebelumnya. */
      .catch(() => { if (hidup) void muatDariShowcase(setAngka, () => hidup, teksTerbit); });
    return () => { hidup = false; };
  }, []);

  return angka;
}

function muatDariShowcase(
  setAngka: (a: AngkaPameran) => void,
  masihHidup: () => boolean,
  teksTerbit: { judul: string; sub: string },
) {
  return fetch(DOK)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!masihHidup()) return;
        const f = j?.fields ?? {};
        /* Dua jurnal, dua bentuk — dan keduanya harus dibaca apa adanya,
           bukan ditebak:

             · ledgerNoirTrades_v1        array; PnL di `pl`, waktu di `date`
                                          sebagai teks ISO ("2026-07-11T23:16")
             · emaScreenerPrioritySim_v1  objek; transaksi selesai ada di
                                          `.history`, PnL di `pnl`, waktu di
                                          `exitTime` (milidetik)

           `jtCryptoNotes_v1` SENGAJA dilewati: isinya catatan per koin, bukan
           transaksi, dan menjumlahkannya akan menghitung ganda. */
        const baris: { pnl: number; waktu: number }[] = [];

        try {
          const forex = JSON.parse(nilai(f.ledgerNoirTrades_v1) ?? '[]');
          if (Array.isArray(forex)) forex.forEach((x: any) => {
            const pnl = Number(x.pl);
            if (isFinite(pnl)) baris.push({ pnl, waktu: Date.parse(x.date) || 0 });
          });
        } catch { /* satu jurnal rusak tidak boleh menjatuhkan yang lain */ }

        try {
          const sim = JSON.parse(nilai(f.emaScreenerPrioritySim_v1) ?? '{}');
          const riwayat = Array.isArray(sim?.history) ? sim.history : [];
          riwayat.forEach((x: any) => {
            const pnl = Number(x.pnl);
            if (isFinite(pnl)) baris.push({ pnl, waktu: Number(x.exitTime) || 0 });
          });
        } catch { /* idem */ }

        if (!baris.length) { setAngka({ ...KOSONG, ...teksTerbit }); return; }

        baris.sort((a, b) => a.waktu - b.waktu);
        const menang = baris.filter((b) => b.pnl > 0).length;
        const bersih = baris.reduce((s, b) => s + b.pnl, 0);

        /* Saldo awal dari profil yang tersimpan di dokumen yang sama; kalau
           tidak ada, kurva dimulai dari nol dan pertumbuhannya tidak
           dihitung — persentase dengan penyebut karangan lebih menyesatkan
           daripada tidak ada persentase. */
        let saldoAwal = 0;
        try { saldoAwal = Number(JSON.parse(nilai(f.jtAccountProfile_v1) ?? '{}').startBalance) || 0; } catch { /* profil belum ada */ }

        let jalan = saldoAwal;
        const kurva = baris.map((b) => (jalan += b.pnl));
        const tumbuh = saldoAwal > 0 ? ((jalan - saldoAwal) / saldoAwal) * 100 : 0;

        setAngka({
          siap: true,
          contoh: false,
          jumlah: baris.length,
          winrate: (menang / baris.length) * 100,
          bersih,
          kurva: kurva.length > 1 ? kurva : [saldoAwal, jalan],
          tumbuh,
          saldo: jalan,
          sejak: baris[0]?.waktu ?? 0,
          ...teksTerbit,
        });
      })
      .catch(() => { /* hero tetap tampil tanpa angka */ });
}

/* ── Posisi terbuka untuk marquee halaman depan ──────────────────────────
   Sumbernya `public/posisiTerbuka` — dokumen yang sama dengan yang dipakai
   Dashboard, dan memang publik supaya pengunjung bisa melihat posisi pemilik.

   Diambil lewat REST karena alasan yang sama dengan angka pameran di atas:
   halaman depan tidak boleh membayar 450 kB untuk satu daftar pendek. */
