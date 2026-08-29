import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, RefreshCw, Trash2, Trophy, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  keadaanDompet, tambahDompet, hapusDompet, peringkatDompet,
  type KeadaanDompet, type TransaksiDompet, type PosisiDompet, type Peringkat,
  type JendelaPeringkat, type PitaAkun,
} from '@/lib/wallet-agen';

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

function PapanPeringkat({ pantau }: { pantau: (alamat: string, nama: string) => Promise<void> }) {
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
          <table className="w-full min-w-[560px] border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-zinc-950">
              <tr className="border-b border-zinc-800 text-[10.5px] uppercase tracking-wide text-zinc-600">
                <th className="w-8 px-2 py-1.5 text-right font-medium">#</th>
                <th className="px-2 py-1.5 text-left font-medium">Dompet</th>
                <th className="px-2 py-1.5 text-right font-medium">Akun</th>
                <th className="px-2 py-1.5 text-right font-medium">P/L</th>
                <th className="px-2 py-1.5 text-right font-medium">Volume</th>
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
                  {/* Volume nol DITULIS sebagai garis, bukan "$0". Sebagian
                      akun besar memang tidak dilaporkan volumenya di jendela
                      itu, dan nol yang tegas terbaca sebagai "tidak pernah
                      transaksi" — kebalikan dari yang sebenarnya. */}
                  <td className="px-2 py-1.5 text-right tabular-nums text-zinc-600">
                    {w.vlm > 0 ? '$' + uangRingkas(w.vlm) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {w.dipantau ? (
                      <span className="text-[11px] text-emerald-400/80">Dipantau</span>
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

      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
        Semua angka di sini milik Hyperliquid; tidak ada yang kita hitung
        sendiri. Kolom persen sengaja tidak ada — ROI terbitan bursanya
        memberi 115.524% untuk akun 30 ribu dolar, dan dua rasio pengganti
        yang dicoba sama tidak masuk akalnya. Papan ini menunjukkan siapa yang
        sedang menang, bukan siapa yang layak disalin. Yang kedua dijawab
        rapor di bawah, sesudah dompetnya dipantau cukup lama.
      </p>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SATU KARTU PER DOMPET
   ════════════════════════════════════════════════════════════════════════
   Versi pertama menaruh SEMUA posisi dalam satu kisi dan SEMUA transaksi
   dalam satu daftar, dengan nama dompetnya dicetak kecil di sudut tiap
   baris. Dengan satu dompet itu terbaca. Dengan enam, tiga puluh satu
   posisi, dan dua ratus transaksi, yang tersisa cuma dinding angka —
   pertanyaan "dompet ini sedang pegang apa" menuntut mata menyisir seluruh
   halaman dan menyaringnya sendiri.

   Pengelompokan mengembalikan pertanyaan itu ke tempatnya. Satu kartu satu
   dompet, dan yang di dalamnya cuma miliknya.

   TERTUTUP SEBAGAI BAWAAN. Barisan kepala kartu sudah memuat seluruh angka
   ringkasnya — berapa posisi, untung mengambang, berapa transaksi, berapa
   persen menang, realisasi. Enam kartu terbuka sekaligus mengembalikan
   dinding yang baru saja dibongkar; yang dicari orang biasanya satu dompet,
   dan satu klik lebih murah daripada menggulir enam layar.

   Rapor yang dulu berdiri sendiri di bawah dihapus: angkanya persis yang
   sekarang ada di kepala kartu, dan dua tempat yang menampilkan hal yang
   sama adalah dua tempat yang bisa berbeda. */
function KartuDompet({ w, posisi, log, hapus }: {
  w: { alamat: string; nama: string; sejak: number };
  posisi: PosisiDompet[];
  log: TransaksiDompet[];
  hapus: () => void;
}) {
  const [buka, setBuka] = useState(false);

  const mengambang = posisi.reduce((n, p) => n + p.pnl, 0);
  const akun = posisi.length ? posisi[0].nilaiAkun : 0;
  /* pnl bukan nol = fill yang MENUTUP sesuatu. Fill pembuka selalu membawa
     closedPnl nol, dan menghitungnya sebagai kekalahan menenggelamkan
     persentase menang dompet mana pun ke angka yang tidak berarti apa-apa. */
  const tutup = log.filter((l) => l.pnl !== 0);
  const menang = tutup.filter((l) => l.pnl > 0).length;
  const nyata = tutup.reduce((n, l) => n + l.pnl, 0);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <button onClick={() => setBuka((v) => !v)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
          <span aria-hidden className={cn('text-zinc-600 transition-transform', buka && 'rotate-90')}>›</span>
          <span className="truncate text-[13px] font-semibold text-zinc-100">{w.nama}</span>
          <span className="hidden font-mono text-[10.5px] text-zinc-600 sm:inline">
            {w.alamat.slice(0, 6)}…{w.alamat.slice(-4)}
          </span>
        </button>

        <span className="text-[11.5px] text-zinc-500">
          {posisi.length ? posisi.length + ' posisi' : 'tanpa posisi'}
          {akun > 0 && <span className="text-zinc-600"> · akun ${uangRingkas(akun)}</span>}
        </span>
        {posisi.length > 0 && (
          <span className={cn('text-[12.5px] font-semibold tabular-nums',
            mengambang >= 0 ? 'text-emerald-400' : 'text-red-400')}
            title="Untung/rugi yang belum direalisasi dari posisi terbuka">
            {mengambang >= 0 ? '+' : '−'}{uangRingkas(Math.abs(mengambang))}
          </span>
        )}

        <span className="text-[11.5px] text-zinc-600">
          {log.length} transaksi
          {tutup.length > 0 && <> · menang {Math.round((menang / tutup.length) * 100)}%</>}
        </span>
        {tutup.length > 0 && (
          <span className={cn('text-[11.5px] font-medium tabular-nums',
            nyata >= 0 ? 'text-emerald-400/80' : 'text-red-400/80')}
            title="Realisasi dari penutupan yang kita saksikan sendiri">
            {nyata >= 0 ? '+' : '−'}{uangRingkas(Math.abs(nyata))}
          </span>
        )}

        <button onClick={hapus} title="Berhenti memantau"
          className="cursor-pointer rounded p-1 text-zinc-700 transition-colors hover:text-red-400">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {buka && (
        <div className="space-y-2 border-t border-zinc-800 p-3">
          {posisi.length > 0 && (
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
              {posisi.map((p, i) => (
                <div key={p.koin + i} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12.5px] font-semibold text-zinc-100">{p.koin}</span>
                    <span className={cn('text-[11.5px] font-semibold',
                      p.arah === 'LONG' ? 'text-emerald-400' : 'text-red-400')}>{p.arah}</span>
                    {p.leverage > 0 && <span className="text-[11px] text-zinc-600">{p.leverage}×</span>}
                    <span className={cn('ml-auto text-[12.5px] font-semibold tabular-nums',
                      p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {p.pnl >= 0 ? '+' : ''}{uangRingkas(p.pnl)}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                    <span>Entry <span className="tabular-nums text-zinc-300">{p.entry}</span></span>
                    <span>Nilai <span className="tabular-nums text-zinc-300">${uangRingkas(p.nilai)}</span></span>
                    <span>Ukuran <span className="tabular-nums text-zinc-300">{p.ukuran}</span></span>
                    {p.likuidasi > 0 && (
                      <span>Likuidasi <span className="tabular-nums text-amber-400/90">{p.likuidasi}</span></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {log.length === 0 ? (
            <p className="text-[11.5px] leading-relaxed text-zinc-600">
              Belum ada transaksi sejak dompet ini mulai dipantau. Riwayat
              sebelumnya sengaja tidak ditarik — daftar ini catatan pantauan
              kita, bukan salinan riwayat dompetnya.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-md border border-zinc-800">
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
      )}
    </div>
  );
}

export function PanelWalletAgen() {
  const [d, setD] = useState<KeadaanDompet | null>(null);
  const [gagal, setGagal] = useState(false);
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

      <FormTambah selesai={() => void tarik()} />

      {/* Papan peringkat di ATAS daftar dompet, bukan di bawah. Yang dicari
          orang saat membuka panel ini pada hari-hari awal adalah "dompet
          mana", bukan "dompet yang sudah saya pilih sedang apa" — dan yang
          dicari lebih sering pantas duduk lebih dekat ke atas. */}
      <PapanPeringkat pantau={async (alamat, nama) => {
        await tambahDompet(alamat, nama || alamat.slice(0, 10) + '…');
        await tarik();
      }} />

      {dompet.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-10 text-center">
          <Wallet className="mx-auto mb-2 size-5 text-zinc-700" />
          <p className="text-[13px] text-zinc-400">Belum ada dompet yang dipantau.</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-zinc-600">
            Tempel alamat dompet Hyperliquid di kotak di atas. Posisi dan
            transaksinya mulai tercatat pada pindaian berikutnya.
          </p>
        </div>
      ) : (
        <>
          <section>
            <h3 className="mb-2 border-b border-zinc-800 pb-1.5 text-[13px] font-semibold text-zinc-200">
              Dompet yang dipantau <span className="font-normal text-zinc-600">· {dompet.length}</span>
              <span className="ml-2 text-[11px] font-normal text-zinc-600">
                Klik namanya untuk membuka posisi &amp; transaksinya
              </span>
            </h3>
            <div className="space-y-1.5">
              {dompet.map((w) => (
                <KartuDompet key={w.alamat} w={w}
                  /* Disaring per kartu, bukan dikelompokkan sekali di atas.
                     Dompet yang BELUM punya posisi maupun transaksi tetap
                     harus muncul — pengelompokan yang membuang yang kosong
                     akan menghilangkan dompet yang baru ditambahkan, dan
                     yang menambahkannya mengira penambahannya gagal. */
                  posisi={posisi.filter((p) => p.alamat === w.alamat)}
                  log={log.filter((l) => l.alamat === w.alamat)}
                  hapus={() => { void hapusDompet(w.alamat).then(() => tarik()); }} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
