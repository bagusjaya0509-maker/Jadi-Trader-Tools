import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ExternalLink, List, Loader2, Plus, RefreshCw, Trash2, Trophy, Users, Wallet, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SparklineSaldo } from '@/components/kurva-saldo';
import {
  keadaanDompet, tambahDompet, hapusDompet, peringkatDompet, tandaiTiru, batalTiru,
  daftarSalin, simpanSalin, hapusSalin, type SetelanSalin,
  type IsiSalin, type LogSalin, type RiwayatSalin, type PosisiSalinan,
  type KeadaanDompet, type TransaksiDompet, type PosisiDompet, type Peringkat,
  type JendelaPeringkat, type PitaAkun, type RiwayatBursa, type PenandaTiru,
  jadikanAnalisDompet,
  type DompetPantau,
} from '@/lib/wallet-agen';
import { Copy as IkonTiru, TriangleAlert } from 'lucide-react';
import { Memuat } from '@/components/memuat';

/* ════════════════════════════════════════════════════════════════════════
   RUANG DOMPET PANTAUAN — fase mencatat
   ════════════════════════════════════════════════════════════════════════
   Tiga hal, dalam urutan yang menjawab pertanyaan orang: apa yang SEDANG
   dipegang dompet ini, apa yang BARU SAJA ia lakukan, dan dompet mana saja
   yang dipantau.

   Transaksi ditulis apa adanya — termasuk istilah Hyperliquid ("Open Long",
   "Close Short"). Menerjemahkannya berarti menebak arti istilah bursa lain,
   dan istilah yang salah terjemah lebih membingungkan daripada istilah
   asing yang jujur.

   BELUM ADA TOMBOL SALIN, dan itu disengaja. Menyalin dompet yang belum
   punya satu angka pun di penggaris kita sendiri sama dengan menyalin orang
   asing karena ia terlihat percaya diri.
   ════════════════════════════════════════════════════════════════════════ */

