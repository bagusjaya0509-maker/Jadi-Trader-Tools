import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Radar, BellRing, Plus, Trash2, RefreshCw, ShieldAlert, ExternalLink,
  Loader2, Wallet, AlertTriangle, X, Clock,
} from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import {
  ambilListing, simpanKoin, hapusKoin, periksaSekarang, periksaKeamanan,
  tandaiDibaca, hargaPresale, kelipatan, nilaiSekarang, tulisHarga, tulisUsd,
  type KoinPantau, type InfoJaringan,
} from '@/lib/coin-listing';

/* ════════════════════════════════════════════════════════════════════════
   COIN LISTING
   ════════════════════════════════════════════════════════════════════════
   Halaman ini menjawab SATU pertanyaan: koin yang sudah kubeli di presale,
   sudah listing belum?

   Bentuknya mengikuti pertanyaan itu. Tidak ada grafik, tidak ada peringkat,
   tidak ada rekomendasi — cuma daftar yang tiap barisnya berkata "belum"
   atau "SUDAH", dan yang kedua terlihat sangat berbeda dari yang pertama.

   ── DUA KEADAAN YANG SENGAJA TIDAK SEIMBANG ──────────────────────────────
   Baris yang menunggu dibuat setenang mungkin: teks kecil, tanpa warna,
   tanpa gerakan. Baris yang sudah listing dibuat sekeras mungkin. Bedanya
   berlebihan dengan sengaja — halaman ini akan berbulan-bulan menampilkan
   "belum" dan cuma sekali menampilkan "sudah", dan yang sekali itulah
   satu-satunya alasan halaman ini ada.

   ── KELIPATAN SEBAGAI TOKOH UTAMA ────────────────────────────────────────
   Angka paling besar di layar bukan harganya, melainkan berapa kali lipat
   ia terhadap harga presale. Harga token baru tidak berarti apa-apa tanpa
   pembanding — "$0,00042" sama tidak informatifnya dengan diam — sedangkan
   "6,2×" langsung menjawab pertanyaan yang sebenarnya sedang ditanyakan.
   ════════════════════════════════════════════════════════════════════════ */

