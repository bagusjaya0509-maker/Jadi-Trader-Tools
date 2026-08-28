import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, Loader2, PenLine, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  daftarChart, gambarChart, tandaiChart, hapusChart, jadikanSinyal,
  type ChartPantauan,
} from '@/lib/chart-agen';

/* ════════════════════════════════════════════════════════════════════════
   PANEL CHART PANTAUAN — ruang kerja pemilik, bukan halaman publik
   ════════════════════════════════════════════════════════════════════════
   Agen menyimpan chart yang diposting di ruang pantauannya; di sini pemilik
   membacanya sendiri dan MENETAPKAN area entry-nya. Tidak ada satu pun
   angka di sini yang ditebak mesin.

   Chart-nya membawa tanda air sumbernya di dalam piksel, jadi panel ini
   tidak boleh bocor ke siapa pun. Gerbangnya di tiga lapis: rute server
   menolak selain uid pemilik, tab-nya tidak sah untuk selain pemilik, dan
   sidebar tidak menampilkannya. Yang menegakkan tetap yang pertama —
   dua sisanya cuma membuat pintunya tidak terlihat.
   ════════════════════════════════════════════════════════════════════════ */

function umur(t: number) {
  const d = Math.max(0, Date.now() - t);
  const m = Math.round(d / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return m + ' menit lalu';
  const j = Math.round(m / 60);
  if (j < 24) return j + ' jam lalu';
  return Math.round(j / 24) + ' hari lalu';
}

/* ── Gambar bertoken ────────────────────────────────────────────────────
   Dipisah jadi komponennya sendiri supaya object URL-nya punya siklus hidup
   yang sama persis dengan yang menampilkannya. Ditaruh di induknya, satu
   chart yang dibuang akan meninggalkan URL-nya hidup tanpa ada yang
   bertanggung jawab melepasnya. */
function GambarChart({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let hidup = true;
    let dipakai: string | null = null;
    void gambarChart(id).then((u) => {
      if (!hidup) { if (u) URL.revokeObjectURL(u); return; }
      if (!u) { setGagal(true); return; }
      dipakai = u;
      setUrl(u);
    });
    return () => {
      hidup = false;
      if (dipakai) URL.revokeObjectURL(dipakai);
    };
  }, [id]);

  if (gagal) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-[12px] text-zinc-500">
        Gambarnya tidak bisa diambil.
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60">
        <Loader2 className="size-4 animate-spin text-zinc-600" />
      </div>
    );
  }
  return (
    /* Dibuka di tab baru saat diklik: chart penuh angka kecil, dan versi
       yang muat di kartu tidak pernah cukup untuk membaca level. */
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt={alt}
           className="w-full rounded-lg border border-zinc-800 transition-opacity hover:opacity-90" />
    </a>
  );
}

/* ── Formulir level ─────────────────────────────────────────────────────
   Kosong, selalu. Tidak ada prasetel dari gambarnya — itu inti keputusannya:
   angka yang muncul sendiri di kotak isian akan diterima apa adanya oleh
   siapa pun yang sedang buru-buru, dan angka hasil tebakan mesin yang
   diterima tanpa diperiksa persis sama bahayanya dengan angka karangan. */
