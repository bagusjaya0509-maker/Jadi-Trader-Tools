import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, List, Loader2, Plus, RefreshCw, Trash2, Trophy, Users, Wallet, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SparklineSaldo } from '@/components/kurva-saldo';
import {
  keadaanDompet, tambahDompet, hapusDompet, peringkatDompet, tandaiTiru, batalTiru, aturOtoTutup, aturBuka,
  type KeadaanDompet, type TransaksiDompet, type PosisiDompet, type Peringkat,
  type JendelaPeringkat, type PitaAkun, type RiwayatBursa, type PenandaTiru,
  type DompetPantau,
} from '@/lib/wallet-agen';
import { usePosisiBinance } from '@/lib/admin';
import { Copy as IkonTiru, TriangleAlert } from 'lucide-react';

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
function PapanPeringkat({ pantau }: { pantau?: (alamat: string, nama: string) => Promise<void> }) {
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
                    {w.dipantau ? (
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

function KartuDompet({ w, posisi, log, bursa, dipilih, pilih, hapus }: {
  w: { alamat: string; nama: string; sejak: number };
  posisi: PosisiDompet[];
  log: TransaksiDompet[];
  bursa?: RiwayatBursa;
  dipilih: boolean;
  pilih: () => void;
  /** Tak diisi = pembacanya bukan pemilik; ikon hapusnya tidak dirender. */
  hapus?: () => void;
}) {
  const mengambang = posisi.reduce((n, p) => n + p.pnl, 0);
  const akun = posisi.length ? posisi[0].nilaiAkun : 0;
  const tutup = penutupanDompet(log);
  const menang = tutup.filter((l) => l.pnl > 0).length;
  const nyata = tutup.reduce((n, l) => n + l.pnl, 0);
  const titik = titikDompet(tutup);
  const rona = ronaAlamat(w.alamat);

  return (
    <div onClick={pilih}
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
function RincianDompet({ w, posisi, log, tiru, ubahTiru, tutup }: {
  w: { alamat: string; nama: string };
  posisi: PosisiDompet[];
  log: TransaksiDompet[];
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
function PosisiTiruan({ tiru, dompet, posisi, ubahTiru, ubahOto, ubahBuka }: {
  tiru: PenandaTiru[];
  dompet: DompetPantau[];
  posisi: PosisiDompet[];
  ubahTiru: (alamat: string, koin: string, nyala: boolean) => void;
  ubahOto: (alamat: string, koin: string, nyala: boolean) => void;
  ubahBuka: (alamat: string, koin: string, ubah: { otoBuka?: boolean; usd?: number; leverage?: number; bursa?: string }) => void;
}) {
  /* Posisi SENDIRI dari bursa. Hook-nya sudah dipakai di tempat lain dan
     menyegarkan tiap 30 detik; memanggilnya lagi di sini tidak menambah
     permintaan karena ia berbagi keadaan yang sama. */
  const { data: punyaku } = usePosisiBinance();
  const nama = new Map(dompet.map((d) => [d.alamat, d.nama]));

  if (!tiru.length) return null;

  const baris = tiru.map((x) => {
    const sumber = posisi.find((p) => p.alamat === x.alamat && p.koin.toUpperCase() === x.koin);
    const milik = punyaku.find((p) => p.simbol.toUpperCase() === x.koin + 'USDT');
    const arahku = milik ? (milik.arah === 'BUY' ? 'LONG' : 'SHORT') : null;
    return {
      ...x,
      namaDompet: nama.get(x.alamat) || x.alamat.slice(0, 10) + '…',
      sumber, milik, arahku,
      sumberTutup: !sumber && !!milik,
      arahBeda: !!(sumber && arahku && sumber.arah !== arahku),
    };
  });

  return (
    <section>
      <h3 className="mb-2 flex flex-wrap items-center gap-x-2 border-b border-zinc-800 pb-1.5">
        <span className="text-[13px] font-semibold text-zinc-200">Posisi tiruan</span>
        <span className="text-[11px] font-normal text-zinc-600">
          · {baris.length} ditandai · posisimu dari Binance, posisi dompet dari rantai
        </span>
      </h3>

      <div className="space-y-1.5">
        {baris.map((b) => (
          <div key={b.alamat + b.koin}
            className={cn('rounded-lg border bg-zinc-900/30 px-3 py-2',
              b.sumberTutup ? 'border-amber-500/40' : b.arahBeda ? 'border-red-500/40' : 'border-zinc-800')}>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[13px] font-semibold text-zinc-100">{b.koin}</span>
              <span className="text-[11px] text-zinc-500">meniru {b.namaDompet}</span>
              <button onClick={() => ubahTiru(b.alamat, b.koin, false)}
                title="Berhenti menandai"
                className="ml-auto cursor-pointer rounded p-0.5 text-zinc-700 transition-colors hover:text-red-400">
                <Trash2 className="size-3" />
              </button>
            </div>

            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {/* Punyaku */}
              <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
                <p className="text-[10px] uppercase tracking-wide text-zinc-600">Posisiku</p>
                {b.milik ? (
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11.5px]">
                    <span className={cn('font-semibold',
                      b.arahku === 'LONG' ? 'text-emerald-400' : 'text-red-400')}>{b.arahku}</span>
                    <span className="tabular-nums text-zinc-400">{b.milik.jumlah} @ {b.milik.entry}</span>
                    <span className={cn('ml-auto font-semibold tabular-nums',
                      b.milik.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {b.milik.pnl >= 0 ? '+' : '−'}${uangRingkas(Math.abs(b.milik.pnl))}
                    </span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11.5px] text-zinc-600">Belum ada posisi terbuka di {b.koin}USDT</p>
                )}
              </div>

              {/* Dompet yang ditiru */}
              <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
                <p className="text-[10px] uppercase tracking-wide text-zinc-600">Dompet</p>
                {b.sumber ? (
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11.5px]">
                    <span className={cn('font-semibold',
                      b.sumber.arah === 'LONG' ? 'text-emerald-400' : 'text-red-400')}>{b.sumber.arah}</span>
                    <span className="tabular-nums text-zinc-400">{b.sumber.ukuran} @ {b.sumber.entry}</span>
                    <span className={cn('ml-auto font-semibold tabular-nums',
                      b.sumber.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {b.sumber.pnl >= 0 ? '+' : '−'}${uangRingkas(Math.abs(b.sumber.pnl))}
                    </span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11.5px] text-amber-300">Sudah tidak punya posisi di {b.koin}</p>
                )}
              </div>
            </div>

            {/* ── SAKELAR AUTO-CLOSE ────────────────────────────────────
                Menyalakannya berarti memberi izin mengirim satu perintah
                tutup ke bursa tanpa ditanya lagi. Karena itu ditulis
                panjang, bukan disingkat jadi ikon: sakelar yang mengeluarkan
                uang tidak boleh sekecil sakelar yang mengubah warna.

                Padam sendiri sesudah sekali dipakai. Izin yang menetap
                selamanya adalah izin yang diberikan sekali untuk keadaan
                yang sudah lama berubah. */}
            <label className={cn('mt-1.5 flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-colors',
              b.otoTutup ? 'border-amber-500/40 bg-amber-500/5' : 'border-zinc-800 hover:border-zinc-700')}>
              <input type="checkbox" checked={!!b.otoTutup}
                onChange={(e) => ubahOto(b.alamat, b.koin, e.target.checked)}
                className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-amber-400" />
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[11.5px] font-medium',
                  b.otoTutup ? 'text-amber-300' : 'text-zinc-400')}>
                  Tutup posisiku otomatis saat dompet ini melepas {b.koin}
                </span>
                <span className="block text-[10.5px] leading-relaxed text-zinc-600">
                  Market reduce-only — secara struktur tidak bisa membuka posisi.
                  Butuh dua pindaian berturut-turut, dan padam sendiri sesudah
                  sekali dipakai.
                  {b.konfirmasi ? ' · konfirmasi ' + b.konfirmasi + '/2' : ''}
                </span>
                {b.terakhir && (
                  <span className={cn('block text-[10.5px]',
                    b.terakhir.sukses ? 'text-emerald-400/80' : 'text-red-400')}>
                    {b.terakhir.sukses
                      ? 'Terakhir: ditutup ' + b.terakhir.jumlah + ' · ' + umur(b.terakhir.waktu)
                      : 'Percobaan terakhir GAGAL — posisinya mungkin masih terbuka'}
                  </span>
                )}
              </span>
            </label>

            {/* ── KOIN INI TIDAK ADA DI BINANCE ─────────────────────────
                Dilaporkan, bukan didiamkan. Tanpa baris ini orangnya
                menyangka salinannya berjalan untuk semua koin, padahal
                yang satu ini dilewati tiap kali — dan ia baru tahu saat
                menghitung hasil yang tidak pernah datang. */}
            {b.takAdaDiBinance && (
              <p className="mt-1.5 rounded-md border border-sky-500/30 bg-sky-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-sky-200/80">
                <span className="font-medium">{b.koin} tidak ada di Binance Futures.</span>{' '}
                Posisinya tidak dibuka di sana. Koin seperti ini nanti dilayani lewat
                jalur Hyperliquid.
              </p>
            )}

            {/* ── SAKELAR AUTO-OPEN ─────────────────────────────────────
                Ditaruh DI BAWAH auto-close, dan warnanya merah sementara
                yang di atas kuning. Bukan selera: yang di atas mengeluarkan
                uang dari posisi, yang ini memasukkannya ke posisi baru.
                Dua izin yang berbeda beratnya tidak boleh terlihat sama.

                Ukurannya diisi DULU — sakelarnya sendiri ditolak server
                kalau ukurannya masih kosong, dan tombol yang bisa ditekan
                lalu ditolak lebih buruk daripada tombol yang menunggu. */}
            <div className={cn('mt-1.5 rounded-md border px-2 py-1.5 transition-colors',
              b.otoBuka ? 'border-red-500/40 bg-red-500/5' : 'border-zinc-800')}>
              {/* -- KE BURSA MANA SALINANNYA DIKIRIM ------------------
                  Dipilih per dompet, bukan satu setelan untuk semuanya:
                  dompet yang isinya koin besar cocok di Binance, yang
                  sering menyentuh koin kecil cuma ada di Hyperliquid, dan
                  memaksa keduanya memakai satu pilihan berarti salah satu
                  selalu dilayani setengah.

                  "Keduanya" MENGUTAMAKAN Binance dan memakai Hyperliquid
                  hanya untuk koin yang tidak terdaftar di sana. Ditulis di
                  keterangannya supaya tidak ada yang menebak urutannya. */}
              <label className="mb-1.5 block">
                <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Bursa tujuan</span>
                <select value={b.bursa ?? 'binance'}
                  onChange={(e) => ubahBuka(b.alamat, b.koin, { bursa: e.target.value })}
                  className="w-full cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[12px] text-zinc-100 outline-none focus:border-zinc-500">
                  <option value="binance">Binance saja</option>
                  <option value="hyperliquid">Hyperliquid saja</option>
                  <option value="dua">Keduanya — Binance dulu, Hyperliquid kalau koinnya tidak ada</option>
                </select>
                <span className="mt-0.5 block text-[10.5px] leading-relaxed text-zinc-600">
                  {b.bursa === 'hyperliquid'
                    ? 'Bursa asal dompetnya — instrumen dan harganya sama persis dengan yang ditiru.'
                    : b.bursa === 'dua'
                      ? 'Koin yang ada di Binance disalin di sana; sisanya otomatis ke Hyperliquid.'
                      : 'Koin yang tidak terdaftar di Binance akan dilewati.'}
                </span>
              </label>

              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Ukuran $</span>
                  <input type="number" min={1} max={500} step={5}
                    defaultValue={b.usd ?? ''}
                    placeholder="30"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0 && v !== b.usd) ubahBuka(b.alamat, b.koin, { usd: v });
                    }}
                    className="angka w-[74px] rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[12px] text-zinc-100 outline-none focus:border-zinc-500" />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Leverage</span>
                  <select value={b.leverage ?? 1}
                    onChange={(e) => ubahBuka(b.alamat, b.koin, { leverage: Number(e.target.value) })}
                    className="angka w-[62px] cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[12px] text-zinc-100 outline-none focus:border-zinc-500">
                    {[1, 2, 3].map((x) => <option key={x} value={x}>{x}×</option>)}
                  </select>
                </label>
                <span className="mb-1 text-[10.5px] text-zinc-600">
                  {b.usd ? 'nilai posisi ~$' + (b.usd * (b.leverage ?? 1)).toFixed(0) : 'isi ukuran dulu'}
                </span>
              </div>

              <label className="mt-1.5 flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={!!b.otoBuka}
                  onChange={(e) => ubahBuka(b.alamat, b.koin, { otoBuka: e.target.checked })}
                  className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-red-400" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[11.5px] font-medium',
                    b.otoBuka ? 'text-red-300' : 'text-zinc-400')}>
                    Buka posisiku otomatis saat dompet ini MULAI pegang {b.koin}
                    <span className="ml-1 font-normal text-zinc-500">
                      di {b.bursa === 'hyperliquid' ? 'Hyperliquid'
                        : b.bursa === 'dua' ? 'Binance/Hyperliquid' : 'Binance'}
                    </span>
                  </span>
                  <span className="block text-[10.5px] leading-relaxed text-zinc-600">
                    Market, tanpa SL/TP — pintu keluarnya sakelar di atas. Yang dipicu
                    saat dompetnya BARU membuka, bukan saat ia sedang punya: pindaian
                    pertama sesudah ini dinyalakan cuma mencatat.
                    {b.bukaKonfirmasi ? ' · konfirmasi ' + b.bukaKonfirmasi + '/2' : ''}
                  </span>
                  {b.terakhirBuka && (
                    <span className="block text-[10.5px] text-emerald-400/80">
                      Terakhir dibuka: {b.simbolBuka}
                      {b.bursaBuka ? ' di ' + (b.bursaBuka === 'hyperliquid' ? 'Hyperliquid' : 'Binance') : ''}
                      {' · '}{umur(b.terakhirBuka)}
                    </span>
                  )}
                </span>
              </label>
            </div>

            {(b.sumberTutup || b.arahBeda) && (
              <p className={cn('mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed',
                b.sumberTutup ? 'text-amber-300' : 'text-red-400')}>
                <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                {b.sumberTutup
                  ? 'Dompet yang kamu tiru sudah menutup posisinya, sementara posisimu masih terbuka.'
                  : 'Arahmu berlawanan dengan dompet yang kamu tiru di koin yang sama.'}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
        Menandai tiruan TIDAK mengirim order apa pun — ia cuma menyandingkan
        angkanya dan membunyikan lonceng saat dompet sumbernya bergerak di koin
        itu. Buka dan tutup posisinya tetap kamu sendiri.
      </p>
    </section>
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

export function PanelWalletAgen({ pemilik = false }: { pemilik?: boolean }) {
  const [d, setD] = useState<KeadaanDompet | null>(null);
  const [gagal, setGagal] = useState(false);
  /* Dompet yang sedang dibuka rinciannya. null = belum ada, dan itu keadaan
     awal yang benar: kisi kartunya sudah menjawab pertanyaan yang paling
     sering ditanyakan, dan rincian yang terbuka sendiri cuma mendorongnya
     ke luar layar. */
  const [pilih, setPilih] = useState<string | null>(null);
  const [muat, setMuat] = useState(true);
  const pertama = useRef(true);

  const tarik = useCallback(async (tampilkanMuat = false) => {
    if (tampilkanMuat) setMuat(true);
    const k = await keadaanDompet();
    /* null = tidak bisa bertanya. Daftar lama DIPERTAHANKAN: satu tarikan
       gagal saat jaringan berkedip bukan kabar bahwa dompetnya kosong. */
    if (k) { setD(k); setGagal(false); } else setGagal(true);
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
      <div className="flex items-center gap-2 py-10 text-[13px] text-zinc-500">
        <Loader2 className="size-4 animate-spin" /> Mengambil keadaan dompet…
      </div>
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
      {pemilik && <FormTambah selesai={() => void tarik()} />}

      {/* Papan peringkat di ATAS daftar dompet, bukan di bawah. Yang dicari
          orang saat membuka panel ini pada hari-hari awal adalah "dompet
          mana", bukan "dompet yang sudah saya pilih sedang apa" — dan yang
          dicari lebih sering pantas duduk lebih dekat ke atas. */}
      <PapanPeringkat pantau={pemilik ? (async (alamat, nama) => {
        await tambahDompet(alamat, nama || alamat.slice(0, 10) + '…');
        await tarik();
      }) : undefined} />

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

          {/* HANYA pemilik. Isinya posisi di akun bursa yang sungguhan,
              dan sakelar auto-close di dalamnya menutup posisi memakai SATU
              kunci API yang ada di .env — kunci pemilik. Orang lain yang
              menyalakannya akan menutup posisi pemilik dengan uang pemilik.

              Digerbangi di sini DAN di server: penanda tiruannya tidak ikut
              di jawaban publik, jadi walau gerbang layar ini luput, yang
              bisa dirender tetap kosong. */}
          {pemilik && (
            <PosisiTiruan tiru={d?.tiru || []} dompet={dompet} posisi={posisi}
              ubahTiru={(a, k, nyala) => {
                void (nyala ? tandaiTiru(a, k) : batalTiru(a, k)).then(() => tarik());
              }}
              ubahOto={(a, k, nyala) => { void aturOtoTutup(a, k, nyala).then(() => tarik()); }}
              ubahBuka={(a, k, u) => { void aturBuka(a, k, u).then((h) => { if (!h.ok && h.pesan) alert(h.pesan); tarik(); }); }} />
          )}

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
                    : undefined} />
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
              tiru={d?.tiru || []}
              ubahTiru={(koin, nyala) => {
                void (nyala ? tandaiTiru(pilih!, koin) : batalTiru(pilih!, koin)).then(() => tarik());
              }}
              tutup={() => setPilih(null)} />
          )}
        </>
      )}
    </div>
  );
}
