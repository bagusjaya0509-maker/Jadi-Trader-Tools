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

/* ── PASANGAN DITEBAK DARI KETERANGANNYA ──────────────────────────────
   Supaya menekan "Jiplak di Chart & Entry" langsung mendarat di pair yang
   benar, bukan di simbol terakhir yang kebetulan terbuka lalu harus dicari
   sendiri. Bolak-balik itu yang dikeluhkan pemilik.

   Cocokkan DARI DAFTAR, bukan mengarang "<kata pertama> + USDT". Keterangan
   di ruang itu ditulis manusia dengan nama panjang ("HYPERLIQUID", "Bitcoin",
   "Gold"), dan menempelkan USDT ke kata apa pun akan menghasilkan simbol
   yang tidak ada — chart lalu terbuka kosong tanpa memberi tahu kenapa.

   Tidak ketemu = tidak menyebut simbol sama sekali, dan Chart & Entry
   membuka apa yang sudah terbuka. Menebak salah lebih buruk daripada tidak
   menebak: yang satu diam, yang lain memindahkan orang ke pasar yang salah
   sambil terlihat yakin. */
/* BATAS KATA SAJA TIDAK CUKUP — SEBAGIAN TICKER WAJIB HURUF BESAR.
   ──────────────────────────────────────────────────────────────────────
   Dua kesalahan berturut-turut di sini, dan keduanya senyap.

   Pertama polanya kehilangan `\b` sewaktu ditulis ke berkas — yang tertulis
   malah karakter backspace sungguhan, jadi TIDAK SATU PUN pola pernah
   cocok dan semua chart jatuh ke "Lainnya". Tidak ada galat, cuma
   pengelompokan yang diam-diam tidak pernah terjadi.

   Sesudah `\b` dikembalikan, muncul kesalahan kedua yang batas kata justru
   tidak bisa tolong: TICKER PENDEK YANG SAMA PERSIS DENGAN KATA INDONESIA.
   "tidak ADA sinyal" bukan Cardano. "harga SUdah" bukan Sui. "LINK grup"
   bukan Chainlink. `\bada\b` mencocokkannya dengan benar — memang itu kata
   utuh — dan justru karena itu ia salah.

   Jalan keluarnya bukan pola yang lebih pintar, melainkan pengamatan
   sederhana: di ruang itu ticker SELALU ditulis huruf besar ("ENA daily",
   "PUMP 1 jam", "HYPERLIQUID 1 JAM"), sementara kata biasa tidak. Jadi
   ticker yang bertabrakan kehilangan bendera `i`-nya; nama panjang yang
   tidak mungkin salah tangkap (bitcoin, solana, cardano) tetap longgar.

   Kalau suatu hari ada keterangan yang menulis "ena" huruf kecil, ia jatuh
   ke "Lainnya" — dan itu kegagalan yang benar: satu chart perlu
   dikelompokkan tangan, bukan sepuluh chart masuk koin yang salah. */
const KAMUS_PASANGAN: [RegExp, string][] = [
  /* Longgar — nama panjang, tidak bersarang di kata Indonesia mana pun. */
  [/\bxau|\bgold\b|\bemas\b/i, 'XAUUSD'],
  [/\bbtc\b|\bbitcoin\b/i, 'BTCUSDT'],
  [/\bethereum\b/i, 'ETHUSDT'],
  [/\bsolana\b/i, 'SOLUSDT'],
  [/\bhyperliquid\b/i, 'HYPEUSDT'],
  [/\bethena\b/i, 'ENAUSDT'],
  [/\bvirtual\b/i, 'VIRTUALUSDT'],
  [/\bcardano\b/i, 'ADAUSDT'],
  [/\bripple\b/i, 'XRPUSDT'],
  [/\bdoge\b/i, 'DOGEUSDT'],
  [/\bavax\b/i, 'AVAXUSDT'],
  [/\bbnb\b/i, 'BNBUSDT'],
  [/\bxrp\b/i, 'XRPUSDT'],

  /* KETAT — huruf besar saja. Lihat catatan di atas. */
  [/\bETH\b/, 'ETHUSDT'],
  [/\bSOL\b/, 'SOLUSDT'],
  [/\bHYPE\b/, 'HYPEUSDT'],
  [/\bENA\b/, 'ENAUSDT'],
  [/\bPUMP\b/, 'PUMPUSDT'],
  [/\bADA\b/, 'ADAUSDT'],
  [/\bLINK\b/, 'LINKUSDT'],
  [/\bSUI\b/, 'SUIUSDT'],
];