/** Jarak waktu yang enak dibaca sekilas. */
function jarak(t: number): string {
  if (!t) return 'belum pernah';
  const d = Math.max(0, Date.now() - t);
  const m = Math.floor(d / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return m + ' menit lalu';
  const j = Math.floor(m / 60);
  if (j < 24) return j + ' jam lalu';
  return Math.floor(j / 24) + ' hari lalu';
}

/* ══ FORMULIR TAMBAH ══════════════════════════════════════════════════════
   Alamat kontrak wajib; sisanya tidak. Dipisah begitu karena momen
   pengisian halaman ini biasanya bukan momen tenang — orang menempel alamat
   yang baru diterima di grup, dan memaksanya mengisi enam medan dulu adalah
   cara memastikan ia menutup halaman dan lupa. Sisanya bisa dilengkapi
   nanti dengan menekan barisnya. */
function FormTambah({ jaringan, selesai }: {
  jaringan: Record<string, InfoJaringan>;
  selesai: () => void;
}) {
  const [buka, setBuka] = useState(false);
  const [net, setNet] = useState('solana');
  const [alamat, setAlamat] = useState('');
  const [nama, setNama] = useState('');
  const [usd, setUsd] = useState('');
  const [tok, setTok] = useState('');
  const [catatan, setCatatan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  async function kirim() {
    setSibuk(true); setGalat('');
    const h = await simpanKoin({
      jaringan: net, alamat: alamat.trim(), nama: nama.trim(), catatan: catatan.trim(),
      beliUsd: Number(usd) || 0, beliToken: Number(tok) || 0,
    });
    setSibuk(false);
    if (h.error) { setGalat(h.error); return; }
    setAlamat(''); setNama(''); setUsd(''); setTok(''); setCatatan('');
    setBuka(false);
    selesai();
  }

  if (!buka) {
    return (
      <button onClick={() => setBuka(true)}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-3 text-[13px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200">
        <Plus className="size-4" /> Pantau koin baru
      </button>
    );
  }

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1">
          <h3 className="text-[13.5px] font-semibold text-zinc-100">Pantau koin baru</h3>
          <p className="mt-0.5 text-[11.5px] text-zinc-500">
            Yang wajib cuma alamat kontraknya. Sisanya bisa dilengkapi nanti.
          </p>
        </div>
        <button onClick={() => setBuka(false)} className="cursor-pointer rounded p-1 text-zinc-500 hover:text-zinc-200">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block sm:w-44">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Jaringan</span>
            <select value={net} onChange={(e) => setNet(e.target.value)}
              className="w-full cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-500">
              {Object.entries(jaringan).map(([id, j]) => (
                <option key={id} value={id}>{j.label}</option>
              ))}
            </select>
          </label>
          <label className="block flex-1">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
              Alamat kontrak token
            </span>
            <input value={alamat} onChange={(e) => setAlamat(e.target.value)}
              placeholder={jaringan[net]?.pola === 'evm' ? '0x…' : 'Alamat mint Solana'}
              className="angka w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[12.5px] text-zinc-100 outline-none focus:border-zinc-500" />
          </label>
        </div>

        {/* Kenapa alamat, bukan nama — dijelaskan di tempat orang tergoda
            mengetik nama. Penjelasan yang ditaruh di dokumentasi tidak akan
            terbaca oleh orang yang sedang buru-buru menempel sesuatu. */}
        <p className="flex gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-zinc-600" />
          <span>
            Harus alamat kontrak, bukan nama. Di Solana ada empat kolam berbeda bernama
            “TRUMP” dengan harga $2,42 sampai $0,029 — dan tiga di antaranya bukan yang
            dimaksud siapa pun. Salin alamatnya dari pengumuman resmi proyeknya.
          </span>
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block flex-1">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Nama proyek</span>
            <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="opsional"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-500" />
          </label>
          <label className="block sm:w-36">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Dibayar ($)</span>
            <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" placeholder="100"
              className="angka w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-500" />
          </label>
          <label className="block sm:w-44">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Token diterima</span>
            <input value={tok} onChange={(e) => setTok(e.target.value)} inputMode="decimal" placeholder="20000"
              className="angka w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-500" />
          </label>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Dua angka itu yang membuat halaman ini bisa menjawab “untung berapa” pada detik
          listing, bukan cuma “harganya sekian”.
          {Number(usd) > 0 && Number(tok) > 0 && (
            <> Harga presale kamu <span className="angka text-zinc-300">
              {tulisHarga(Number(usd) / Number(tok))}</span> per token.</>
          )}
        </p>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Catatan</span>
          <input value={catatan} onChange={(e) => setCatatan(e.target.value)}
            placeholder="Dari mana kamu tahu koin ini — berguna saat menilai sumbernya nanti"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[12.5px] text-zinc-100 outline-none focus:border-zinc-500" />
        </label>

        {galat && (
          <p className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-[12px] text-red-300">{galat}</p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={() => setBuka(false)}
            className="cursor-pointer rounded-md border border-zinc-700 px-3 py-1.5 text-[12.5px] text-zinc-300 hover:border-zinc-500">
            Batal
          </button>
          <button disabled={!alamat.trim() || sibuk} onClick={() => void kirim()}
            className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-[12.5px] font-semibold text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
            {sibuk ? 'Menyimpan…' : 'Mulai pantau'}
          </button>
        </div>
      </div>
    </Panel>
  );
}

/* ══ FAKTA KEAMANAN ═══════════════════════════════════════════════════════
   Fakta, bukan vonis. Tidak ada skor dan tidak ada kata "aman" di mana pun.

   Alasannya sudah terbukti: TRUMP yang RESMI punya 89,8% pasokan di sepuluh
   dompet teratas — angka yang akan ditandai merah oleh penyaring penipuan
   mana pun. Label "berisiko" pada token yang benar melatih orang
   mengabaikan label, dan sesudah itu labelnya tidak berguna untuk token
   yang memang salah. */
function PanelAman({ k, muat, periksa }: {
  k: KoinPantau; muat: boolean; periksa: () => void;
}) {
  const a = k.aman;
  if (!a || a.kosong) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2">
        <ShieldAlert className="size-3.5 text-zinc-600" />
        <span className="text-[11.5px] text-zinc-500">
          {a?.kosong ? 'Data keamanan tidak tersedia untuk token ini.' : 'Fakta keamanan belum ditarik.'}
        </span>
        <button onClick={periksa} disabled={muat}
          className="ml-auto cursor-pointer rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-zinc-500 disabled:opacity-40">
          {muat ? 'Memeriksa…' : 'Periksa'}
        </button>
      </div>
    );
  }

  const baris: [string, string, boolean][] = [
    ['Bisa dicetak lagi', a.bisaCetak ? 'ya' : 'tidak', !!a.bisaCetak],
    ['Saldo bisa dibekukan', a.bisaBekukan ? 'ya' : 'tidak', !!a.bisaBekukan],
    ['Kontrak bisa diubah', a.bisaDiubah ? 'ya' : 'tidak', !!a.bisaDiubah],
  ];
  if (a.pajakJual != null) {
    baris.push(['Pajak jual', (a.pajakJual * 100).toFixed(1) + '%', a.pajakJual > 0.1]);
  }

  return (
    <div className="rounded-lg border border-zinc-800 px-3 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <ShieldAlert className="size-3.5 text-zinc-500" />
        <span className="text-[11.5px] font-medium text-zinc-300">Fakta kontrak</span>
        <button onClick={periksa} disabled={muat}
          className="ml-auto cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40">
          {muat ? 'Memeriksa…' : 'Perbarui'}
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {baris.map(([l, v, awas]) => (
          <span key={l} className="text-[11px] text-zinc-500">
            {l}: <span className={awas ? 'font-semibold text-amber-300' : 'text-zinc-300'}>{v}</span>
          </span>
        ))}
        {a.terpusat != null && (
          <span className="text-[11px] text-zinc-500">
            10 dompet teratas: <span className="angka text-zinc-300">{a.terpusat}%</span>
          </span>
        )}
        {a.pemegang != null && (
          <span className="text-[11px] text-zinc-500">
            pemegang: <span className="angka text-zinc-300">{a.pemegang.toLocaleString('id-ID')}</span>
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-zinc-600">
        Angka mentah dari kontraknya, bukan penilaian. Pasokan yang terpusat sering justru
        ciri proyek resmi yang menahan token tim — yang menentukan tetap kamu.
      </p>
    </div>
  );
}

/* ══ SATU BARIS ═══════════════════════════════════════════════════════════ */
function Baris({ k, jaringan, sibuk, aksi }: {
  k: KoinPantau;
  jaringan: Record<string, InfoJaringan>;
  /* Kunci gabungan "alamat:aksi", bukan alamat saja. Sempat alamat saja, dan
     akibatnya tombol keamanan tidak pernah berkata "Memeriksa…" — barisnya
     memang sibuk, tapi yang sibuk aksi yang lain. Satu penanda sibuk untuk
     dua tombol berarti salah satunya selalu berbohong. */
  sibuk: string;
  aksi: {
    periksa: () => void; hapus: () => void; aman: () => void; baca: () => void;
  };
}) {
  const muat = sibuk.startsWith(k.alamat + ':') ? sibuk.slice(k.alamat.length + 1) : '';
  const listing = k.status === 'listing' && k.pasar;
  const lipat = kelipatan(k);
  const presale = hargaPresale(k);
  const nilai = nilaiSekarang(k);
  const alarm = listing && k.dibaca === false;
  const net = jaringan[k.jaringan];

  return (
    <Panel className={cn('overflow-hidden transition-colors',
      alarm ? 'border-emerald-500/60 bg-emerald-500/[0.04]'
        : listing ? 'border-zinc-700' : 'border-zinc-800/80')}>

      {/* Pita alarm — cuma sekali seumur baris, sampai ditekan. */}
      {alarm && (
        <div className="flex flex-wrap items-center gap-2 bg-emerald-500/15 px-4 py-2">
          <BellRing className="size-4 shrink-0 animate-pulse text-emerald-300" />
          <span className="text-[12.5px] font-semibold text-emerald-200">
            Sudah listing — terdeteksi {jarak(k.listingKetahuan || 0)}
          </span>
          <button onClick={aksi.baca}
            className="ml-auto cursor-pointer rounded border border-emerald-500/40 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-500/20">
            Sudah lihat
          </button>
        </div>
      )}

      <div className="space-y-3 p-4">
        {/* ── Kepala ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[14px] font-semibold text-zinc-100">
            {k.nama || k.simbol || 'Tanpa nama'}
          </span>
          {k.simbol && k.nama && (
            <span className="text-[12px] text-zinc-500">{k.simbol}</span>
          )}
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
            {net?.label || k.jaringan}
          </span>
          {!listing && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-600">
              <Clock className="size-3" /> menunggu · dicek {jarak(k.diperiksa)}
            </span>
          )}
          <button onClick={aksi.periksa} disabled={muat === 'periksa'}
            title="Periksa sekarang, tidak menunggu putaran berikutnya"
            className="ml-auto cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300 disabled:opacity-40">
            <RefreshCw className={cn('size-3.5', muat === 'periksa' && 'animate-spin')} />
          </button>
          <button onClick={aksi.hapus} title="Berhenti memantau"
            className="cursor-pointer rounded p-1 text-zinc-700 transition-colors hover:text-red-400">
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {/* ── Isi utama ──────────────────────────────────────────────── */}
        {listing ? (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            {/* TOKOH UTAMA: kelipatan terhadap harga presale. */}
            {lipat != null ? (
              <div>
                <span className="block text-[10.5px] uppercase tracking-wide text-zinc-500">
                  Terhadap harga presale
                </span>
                <span className={cn('angka block text-[34px] font-semibold leading-none',
                  lipat >= 1 ? 'text-emerald-400' : 'text-red-400')}>
                  {lipat.toFixed(2)}×
                </span>
              </div>
            ) : (
              <div>
                <span className="block text-[10.5px] uppercase tracking-wide text-zinc-500">Harga</span>
                <span className="angka block text-[28px] font-semibold leading-none text-zinc-100">
                  {tulisHarga(k.pasar!.harga)}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {lipat != null && (
                <Angka label="Harga sekarang" nilai={tulisHarga(k.pasar!.harga)} />
              )}
              {presale != null && <Angka label="Harga presale" nilai={tulisHarga(presale)} />}
              {nilai != null && (
                <Angka label="Nilai tokenmu"
                  nilai={tulisUsd(nilai)}
                  sub={k.beliUsd > 0 ? `dari $${k.beliUsd.toLocaleString('id-ID')}` : undefined} />
              )}
              <Angka label="Likuiditas kolam" nilai={tulisUsd(k.pasar!.likuiditas)} />
              <Angka label="Volume 24 jam" nilai={tulisUsd(k.pasar!.volume24)} />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-[12.5px] text-zinc-400">
              Belum ada kolam dengan likuiditas berarti.
            </span>
            {k.benih && (
              /* Kolam benih dilaporkan, bukan disembunyikan: ia tanda
                 listingnya dekat, dan menyembunyikannya membuat pemantau
                 terlihat diam padahal ia sedang melihat sesuatu. */
              <span className="text-[11.5px] text-amber-300/80">
                Ada kolam kecil {tulisUsd(k.benih.likuiditas)} — biasanya kolam benih,
                belum bisa dipakai.
              </span>
            )}
            {k.galat && (
              <span className="text-[11.5px] text-red-400/80">Gagal memeriksa: {k.galat}</span>
            )}
            <span className="text-[11px] text-zinc-600">{k.putaran || 0}× diperiksa</span>
          </div>
        )}

        {/* ── Alamat + tautan ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="angka text-[11px] text-zinc-600">
            {k.alamat.slice(0, 12)}…{k.alamat.slice(-8)}
          </span>
          <button onClick={() => void navigator.clipboard?.writeText(k.alamat)}
            className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">
            salin alamat
          </button>
          {listing && k.pasar!.kolam && (
            <a href={`https://www.geckoterminal.com/${k.jaringan}/pools/${k.pasar!.kolam}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200">
              Chart kolam <ExternalLink className="size-3" />
            </a>
          )}
          {k.catatan && <span className="text-[11px] text-zinc-600">· {k.catatan}</span>}
        </div>

        <PanelAman k={k} muat={muat === 'aman'} periksa={aksi.aman} />
      </div>
    </Panel>
  );
}

function Angka({ label, nilai, sub }: { label: string; nilai: string; sub?: string }) {
  return (
    <div>
      <span className="block text-[10.5px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="angka block text-[15px] font-medium text-zinc-100">{nilai}</span>
      {sub && <span className="block text-[10.5px] text-zinc-600">{sub}</span>}
    </div>
  );
}

/* ══ HALAMAN ══════════════════════════════════════════════════════════════ */
export default function CoinListing() {
  const [daftar, setDaftar] = useState<KoinPantau[]>([]);
  const [jaringan, setJaringan] = useState<Record<string, InfoJaringan>>({});
  const [muat, setMuat] = useState(true);
  const [sibuk, setSibuk] = useState('');
  const [masuk, setMasuk] = useState(true);
  /* Alamat yang sudah pernah membunyikan notifikasi desktop di tab INI.
     Tanpa ini, tiap tarikan 60 detik akan membunyikan ulang alarm yang sama
     sampai tombolnya ditekan — dan notifikasi yang berulang untuk kabar
     yang sudah dibaca adalah cara tercepat membuat orang mematikannya. */
  const sudahBunyi = useRef(new Set<string>());

  const tarik = useCallback(async () => {
    const j = await ambilListing();
    setMuat(false);
    if (!j) { setMasuk(false); return; }
    setMasuk(true);
    setDaftar(j.daftar);
    setJaringan(j.jaringan);

    /* Notifikasi desktop justru untuk saat halaman ini TIDAK dilihat —
       itu keadaan normalnya. Izinnya diminta saat ada yang benar-benar
       perlu diberitahukan, bukan saat halaman dibuka: permintaan izin yang
       datang tanpa sebab hampir selalu ditolak. */
    for (const k of j.daftar) {
      if (k.status !== 'listing' || k.dibaca !== false) continue;
      if (sudahBunyi.current.has(k.alamat)) continue;
      sudahBunyi.current.add(k.alamat);
      try {
        if (typeof Notification === 'undefined') continue;
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission !== 'granted') continue;
        new Notification(`${k.nama || k.simbol || 'Koin pantauan'} sudah listing`, {
          body: `${tulisHarga(k.pasar?.harga || 0)} · likuiditas ${tulisUsd(k.pasar?.likuiditas || 0)}`,
          tag: 'listing-' + k.alamat,
        });
      } catch { /* peramban menolak — pita di layar tetap ada */ }
    }
  }, []);

  useEffect(() => {
    void tarik();
    const t = setInterval(() => { void tarik(); }, 60000);
    return () => clearInterval(t);
  }, [tarik]);

  /* Judul tab ikut berteriak. Satu-satunya cara halaman ini terlihat saat
     ia berada di tab yang tidak aktif dan izin notifikasi ditolak. */
  const jumlahAlarm = daftar.filter((k) => k.status === 'listing' && k.dibaca === false).length;
  useEffect(() => {
    if (!jumlahAlarm) return;
    const asli = document.title;
    document.title = `(${jumlahAlarm}) LISTING · ${asli}`;
    return () => { document.title = asli; };
  }, [jumlahAlarm]);

  async function jalankan(kunci: string, f: () => Promise<any>) {
    setSibuk(kunci); await f(); setSibuk(''); await tarik();
  }

  const menunggu = daftar.filter((k) => k.status !== 'listing');
  const sudah = daftar.filter((k) => k.status === 'listing');

  /* `p-4 sm:p-6` dipasang halamannya sendiri, bukan kerangka: <main> memang
     tanpa bantalan supaya halaman chart bisa memakai seluruh lebarnya. */
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Panel className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          <Radar className="mt-0.5 size-5 shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-zinc-100">
              Menunggui koin yang belum listing
            </h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-zinc-400">
              Tempel alamat kontrak koin yang sudah kamu beli di presale. Sejak itu
              alamatnya diperiksa tiap 90 detik, dan begitu ada kolam DEX dengan likuiditas
              nyata, halaman ini berbunyi — beserta harganya dan berapa kali lipat ia
              terhadap harga belimu.
            </p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <span className="block text-[10.5px] uppercase tracking-wide text-zinc-500">Menunggu</span>
              <span className="angka block text-[20px] font-medium text-zinc-200">{menunggu.length}</span>
            </div>
            <div>
              <span className="block text-[10.5px] uppercase tracking-wide text-zinc-500">Sudah listing</span>
              <span className={cn('angka block text-[20px] font-medium',
                sudah.length ? 'text-emerald-400' : 'text-zinc-600')}>{sudah.length}</span>
            </div>
          </div>
        </div>
      </Panel>

      {!masuk && (
        <Panel className="px-4 py-6 text-center">
          <p className="text-[13px] text-zinc-400">Masuk dulu untuk memakai halaman ini.</p>
        </Panel>
      )}

      {masuk && <FormTambah jaringan={jaringan} selesai={() => void tarik()} />}

      {muat && (
        <p className="flex items-center gap-2 py-6 text-[13px] text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> Memuat daftar pantauan…
        </p>
      )}

      {/* Yang sudah listing di ATAS. Urutan ini kebalikan dari urutan
          kejadian, dan itu disengaja: baris yang sudah listing menuntut
          keputusan sekarang, sedangkan yang menunggu tidak menuntut apa-apa. */}
      {sudah.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12.5px] font-semibold uppercase tracking-wide text-zinc-400">
            Sudah listing
          </h3>
          {sudah.map((k) => (
            <Baris key={k.jaringan + k.alamat} k={k} jaringan={jaringan} sibuk={sibuk}
              aksi={{
                periksa: () => void jalankan(k.alamat + ':periksa', () => periksaSekarang(k.jaringan, k.alamat)),
                hapus: () => void jalankan(k.alamat + ':hapus', () => hapusKoin(k.jaringan, k.alamat)),
                aman: () => void jalankan(k.alamat + ':aman', () => periksaKeamanan(k.jaringan, k.alamat)),
                baca: () => void jalankan(k.alamat + ':baca', () => tandaiDibaca(k.alamat)),
              }} />
          ))}
        </section>
      )}

      {menunggu.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12.5px] font-semibold uppercase tracking-wide text-zinc-400">
            Menunggu listing
          </h3>
          {menunggu.map((k) => (
            <Baris key={k.jaringan + k.alamat} k={k} jaringan={jaringan} sibuk={sibuk}
              aksi={{
                periksa: () => void jalankan(k.alamat + ':periksa', () => periksaSekarang(k.jaringan, k.alamat)),
                hapus: () => void jalankan(k.alamat + ':hapus', () => hapusKoin(k.jaringan, k.alamat)),
                aman: () => void jalankan(k.alamat + ':aman', () => periksaKeamanan(k.jaringan, k.alamat)),
                baca: () => {},
              }} />
          ))}
        </section>
      )}

      {!muat && masuk && !daftar.length && (
        <Panel className="px-4 py-8 text-center">
          <p className="text-[13px] text-zinc-400">Belum ada koin yang dipantau.</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-zinc-600">
            Tekan “Pantau koin baru” dan tempel alamat kontraknya. Kalau koinnya belum
            punya alamat sama sekali — presale-nya masih berupa formulir dan janji —
            itu tanda proyeknya belum menerbitkan token apa pun.
          </p>
        </Panel>
      )}

      {/* ── SIAPKAN DOMPET ────────────────────────────────────────────────
          Ditaruh di halaman ini, bukan di dokumentasi. Orang yang membuka
          halaman ini sedang bersiap ikut presale, dan itu satu-satunya
          momen ia mau membaca soal dompet terpisah. */}
      <Panel className="p-4">
        <PanelHead judul="Yang perlu disiapkan sebelum ikut presale"
          sub="Sekali siapkan, dipakai untuk semua presale berikutnya" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Wallet className="size-4 text-zinc-400" />
              <span className="text-[12.5px] font-semibold text-zinc-200">Dua dompet</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-zinc-400">
              <span className="text-zinc-200">MetaMask</span> untuk presale di Ethereum, BNB
              Chain, Base, dan Arbitrum. <span className="text-zinc-200">Phantom</span> untuk
              Solana. Hampir semua presale ada di salah satu dari keduanya.
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.03] p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400" />
              <span className="text-[12.5px] font-semibold text-amber-200">Dompet khusus, bukan dompet utama</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-zinc-400">
              Situs presale meminta kamu menyambungkan dompet dan menyetujui akses token.
              Satu persetujuan jahat bisa menguras seluruh isinya — bukan cuma yang kamu
              belanjakan. Isi dompet ini sebatas anggaran presale, dan itulah batas
              kerugian terburukmu.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="mb-1.5 text-[12.5px] font-semibold text-zinc-200">Dana sudah di dompet, bukan di bursa</div>
            <p className="text-[11.5px] leading-relaxed text-zinc-400">
              USDT atau USDC di rantai yang dipakai, plus token gas-nya (ETH, BNB, atau SOL).
              Penyebab paling sering ketinggalan bukan tidak tahu kabarnya, tapi dananya
              masih di Binance saat kabarnya datang — penarikan butuh belasan menit sampai
              sejam.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="mb-1.5 text-[12.5px] font-semibold text-zinc-200">Cocokkan alamatnya sendiri</div>
            <p className="text-[11.5px] leading-relaxed text-zinc-400">
              Ambil alamat kontrak dari kanal resmi proyeknya, lalu bandingkan huruf per
              huruf dengan yang beredar di grup. Alamat palsu yang mirip adalah penipuan
              presale yang paling sering berhasil, justru karena korbannya memang sedang
              menunggu alamat.
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
          Perlu dikatakan sekali: “ada yang ahli menyarankan → belum listing di mana pun →
          belinya di situs proyeknya” secara bentuk sama persis dengan penipuan kripto yang
          paling umum. Itu tidak berarti semuanya penipuan, tapi berarti pembuktiannya ada
          di pihakmu. Pakai hanya uang yang kamu siap kehilangan seluruhnya — bukan karena
          pasti hilang, tapi karena di kelas ini tidak ada jalan keluar kalau salah.
        </p>
      </Panel>
    </div>
  );
}