function FormLevel({ chart, selesai }: { chart: ChartPantauan; selesai: () => void }) {
  const [pasangan, setPasangan] = useState('');
  const [arah, setArah] = useState<'BUY' | 'SELL'>('BUY');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [tf, setTf] = useState('1h');
  const [alasan, setAlasan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  /* Titik ATAU koma diterima. Papan angka ponsel di Indonesia memberi koma
     sebagai pemisah desimal, dan Number('0,16') itu NaN — kotak yang
     menolak angka yang baru saja diketik orangnya tanpa mengatakan kenapa
     adalah kegagalan yang paling menjengkelkan. */
  const angka = (x: string) => Number(String(x).trim().replace(',', '.'));

  async function kirim() {
    setGalat('');
    const e = angka(entry); const s = angka(sl); const t = angka(tp);
    if (!pasangan.trim()) return setGalat('Pasangannya belum diisi.');
    if (!(e > 0) || !(s > 0) || !(t > 0)) return setGalat('Entry, SL, dan TP harus angka lebih dari nol.');
    setSibuk(true);
    const h = await jadikanSinyal(chart.id, {
      pasangan: pasangan.trim().toUpperCase(), arah, entry: e, sl: s, tp: t, tf,
      alasan: alasan.trim() || undefined,
    });
    setSibuk(false);
    if (h.ok) selesai();
    else setGalat(h.pesan);
  }

  const kotak = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600';

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input className={kotak} placeholder="Pasangan (BTCUSDT)" value={pasangan}
               onChange={(e) => setPasangan(e.target.value)} />
        <div className="flex overflow-hidden rounded-md border border-zinc-800">
          {(['BUY', 'SELL'] as const).map((a) => (
            <button key={a} onClick={() => setArah(a)}
              className={cn('flex-1 cursor-pointer py-1.5 text-[12px] font-semibold transition-colors',
                arah === a
                  ? a === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                  : 'text-zinc-500 hover:text-zinc-300')}>
              {a}
            </button>
          ))}
        </div>
        <input className={kotak} placeholder="TF (1h)" value={tf}
               onChange={(e) => setTf(e.target.value)} />
        <input className={kotak} placeholder="Entry" inputMode="decimal" value={entry}
               onChange={(e) => setEntry(e.target.value)} />
        <input className={kotak} placeholder="SL" inputMode="decimal" value={sl}
               onChange={(e) => setSl(e.target.value)} />
        <input className={kotak} placeholder="TP" inputMode="decimal" value={tp}
               onChange={(e) => setTp(e.target.value)} />
      </div>
      <textarea className={cn(kotak, 'min-h-[52px] resize-y')} value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Catatan yang ikut terbit di kartu (opsional)" />
      {galat && <p className="text-[12px] text-red-400">{galat}</p>}
      <div className="flex items-center gap-2">
        <button onClick={() => void kirim()} disabled={sibuk}
          className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-default disabled:opacity-60">
          {sibuk ? 'Menerbitkan…' : 'Terbitkan sebagai sinyal'}
        </button>
        <span className="text-[11px] text-zinc-500">Kartunya terbit atas nama {chart.agen}.</span>
      </div>
    </div>
  );
}