export function tebakPasangan(keterangan: string): string | null {
  const t = String(keterangan || '');
  for (const [pola, simbol] of KAMUS_PASANGAN) if (pola.test(t)) return simbol;
  return null;
}

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

  /* ── DIKELOMPOKKAN PER KOIN, TERBARU DI ATAS ────────────────────────
     Satu koin sering punya dua-tiga chart pembaruan berturut-turut, dan
     dalam satu rak panjang mereka terserak di antara koin lain — jadi
     membandingkan "yang mana yang terakhir" butuh menyapu seluruh halaman.

     Diurutkan dari `waktu`, BUKAN dari urutan berkasnya. Pengisi awal
     menelusuri Telegram dari yang terbaru sambil memakai unshift, jadi
     yang tertua justru berakhir paling depan di berkas — dan mengandalkan
     urutan simpan berarti tampilan ikut salah tiap kali arsipnya diisi
     ulang. Waktu pesan tidak bisa berbohong begitu.

     Seksi juga diurutkan dari isi TERBARUNYA, bukan menurut abjad: yang
     baru saja diperbarui memang yang paling ingin dilihat, dan daftar
     berabjad menaruh koin yang diam berbulan-bulan di atas hanya karena
     namanya dimulai huruf A. */
  const seksi = (() => {
    const peta = new Map<string, ChartPantauan[]>();
    for (const c of [...daftar].sort((a, b) => b.waktu - a.waktu)) {
      const kunci = tebakPasangan(c.keterangan) || 'Lainnya';
      const isi = peta.get(kunci);
      if (isi) isi.push(c); else peta.set(kunci, [c]);
    }
    return [...peta.entries()]
      .map(([nama, isi]) => ({ nama, isi }))
      .sort((a, b) => {
        /* "Lainnya" selalu paling bawah: isinya chart yang pasangannya
           tidak terbaca, dan itu keranjang sisa — bukan koin yang kebetulan
           paling baru. */
        if (a.nama === 'Lainnya') return 1;
        if (b.nama === 'Lainnya') return -1;
        return b.isi[0].waktu - a.isi[0].waktu;
      });
  })();

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

      {seksi.map((sk) => (
        <section key={sk.nama} className="pb-2">
          {/* Kepala seksi MENEMPEL saat digulir dan punya GARIS yang jelas.
              Versi pertama cuma menebalkan namanya, dan di layar penuh
              kartu gelap yang seragam itu tenggelam — dari jauh raknya
              terbaca sebagai satu deretan panjang lagi, persis keluhan yang
              mau diselesaikan.

              Garisnya melintang penuh, bukan cuma di bawah tulisannya:
              yang perlu ditandai batas antar KELOMPOK, dan garis sepanjang
              tulisan cuma menghias judulnya. */}
          <div className="sticky top-0 z-10 -mx-1 mb-3 border-b border-zinc-700 bg-zinc-950/95 px-1 pb-1.5 pt-2 backdrop-blur-sm">
            <div className="flex items-baseline gap-2">
              <span aria-hidden className="h-3.5 w-[3px] shrink-0 self-center rounded-full bg-violet-400/80" />
              <h3 className="text-[13.5px] font-semibold tracking-tight text-zinc-100">{sk.nama}</h3>
              <span className="text-[11px] text-zinc-500">
                {sk.isi.length} chart · terbaru {umur(sk.isi[0].waktu)}
              </span>
            </div>
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {sk.isi.map((c) => (
              <div key={c.id}
                className={cn('rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 transition-opacity',
                  c.sembunyi && 'opacity-55')}>
                {/* SATU BARIS: nama koin di kiri, umur & ukuran di kanan.
                    Dulu yang tertulis "AI Chart" — nama AGEN, sama persis di
                    kesebelas kartu, jadi ia tidak pernah membedakan apa pun.
                    Yang membedakan koinnya, dan itu yang dicari mata.

                    Waktunya naik ke baris yang sama, tidak lagi menumpuk di
                    bawahnya: dua baris teks kecil di kepala kartu memakan
                    tinggi yang lebih berguna untuk gambarnya, dan di grid
                    tinggi satu kartu menaikkan seluruh barisnya. */}
                <div className="mb-2 flex items-baseline gap-2">
                  <p className="min-w-0 truncate text-[12.5px] font-semibold tracking-tight text-zinc-100">
                    {tebakPasangan(c.keterangan) || c.agen}
                  </p>
                  <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-zinc-600">
                    {umur(c.waktu)} · {c.kb} KB
                  </span>
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

                {buka === c.id && (
                  <FormLevel chart={c} selesai={() => { setBuka(null); void tarik(); }} />
                )}

                {/* SATU BARIS KAKI untuk semua tindakan kartu ini.
                    ─────────────────────────────────────────────────────
                    Ikon mata & sampah dulu duduk di kepala, berdampingan
                    dengan nama dan waktu — dua hal yang cuma dibaca,
                    ditempeli dua tombol yang MENGUBAH dan salah satunya
                    menghapus. Sekarang semua yang bisa ditekan berkumpul di
                    kaki: yang dibaca di atas, yang dilakukan di bawah.

                    Barisnya tetap digambar walau formulirnya terbuka, cuma
                    dua pintunya yang menyingkir — supaya menghapus atau
                    menandai selesai tidak menuntut menutup formulir dulu.

                    DUA PINTU ITU dua pekerjaan berbeda, bukan jalan pintas
                    satu sama lain: yang kiri menetapkan level dari angka
                    yang sudah terbaca di gambarnya, yang kanan membawa
                    gambarnya ke chart sungguhan untuk dijiplak dulu — dipakai
                    saat zonanya masih perlu dicocokkan ke harga berjalan.

                    Sebaris, bukan bertumpuk: kartu-kartu ini duduk di grid,
                    dan tinggi yang bertambah di satu kartu ikut menaikkan
                    seluruh barisnya. */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {/* Fragment WAJIB: dua elemen bersaudara (tombol + tautan)
                      dalam satu ekspresi JSX tidak bisa berdiri tanpa induk. */}
                  {buka !== c.id && (<>
                    <button onClick={() => setBuka(c.id)}
                      className="cursor-pointer rounded-md border border-zinc-700 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
                      {c.sinyalId ? 'Terbitkan lagi' : 'Tetapkan area entry'}
                    </button>
                    {/* Alamatnya membawa id chart-nya. Halaman Chart & Entry yang
                        mengambil gambarnya sendiri — bukan dioper lewat state
                        navigasi: alamat yang lengkap bisa disalin, dibuka di tab
                        baru, dan dimuat ulang tanpa kehilangan jiplakannya. */}
                    <Link to={`/chart-entry?jiplak=${encodeURIComponent(c.id)}`
                      + (tebakPasangan(c.keterangan) ? `&simbol=${tebakPasangan(c.keterangan)}` : '')}
                      title={tebakPasangan(c.keterangan)
                        ? `Buka ${tebakPasangan(c.keterangan)} dengan chart ini di sampingnya`
                        : 'Pasangannya tidak terbaca dari keterangan — chart yang sedang terbuka dipakai apa adanya'}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[12px] text-violet-300 transition-colors hover:border-violet-500/50 hover:text-violet-200">
                      <PenLine className="size-3.5" />
                      Jiplak di Chart &amp; Entry
                    </Link>
                  </>)}

                  {/* Didorong ke ujung kanan oleh ml-auto, jadi ia tetap di
                      sana baik saat dua pintunya tampil maupun saat formulir
                      menggantikannya — letak tombol hapus yang berpindah-pindah
                      adalah tombol hapus yang cepat atau lambat tersenggol. */}
                  <span className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button onClick={() => void sembunyikan(c)}
                      title={c.sembunyi ? 'Kembalikan ke daftar' : 'Tandai selesai'}
                      className="cursor-pointer rounded p-1.5 text-zinc-500 transition-colors hover:text-zinc-200">
                      {c.sembunyi ? <Undo2 className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </button>
                    <button onClick={() => void buang(c)} title="Hapus berikut gambarnya"
                      className="cursor-pointer rounded p-1.5 text-zinc-500 transition-colors hover:text-red-400">
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}