function umur(t: number) {
  const d = Math.max(0, Date.now() - t);
  const m = Math.round(d / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return m + ' mnt lalu';
  const j = Math.round(m / 60);
  if (j < 24) return j + ' jam lalu';
  return Math.round(j / 24) + ' hari lalu';
}

/* Umur dompet dalam kata, bukan tanggal. "8 bulan" langsung bisa ditimbang;
   "1 Mei 2025" menuntut pembacanya berhitung sendiri tiap kali. */
function umurDompet(ms: number) {
  if (!ms) return null;
  const hari = Math.floor((Date.now() - ms) / 86400000);
  if (hari < 1) return 'hari ini';
  if (hari < 60) return hari + ' hari';
  const bulan = Math.round(hari / 30);
  if (bulan < 24) return bulan + ' bln';
  return (hari / 365).toFixed(1) + ' thn';
}

/* RR di atas 99 ditulis "99+", bukan angkanya. Data sungguhan memulangkan
   876 dan 429 — benar secara hitungan, tapi artinya cuma "hampir tidak
   pernah rugi berarti di jendela ini", bukan "sepuluh kali lebih baik
   daripada yang 87". Angka empat digit di kolom sempit juga mendorong kolom
   lain keluar layar untuk keterangan yang tidak bertambah. */
function rrTeks(v: number) {
  if (v >= 100) return '99+';
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function uangRingkas(v: number) {
  const a = Math.abs(v);
  if (a >= 1_000_000) return (v / 1_000_000).toFixed(2) + ' jt';
  if (a >= 1_000) return (v / 1_000).toFixed(1) + ' rb';
  return v.toFixed(2);
}

/* Warna dari `dir`, bukan dari `arah`. BUY yang menutup short dan BUY yang
   membuka long adalah dua kejadian yang sangat berbeda artinya, dan
   mewarnai keduanya sama membuat daftar ini terbaca sebagai deretan beli
   yang tak berujung. */
function warnaDir(dir: string) {
  const d = dir.toLowerCase();
  if (d.includes('open long')) return 'text-emerald-400';
  if (d.includes('open short')) return 'text-red-400';
  if (d.includes('close')) return 'text-zinc-300';
  /* Pasar spot cuma memulangkan "Buy"/"Sell" — tidak ada posisi yang
     dibuka atau ditutup di sana, jadi tidak ada arah untuk diwarnai
     hijau-merah. Diberi warna sendiri supaya terbaca sebagai jenis
     kejadian yang lain, bukan sebagai baris yang gagal dikenali. */
  if (d === 'buy' || d === 'sell') return 'text-sky-400/90';
  return 'text-zinc-500';
}

function FormTambah({ selesai }: { selesai: () => void }) {
  const [alamat, setAlamat] = useState('');
  const [nama, setNama] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  async function kirim() {
    setGalat('');
    setSibuk(true);
    const h = await tambahDompet(alamat.trim(), nama.trim());
    setSibuk(false);
    if (h.ok) { setAlamat(''); setNama(''); selesai(); }
    else setGalat(h.pesan);
  }

  const kotak = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600';

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
        <input className={cn(kotak, 'font-mono')} placeholder="0x… alamat dompet Hyperliquid"
               value={alamat} onChange={(e) => setAlamat(e.target.value)} />
        <input className={kotak} placeholder="Nama panggilan (opsional)"
               value={nama} onChange={(e) => setNama(e.target.value)} />
        <button onClick={() => void kirim()} disabled={sibuk || !alamat.trim()}
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-default disabled:opacity-50">
          {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Pantau
        </button>
      </div>
      {galat && <p className="text-[12px] text-red-400">{galat}</p>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PAPAN PERINGKAT — menjawab "dompet mana", bukan cuma "dompet ini apa"
   ════════════════════════════════════════════════════════════════════════
   Sampai sekarang menambah dompet berarti menempel alamat 42 karakter yang
   harus dicari sendiri di luar. Itu bukan alur kerja; itu penghalang yang
   membuat fiturnya nyaris tidak pernah dipakai lebih dari sekali.

   TIDAK ADA KOLOM PERSEN. Tiga kandidat dicoba dengan data sungguhan dan
   ketiganya menghasilkan angka enam digit yang tidak bisa dijelaskan —
   alasannya panjang dan ditulis di peringkat-wallet.js. Yang bisa
   dipertanggungjawabkan cuma untung dalam dolar; supaya dana raksasa tidak
   selamanya menguasai puncak, yang dipilih adalah DENGAN SIAPA
   perbandingannya dilakukan.
   ════════════════════════════════════════════════════════════════════════ */

const PITA: { id: PitaAkun; label: string; jelas: string }[] = [
  { id: 'kecil', label: 'Di bawah $1 jt', jelas: 'Akun perorangan — ukuran yang paling mirip dengan kita' },
  { id: 'menengah', label: '$1–10 jt', jelas: 'Akun besar, tapi masih dikelola orang' },
  { id: 'semua', label: 'Semua', jelas: 'Termasuk dana institusi bernilai miliaran dolar' },
];

const JENDELA: { id: JendelaPeringkat; label: string }[] = [
  { id: 'day', label: 'Hari' },
  { id: 'week', label: 'Pekan' },
  { id: 'month', label: 'Bulan' },
  { id: 'allTime', label: 'Semua' },
];

/* `pantau` boleh kosong: papannya tetap berguna dibaca siapa pun — ia
   menjawab "dompet mana yang bagus" — tapi memantau berarti MENULIS ke
   daftar pemilik, dan tombol yang selalu gagal lebih buruk daripada tombol
   yang tidak ada. */
function PapanPeringkat({ pantau, jadiAnalis, analisSet }: {
  pantau?: (alamat: string, nama: string) => Promise<void>;
  /** Menjadikan dompet ini analis di Copy Signal. Kosong = bukan pemilik. */
  jadiAnalis?: (alamat: string, nama: string) => Promise<void>;
  /** Alamat yang SUDAH jadi analis. Dikirim dari atas, bukan ditarik ulang
   *  di sini: panel induknya sudah memegang daftar dompetnya, dan dua
   *  tarikan untuk daftar yang sama adalah dua daftar yang bisa berselisih
   *  di layar yang sama. */
  analisSet?: Set<string>;
}) {
  const [jendela, setJendela] = useState<JendelaPeringkat>('month');
  /* Bawaannya pita kecil, bukan "semua". Yang membuka papan ini mencari
     dompet untuk ditiru, dan dana kelola dua miliar dolar tidak bisa ditiru
     oleh siapa pun di sini -- membiarkannya di puncak layar pertama berarti
     jawaban pertama yang dilihat orang selalu jawaban yang salah. */
  const [pita, setPita] = useState<PitaAkun>('kecil');
  const [p, setP] = useState<Peringkat | null>(null);
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    setMuat(true);
    void peringkatDompet(jendela, pita, 40).then((d) => {
      if (!hidup) return;
      /* Hasil null MEMPERTAHANKAN daftar lama, sama seperti di panel utama:
         satu tarikan gagal saat jaringan berkedip bukan kabar bahwa papannya
         kosong. */
      if (d) setP(d);
      setMuat(false);
    });
    return () => { hidup = false; };
  }, [jendela, pita]);

  /* ── WALLET VIEW — koin yang dipegang LEBIH DARI SATU dompet ────────
     Papan ini menjawab "dompet mana yang bagus". Yang tidak dijawabnya:
     apakah dompet-dompet bagus itu kebetulan sedang memegang koin yang
     sama. Jawabannya sudah ada di kolom "Posisi sekarang" — tapi tersebar
     di empat puluh baris, dan menghitungnya dengan mata berarti tidak
     pernah dihitung.

     ── AMBANG DUA, DAN KENAPA ────────────────────────────────────────
     Satu dompet memegang satu koin bukan kesepakatan, itu cuma satu orang
     punya pendapat. Yang dicari di sini pertemuan pendapat, jadi koin yang
     cuma dipegang satu dompet tidak ditampilkan sama sekali.

     ── PENYEBUTNYA IKUT DITULIS ──────────────────────────────────────
     "5 BTC L" tanpa keterangan terbaca sebagai "5 dari 40". Padahal
     pengayaan posisi cuma menjangkau sebagian papan — sisanya belum punya
     data posisi sama sekali, dan menghitungnya sebagai "tidak memegang"
     adalah menyimpulkan sesuatu dari ketidaktahuan. Jumlah dompet yang
     benar-benar terbaca ditulis di sebelahnya. */
  const ringkas = useMemo(() => {
    const baris = p?.daftar || [];
    const berisi = baris.filter((r) => r.rinci && r.rinci.posisi.length > 0);
    const adaData = baris.filter((r) => r.rinci).length;
    const peta = new Map();

    for (const r of berisi) {
      /* Dijaga lagi di sini, bukan hanya di `filter` di atas: penyempitan
         tipe tidak ikut menyeberangi batas `filter`, dan pagar yang cuma
         ada di satu sisi adalah pagar yang hilang saat kodenya disusun
         ulang nanti. */
      if (!r.rinci) continue;
      /* Satu dompet dihitung SEKALI per koin+arah. Bursa memang memulangkan
         satu baris per koin, tapi dijaga di sini supaya angkanya tetap
         berarti "berapa DOMPET" — bukan "berapa baris" — apa pun yang
         dikirim bursa nanti. */
      const unik = new Set();
      for (const q of r.rinci.posisi) {
        const koin = String(q.koin).toUpperCase();
        const k = koin + '|' + q.arah;
        if (unik.has(k)) continue;
        unik.add(k);
        const c = peta.get(k) || { koin, arah: q.arah, n: 0, nilai: 0 };
        c.n += 1;
        c.nilai += Math.abs(Number(q.nilai) || 0);
        peta.set(k, c);
      }
    }

    const semua = [...peta.values()];
    return {
      dompet: berisi.length,
      belumTerbaca: baris.length - adaData,
      sendirian: semua.filter((x) => x.n === 1).length,
      /* Urut jumlah dompet dulu, nilai dolar sebagai pemutus seri: dua koin
         yang sama-sama dipegang tiga dompet dibedakan oleh seberapa besar
         uang yang ditaruh di sana. */
      isi: semua.filter((x) => x.n >= 2).sort((a, b) => b.n - a.n || b.nilai - a.nilai),
    };
  }, [p]);

  const pilihan = 'cursor-pointer rounded px-2 py-1 text-[11.5px] transition-colors';
  const aktif = 'bg-zinc-100 text-zinc-950';
  const diam = 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100';

  return (
    <section>
      <h3 className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-zinc-800 pb-1.5">
        <Trophy className="size-3.5 text-zinc-500" />
        <span className="text-[13px] font-semibold text-zinc-200">Papan peringkat Hyperliquid</span>
        {p && p.diperbarui > 0 && (
          <span className="text-[11px] font-normal text-zinc-600">
            · {umur(p.diperbarui)} · dari {p.total.toLocaleString('id-ID')} dompet,
            akun minimal ${(p.minAkun / 1000).toFixed(0)} rb
          </span>
        )}
      </h3>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex gap-0.5 rounded-md border border-zinc-800 p-0.5">
          {JENDELA.map((j) => (
            <button key={j.id} onClick={() => setJendela(j.id)}
              className={cn(pilihan, jendela === j.id ? aktif : diam)}>{j.label}</button>
          ))}
        </div>
        <div className="flex gap-0.5 rounded-md border border-zinc-800 p-0.5">
          {PITA.map((p) => (
            <button key={p.id} onClick={() => setPita(p.id)} title={p.jelas}
              className={cn(pilihan, pita === p.id ? aktif : diam)}>{p.label}</button>
          ))}
        </div>
        {muat && <Loader2 className="size-3.5 animate-spin text-zinc-600" />}

        {/* Menempel ke KANAN baris saringan, bukan baris sendiri: ia
            ringkasan dari daftar yang sedang disaring, jadi tempatnya
            sejajar dengan saringannya. Menggulir mendatar kalau koinnya
            banyak — membiarkannya membungkus akan mendorong tabelnya turun
            setiap kali pasar sedang ramai. */}
        {p && !p.belumAda && ringkas.dompet > 0 && (
          <div className="ml-auto flex min-w-0 max-w-full items-center gap-1.5 sm:max-w-[58%]">
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-600"
                  title={'Koin yang dipegang lebih dari satu dompet di papan ini.'
                       + ' Dihitung dari ' + ringkas.dompet + ' dompet yang posisinya terbaca'
                       + (ringkas.belumTerbaca ? ', ' + ringkas.belumTerbaca + ' dompet belum punya data posisi' : '')
                       + (ringkas.sendirian ? '. ' + ringkas.sendirian + ' koin lain cuma dipegang satu dompet dan tidak ditampilkan' : '')}>
              Wallet View
            </span>

            {ringkas.isi.length === 0 ? (
              <span className="truncate text-[11px] text-zinc-600">
                belum ada koin yang dipegang 2 dompet
              </span>
            ) : (
              <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                {ringkas.isi.map((x) => (
                  <span key={x.koin + x.arah}
                    title={x.n + ' dompet memegang ' + x.koin + ' ' + (x.arah === 'L' ? 'LONG' : 'SHORT')
                         + ' · nilai gabungan ' + uangRingkas(x.nilai)}
                    className="shrink-0 whitespace-nowrap rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-300">
                    {x.n} {x.koin}{' '}
                    <span className={x.arah === 'L' ? 'text-emerald-500' : 'text-red-400'}>
                      {x.arah}
                    </span>
                  </span>
                ))}
              </div>
            )}

            <span className="shrink-0 whitespace-nowrap text-[10px] text-zinc-600">
              dari {ringkas.dompet}
            </span>

            {/* Membawa jendela DAN pita yang sedang dipilih. Tanpa keduanya
                daftar di chart akan disusun dari saringan bawaan, dan dua
                layar yang mengaku menampilkan hal yang sama tapi isinya
                berbeda lebih buruk daripada tidak ada tombolnya sama
                sekali. */}
            {ringkas.isi.length > 0 && (
              <Link to={`/chart-entry?walletview=1&j=${jendela}&pita=${pita}`}
                title="Buka daftar Wallet View di samping chart — klik koin untuk berpindah"
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
                <List className="size-3.5" /> List in Chart
              </Link>
            )}
          </div>
        )}
      </div>

      {p?.belumAda ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-4 text-[12.5px] leading-relaxed text-zinc-500">
          Papan peringkat belum pernah ditarik. Skripnya berjalan sendiri tiap
          enam jam; daftar ini terisi pada putaran berikutnya.
        </p>
      ) : !p || p.daftar.length === 0 ? (
        <p className="py-3 text-[12.5px] text-zinc-600">
          {muat ? 'Mengambil papan peringkat…' : 'Tidak ada dompet yang lolos saringan.'}
        </p>
      ) : (
        <div className="max-h-[21rem] overflow-auto rounded-lg border border-zinc-800">
          {/* Sepuluh baris terlihat, sisanya digulir DI DALAM kotak ini.
              Empat puluh baris sekaligus mendorong daftar dompet yang
              dipantau jauh ke bawah layar — dan yang dipantau itulah yang
              dibuka tiap hari, sementara papan peringkat cuma disentuh
              sesekali saat mencari yang baru. Kepala tabelnya menempel
              supaya judul kolom tidak hilang di baris kesebelas. */}
          <table className="w-full min-w-[900px] border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-zinc-950">
              <tr className="border-b border-zinc-800 text-[10.5px] uppercase tracking-wide text-zinc-600">
                <th className="w-8 px-2 py-1.5 text-right font-medium">#</th>
                <th className="px-2 py-1.5 text-left font-medium">Dompet</th>
                <th className="px-2 py-1.5 text-right font-medium">Akun</th>
                <th className="px-2 py-1.5 text-right font-medium">P/L</th>
                <th className="px-2 py-1.5 text-right font-medium" title="Menang dari penutupan sepanjang riwayat yang diberikan bursa">WR</th>
                <th className="px-2 py-1.5 text-right font-medium" title="Rata-rata untung dibagi rata-rata rugi. WR tinggi dengan RR rendah bisa tetap merugi.">RR</th>
                <th className="px-2 py-1.5 text-right font-medium" title="Sejak setoran pertama ke dompet ini">Umur</th>
                <th className="px-2 py-1.5 text-left font-medium">Posisi sekarang</th>
                <th className="w-20 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {p.daftar.map((w, i) => (
                <tr key={w.alamat} className="border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-900/40">
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-600">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    {/* Nama dipasang pemiliknya sendiri — teks pihak lain.
                        Ditampilkan apa adanya, dan alamatnya tetap ikut:
                        nama boleh apa saja, alamat yang menentukan. */}
                    {w.nama && <span className="mr-1.5 text-zinc-200">{w.nama}</span>}
                    <span className="font-mono text-[10.5px] text-zinc-500">
                      {w.alamat.slice(0, 8)}…{w.alamat.slice(-6)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">${uangRingkas(w.akun)}</td>
                  <td className={cn('px-2 py-1.5 text-right font-semibold tabular-nums',
                    w.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {w.pnl >= 0 ? '+' : '−'}{uangRingkas(Math.abs(w.pnl))}
                  </td>
                  {/* Tanda hubung berarti BELUM DIPERIKSA, bukan nol. Cuma
                      barisan teratas yang diperkaya — userFills 632 KB per
                      dompet, dan 953 dompet mustahil ditarik tiap putaran. */}
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {/* Di bawah sepuluh penutupan, angkanya DIREDUPKAN —
                        bukan disembunyikan. WR 100% dari satu trade benar
                        secara hitungan dan tidak berarti apa-apa, dan warna
                        hijau penuh di sebelahnya membuatnya terbaca seperti
                        rekam jejak. */}
                    {w.rinci && w.rinci.wr !== null ? (
                      <span className={cn(w.rinci.tutup < 10 ? 'text-zinc-500'
                        : w.rinci.wr >= 50 ? 'text-emerald-400' : 'text-red-400')}
                        title={w.rinci.tutup + ' penutupan dari ' + w.rinci.fill + ' transaksi'
                          + (w.rinci.terpotong ? ' (dibatasi 2000 oleh bursa)' : '')}>
                        {w.rinci.wr}%
                        <span className="ml-1 text-[9.5px] text-zinc-600">{w.rinci.tutup}</span>
                      </span>
                    ) : <span className="text-zinc-700">—</span>}
                  </td>
                  {/* RR di sebelah WR, dan itu disengaja: keduanya tidak
                      berarti apa-apa sendirian. Menang 80% dengan RR 0,3
                      adalah kerugian pelan, dan angka 80% itu yang membuatnya
                      terlihat hebat. */}
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {w.rinci && w.rinci.rr !== null ? (
                      <span className={cn(w.rinci.tutup < 10 ? 'text-zinc-500'
                        : w.rinci.rr >= 1 ? 'text-emerald-400/90' : 'text-amber-400/90')}
                        title={'Rata-rata untung $' + uangRingkas(w.rinci.menangRata)
                          + ' vs rata-rata rugi $' + uangRingkas(w.rinci.kalahRata)
                          + (w.rinci.tutup < 10 ? ' — baru ' + w.rinci.tutup
                              + ' penutupan, belum cukup untuk disimpulkan' : '')}>
                        {rrTeks(w.rinci.rr)}
                      </span>
                    ) : <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">
                    {w.rinci && w.rinci.lahir ? umurDompet(w.rinci.lahir) : <span className="text-zinc-700">—</span>}
                  </td>
                  {/* Posisi terbuka RINGKAS, tiga terbesar. Daftar penuh di
                      kolom tabel akan melebarkan barisnya sampai kolom lain
                      terdorong keluar layar — dan yang menjawab "dia sedang
                      pegang apa" memang tiga terbesarnya. */}
                  <td className="max-w-[13rem] px-2 py-1.5">
                    {!w.rinci ? <span className="text-zinc-700">—</span>
                      : w.rinci.jmlPosisi === 0 ? <span className="text-zinc-700">kosong</span>
                      : (
                        <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                          {w.rinci.posisi.slice(0, 3).map((p) => (
                            <span key={p.koin} className="whitespace-nowrap text-[11px]">
                              <span className="text-zinc-300">{p.koin}</span>
                              <span className={cn('ml-0.5', p.arah === 'L' ? 'text-emerald-400' : 'text-red-400')}>{p.arah}</span>
                            </span>
                          ))}
                          {w.rinci.jmlPosisi > 3 && (
                            <span className="text-[10px] text-zinc-600">+{w.rinci.jmlPosisi - 3}</span>
                          )}
                        </span>
                      )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-600">
                    {w.vlm > 0 ? '$' + uangRingkas(w.vlm) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {/* DUA TINDAKAN, dan yang kedua menyiratkan yang pertama:
                        menjadikan analis memasukkan dompetnya ke daftar
                        pantau sekalian (server yang mengurusnya). Jadi
                        tombolnya tetap muncul untuk dompet yang belum
                        dipantau — memaksa orang menekan "Pantau" dulu cuma
                        menambah satu ketukan untuk sesuatu yang toh terjadi. */}
                    {analisSet?.has(w.alamat) ? (
                      <span className="text-[11px] text-[#ffcd75]/90" title="Dompet ini punya kartunya sendiri di Copy Signal.">
                        Analis
                      </span>
                    ) : jadiAnalis ? (
                      <span className="inline-flex items-center gap-1">
                        {w.dipantau
                          ? <span className="text-[11px] text-emerald-400/80">Dipantau</span>
                          : pantau && (
                            <button
                              onClick={() => { setSibuk(w.alamat); void pantau(w.alamat, w.nama).finally(() => setSibuk(null)); }}
                              disabled={sibuk === w.alamat}
                              className="cursor-pointer rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50">
                              {sibuk === w.alamat ? '…' : 'Pantau'}
                            </button>
                          )}
                        <button
                          onClick={() => { setSibuk(w.alamat); void jadiAnalis(w.alamat, w.nama).finally(() => setSibuk(null)); }}
                          disabled={sibuk === w.alamat}
                          title="Posisi dompet ini terbit sebagai sinyal di Copy Signal, apa adanya — tanpa SL dan TP."
                          className="cursor-pointer whitespace-nowrap rounded border border-[#ffcd75]/40 px-2 py-0.5 text-[11px] text-[#ffcd75]/90 transition-colors hover:border-[#ffcd75]/70 hover:text-[#ffcd75] disabled:opacity-50">
                          {sibuk === w.alamat ? '…' : 'Jadikan analis'}
                        </button>
                      </span>
                    ) : w.dipantau ? (
                      <span className="text-[11px] text-emerald-400/80">Dipantau</span>
                    ) : !pantau ? (
                      /* Tanpa izin menulis, kolomnya dibiarkan kosong.
                         Menampilkan tombol yang pasti ditolak server berarti
                         menjanjikan sesuatu dua kali: sekali saat terlihat,
                         sekali lagi saat diklik. */
                      <span className="text-[11px] text-zinc-700">—</span>
                    ) : (
                      <button
                        onClick={() => { setSibuk(w.alamat); void pantau(w.alamat, w.nama).finally(() => setSibuk(null)); }}
                        disabled={sibuk === w.alamat}
                        className="cursor-pointer rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50">
                        {sibuk === w.alamat ? '…' : 'Pantau'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* div, bukan p: <details> adalah elemen blok dan paragraf tidak boleh
          memuatnya. Peramban akan menutup paragrafnya sendiri di tengah, dan
          separuh keterangannya keluar dari kotak yang seharusnya
          membungkusnya. */}
      <div className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
        {/* Keterangannya dilipat. Delapan kalimat di bawah tabel dibaca
            sekali lalu jadi dinding teks yang didorong mata setiap kali —
            tapi membuangnya berarti menghapus satu-satunya tempat yang
            menjelaskan kenapa ada tanda hubung dan kenapa angka tertentu
            abu-abu. Kalimat pertama tetap terlihat karena ia yang paling
            sering dibutuhkan; sisanya menunggu diminta. */}
        <details className="group/ket">
          <summary className="cursor-pointer list-none marker:content-none">
          RR = rata-rata untung dibagi rata-rata rugi; ia melengkapi WR, tidak
        menggantikannya.{' '}
          <span className="text-zinc-500 underline decoration-dotted underline-offset-2 group-open/ket:hidden">Baca selengkapnya</span>
          <span className="hidden text-zinc-500 underline decoration-dotted underline-offset-2 group-open/ket:inline">Tutup</span>
          </summary>
          <span className="mt-1 block">Angka abu-abu berarti di bawah sepuluh penutupan —
        benar secara hitungan, belum berarti sebagai rekam jejak. Menang 80% dengan RR 0,3 tetap merugi pelan-pelan.
        WR, RR, umur, dan posisi cuma terisi untuk barisan teratas tiap pita —
        menarik riwayat lengkap 953 dompet berarti 600 MB tiap putaran. Tanda
        hubung berarti belum diperiksa, bukan nol. Umur dihitung dari setoran
        pertama ke dompetnya, bukan dari transaksi tertua yang terbaca.
        Selebihnya angka Hyperliquid; tidak ada yang kita hitung
        sendiri. Kolom persen sengaja tidak ada — ROI terbitan bursanya
        memberi 115.524% untuk akun 30 ribu dolar, dan dua rasio pengganti
        yang dicoba sama tidak masuk akalnya. Papan ini menunjukkan siapa yang
        sedang menang, bukan siapa yang layak disalin. Yang kedua dijawab
        rapor di bawah, sesudah dompetnya dipantau cukup lama.</span>
        </details>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   KARTU DOMPET — sebentuk dengan kartu analis di Copy Signal
   ════════════════════════════════════════════════════════════════════════
   Dua bentuk sudah dicoba dan keduanya ditolak pemilik. Yang pertama:
   semua posisi dalam satu kisi, semua transaksi dalam satu daftar, nama
   dompetnya dicetak kecil di sudut tiap baris — dinding angka begitu
   dompetnya lebih dari satu. Yang kedua: baris terlipat dengan ringkasan
   di kepalanya — rapi, tapi tidak ada satu pun angka yang MASUK sendiri ke
   mata; semuanya harus dibaca satu per satu.

   Bentuk ketiga meniru kartu yang sudah ada di halaman yang sama. Kartu
   analis di Copy Signal menjawab "siapa yang sedang bagus" dalam sekali
   pandang: satu angka besar, satu kurva, satu badge menang. Dompet adalah
   pertanyaan yang persis sama, dan menjawabnya dengan bentuk yang berbeda
   di halaman yang sama cuma memaksa orang belajar dua bahasa.

   ── KURVANYA REALISASI, BUKAN NILAI AKUN ────────────────────────────────
   Nilai akun ikut naik-turun karena setoran dan penarikan, dan dompet yang
   menarik untungnya keluar akan menggambar terjun bebas yang terbaca
   sebagai kerugian besar. Yang digambar di sini jumlah berjalan dari
   closedPnl tiap fill penutup — apa yang benar-benar dihasilkan
   perdagangannya, sejak kita mulai memantau.

   ── ANGKA BESARNYA REALISASI, MENGAMBANG DI BAWAHNYA ────────────────────
   Keduanya perlu ada dan tidak boleh dijumlahkan. Realisasi sudah terjadi;
   mengambang bisa hilang dalam satu jam. Menjumlahkannya jadi satu angka
   membuat posisi yang sedang untung terbaca seperti untung yang sudah
   diamankan.
   ════════════════════════════════════════════════════════════════════════ */

/** Warna monogram dari alamatnya. Bukan hiasan: enam kartu abu-abu yang
 *  seragam menuntut membaca teks untuk membedakannya, dan warna yang tetap
 *  per alamat membuat kartu yang sama dikenali dari sudut mata. */
function ronaAlamat(a: string) {
  let n = 0;
  for (let i = 2; i < a.length; i++) n = (n * 31 + a.charCodeAt(i)) % 360;
  return n;
}

/* ── FILL BUKAN TRADE, DAN ITU MENGUBAH SEGALANYA ──────────────────────
   Versi pertama menghitung tiap fill berisi closedPnl sebagai satu
   penutupan. Data sungguhan langsung menunjukkan kenapa itu salah: satu
   dompet memulangkan 107 baris "Close Long" pada PURR, semuanya rugi,
   semuanya dalam hitungan detik, semuanya di harga yang sama sampai empat
   angka di belakang koma. Itu BUKAN 107 kekalahan — itu SATU posisi yang
   dilepas, dan mesin pencocokan bursanya memotongnya jadi 107 keping.

   Menghitungnya per fill membuat win rate ditentukan oleh cara bursa
   kebetulan mengiris order, bukan oleh keputusan orangnya. Satu keluar
   yang terpotong seratus keping menenggelamkan sembilan puluh kemenangan
   yang kebetulan terisi sekali jalan.

   Fill berurutan pada koin dan arah yang sama, berjarak kurang dari lima
   menit, dihitung SATU penutupan dan pnl-nya dijumlahkan. Lima menit
   longgar untuk pelepasan bertahap dan masih terlalu pendek untuk
   menyatukan dua keputusan yang benar-benar berbeda. */
export interface Penutupan { koin: string; dir: string; pnl: number; waktu: number }

const JEDA_SATU_KELUAR = 5 * 60 * 1000;

function penutupanDompet(log: TransaksiDompet[]): Penutupan[] {
  /* `log` datang terbaru di depan; dibalik dulu. Pengelompokan yang
     berjalan mundur akan memotong kelompoknya di tempat yang salah. */
  const tutup = log.filter((l) => l.pnl !== 0).slice().sort((x, y) => x.waktu - y.waktu);
  const out: Penutupan[] = [];
  for (const l of tutup) {
    const g = out[out.length - 1];
    if (g && g.koin === l.koin && g.dir === l.dir && l.waktu - g.waktu <= JEDA_SATU_KELUAR) {
      g.pnl += l.pnl;
      g.waktu = l.waktu;
    } else {
      out.push({ koin: l.koin, dir: l.dir, pnl: l.pnl, waktu: l.waktu });
    }
  }
  return out;
}

/** Realisasi kumulatif, satu langkah per PENUTUPAN — bukan per fill. */
function titikDompet(tutup: Penutupan[]) {
  const out = [{ saldo: 0, waktu: tutup.length ? tutup[0].waktu : Date.now() }];
  let n = 0;
  for (const l of tutup) { n += l.pnl; out.push({ saldo: n, waktu: l.waktu }); }
  return out;
}

function KartuDompet({ w, posisi, log, bursa, dipilih, pilih, hapus, salin, salinAktif }: {
  w: { alamat: string; nama: string; sejak: number };
  posisi: PosisiDompet[];
  log: TransaksiDompet[];
  bursa?: RiwayatBursa;
  dipilih: boolean;
  pilih: () => void;
  /** Tak diisi = pembacanya bukan pemilik; ikon hapusnya tidak dirender. */
  hapus?: () => void;
  /** Membuka popup setelan salin. Tak diisi = bukan pemilik. */
  salin?: () => void;
  /** Salinan dompet ini sedang hidup — ikonnya menyala. */
  salinAktif?: boolean;
}) {
  const mengambang = posisi.reduce((n, p) => n + p.pnl, 0);
  const akun = posisi.length ? posisi[0].nilaiAkun : 0;
  const tutup = penutupanDompet(log);
  const menang = tutup.filter((l) => l.pnl > 0).length;
  const nyata = tutup.reduce((n, l) => n + l.pnl, 0);
  const titik = titikDompet(tutup);
  const rona = ronaAlamat(w.alamat);

  return (
    /* `id` supaya baris di tab Posisi Copy bisa menuju kartu ini langsung.
       Alamatnya dihuruf-kecilkan: yang datang dari daftar salin sudah
       kecil semua, tapi nama dompet boleh ditulis dengan huruf besar dan
       satu huruf beda membuat `getElementById` memulangkan null tanpa
       sepatah pesan pun. */
    <div id={'kartu-dompet-' + w.alamat.toLowerCase()} onClick={pilih}
      className={cn('group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-zinc-900/40 transition-colors',
        dipilih ? 'border-zinc-500' : 'border-zinc-800 hover:border-zinc-700')}>

      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-zinc-950"
          style={{ background: `hsl(${rona} 55% 62%)` }}>
          {(w.nama.trim()[0] || '0').toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-zinc-100">{w.nama}</span>
          <span className="block font-mono text-[10px] text-zinc-600">
            {w.alamat.slice(0, 6)}…{w.alamat.slice(-4)}
          </span>
        </span>
        {/* ── DUA WR, DAN URUTANNYA DISENGAJA ────────────────────────
            Yang ATAS milik kita: penutupan yang benar-benar kita saksikan
            sendiri sejak dompet ini dipantau. Kecil sampelnya, tapi ia
            satu-satunya angka yang bisa kita pertanggungjawabkan sepenuhnya.

            Yang BAWAH milik bursa: sepanjang riwayat yang Hyperliquid mau
            berikan. Jauh lebih banyak sampelnya, dan itulah gunanya — tapi
            ia riwayat yang kita terima, bukan yang kita saksikan.

            Ditulis bertumpuk, bukan bersebelahan: dua persentase sejajar di
            satu baris terbaca sebagai satu angka yang terbelah, dan yang
            membacanya harus menebak mana yang mana. */}
        <span className="shrink-0 text-right leading-tight">
          {tutup.length > 0 && (
            <span className={cn('block text-[10.5px] font-medium',
              menang / tutup.length >= 0.5 ? 'text-emerald-400' : 'text-red-400')}
              title={menang + ' menang dari ' + tutup.length + ' penutupan yang KITA saksikan sejak '
                + 'dompet ini dipantau. Fill berurutan pada koin & arah yang sama dalam lima menit '
                + 'dihitung satu penutupan.'}>
              WR {Math.round((menang / tutup.length) * 100)}%
            </span>
          )}
          {bursa && bursa.tutup > 0 && (
            <span className={cn('block text-[9.5px]',
              bursa.menang / bursa.tutup >= 0.5 ? 'text-emerald-400/70' : 'text-red-400/70')}
              title={bursa.menang + ' menang dari ' + bursa.tutup + ' penutupan sepanjang '
                + bursa.fill + ' transaksi yang diberikan bursa'
                + (bursa.sejak ? ', sejak ' + tanggalJam(bursa.sejak) : '') + '. '
                + (bursa.terpotong
                    ? 'Hyperliquid memulangkan maksimal 2000 transaksi — riwayat sebelum itu tidak terbaca, '
                      + 'jadi ini BUKAN angka seumur hidup dompetnya.'
                    : 'Seluruh riwayat dompet ini terbaca.')}>
              {bursa.tutup} tutup · {Math.round((bursa.menang / bursa.tutup) * 100)}%
              {bursa.rr !== null && (
                <span className={cn('ml-1', bursa.rr >= 1 ? 'text-emerald-400/70' : 'text-amber-400/80')}>
                  RR {rrTeks(bursa.rr)}
                </span>
              )}
              {bursa.terpotong && <span className="text-zinc-600"> ·2rb</span>}
            </span>
          )}
        </span>
        {/* Tidak dirender untuk yang bukan pemilik. Ikon tempat sampah
            yang terlihat tapi ditolak server memberi kesan daftar ini bisa
            dirapikan siapa saja — dan yang mengkliknya baru tahu sesudah
            mencoba menghapus punya orang lain. */}
        {/* ── SALIN DOMPET INI ──────────────────────────────────────
            Di kepala kartu, bukan terkubur di dalam rinciannya. Yang
            ditawarkan kartu ini cuma dua hal: berhenti memantau, dan
            menyalin. Keduanya pantas terlihat tanpa membuka apa pun.

            Menyala hijau saat salinannya HIDUP — supaya sekilas pandang
            ke seluruh daftar sudah menjawab "dompet mana yang sedang
            berjalan atas namaku". */}
        {salin && (
          <button onClick={(e) => { e.stopPropagation(); salin(); }}
            title={salinAktif
              ? 'Salinan HIDUP — order berangkat sendiri. Klik untuk mengubah setelannya.'
              : 'Salin dompet ini: atur bursa, ukuran order, dan leverage.'}
            className={cn('shrink-0 cursor-pointer rounded p-1 transition-colors',
              salinAktif ? 'text-emerald-400 hover:text-emerald-300'
                         : 'text-zinc-800 hover:text-zinc-300 group-hover:text-zinc-600')}>
            <IkonTiru className="size-3.5" />
          </button>
        )}
        {hapus && (
          <button onClick={(e) => { e.stopPropagation(); hapus(); }} title="Berhenti memantau"
            className="shrink-0 cursor-pointer rounded p-1 text-zinc-800 transition-colors hover:text-red-400 group-hover:text-zinc-600">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div className="px-3 pt-1.5">
        <span className={cn('block text-[22px] font-semibold leading-none tabular-nums',
          nyata > 0 ? 'text-emerald-400' : nyata < 0 ? 'text-red-400' : 'text-zinc-400')}>
          {nyata > 0 ? '+' : nyata < 0 ? '−' : ''}${uangRingkas(Math.abs(nyata))}
        </span>
        <span className="mt-0.5 block text-[10.5px] text-zinc-600">
          realisasi sejak dipantau · {tutup.length} penutupan
          {bursa && bursa.tutup > 0 && (
            <span className="block text-zinc-700">
              riwayat bursa {bursa.realisasi >= 0 ? '+' : '−'}${uangRingkas(Math.abs(bursa.realisasi))}
              {bursa.rr !== null && (
                <> · menang ${uangRingkas(bursa.menangRata)} vs rugi ${uangRingkas(bursa.kalahRata)}</>
              )}
            </span>
          )}
        </span>
      </div>

      {/* Kurva menempel ke tepi bawah kartu, tanpa jarak kiri-kanan. Kurva
          yang mengambang di tengah kotak berpadding terbaca sebagai gambar
          kecil yang ditempel; yang menyentuh tepinya terbaca sebagai dasar
          kartunya. */}
      {/* Kurva baru digambar kalau ADA yang bisa digambar. Satu titik
          menghasilkan path 'M0,y' — tidak terlihat sama sekali, tapi tetap
          memakan enam belas baris tinggi, dan pita kosong di tengah kartu
          terbaca sebagai grafik yang gagal dimuat. */}
      {titik.length >= 2 ? (
        <SparklineSaldo titik={titik} modal={0} kelas="mt-1.5 h-16 w-full" />
      ) : (
        <p className="mt-1.5 flex h-16 items-center px-3 text-[10.5px] leading-relaxed text-zinc-700">
          Kurva muncul sesudah penutupan posisi pertama yang kita saksikan.
        </p>
      )}

      <div className="flex flex-wrap items-baseline gap-x-2 border-t border-zinc-800/70 px-3 py-1.5 text-[10.5px] text-zinc-600">
        {posisi.length > 0 ? (
          <>
            <span className="text-zinc-500">{posisi.length} posisi</span>
            <span className={cn('font-medium tabular-nums',
              mengambang >= 0 ? 'text-emerald-400/90' : 'text-red-400/90')}
              title="Untung/rugi yang BELUM direalisasi — bisa hilang dalam satu jam">
              {mengambang >= 0 ? '+' : '−'}${uangRingkas(Math.abs(mengambang))} mengambang
            </span>
          </>
        ) : (
          <span>tanpa posisi terbuka</span>
        )}
        <span className="ml-auto">
          {akun > 0 ? 'akun $' + uangRingkas(akun) : umur(w.sejak)}
        </span>
      </div>

      {/* ── TANDA BISA DIKLIK, DITULIS ────────────────────────────────
          Kartu yang seluruh badannya bisa diklik tapi tidak punya satu pun
          tanda yang mengatakannya akan diperlakukan sebagai gambar. Itu
          persis yang terjadi: rinciannya sudah ada dan terbuka dengan
          benar, tapi tidak ada yang tahu harus mengklik. Kursor berubah
          jadi tangan cuma terlihat SESUDAH orang mencoba. */}
      <div className="flex items-center justify-center gap-1 border-t border-zinc-800/70 bg-zinc-900/40 py-1 text-[10.5px] text-zinc-500 transition-colors group-hover:bg-zinc-800/50 group-hover:text-zinc-300">
        Lihat posisi &amp; transaksi
        <ChevronRight className="size-3" />
      </div>
    </div>
  );
}

/* ── SEJAK KAPAN POSISI INI TERBUKA ─────────────────────────────────────
   Hyperliquid TIDAK memulangkan waktu buka bersama posisinya.
   `clearinghouseState` memberi koin, ukuran, harga masuk, leverage, dan
   harga likuidasi — tidak ada satu pun stempel waktu. Jadi angkanya harus
   disusun sendiri dari fill yang kita saksikan.

   Ukuran berjalan dihitung ulang dari nol: `dir` yang memuat "Open"
   menambah, yang memuat "Close" mengurangi. Saat ukurannya berpindah dari
   nol ke lebih dari nol, di situlah posisinya dibuka; saat kembali ke nol,
   catatannya dilupakan. Cara ini tahan terhadap penambahan bertahap dan
   penutupan sebagian — dua hal yang lazim dan yang membuat "ambil fill
   pembuka terakhir" memberi jawaban yang salah.

   ── TIGA JAWABAN, BUKAN DUA ───────────────────────────────────────────
   Yang penting bukan cuma tanggalnya, tapi seberapa jauh ia bisa dipercaya:

     · UTUH  — seluruh posisinya terbentuk di depan mata kita. Tanggalnya
               benar-benar tanggal posisi itu dibuka.
     · SEBAGIAN — kita cuma menyaksikan penambahannya. Posisi induknya sudah
               ada sebelum dompet ini dipantau, dan tanggal yang kita punya
               bukan tanggal buka, melainkan tanggal ditambah.
     · TIDAK ADA — tidak satu pun fill pembukanya kita lihat.

   Menyatukan yang kedua dan yang pertama akan mencetak tanggal yang tampak
   pasti untuk posisi yang sebenarnya jauh lebih tua. Di panel yang dipakai
   menilai berapa lama seseorang menahan posisi, itu kesalahan yang mahal. */
function bukaPosisi(log: TransaksiDompet[], koin: string, arah: 'LONG' | 'SHORT', ukuran: number) {
  const sisi = arah === 'LONG' ? 'long' : 'short';
  const f = log.filter((l) => l.koin === koin).slice().sort((a, b) => a.waktu - b.waktu);
  let size = 0;
  let mulai: number | null = null;
  for (const l of f) {
    const d = (l.dir || '').toLowerCase();
    if (!d.includes(sisi)) continue;
    if (d.includes('open')) {
      if (size <= 1e-9) mulai = l.waktu;
      size += l.ukuran;
    } else if (d.includes('close')) {
      size -= l.ukuran;
      if (size <= 1e-9) { size = 0; mulai = null; }
    }
  }
  if (mulai === null) return null;
  /* Ambang 99%, bukan sama persis: ukuran datang sebagai desimal dari dua
     sumber yang membulatkannya berbeda, dan selisih di angka keenam tidak
     boleh mengubah "utuh" jadi "sebagian". */
  return { waktu: mulai, utuh: size >= ukuran * 0.99 };
}

/* ── NAMA KOIN HYPERLIQUID -> SIMBOL CHART ────────────────────────────
   Hyperliquid menyebut perp-nya dengan nama pendek: BTC, ETH, ARB. Chart di
   situs ini memakai simbol Binance: BTCUSDT. Penyambungnya cuma menempelkan
   USDT — dan itu benar untuk hampir semuanya.

   Yang TIDAK punya pasangan di Binance (PURR, CASHCAT, FXMR — token yang
   lahir dan hidup di Hyperliquid saja) akan membuka chart kosong. Itu
   dibiarkan apa adanya, bukan disembunyikan: menghilangkan barisnya berarti
   daftar posisi yang tidak cocok dengan yang dilihat orang di dompetnya,
   dan itu kebingungan yang lebih mahal daripada satu chart kosong yang
   sudah punya keterangannya sendiri. */
function simbolChart(koin: string) {
  return String(koin || '').toUpperCase().replace(/^@/, '') + 'USDT';
}

function tanggalJam(ms: number) {
  return new Date(ms).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/* ── RINCIAN SATU DOMPET, DI BAWAH KISI KARTUNYA ────────────────────────
   Bukan di dalam kartunya. Kartu yang memuai saat diklik mendorong semua
   kartu di baris yang sama, dan kisi yang melompat tiap kali seseorang
   melihat isi sebuah kartu membuat sisanya sulit dipilih.

   Pola yang sama dengan papan analis di halaman ini: kartunya memilih,
   ruang di bawahnya menampilkan. */
function RincianDompet({ w, posisi, log, tiru, ubahTiru, tutup, nilaiAkun }: {
  w: { alamat: string; nama: string };
  posisi: PosisiDompet[];
  log: TransaksiDompet[];
  /** Nilai akun dompet saat pindaian terakhir. `undefined` = pemantau belum
   *  pernah mencatatnya (mis. belum satu putaran sejak medannya ada) — dan
   *  itu berbeda dari nol, jadi kalimatnya memang tidak ditampilkan. */
  nilaiAkun?: number;
  tiru: PenandaTiru[];
  ubahTiru: (koin: string, nyala: boolean) => void;
  tutup: () => void;
}) {
  /* Escape menutup. Lapisan yang cuma bisa ditutup lewat satu tombol kecil
     di sudut adalah lapisan yang terasa menjebak. */
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup(); };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [tutup]);

  return (
    /* ── DI ATAS HALAMAN, BUKAN DI BAWAH KISINYA ──────────────────────
       Versi sebelumnya menaruh rincian ini tepat di bawah kisi kartu.
       Secara kode benar, dan tetap gagal dipakai: dengan tujuh kartu, ujung
       kisinya sudah berada di garis bawah layar — jadi mengklik kartu
       memang membuka sesuatu, hanya saja di tempat yang tidak terlihat
       tanpa menggulir. Yang mengkliknya menyimpulkan kartunya tidak bisa
       dibuka, dan itu kesimpulan yang wajar.

       Lapisan tidak punya masalah itu: ia muncul di tempat mata sudah
       berada. */
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
         onClick={tutup}>
      <section onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
          <h4 className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-zinc-100">{w.nama}</span>
            <span className="block truncate font-mono text-[10.5px] text-zinc-600">{w.alamat}</span>
          </h4>
          {/* Membawa SELURUH daftar, bukan satu koin. Membuka delapan
              posisi satu per satu berarti delapan kali bolak-balik ke panel
              ini; dengan daftarnya ikut ke chart, berpindah pasangan tinggal
              satu klik di sebelah kiri. */}
          {posisi.length > 0 && (
            <Link to={`/chart-entry?dompet=${encodeURIComponent(w.alamat)}`}
              title="Buka semua posisi dompet ini sebagai daftar di samping chart"
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
              <List className="size-3.5" />
              List in Chart
            </Link>
          )}
          <button onClick={tutup} title="Tutup (Esc)"
            className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-zinc-100">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">

      {posisi.length > 0 && (
        <div className="mb-2 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
          {posisi.map((p, i) => (
            <div key={p.koin + i} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2.5">
              <div className="flex items-baseline gap-2">
                {/* Nama koinnya SENDIRI yang jadi tautan, bukan tombol
                    terpisah di sebelahnya. Yang ingin dilihat orang saat
                    membaca baris ini adalah chart koin itu, dan nama koin
                    adalah tempat pertama yang jarinya tuju. */}
                <Link to={`/chart-entry?simbol=${simbolChart(p.koin)}`}
                  title={'Buka chart ' + simbolChart(p.koin)}
                  className="text-[12.5px] font-semibold text-zinc-100 underline decoration-zinc-700 decoration-dotted underline-offset-4 transition-colors hover:text-white hover:decoration-zinc-400">
                  {p.koin}
                </Link>
                <span className={cn('text-[11.5px] font-semibold',
                  p.arah === 'LONG' ? 'text-emerald-400' : 'text-red-400')}>{p.arah}</span>
                {p.leverage > 0 && <span className="text-[11px] text-zinc-600">{p.leverage}×</span>}
                <span className={cn('ml-auto text-[12.5px] font-semibold tabular-nums',
                  p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {p.pnl >= 0 ? '+' : ''}{uangRingkas(p.pnl)}
                </span>
                {/* Menandai, BUKAN mengeksekusi. Tombolnya cuma mencatat
                    "koin ini saya tiru dari dompet ini" — tidak ada order
                    yang dikirim ke mana pun. Yang didapat: posisinya
                    disandingkan dengan posisi kita di satu layar, dan
                    lonceng berbunyi saat dompet ini bergerak di koin itu. */}
                {(() => {
                  const nyala = tiru.some((x) => x.alamat === w.alamat
                    && x.koin === p.koin.toUpperCase());
                  return (
                    <button onClick={() => ubahTiru(p.koin.toUpperCase(), !nyala)}
                      title={nyala
                        ? 'Berhenti menandai koin ini sebagai tiruan'
                        : 'Tandai: saya meniru posisi ini. Tidak ada order yang dikirim.'}
                      className={cn('shrink-0 cursor-pointer rounded p-1 transition-colors',
                        nyala ? 'text-emerald-400 hover:text-emerald-300'
                              : 'text-zinc-700 hover:text-zinc-300')}>
                      <IkonTiru className="size-3.5" />
                    </button>
                  );
                })()}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                <span>Entry <span className="tabular-nums text-zinc-300">{p.entry}</span></span>
                <span>Nilai <span className="tabular-nums text-zinc-300">${uangRingkas(p.nilai)}</span></span>
                <span>Ukuran <span className="tabular-nums text-zinc-300">{p.ukuran}</span></span>
                {p.likuidasi > 0 && (
                  <span>Likuidasi <span className="tabular-nums text-amber-400/90">{p.likuidasi}</span></span>
                )}
              </div>
              {(() => {
                const b = bukaPosisi(log, p.koin, p.arah, p.ukuran);
                if (!b) {
                  return (
                    <p className="mt-1 border-t border-zinc-800/60 pt-1 text-[10.5px] text-zinc-600">
                      Sudah terbuka sebelum dompet ini dipantau
                    </p>
                  );
                }
                return (
                  <p className={cn('mt-1 border-t border-zinc-800/60 pt-1 text-[10.5px]',
                    b.utuh ? 'text-zinc-400' : 'text-zinc-600')}>
                    {b.utuh ? 'Dibuka ' : 'Ditambah '}
                    <span className="tabular-nums text-zinc-300">{tanggalJam(b.waktu)}</span>
                    <span className="text-zinc-600"> · {umur(b.waktu)}</span>
                    {!b.utuh && (
                      <span className="block text-zinc-600">
                        sebagian sudah terbuka sebelum dipantau
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* ── KEPALA YANG DULU TIDAK ADA ────────────────────────────────
          Daftar di bawah ini adalah RIWAYAT ISIAN (fill), dan kisi di
          atasnya adalah POSISI YANG MASIH HIDUP. Dua sumber yang berbeda:
          posisi dari `clearinghouseState`, riwayat dari `userFills`.

          Tanpa kepala, keduanya terbaca sebagai satu daftar panjang — dan
          barisnya menulis "Open Long" apa adanya dari Hyperliquid, di mana
          kata itu menerangkan APA YANG DILAKUKAN ISIAN ITU saat terjadi,
          bukan keadaan sekarang. Posisi yang dibangun bertahap memberi dua
          puluh baris "Open Long"; kalau kemudian ditutup, baris "Close
          Long"-nya duduk di tempat lain pada daftar yang sama.

          Dilaporkan pemilik 2 Sep 2026: ia membaca deretan "Open Long" di
          sini sebagai posisi yang sedang berjalan. Kekeliruan yang wajar —
          layarnya memang tidak pernah mengatakan sebaliknya. */}
      <p className="mb-1.5 mt-3 text-[11.5px] text-zinc-500">
        <span className="font-medium text-zinc-300">Riwayat transaksi</span>
        {' — '}catatan tiap isian saat terjadi, bukan posisi yang sedang berjalan.
        {' '}Posisi hidup ada di kartu-kartu {posisi.length > 0 ? 'di atas' : '(sekarang kosong)'}.
        {/* ── KENAPA KOSONG, bukan cuma "kosong" ────────────────────────
            Dompet yang menutup semuanya dan dompet yang gagal dibaca
            sama-sama menghasilkan nol kartu. Satu angka membedakannya:
            akun $0 berarti dananya memang sudah ditarik, akun berisi
            berarti ia sedang tidak memegang apa pun.

            Dilaporkan pemilik 5 Sep 2026 — ia membaca belasan "Close Long"
            berumur puluhan menit, tidak menemukan posisi terbuka, lalu
            bertanya apakah posisinya tidak terekam. Terekam; dompetnya
            yang kosong. */}
        {posisi.length === 0 && typeof nilaiAkun === 'number' && (
          <span className="block text-zinc-600">
            {nilaiAkun > 0
              ? `Akun dompet masih berisi $${nilaiAkun.toLocaleString('id-ID', { maximumFractionDigits: 2 })} — ia sedang tidak memegang posisi apa pun.`
              : 'Akun dompet $0 — dananya sudah ditarik, bukan posisinya yang gagal terbaca.'}
          </span>
        )}
      </p>

      {log.length === 0 ? (
        <p className="text-[11.5px] leading-relaxed text-zinc-600">
          Belum ada transaksi sejak dompet ini mulai dipantau. Riwayat
          sebelumnya sengaja tidak ditarik — daftar ini catatan pantauan kita,
          bukan salinan riwayat dompetnya.
        </p>
      ) : (
        <div className="rounded-md border border-zinc-800">
          {log.map((l, i) => (
            <div key={l.hash + l.waktu + i}
              className="flex flex-wrap items-baseline gap-x-2.5 border-b border-zinc-800/60 px-2.5 py-1.5 last:border-b-0">
              <span className="text-[12px] font-semibold text-zinc-100">{l.koin}</span>
              <span className={cn('text-[11px] font-medium', warnaDir(l.dir))}>{l.dir || l.arah}</span>
              <span className="text-[11px] tabular-nums text-zinc-400">{l.ukuran} @ {l.harga}</span>
              <span className="text-[11px] tabular-nums text-zinc-600">${uangRingkas(l.nilai)}</span>
              {l.pnl !== 0 && (
                <span className={cn('text-[11px] font-semibold tabular-nums',
                  l.pnl > 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {l.pnl > 0 ? '+' : ''}{uangRingkas(l.pnl)}
                </span>
              )}
              <span className="ml-auto text-[10px] text-zinc-600">{umur(l.waktu)}</span>
            </div>
          ))}
        </div>
      )}
        </div>
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   POSISI TIRUAN — punya sendiri disandingkan dengan yang ditiru
   ════════════════════════════════════════════════════════════════════════
   Menjawab satu pertanyaan yang sebelumnya menuntut dua tab dan ingatan:
   posisi yang saya buka meniru dompet itu, sekarang bagaimana keadaannya
   DIBANDING aslinya.

   Yang disandingkan cuma yang benar-benar ada di kedua sisi. Posisi sendiri
   dibaca dari bursa (bukan dari catatan), posisi dompet dibaca dari rantai.
   Tidak ada satu pun angka di sini yang diperkirakan.

   ── DUA PERINGATAN, DAN KEDUANYA MAHAL KALAU TERLAMBAT ────────────────
     · SUMBERNYA SUDAH TUTUP sementara posisi kita masih terbuka. Ini
       keadaan paling berbahaya di seluruh panel: yang ditiru sudah keluar,
       dan yang meniru masih menanggung risikonya tanpa tahu.
     · ARAH BERBEDA. Kita long sementara dompetnya short di koin yang sama
       berarti salah satunya salah baca, dan biasanya kita.
   ════════════════════════════════════════════════════════════════════════ */
/* ══ POPUP SETELAN SALIN ═══════════════════════════════════════════════
   SATU formulir, SATU tombol Simpan. Bukan sekumpulan sakelar yang
   masing-masing menyimpan sendiri — di formulir yang bisa memindahkan uang,
   keadaan setengah tersimpan adalah keadaan yang bisa dipakai pemantau di
   tengah putaran, dan tidak ada yang pernah bermaksud menyimpannya. */
function DialogSalin({ w, awal, maksLipat, tutup, simpan, hapus }: {
  w: { alamat: string; nama: string };
  awal?: SetelanSalin;
  /** Batas per koin yang sedang berlaku — GLOBAL, bukan milik dompet ini. */
  maksLipat: number;
  tutup: () => void;
  simpan: (v: { aktif: boolean; bursa: string; usd: number; leverage: number; maksLipat: number }) => Promise<void>;
  hapus?: () => Promise<void>;
}) {
  const [bursa, setBursa] = useState<string>(awal?.bursa ?? 'binance');
  const [usd, setUsd] = useState(String(awal?.usd ?? 30));
  const [lev, setLev] = useState(awal?.leverage ?? 1);
  const [aktif, setAktif] = useState(!!awal?.aktif);
  const [lipat, setLipat] = useState(maksLipat);
  const [sibuk, setSibuk] = useState(false);

  const nilai = Number(usd);
  const sah = nilai > 0 && nilai <= 500;
  const terbuka = Object.keys(awal?.punyaku || {});

  return createPortal(
    <div onClick={tutup}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex items-start gap-2 border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-zinc-100">Salin dompet ini</h3>
            <p className="mt-0.5 truncate text-[11.5px] text-zinc-500">
              {w.nama} · <span className="angka">{w.alamat.slice(0, 10)}…{w.alamat.slice(-6)}</span>
            </p>
          </div>
          <button onClick={tutup} className="cursor-pointer rounded p-1 text-zinc-500 hover:text-zinc-200">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Bursa tujuan</span>
            <select value={bursa} onChange={(e) => setBursa(e.target.value)}
              className="w-full cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-500">
              <option value="binance">Binance saja</option>
              <option value="hyperliquid">Hyperliquid saja</option>
              <option value="dua">Keduanya — Binance dulu, Hyperliquid kalau koinnya tidak ada</option>
            </select>
            <span className="mt-1 block text-[11px] leading-relaxed text-zinc-600">
              {bursa === 'hyperliquid'
                ? 'Bursa asal dompetnya — instrumen dan harganya sama persis dengan yang ditiru.'
                : bursa === 'dua'
                  ? 'Koin yang ada di Binance disalin di sana; sisanya otomatis ke Hyperliquid.'
                  : 'Koin yang tidak terdaftar di Binance akan dilewati.'}
            </span>
          </label>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Ukuran per order ($)</span>
              <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal"
                className="angka w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-500" />
            </label>
            <label className="block w-24">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Leverage</span>
              <select value={lev} onChange={(e) => setLev(Number(e.target.value))}
                className="angka w-full cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-500">
                {[1, 2, 3].map((x) => <option key={x} value={x}>{x}×</option>)}
              </select>
            </label>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Yang diisi MARGIN — uang yang dipertaruhkan. Nilai posisinya{' '}
            <span className="angka text-zinc-400">${sah ? (nilai * lev).toFixed(0) : '—'}</span>.
            Di 1× keduanya sama, dan tanpa leverage tidak ada likuidasi: kerugian terburuk
            dikunci oleh ukuran ordernya sendiri.
          </p>

          {/* ── BATAS PER KOIN ────────────────────────────────────────────
              Ditaruh di sini, di formulir per dompet, karena di sinilah
              orangnya berada saat pertanyaannya muncul: "koin ini sudah
              terbuka — boleh dibuka lagi?". Tapi nilainya GLOBAL, dan itu
              ditulis besar-besar di keterangannya supaya tidak ada yang
              mengira ia cuma berlaku untuk dompet yang sedang dibuka. */}
          <label className="block rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
              Batas per koin
            </span>
            <select value={lipat} onChange={(e) => setLipat(Number(e.target.value))}
              className="angka w-full cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-500">
              <option value={1}>1× — satu koin satu posisi</option>
              {[1.5, 2, 2.5, 3, 4, 5].map((x) => (
                <option key={x} value={x}>{x}× dari margin dasar</option>
              ))}
            </select>
            <span className="mt-1.5 block text-[11px] leading-relaxed text-zinc-600">
              <b className="text-zinc-400">Berlaku untuk SEMUA dompet yang disalin</b>, bukan
              cuma yang ini — bursa menyatukan posisi dari dompet mana pun jadi satu.
              {lipat > 1 ? (
                <> Dengan ${sah ? nilai : '—'} per order, satu koin boleh terisi sampai{' '}
                  <span className="angka text-zinc-300">${sah ? (nilai * lipat).toFixed(0) : '—'}</span>{' '}
                  sebelum salinan berikutnya ditahan. Posisi yang kamu buka sendiri di
                  Chart &amp; Entry ikut dihitung.</>
              ) : (
                <> Sekarang: koin yang sudah terisi — dari salinan lain maupun dari posisi
                  yang kamu buka sendiri — menahan salinan berikutnya.</>
              )}
            </span>
          </label>

          <label className={cn('flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors',
            aktif ? 'border-red-500/40 bg-red-500/5' : 'border-zinc-800 hover:border-zinc-700')}>
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)}
              className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-red-400" />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[12.5px] font-medium', aktif ? 'text-red-300' : 'text-zinc-300')}>
                Nyalakan salinan
              </span>
              <span className="block text-[11px] leading-relaxed text-zinc-600">
                Apa pun yang dompet ini BUKA akan diikuti, dan apa pun yang ia TUTUP ikut ditutup.
                Order berangkat sendiri tanpa ditanya lagi. Pindaian pertama sesudah disimpan
                hanya mencatat — posisi yang sudah terbuka sekarang tidak ikut disalin.
              </span>
            </span>
          </label>

          {terbuka.length > 0 && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
              Sedang memegang {terbuka.length} posisi salinan: {terbuka.join(', ')}.
              Mematikan sakelar menghentikan salinan BARU; posisi yang sudah terbuka tetap
              ditutup saat dompet sumbernya melepasnya.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-3">
          {hapus && awal && (
            <button disabled={sibuk}
              onClick={() => { setSibuk(true); void hapus().finally(() => setSibuk(false)); }}
              className="cursor-pointer rounded-md border border-zinc-700 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300 disabled:opacity-40">
              Hapus setelan
            </button>
          )}
          <button onClick={tutup}
            className="ml-auto cursor-pointer rounded-md border border-zinc-700 px-3 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-500">
            Batal
          </button>
          <button disabled={!sah || sibuk}
            onClick={() => { setSibuk(true); void simpan({ aktif, bursa, usd: nilai, leverage: lev, maksLipat: lipat }).finally(() => setSibuk(false)); }}
            className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-[12.5px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
            {sibuk ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ════════════════════════════════════════════════════════════════════════
   KONSENSUS — berapa dompet sepakat, dan seberapa bagus yang sepakat itu
   ════════════════════════════════════════════════════════════════════════
   "Tiga puluh dari empat puluh dompet long BTC" terdengar seperti kabar
   besar, dan sering bukan. Yang menentukan bukan jumlahnya, melainkan SIAPA
   — tiga puluh dompet dengan win rate 45% yang sepakat cuma kerumunan;
   enam dompet dengan win rate 80% yang sepakat adalah keterangan.

   Karena itu kartu ini SELALU menyandingkan tiga hal, dan tidak pernah
   memisahkannya:

     · berapa dompet di tiap sisi
     · WR RATA-RATA mereka menurut riwayat bursa
     · umur rata-rata dompetnya

   Sisi yang menang jumlah tapi kalah rekam jejak ditandai — itu justru
   keadaan yang paling sering salah dibaca, dan satu-satunya alasan kolom WR
   ada di sini.

   ── HARGA MASUK DAN KAPAN ─────────────────────────────────────────────
   Tiap baris membawa harga entry dompetnya dan, kalau pembukaannya kita
   saksikan, kapan itu terjadi. Rata-rata entry sisi yang sepakat adalah
   angka yang paling langsung berguna: ia harga yang mereka anggap layak,
   dan jarak harga sekarang terhadapnya menentukan apakah ikut masuk
   sekarang masih setara atau sudah terlambat.

   ── YANG TIDAK DIHITUNG DI SINI ───────────────────────────────────────
   Tidak ada skor gabungan, tidak ada "sinyal konsensus". Menjumlahkan
   jumlah dompet, win rate, dan umur jadi satu angka berarti memilihkan
   bobotnya untuk orang lain — dan bobot itu justru keputusan yang sedang
   ia ambil. */
function KonsensusPasar({ posisi, dompet, seumur, log }: {
  posisi: PosisiDompet[];
  dompet: DompetPantau[];
  seumur: Record<string, RiwayatBursa>;
  log: TransaksiDompet[];
}) {
  const [buka, setBuka] = useState<string | null>(null);

  const grup = useMemo(() => {
    const peta = new Map<string, { koin: string; long: PosisiDompet[]; short: PosisiDompet[] }>();
    for (const p of posisi) {
      const k = p.koin.toUpperCase();
      if (!peta.has(k)) peta.set(k, { koin: k, long: [], short: [] });
      (p.arah === 'LONG' ? peta.get(k)!.long : peta.get(k)!.short).push(p);
    }

    const rata = (d: number[]) => (d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0);
    const nilaiSisi = (sisi: PosisiDompet[]) => {
      /* Cuma dompet yang PUNYA rekam jejak yang ikut rata-rata WR-nya.
         Memasukkan yang belum terukur sebagai nol akan menyeret turun
         angkanya karena alasan yang tidak ada hubungannya dengan kualitas. */
      const wr = sisi.map((p) => seumur[p.alamat])
        .filter((r) => r && r.tutup > 0)
        .map((r) => (r.menang / r.tutup) * 100);
      const umurHari = sisi.map((p) => seumur[p.alamat]?.lahir)
        .filter((x): x is number => !!x)
        .map((x) => (Date.now() - x) / 86400000);
      return {
        n: sisi.length,
        wr: wr.length ? Math.round(rata(wr)) : null,
        wrDari: wr.length,
        umur: umurHari.length ? Math.round(rata(umurHari)) : null,
        entry: rata(sisi.map((p) => p.entry).filter((x) => x > 0)),
        nilai: sisi.reduce((a, p) => a + p.nilai, 0),
      };
    };

    return [...peta.values()]
      .map((g) => ({ ...g, L: nilaiSisi(g.long), S: nilaiSisi(g.short) }))
      .filter((g) => g.long.length + g.short.length >= 2)
      .sort((a, b) => (b.long.length + b.short.length) - (a.long.length + a.short.length));
    /* Tipe eksplisit di sini, bukan dibiarkan disimpulkan: rantai
       map->filter->sort yang panjang membuat TS kehilangan jejaknya di
       pemakai, dan galatnya muncul dua ratus baris jauh dari sebabnya. */
  }, [posisi, seumur]);

  if (!grup.length) return null;
  const namaDari = new Map(dompet.map((d) => [d.alamat, d.nama]));

  const barisDompet = (sisi: PosisiDompet[]) => sisi
    .slice()
    .sort((a, b) => (seumur[b.alamat]?.tutup ? (seumur[b.alamat].menang / seumur[b.alamat].tutup) : 0)
                  - (seumur[a.alamat]?.tutup ? (seumur[a.alamat].menang / seumur[a.alamat].tutup) : 0))
    .map((p) => {
      const r = seumur[p.alamat];
      const b = bukaPosisi(log.filter((l) => l.alamat === p.alamat), p.koin, p.arah, p.ukuran);
      return (
        <div key={p.alamat + p.koin}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-zinc-800/50 px-2 py-1 last:border-b-0">
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-300">
            {namaDari.get(p.alamat) || p.alamat.slice(0, 10)}
          </span>
          <span className={cn('w-12 text-right text-[11px] tabular-nums',
            !r || !r.tutup ? 'text-zinc-700'
              : r.menang / r.tutup >= 0.5 ? 'text-emerald-400' : 'text-red-400')}>
            {r && r.tutup ? Math.round((r.menang / r.tutup) * 100) + '%' : '—'}
          </span>
          <span className="w-14 text-right text-[10.5px] tabular-nums text-zinc-600">
            {r?.lahir ? umurDompet(r.lahir) : '—'}
          </span>
          <span className="w-20 text-right text-[10.5px] tabular-nums text-zinc-500">{p.entry}</span>
          <span className="w-24 text-right text-[10px] tabular-nums text-zinc-600">
            {b ? (b.utuh ? '' : '≥') + tanggalJam(b.waktu) : 'sebelum dipantau'}
          </span>
          <span className={cn('w-16 text-right text-[11px] font-medium tabular-nums',
            p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {p.pnl >= 0 ? '+' : '−'}${uangRingkas(Math.abs(p.pnl))}
          </span>
        </div>
      );
    });

  return (
    <section>
      <h3 className="mb-2 flex flex-wrap items-center gap-x-2 border-b border-zinc-800 pb-1.5">
        <Users className="size-3.5 text-zinc-500" />
        <span className="text-[13px] font-semibold text-zinc-200">Konsensus dompet</span>
        <span className="text-[11px] font-normal text-zinc-600">
          · koin yang dipegang lebih dari satu dompet · WR & umur dari riwayat bursa
        </span>
        {/* Pintu yang sama bentuknya dengan "List in Chart" di kartu dompet,
            dan itu disengaja: dua daftar yang berperilaku sama harus terlihat
            sama, kalau tidak orang harus belajar dua kali untuk satu
            kebiasaan. */}
        <Link to="/chart-entry?konsensus=1"
          title="Buka daftar konsensus di samping chart — klik koin untuk berpindah"
          className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1 text-[11.5px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
          <List className="size-3.5" />
          List in Chart
        </Link>
      </h3>

      <div className="space-y-1.5">
        {grup.map((g) => {
          const dominan = g.L.n >= g.S.n ? g.L : g.S;
          const lawan = g.L.n >= g.S.n ? g.S : g.L;
          /* Sisi mayoritas yang rekam jejaknya justru lebih buruk daripada
             minoritas — keadaan yang paling sering salah dibaca, dan alasan
             kolom WR ada di kartu ini sama sekali. */
          const mayoritasLemah = !!(lawan.n > 0 && dominan.wr !== null && lawan.wr !== null
            && lawan.wr - dominan.wr >= 15);
          const terbuka = buka === g.koin;
          return (
            <div key={g.koin} className={cn('rounded-lg border bg-zinc-900/30',
              mayoritasLemah ? 'border-amber-500/30' : 'border-zinc-800')}>
              <button onClick={() => setBuka(terbuka ? null : g.koin)}
                className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left">
                <span aria-hidden className={cn('text-zinc-600 transition-transform', terbuka && 'rotate-90')}>›</span>
                <span className="text-[13px] font-semibold text-zinc-100">{g.koin}</span>

                {g.L.n > 0 && (
                  <span className="text-[11.5px]">
                    <span className="font-semibold text-emerald-400">{g.L.n} LONG</span>
                    {g.L.wr !== null && (
                      <span className="ml-1 text-zinc-500">WR {g.L.wr}%
                        <span className="text-zinc-700"> ({g.L.wrDari})</span>
                      </span>
                    )}
                  </span>
                )}
                {g.S.n > 0 && (
                  <span className="text-[11.5px]">
                    <span className="font-semibold text-red-400">{g.S.n} SHORT</span>
                    {g.S.wr !== null && (
                      <span className="ml-1 text-zinc-500">WR {g.S.wr}%
                        <span className="text-zinc-700"> ({g.S.wrDari})</span>
                      </span>
                    )}
                  </span>
                )}

                <span className="ml-auto text-[10.5px] text-zinc-600">
                  rata entry {dominan.entry ? dominan.entry.toFixed(dominan.entry > 100 ? 0 : 4) : '—'}
                  {dominan.umur !== null && <> · umur rata {Math.round(dominan.umur / 30)} bln</>}
                  {' · $' + uangRingkas(g.L.nilai + g.S.nilai)}
                </span>
              </button>

              {mayoritasLemah && (
                <p className="flex items-start gap-1.5 border-t border-zinc-800/60 px-3 py-1.5 text-[11px] leading-relaxed text-amber-300">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                  Sisi yang lebih ramai justru punya rekam jejak lebih buruk
                  ({dominan.wr}% lawan {lawan.wr}%). Jumlah dompet dan kualitas
                  dompet menunjuk ke arah yang berbeda di koin ini.
                </p>
              )}

              {terbuka && (
                <div className="border-t border-zinc-800 p-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 px-2 pb-1 text-[9.5px] uppercase tracking-wide text-zinc-600">
                    <span className="min-w-0 flex-1">Dompet</span>
                    <span className="w-12 text-right">WR</span>
                    <span className="w-14 text-right">Umur</span>
                    <span className="w-20 text-right">Entry</span>
                    <span className="w-24 text-right">Dibuka</span>
                    <span className="w-16 text-right">P/L</span>
                  </div>
                  {g.long.length > 0 && (
                    <>
                      <p className="px-2 py-0.5 text-[10px] font-semibold text-emerald-400/80">LONG · {g.long.length}</p>
                      {barisDompet(g.long)}
                    </>
                  )}
                  {g.short.length > 0 && (
                    <>
                      <p className="mt-1 px-2 py-0.5 text-[10px] font-semibold text-red-400/80">SHORT · {g.short.length}</p>
                      {barisDompet(g.short)}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
        Jumlah dompet bukan sinyal. Tiga puluh dompet dengan WR 45% yang
        sepakat cuma kerumunan; enam dompet dengan WR 80% yang sepakat adalah
        keterangan. Angka dalam kurung di sebelah WR = berapa dompet di sisi
        itu yang rekam jejaknya sudah terukur. Tanda “≥” di kolom Dibuka
        berarti kita cuma menyaksikan penambahannya, bukan pembukaan
        pertamanya.
      </p>
    </section>
  );
}

/* ══ SUB-HALAMAN: POSISI COPY ══════════════════════════════════════════
   Semua yang menyangkut salinan dikumpulkan di satu tempat: dompet mana
   yang disalin, setelan masing-masing, dan posisi apa yang sedang terbuka
   atas namanya.

   Dipisah dari daftar dompet karena keduanya menjawab pertanyaan yang
   berbeda. "Dompet Pantauan" menjawab siapa yang sedang diamati — daftar
   yang dibaca sambil mencari. "Posisi Copy" menjawab apa yang sedang
   berjalan dengan uang sungguhan — dan yang kedua dibuka orang dengan
   maksud yang sama sekali lain, sering kali dengan tergesa. */
/* ── Angka uang di panel ini SELALU dolar bursa ────────────────────────
   Bukan rupiah, dan bukan "ringkas". Yang dibandingkan orang di sini
   adalah margin $30 dengan PnL -$1,84 — dua angka kecil yang selisih
   sennya berarti, dan pembulatan ke "0,0 rb" menghapus persis bagian yang
   sedang dibaca. */
function usdTanda(v: number) {
  return (v > 0 ? '+$' : v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
}

/* Harga dengan jumlah desimal yang mengikuti besarnya. BTC di 79.000 tidak
   butuh enam desimal; PEPE di 0,0000082 tidak bisa hidup tanpanya. */
function hrgAdaptif(v: number) {
  if (!v) return '—';
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(2);
  if (a >= 1) return v.toFixed(4);
  if (a >= 0.01) return v.toFixed(5);
  return v.toPrecision(4);
}

function durasi(dari: number, sampai: number) {
  const m = Math.max(0, Math.round((sampai - dari) / 60000));
  if (m < 60) return m + ' mnt';
  const j = m / 60;
  if (j < 24) return (j < 10 ? j.toFixed(1) : Math.round(j)) + ' jam';
  return (j / 24).toFixed(1) + ' hari';
}

const RONA_LOG: Record<string, string> = {
  buka: 'bg-emerald-500/15 text-emerald-300',
  tutup: 'bg-sky-500/15 text-sky-300',
  gagal: 'bg-red-500/15 text-red-300',
  tahan: 'bg-amber-500/15 text-amber-300',
  konfirmasi: 'bg-zinc-800 text-zinc-400',
  catat: 'bg-zinc-800 text-zinc-500',
};

/** Satu angka besar dengan labelnya. Dipakai dua baris ringkasan di bawah. */
function Angka({ judul, nilai, warna, sub }: {
  judul: string; nilai: string; warna?: string; sub?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <span className="block text-[10.5px] uppercase tracking-wide text-zinc-600">{judul}</span>
      <span className={cn('angka mt-0.5 block text-[18px] font-medium', warna || 'text-zinc-100')}>{nilai}</span>
      {sub && <span className="mt-0.5 block text-[10.5px] text-zinc-600">{sub}</span>}
    </div>
  );
}

function PosisiCopy({ salin, log, riwayat, dompet, maksLipat, buka, keKartu, muat }: {
  salin: SetelanSalin[];
  log: LogSalin[];
  riwayat: RiwayatSalin[];
  dompet: DompetPantau[];
  /** Batas per koin yang sedang berlaku — GLOBAL, bukan milik satu dompet. */
  maksLipat: number;
  buka: (w: { alamat: string; nama: string }) => void;
  /** Pindah ke tab Dompet Pantauan, tepat di kartu dompet ini. */
  keKartu: (alamat: string) => void;
  muat: boolean;
}) {
  const nama = new Map(dompet.map((d) => [d.alamat, d.nama]));

  /* Posisi salinan diratakan jadi satu daftar, bukan dikelompokkan per
     dompet. Yang ditanyakan orang saat membuka halaman ini "aku sedang
     pegang apa" — dan jawaban itu tersebar di beberapa kartu kalau
     dikelompokkan menurut asalnya. */
  const posisi = salin.flatMap((s) =>
    Object.entries((s.punyaku || {}) as Record<string, PosisiSalinan>).map(([koin, p]) => ({
      koin, ...p, alamat: s.alamat,
      dompet: nama.get(s.alamat) || s.nama || s.alamat.slice(0, 8) + '…',
      /* Setelan saat DIBUKA lebih benar daripada setelan sekarang; yang
         sekarang cuma dipakai kalau posisinya lahir sebelum medan ini ada. */
      usd: p.usd ?? s.usd, leverage: p.leverage ?? s.leverage,
    })));

  const hidup = salin.filter((s) => s.aktif);

  /* ── Angka berjalan ──────────────────────────────────────────────────
     Dijumlahkan hanya dari posisi yang potretnya TERBACA. Posisi yang
     angkanya basi tidak dihitung nol — nol adalah pernyataan, dan
     menjumlahkan "tidak tahu" sebagai nol membuat total margin terlihat
     lebih kecil daripada yang benar-benar tertahan di bursa. */
  const terbaca = posisi.filter((p) => p.hidup?.terbaca);
  const margin = terbaca.reduce((t, p) => t + (p.hidup?.margin || 0), 0);
  const pnlJalan = terbaca.reduce((t, p) => t + (p.hidup?.pnl || 0), 0);
  const nilaiPosisi = terbaca.reduce((t, p) => t + (p.hidup?.nilai || 0), 0);
  const belumTerbaca = posisi.length - terbaca.length;

  /* ── Hasil yang sudah selesai ────────────────────────────────────────
     Winrate dihitung dari trade yang PnL-nya benar-benar terbaca saja.
     Yang tidak terbaca tetap ditampilkan di daftar, tapi tidak ikut
     memilih — angka kemenangan yang mengandung tebakan lebih buruk
     daripada angka kemenangan dari sampel yang lebih kecil. */
  const dinilai = riwayat.filter((r) => r.pnl !== null);
  const realisasi = dinilai.reduce((t, r) => t + (r.pnl || 0), 0);
  const menang = dinilai.filter((r) => (r.pnl || 0) > 0).length;
  const winrate = dinilai.length ? (menang / dinilai.length) * 100 : null;

  if (muat && !salin.length) {
    return (
      <p className="flex items-center gap-2 py-8 text-[13px] text-zinc-500">
        <Loader2 className="size-4 animate-spin" /> Memuat setelan salinan…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── RINGKASAN: YANG SEDANG BERJALAN ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Angka judul="Dompet disalin" nilai={String(hidup.length)}
          warna={hidup.length ? 'text-emerald-400' : 'text-zinc-500'}
          sub={hidup.length ? '$' + [...new Set(hidup.map((s) => s.usd))].join(' / $') + ' per order' : undefined} />
        <Angka judul="Posisi terbuka" nilai={String(posisi.length)}
          warna={posisi.length ? 'text-zinc-100' : 'text-zinc-500'}
          sub={nilaiPosisi > 0 ? 'nilai $' + nilaiPosisi.toFixed(0) : undefined} />
        <Angka judul="Margin terpakai" nilai={margin > 0 ? '$' + margin.toFixed(2) : '—'}
          warna={margin > 0 ? 'text-zinc-100' : 'text-zinc-500'}
          sub={belumTerbaca > 0 ? belumTerbaca + ' posisi belum terbaca' : undefined} />
        <Angka judul="PnL berjalan" nilai={terbaca.length ? usdTanda(pnlJalan) : '—'}
          warna={!terbaca.length ? 'text-zinc-500' : pnlJalan > 0 ? 'text-emerald-400' : pnlJalan < 0 ? 'text-red-400' : 'text-zinc-300'}
          sub={margin > 0 ? ((pnlJalan / margin) * 100).toFixed(1) + '% dari margin' : undefined} />
      </div>

      {/* ── RINGKASAN: YANG SUDAH SELESAI ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Angka judul="Realized" nilai={dinilai.length ? usdTanda(realisasi) : '—'}
          warna={!dinilai.length ? 'text-zinc-500' : realisasi > 0 ? 'text-emerald-400' : realisasi < 0 ? 'text-red-400' : 'text-zinc-300'}
          sub={dinilai.length ? dinilai.length + ' posisi tertutup' : 'belum ada yang tertutup'} />
        <Angka judul="Winrate" nilai={winrate === null ? '—' : winrate.toFixed(0) + '%'}
          warna={winrate === null ? 'text-zinc-500' : winrate >= 50 ? 'text-emerald-400' : 'text-red-400'}
          sub={winrate === null ? undefined : menang + ' menang · ' + (dinilai.length - menang) + ' kalah'} />
        <Angka judul="Total (jalan + selesai)"
          nilai={terbaca.length || dinilai.length ? usdTanda(pnlJalan + realisasi) : '—'}
          warna={!terbaca.length && !dinilai.length ? 'text-zinc-500'
            : pnlJalan + realisasi > 0 ? 'text-emerald-400' : pnlJalan + realisasi < 0 ? 'text-red-400' : 'text-zinc-300'} />
        <Angka judul="Aksi tercatat" nilai={String(log.length)}
          warna={log.length ? 'text-zinc-300' : 'text-zinc-500'}
          sub={log.length ? umur(log[0].waktu) : undefined} />
      </div>

      {/* ── POSISI YANG SEDANG TERBUKA ──────────────────────────────── */}
      <section>
        <h3 className="mb-2 flex flex-wrap items-center gap-x-2 border-b border-zinc-800 pb-1.5">
          <span className="text-[13px] font-semibold text-zinc-200">Posisi salinan terbuka</span>
          <span className="text-[11px] font-normal text-zinc-600">
            · dibuka otomatis mengikuti dompet sumbernya, ditutup saat ia melepas
          </span>
        </h3>
        {!posisi.length ? (
          <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-[12px] leading-relaxed text-zinc-500">
            Belum ada posisi salinan. Ia muncul di sini begitu salah satu dompet yang
            kamu salin membuka posisi BARU — posisi yang sudah terbuka sebelum salinan
            dinyalakan sengaja tidak diikuti.
          </p>
        ) : (
          <div className="space-y-1.5">
            {posisi.map((p) => {
              const h = p.hidup;
              const segar = !!h?.terbaca;
              /* Jarak ke likuidasi dalam PERSEN, bukan selisih harga.
                 "$412 lagi" tidak bisa ditimbang tanpa tahu harganya
                 berapa; "8% lagi" langsung terbaca sebagai bahaya. */
              const keLikuidasi = segar && h!.likuidasi > 0 && h!.harga > 0
                ? Math.abs((h!.harga - h!.likuidasi) / h!.harga) * 100 : null;
              const gerak = segar && h!.entry > 0 && h!.harga > 0
                ? ((h!.harga - h!.entry) / h!.entry) * 100 : null;
              return (
                <div key={p.alamat + p.koin}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2">
                  {/* Baris atas: identitas posisi. */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[13px] font-semibold text-zinc-100">{p.simbol || p.koin}</span>
                    <span className={cn('text-[11.5px] font-semibold',
                      p.arah === 'BUY' ? 'text-emerald-400' : 'text-red-400')}>
                      {p.arah === 'BUY' ? 'LONG' : 'SHORT'}
                    </span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10.5px]',
                      p.bursa === 'hyperliquid' ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300')}>
                      {p.bursa === 'hyperliquid' ? 'Hyperliquid' : 'Binance'}
                    </span>
                    <span className="angka text-[11px] text-zinc-500">
                      ${p.usd} · {p.leverage ?? 1}×
                    </span>
                    <span className="text-[11px] text-zinc-600">meniru {p.dompet}</span>
                    <span className="ml-auto text-[11px] text-zinc-600">{umur(p.waktu)}</span>
                  </div>

                  {/* Baris bawah: angka dari bursa. Ditampilkan hanya kalau
                      potretnya segar — angka basi yang dipajang seolah
                      terkini adalah kesalahan yang paling mahal di panel
                      berisi uang sungguhan. */}
                  {segar ? (
                    <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-zinc-800/70 pt-1.5 sm:grid-cols-4">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-zinc-600">Ukuran</span>
                        <span className="angka text-[11.5px] text-zinc-300">
                          {h!.qty} <span className="text-zinc-600">≈ ${h!.nilai.toFixed(2)}</span>
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-zinc-600">Masuk → pasar</span>
                        <span className="angka text-[11.5px] text-zinc-300">
                          {hrgAdaptif(h!.entry)} → {hrgAdaptif(h!.harga)}
                          {gerak !== null && (
                            <span className={cn('ml-1', gerak >= 0 ? 'text-emerald-500/80' : 'text-red-400/80')}>
                              {gerak >= 0 ? '+' : ''}{gerak.toFixed(2)}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-zinc-600">Margin</span>
                        <span className="angka text-[11.5px] text-zinc-300">
                          ${h!.margin.toFixed(2)}
                          {keLikuidasi !== null && (
                            <span className={cn('ml-1 text-[10.5px]',
                              keLikuidasi < 15 ? 'text-red-400' : 'text-zinc-600')}>
                              liq {keLikuidasi.toFixed(0)}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-zinc-600">PnL berjalan</span>
                        <span className={cn('angka text-[11.5px] font-medium',
                          h!.pnl > 0 ? 'text-emerald-400' : h!.pnl < 0 ? 'text-red-400' : 'text-zinc-300')}>
                          {usdTanda(h!.pnl)}
                          <span className="ml-1 text-[10.5px] opacity-70">
                            {h!.roe >= 0 ? '+' : ''}{h!.roe.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 flex items-center gap-1.5 border-t border-zinc-800/70 pt-1.5 text-[11px] text-zinc-600">
                      <TriangleAlert className="size-3 shrink-0 text-amber-500/70" />
                      Angka posisinya belum terbaca dari bursa. Pemantau memindai tiap 60 detik;
                      kalau tetap kosong, posisinya mungkin sudah tertutup di luar salinan.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── HASIL YANG SUDAH TERTUTUP ───────────────────────────────── */}
      <section>
        <h3 className="mb-2 flex flex-wrap items-center gap-x-2 border-b border-zinc-800 pb-1.5">
          <span className="text-[13px] font-semibold text-zinc-200">Hasil tertutup</span>
          <span className="text-[11px] font-normal text-zinc-600">
            · PnL dipotret sesaat sebelum order tutup berangkat, bukan dari fill bursa
          </span>
        </h3>
        {!riwayat.length ? (
          <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-[12px] leading-relaxed text-zinc-500">
            Belum ada posisi salinan yang tertutup. Baris pertama muncul begitu salah satu
            dompet sumber melepas koin yang sedang kamu salin.
          </p>
        ) : (
          <div className="space-y-1">
            {riwayat.slice(0, 25).map((r, i) => (
              <div key={r.waktu + r.koin + i}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg border border-zinc-800/70 px-3 py-1.5">
                <span className="text-[12.5px] font-medium text-zinc-200">{r.simbol || r.koin}</span>
                <span className={cn('text-[11px] font-semibold',
                  r.arah === 'BUY' ? 'text-emerald-500/80' : 'text-red-400/80')}>
                  {r.arah === 'BUY' ? 'LONG' : 'SHORT'}
                </span>
                <span className="text-[10.5px] text-zinc-600">
                  {r.bursa === 'hyperliquid' ? 'Hyperliquid' : 'Binance'} · ${r.usd} {r.leverage}×
                </span>
                {r.entry > 0 && (
                  <span className="angka text-[10.5px] text-zinc-600">
                    {hrgAdaptif(r.entry)} → {hrgAdaptif(r.keluar)}
                  </span>
                )}
                <span className="text-[10.5px] text-zinc-600">
                  {r.dibuka ? durasi(r.dibuka, r.waktu) : ''} · {umur(r.waktu)}
                </span>
                <span className={cn('angka ml-auto text-[12px] font-medium',
                  r.pnl === null ? 'text-zinc-600'
                    : r.pnl > 0 ? 'text-emerald-400' : r.pnl < 0 ? 'text-red-400' : 'text-zinc-300')}>
                  {r.pnl === null ? 'tak terbaca' : usdTanda(r.pnl)}
                  {r.roe !== null && (
                    <span className="ml-1 text-[10.5px] opacity-70">
                      {r.roe >= 0 ? '+' : ''}{r.roe.toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── SETELAN PER DOMPET ──────────────────────────────────────── */}
      <section>
        <h3 className="mb-2 flex flex-wrap items-center gap-x-2 border-b border-zinc-800 pb-1.5">
          <span className="text-[13px] font-semibold text-zinc-200">Dompet yang disalin</span>
          <span className="text-[11px] font-normal text-zinc-600">· {salin.length} setelan</span>
          {/* Batas per koin dipampang DI SINI, bukan cuma di dalam dialog.
              Ia berlaku untuk semua baris di bawahnya, dan aturan yang cuma
              terlihat sesudah membuka salah satu barisnya akan terbaca
              sebagai milik baris itu. */}
          <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10.5px]',
            maksLipat > 1 ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-800 text-zinc-400')}>
            batas per koin <span className="angka">{maksLipat}×</span>
            {maksLipat > 1 ? ' margin dasar' : ' — satu koin satu posisi'}
          </span>
        </h3>
        {!salin.length ? (
          <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-[12px] leading-relaxed text-zinc-500">
            Belum ada dompet yang disalin. Buka tab <span className="text-zinc-300">Dompet Pantauan</span>,
            lalu tekan ikon salin di kartu dompet mana pun untuk mengaturnya.
          </p>
        ) : (
          <div className="space-y-1.5">
            {salin.map((s) => {
              const terbuka = Object.keys(s.punyaku || {});
              /* Hasil PER DOMPET, bukan cuma total. Yang diputuskan orang di
                 baris ini adalah "dompet ini layak diteruskan atau tidak",
                 dan total gabungan tidak pernah bisa menjawabnya. */
              const punyaDia = riwayat.filter((r) => r.alamat === s.alamat && r.pnl !== null);
              const hasilDia = punyaDia.reduce((t, r) => t + (r.pnl || 0), 0);
              const menangDia = punyaDia.filter((r) => (r.pnl || 0) > 0).length;
              const sebutan = nama.get(s.alamat) || s.nama || 'Tanpa nama';
              return (
                /* ── DUA SASARAN KLIK DALAM SATU BARIS ────────────────────
                   Barisnya membuka setelan salin, seperti sebelumnya. Yang
                   baru: NAMA/ALAMAT-nya sendiri menuju kartu dompetnya di
                   tab Dompet Pantauan — dua pertanyaan berbeda yang selama
                   ini dijawab satu tombol, dan yang kedua ("dompet ini
                   sebenarnya sedang apa") tidak punya jalan sama sekali.

                   `div role="button"`, bukan `<button>`: tombol di dalam
                   tombol bukan HTML yang sah, dan peramban boleh
                   memperlakukannya sesukanya. Papan ketik tetap terlayani
                   lewat tabIndex + penangan Enter/Spasi. */
                /* ── SATU BARIS, SATU ARTI ────────────────────────────────
                   Barisnya `<button>` lagi — persis seperti sebelum 4 Sep
                   2026 — karena bentuk yang sempat menggantikannya RUSAK di
                   layar: baris yang di DALAMNYA ada tombol lain (tautan ke
                   kartu dompet). Diperiksa langsung di peramban pemilik:
                   menekan barisnya tidak membuka apa pun, dialog setelan
                   salin tidak pernah muncul.

                   Elemen interaktif di dalam elemen interaktif memang tidak
                   sah, dan yang membayarnya bukan validator melainkan orang
                   yang menekan barisnya lalu tidak terjadi apa-apa.

                   Tautan ke kartu dompet tetap ada — sebagai SAUDARA di
                   sebelahnya, bukan anak. */
                <div key={s.alamat} className="relative">
                <button
                  onClick={() => buka({ alamat: s.alamat, nama: sebutan })}
                  className={cn('flex w-full cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border py-2 pl-3 pr-10 text-left transition-colors',
                    s.aktif ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
                            : 'border-zinc-800 hover:border-zinc-700')}>
                  <span className="text-[12.5px] font-medium text-zinc-100">{sebutan}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                    s.aktif ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500')}>
                    {s.aktif ? 'hidup' : 'mati'}
                  </span>
                  <span className="angka text-[11px] text-zinc-500">
                    ${s.usd} · {s.leverage ?? 1}× ·{' '}
                    {s.bursa === 'hyperliquid' ? 'Hyperliquid'
                      : s.bursa === 'dua' ? 'Binance + Hyperliquid' : 'Binance'}
                  </span>
                  {terbuka.length > 0 && (
                    <span className="text-[11px] text-zinc-400">{terbuka.length} posisi: {terbuka.join(', ')}</span>
                  )}
                  {punyaDia.length > 0 && (
                    <span className="text-[11px] text-zinc-500">
                      <span className={cn('angka font-medium',
                        hasilDia > 0 ? 'text-emerald-400' : hasilDia < 0 ? 'text-red-400' : 'text-zinc-300')}>
                        {usdTanda(hasilDia)}
                      </span>{' '}
                      dari {punyaDia.length} trade · {Math.round((menangDia / punyaDia.length) * 100)}% menang
                    </span>
                  )}
                  {/* Berapa koin yang SEDANG dipegang dompet sumbernya —
                      pembanding yang menjelaskan kenapa salinan kita cuma
                      sekian: sisanya sudah terbuka sebelum salinan menyala. */}
                  {Array.isArray(s.pegang) && (
                    <span className="ml-auto text-[11px] text-zinc-600">
                      sumber pegang {s.pegang.length} koin
                    </span>
                  )}
                </button>
                  {/* Tautan ke kartu dompet: SAUDARA tombol baris, bukan
                      anaknya. Ditumpuk di ujung kanan lewat pembungkus
                      `relative`; barisnya diberi `pr-10` supaya isinya tidak
                      pernah lewat di bawah ikon ini. */}
                  <button
                    onClick={() => keKartu(s.alamat)}
                    title={'Lihat kartu dompet ' + s.alamat + ' di tab Dompet Pantauan'}
                    aria-label={'Lihat kartu dompet ' + sebutan}
                    className="absolute right-1.5 top-1.5 inline-flex size-[22px] cursor-pointer items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-sky-300">
                    <ExternalLink className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── LOG AKSI ────────────────────────────────────────────────────
          Yang paling sering ditanyakan tentang mesin salinan bukan "kenapa
          ia membuka", melainkan "kenapa ia TIDAK membuka" — dan pertanyaan
          itu cuma bisa dijawab kalau penolakan ikut tercatat, bukan cuma
          keberhasilan. Jadi konfirmasi yang belum genap, posisi yang
          ditahan karena kuota penuh, dan order yang ditolak bursa semuanya
          punya barisnya sendiri di sini. */}
      <section>
        <h3 className="mb-2 flex flex-wrap items-center gap-x-2 border-b border-zinc-800 pb-1.5">
          <span className="text-[13px] font-semibold text-zinc-200">Log aksi</span>
          <span className="text-[11px] font-normal text-zinc-600">
            · termasuk yang TIDAK jadi dikerjakan, berikut alasannya
          </span>
        </h3>
        {!log.length ? (
          <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-[12px] leading-relaxed text-zinc-500">
            Log masih kosong. Ia mulai terisi pada pindaian berikutnya —
            pemantau memindai tiap 60 detik.
          </p>
        ) : (
          <div className="gulir-senyap max-h-[320px] space-y-0.5 overflow-y-auto pr-1">
            {log.slice(0, 80).map((b, i) => (
              <div key={b.waktu + b.jenis + i}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded px-2 py-1 text-[11.5px] odd:bg-zinc-900/30">
                <span className="angka shrink-0 text-[10.5px] text-zinc-600">{tanggalJam(b.waktu)}</span>
                <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide',
                  RONA_LOG[b.jenis] || 'bg-zinc-800 text-zinc-500')}>
                  {b.jenis}
                </span>
                <span className="min-w-0 flex-1 text-zinc-400">{b.pesan}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function PanelWalletAgen({ pemilik = false, tab: tabLuar }: {
  pemilik?: boolean;
  /* Tab DARI LUAR, dipasok halaman Wallet Tracking yang membacanya dari
     alamat. Saat prop ini ada, bilah tab internal tidak digambar sama
     sekali — pemanggilnya sudah menggambar bilahnya sendiri, dan dua bilah
     untuk pilihan yang sama persis adalah cacat yang paling mudah dibuat
     saat memindahkan komponen ke halaman baru.

     Tetap opsional supaya panel ini masih bisa berdiri sendiri di tempat
     lain tanpa halaman yang mengurus alamatnya. */
  tab?: 'dompet' | 'salin';
}) {
  const [d, setD] = useState<KeadaanDompet | null>(null);
  const [gagal, setGagal] = useState(false);
  /* Dompet yang sedang dibuka rinciannya. null = belum ada, dan itu keadaan
     awal yang benar: kisi kartunya sudah menjawab pertanyaan yang paling
     sering ditanyakan, dan rincian yang terbuka sendiri cuma mendorongnya
     ke luar layar. */
  const [pilih, setPilih] = useState<string | null>(null);

  /* ── MENUJU SATU KARTU DOMPET DARI TAB LAIN ──────────────────────────
     Lewat alamat (`?sub=dompet&w=0x…`), bukan lewat keadaan di dalam
     komponen: tab-nya sendiri sudah hidup di alamat, dan sasaran yang
     dititipkan ke keadaan akan hilang tiap kali orangnya menyegarkan
     halaman atau menekan tombol kembali.

     Parameternya dihapus SESUDAH kartunya benar-benar ketemu. Daftar
     dompet datang dari jaringan, jadi pada gambar pertama kartunya belum
     ada — menghapus parameter di situ berarti sasarannya hilang tepat
     sebelum ia bisa dipakai. `dompet.length` jadi dep supaya percobaannya
     diulang begitu daftarnya masuk. */
  const [cari, setCari] = useSearchParams();
  const keKartu = useCallback((alamat: string) => {
    const b = new URLSearchParams(cari);
    b.delete('sub');
    b.set('w', alamat.toLowerCase());
    setCari(b, { replace: false });
  }, [cari, setCari]);

  /* ── MENDARAT DI KARTU YANG DIMINTA `?w=` ────────────────────────────
     DI ATAS `if (muat) return` — dan itu bukan selera, itu syarat.

     Efek ini sempat duduk di bawah sana, sesudah kartunya digambar, karena
     di situlah `dompet` sudah ada. Akibatnya: pada gambar PERTAMA `muat`
     masih true, komponennya pulang lebih awal, dan efek ini tidak pernah
     terhitung. Begitu datanya masuk dan `muat` jadi false, React menemukan
     satu hook LEBIH BANYAK daripada gambar sebelumnya — dan itu galat yang
     mematikan seluruh komponennya, bukan peringatan.

     Yang terlihat pengguna: halaman Wallet Tracking berubah jadi "Halaman
     ini gagal dimuat". Dilaporkan pemilik 4 Sep 2026.

     Aturannya sederhana dan berlaku untuk berkas ini seterusnya: TIDAK ADA
     hook di bawah `if (muat)`. Jumlah dompetnya dibaca dari `d` langsung,
     jadi efek ini tidak perlu menunggu turunan mana pun.

     Parameternya dihapus SESUDAH kartunya ketemu — daftar dompet datang
     dari jaringan, jadi pada gambar pertama `getElementById` masih null,
     dan jumlah dompet di dep membuat percobaannya diulang saat daftarnya
     masuk. Sasaran itu sekali pakai: dibiarkan menempel, menyegarkan
     halaman akan menggulir ke sana lagi selamanya. */
  const sorot = (cari.get('w') || '').toLowerCase();
  const jumlahDompet = d?.dompet?.length ?? 0;
  useEffect(() => {
    if (!sorot || !jumlahDompet) return;
    const el = document.getElementById('kartu-dompet-' + sorot);
    if (!el) return;
    setPilih(sorot);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const b = new URLSearchParams(cari);
    b.delete('w');
    setCari(b, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorot, jumlahDompet]);
  /* Setelan salin ditarik terpisah dari keadaan dompet: ia milik pemilik
     saja dan digerbangi server, jadi menggabungkannya ke jawaban publik
     berarti menambah satu jalan bocor tanpa satu pun manfaat. */
  const [isiSalin, setIsiSalin] = useState<IsiSalin>({ salin: [], log: [], riwayat: [], maksLipat: 1 });
  const salin = isiSalin.salin;
  /* Sub-halaman DI DALAM kartu ini, bukan di sidebar Copy Signal. Yang di
     sidebar berlaku untuk seluruh halaman Copy Signal; ini cuma dua cara
     melihat isi satu kanal. Menaruhnya di sidebar akan menyiratkan ia
     sejajar "Market Signal", dan itu keliru. */
  const [tabDalam, setTab] = useState<'dompet' | 'salin'>('dompet');
  const tab = tabLuar ?? tabDalam;
  const [dialogSalin, setDialogSalin] = useState<{ alamat: string; nama: string } | null>(null);
  const salinPeta = useMemo(() => new Map(salin.map((x) => [x.alamat, x])), [salin]);
  const [muat, setMuat] = useState(true);
  const pertama = useRef(true);

  const tarik = useCallback(async (tampilkanMuat = false) => {
    if (tampilkanMuat) setMuat(true);
    const k = await keadaanDompet();
    /* null = tidak bisa bertanya. Daftar lama DIPERTAHANKAN: satu tarikan
       gagal saat jaringan berkedip bukan kabar bahwa dompetnya kosong. */
    if (k) { setD(k); setGagal(false); } else setGagal(true);
    /* Setelan salin ikut ditarik di putaran yang sama. Keadaan berjalannya
       (`punyaku`, hitungan konfirmasi) ditulis pemantau tiap 60 detik, jadi
       menariknya bersama keadaan dompet membuat ikon salin di kartu dan
       posisi yang tampil di sub-halaman selalu bercerita hal yang sama.
       Gagal diam-diam: setelan yang tidak terbaca cuma membuat ikonnya
       tidak menyala, bukan menjatuhkan seluruh panel. */
    setIsiSalin(await daftarSalin());
    setMuat(false);
  }, []);

  useEffect(() => {
    void tarik(pertama.current);
    pertama.current = false;
    /* Pemantau memindai tiap 60 detik, jadi menarik lebih rapat dari itu
       cuma menambah permintaan tanpa menambah kabar. */
    const t = setInterval(() => { void tarik(); }, 60000);
    return () => clearInterval(t);
  }, [tarik]);

  if (muat) {
    return (
      /* Dulu TANPA justify-center — menempel ke kiri, persis seperti
         panel-chart-agen. Dua berkas, satu kekeliruan yang sama, karena
         kelasnya memang disalin dari satu ke yang lain. */
      <Memuat pesan="Mengambil keadaan dompet…" />
    );
  }

  const dompet = d?.dompet || [];
  const posisi = d?.posisi || [];
  const log = d?.log || [];

  /* Nama tidak lagi perlu dicari dari tiap baris: pengelompokan per kartu
     membuat namanya dibaca sekali dari daftar dompet, dan salinan nama yang
     ikut tersimpan di tiap transaksi tidak pernah dipakai lagi. Itu sekaligus
     menutup cacat yang sempat terlihat — mengganti nama dompet dulu
     meninggalkan ratusan baris yang masih menuliskan nama lamanya. */
  const BATAS_DENYUT = 5 * 60 * 1000;
  const sehat = !!d && d.denyut > 0 && Date.now() - d.denyut < BATAS_DENYUT;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-zinc-100">Dompet Pantauan</h2>
          <p className="mt-0.5 text-[12.5px] text-zinc-500">
            Posisi dan setiap transaksi dompet perp on-chain. Fase mencatat —
            tidak ada order yang dikirim, dan belum ada sinyal yang terbit ke publik.
          </p>
        </div>
        <span className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px]',
          sehat ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-300')}>
          <span aria-hidden className={cn('size-1.5 rounded-full', sehat ? 'bg-emerald-400' : 'bg-amber-400')} />
          {d && d.denyut ? 'Pindai ' + umur(d.denyut) : 'Belum pernah memindai'}
        </span>
        <button onClick={() => void tarik(true)} title="Muat ulang"
          className="cursor-pointer rounded-md border border-zinc-800 p-1.5 text-zinc-400 transition-colors hover:text-zinc-100">
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {gagal && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12.5px] text-amber-300">
          Server tidak menjawab — yang tampil di bawah bacaan terakhir yang berhasil.
        </p>
      )}
      {d?.galat && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12.5px] text-amber-300">
          Sebagian dompet gagal dibaca — {d.galat}
        </p>
      )}

      {/* Menambah dompet menulis ke daftar PEMILIK. Untuk orang lain
          formulirnya tidak dirender sama sekali — bukan dinonaktifkan:
          kotak isian yang menolak sesudah diketik penuh membuang waktu
          orang untuk memberitahunya sesuatu yang sudah diketahui sejak
          sebelum ia mulai mengetik. */}
      {/* Cuma pemilik yang punya dua sisi: pembaca lain tidak punya salinan
          apa pun, dan tab yang isinya selalu kosong cuma menambah satu
          keputusan yang tidak perlu diambil siapa pun. */}
      {pemilik && !tabLuar && (
        <div className="flex gap-1 border-b border-zinc-800">
          {([['dompet', 'Dompet Pantauan'], ['salin', 'Posisi Copy']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn('-mb-px cursor-pointer border-b-2 px-3 py-1.5 text-[12.5px] transition-colors',
                tab === id ? 'border-zinc-100 font-medium text-zinc-100'
                           : 'border-transparent text-zinc-500 hover:text-zinc-300')}>
              {label}
              {id === 'salin' && salin.some((x) => x.aktif) && (
                <span className="ml-1.5 inline-block size-1.5 rounded-full bg-emerald-400 align-middle" />
              )}
            </button>
          ))}
        </div>
      )}

      {tab === 'salin' ? (
        <PosisiCopy salin={salin} log={isiSalin.log} riwayat={isiSalin.riwayat}
          dompet={dompet} muat={muat} maksLipat={isiSalin.maksLipat}
          buka={(w) => setDialogSalin(w)} keKartu={keKartu} />
      ) : (<>

      {pemilik && <FormTambah selesai={() => void tarik()} />}

      {/* Papan peringkat di ATAS daftar dompet, bukan di bawah. Yang dicari
          orang saat membuka panel ini pada hari-hari awal adalah "dompet
          mana", bukan "dompet yang sudah saya pilih sedang apa" — dan yang
          dicari lebih sering pantas duduk lebih dekat ke atas. */}
      <PapanPeringkat
        pantau={pemilik ? (async (alamat, nama) => {
          await tambahDompet(alamat, nama || alamat.slice(0, 10) + '…');
          await tarik();
        }) : undefined}
        jadiAnalis={pemilik ? (async (alamat, nama) => {
          await jadikanAnalisDompet(alamat, nama || 'Dompet ' + alamat.slice(2, 8));
          await tarik();
        }) : undefined}
        analisSet={new Set(dompet.filter((d) => d.analis).map((d) => d.alamat))}
      />

      {dompet.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-10 text-center">
          <Wallet className="mx-auto mb-2 size-5 text-zinc-700" />
          <p className="text-[13px] text-zinc-400">Belum ada dompet yang dipantau.</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-zinc-600">
            {pemilik
              ? 'Tempel alamat dompet Hyperliquid di kotak di atas. Posisi dan transaksinya mulai tercatat pada pindaian berikutnya.'
              : 'Daftarnya disusun pemilik situs. Begitu ada dompet yang dipantau, posisi dan rekam jejaknya muncul di sini.'}
          </p>
        </div>
      ) : (
        <>
          <KonsensusPasar posisi={posisi} dompet={dompet}
            seumur={d?.seumur || {}} log={log} />

          <section>
            <h3 className="mb-2 border-b border-zinc-800 pb-1.5 text-[13px] font-semibold text-zinc-200">
              Dompet yang dipantau <span className="font-normal text-zinc-600">· {dompet.length}</span>
              <span className="ml-2 text-[11px] font-normal text-zinc-600">
                Klik kartunya untuk melihat posisi &amp; transaksinya
              </span>
            </h3>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,15.5rem),1fr))]">
              {dompet.map((w) => (
                <KartuDompet key={w.alamat} w={w}
                  /* Disaring per kartu, bukan dikelompokkan sekali di atas.
                     Dompet yang BELUM punya posisi maupun transaksi tetap
                     harus muncul — pengelompokan yang membuang yang kosong
                     akan menghilangkan dompet yang baru ditambahkan, dan
                     yang menambahkannya mengira penambahannya gagal. */
                  posisi={posisi.filter((p) => p.alamat === w.alamat)}
                  log={log.filter((l) => l.alamat === w.alamat)}
                  bursa={d?.seumur?.[w.alamat]}
                  dipilih={pilih === w.alamat}
                  pilih={() => setPilih((v) => (v === w.alamat ? null : w.alamat))}
                  hapus={pemilik
                    ? () => { void hapusDompet(w.alamat).then(() => tarik()); }
                    : undefined}
                  salin={pemilik ? () => setDialogSalin({ alamat: w.alamat, nama: w.nama }) : undefined}
                  salinAktif={!!salinPeta.get(w.alamat)?.aktif} />
              ))}
            </div>
          </section>

          {/* Lapisan rincian. Muncul HANYA saat ada yang dipilih — dan
              karena ia lapisan, tidak ada ruang kosong yang tertinggal saat
              tidak ada. */}
          {dompet.some((w) => w.alamat === pilih) && (
            <RincianDompet
              w={dompet.find((w) => w.alamat === pilih)!}
              posisi={posisi.filter((p) => p.alamat === pilih)}
              log={log.filter((l) => l.alamat === pilih)}
              nilaiAkun={d?.seumur?.[pilih!]?.nilaiAkun}
              tiru={d?.tiru || []}
              ubahTiru={(koin, nyala) => {
                void (nyala ? tandaiTiru(pilih!, koin) : batalTiru(pilih!, koin)).then(() => tarik());
              }}
              tutup={() => setPilih(null)} />
          )}
        </>
      )}
      </>)}

      {/* ── DIALOG DI LUAR PERCABANGAN TAB ──────────────────────────────
          Dulu ia duduk DI DALAM cabang "bukan salin". Akibatnya dialog
          setelan salin cuma bisa tergambar dari tab Dompet Pantauan —
          sementara dari tab Posisi Copy, menekan barisnya memanggil `buka`,
          keadaannya berubah, dan TIDAK ADA APA-APA yang muncul. Bukan galat,
          bukan pesan: cuma tidak terjadi apa-apa, yaitu bentuk kegagalan yang
          paling lama tidak dilaporkan orang karena tidak ada yang bisa
          ditunjuk.

          Ditemukan 4 Sep 2026 dengan menekan barisnya di peramban pemilik dan
          memeriksa pohon aksesibilitasnya: keadaan berubah, portalnya tidak
          pernah ada.

          Sekarang ia berdiri di luar percabangan — satu-satunya tempat yang
          benar untuk sesuatu yang bisa dipanggil dari kedua tab. */}
      {dialogSalin && (
        <DialogSalin
          w={dialogSalin}
          awal={salinPeta.get(dialogSalin.alamat)}
          maksLipat={isiSalin.maksLipat}
          tutup={() => setDialogSalin(null)}
          simpan={async (v) => {
            const h = await simpanSalin({ alamat: dialogSalin.alamat, nama: dialogSalin.nama, ...v });
            if (!h.ok) { alert(h.pesan || 'Gagal menyimpan.'); return; }
            setIsiSalin(await daftarSalin());
            setDialogSalin(null);
          }}
          hapus={async () => {
            const h = await hapusSalin(dialogSalin.alamat);
            if (!h.ok) { alert(h.pesan || 'Gagal menghapus.'); return; }
            setIsiSalin(await daftarSalin());
            setDialogSalin(null);
          }} />
      )}
    </div>
  );
}