export function PanelChartAgen() {
  const [chart, setChart] = useState<ChartPantauan[] | null>(null);
  const [gagal, setGagal] = useState(false);
  const [semua, setSemua] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);
  const [muat, setMuat] = useState(true);
  const pertama = useRef(true);

  const tarik = useCallback(async (tampilkanMuat = false) => {
    if (tampilkanMuat) setMuat(true);
    const d = await daftarChart(semua);
    /* null = tidak bisa bertanya. Daftar lama DIPERTAHANKAN, tidak
       dikosongkan: satu tarikan yang gagal saat jaringan berkedip tidak
       berarti arsipnya kosong, dan mengosongkan layar karenanya membuat
       pemiliknya mengira chart-nya hilang. */
    if (d) { setChart(d); setGagal(false); } else setGagal(true);
    setMuat(false);
  }, [semua]);

  useEffect(() => {
    void tarik(pertama.current);
    pertama.current = false;
    /* Ditarik ulang tiap dua menit. Chart datang beberapa kali sehari, jadi
       lebih rapat dari ini cuma menambah permintaan tanpa menambah kabar. */
    const t = setInterval(() => { void tarik(); }, 120000);
    return () => clearInterval(t);
  }, [tarik]);

  async function sembunyikan(c: ChartPantauan) {
    setChart((d) => (d || []).map((x) => (x.id === c.id ? { ...x, sembunyi: !x.sembunyi } : x)));
    await tandaiChart(c.id, { sembunyi: !c.sembunyi });
    void tarik();
  }

  async function buang(c: ChartPantauan) {
    setChart((d) => (d || []).filter((x) => x.id !== c.id));
    await hapusChart(c.id);
    void tarik();
  }

  if (muat) {
    return (
      <div className="flex items-center gap-2 py-10 text-[13px] text-zinc-500">
        <Loader2 className="size-4 animate-spin" /> Mengambil chart…
      </div>
    );
  }

  const daftar = chart || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Nama agennya TIDAK diulang di sini — kepala kanal di atas sudah
            menyebutnya. Yang perlu dijelaskan cuma satu hal yang tidak
            terlihat dari mana pun: bahwa isi tab ini tidak tampil ke siapa
            pun selain dirinya, sampai ia sendiri menerbitkannya. */}
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-zinc-100">Ruang penyaringan</h2>
          <p className="mt-0.5 text-[12.5px] text-zinc-500">
            Chart yang diambil agen, tersimpan apa adanya dan hanya terlihat
            oleh Anda. Tetapkan sendiri zona, SL, dan TP-nya — baru setelah
            diterbitkan ia tampil di publik sebagai sinyal kartu ini.
          </p>
        </div>
        <button onClick={() => setSemua((v) => !v)}
          className="cursor-pointer rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:text-zinc-100">
          {semua ? 'Sembunyikan yang selesai' : 'Tampilkan semua'}
        </button>
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

      {daftar.length === 0 && !gagal && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-10 text-center">
          <p className="text-[13px] text-zinc-400">Belum ada chart yang menunggu.</p>
          <p className="mt-1 text-[12px] text-zinc-600">
            Chart baru dari ruang pantauan muncul di sini sendiri, tanpa perlu dimuat ulang.
          </p>
        </div>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
        {daftar.map((c) => (
          <div key={c.id}
            className={cn('rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 transition-opacity',
              c.sembunyi && 'opacity-55')}>
            <div className="mb-2 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-zinc-300">{c.agen}</p>
                <p className="text-[11px] text-zinc-600">{umur(c.waktu)} · {c.kb} KB</p>
              </div>
              <button onClick={() => void sembunyikan(c)}
                title={c.sembunyi ? 'Kembalikan ke daftar' : 'Tandai selesai'}
                className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200">
                {c.sembunyi ? <Undo2 className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
              <button onClick={() => void buang(c)} title="Hapus berikut gambarnya"
                className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-red-400">
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <GambarChart id={c.id} alt={c.keterangan || 'Chart pantauan'} />

            {c.keterangan && (
              <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-300">
                {c.keterangan}
              </p>
            )}

            {c.sinyalId && (
              <p className="mt-2 text-[12px] text-emerald-400">Sudah diterbitkan sebagai sinyal.</p>
            )}

            {buka === c.id ? (
              <FormLevel chart={c} selesai={() => { setBuka(null); void tarik(); }} />
            ) : (
              /* DUA PINTU BERDAMPINGAN, dan keduanya memang dua pekerjaan
                 yang berbeda: yang kiri menetapkan level dari angka yang
                 sudah terbaca di gambarnya, yang kanan membawa gambarnya ke
                 chart sungguhan untuk dijiplak dulu. Yang kedua bukan jalan
                 pintas ke yang pertama; ia yang dipakai saat zonanya masih
                 perlu dicocokkan ke harga yang berjalan.

                 Sebaris, bukan bertumpuk: kartu-kartu ini duduk di grid,
                 dan tinggi yang bertambah di satu kartu ikut menaikkan
                 seluruh barisnya. */
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button onClick={() => setBuka(c.id)}
                  className="cursor-pointer rounded-md border border-zinc-700 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
                  {c.sinyalId ? 'Terbitkan lagi' : 'Tetapkan area entry'}
                </button>
                {/* Alamatnya membawa id chart-nya. Halaman Chart & Entry yang
                    mengambil gambarnya sendiri — bukan dioper lewat state
                    navigasi: alamat yang lengkap bisa disalin, dibuka di tab
                    baru, dan dimuat ulang tanpa kehilangan jiplakannya. */}
                <Link to={`/chart-entry?jiplak=${encodeURIComponent(c.id)}`}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[12px] text-violet-300 transition-colors hover:border-violet-500/50 hover:text-violet-200">
                  <PenLine className="size-3.5" />
                  Jiplak di Chart &amp; Entry
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
