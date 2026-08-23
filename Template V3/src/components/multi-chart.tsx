import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutGrid, Plus, X, GripVertical, ExternalLink, Undo2, Maximize2, Minimize2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { ambilTickers, daftarSimbolMt5 } from '@/lib/pasar';
import { cn } from '@/lib/utils';
import {
  useMulti, matikanMulti, tambahPanel, hapusPanel, perbaruiPanel, kirimBus, dengarBus,
  MAKS_PANEL, TF_PANEL, type PanelMulti,
} from '@/lib/multi-chart';

/* ════════════════════════════════════════════════════════════════════════
   GRID MULTI-CHART
   ════════════════════════════════════════════════════════════════════════
   Dipasang SEKALI di AppShell, bukan di rute /chart-entry. Inilah yang
   membuat panel-panelnya selamat dari perpindahan halaman: saat jendela
   tools membuka Copy Signal, grid ini cuma disembunyikan (display:none) —
   iframe di dalamnya tetap hidup, datanya tetap berjalan, dan kembali ke
   Chart & Entry menampilkannya lagi persis seperti ditinggalkan.

   Tiap panel = halaman Chart & Entry utuh dalam iframe mode polos. Tidak
   ada satu pun fitur chart yang ditulis ulang di sini; komponen ini hanya
   mengurus empat hal: susunan grid, tukar-posisi, ukuran belahan, dan
   melepas panel jadi jendela sendiri untuk monitor lain.
   ════════════════════════════════════════════════════════════════════════ */

const ALAMAT = (p: PanelMulti, utama = false) =>
  `/chart-entry?simbol=${encodeURIComponent(p.simbol)}&tf=${encodeURIComponent(p.tf)}`
  + `&polos=1&panel=${encodeURIComponent(p.id)}${utama ? '&utama=1' : ''}`;

export function MultiChart() {
  const m = useMulti();
  const { pathname } = useLocation();

  /* Urutan TAMPILAN dipisah dari urutan array panel, dan panelnya digeser
     lewat CSS `order` — bukan dengan menyusun ulang arraynya. Memindahkan
     elemen iframe di DOM MEMUAT ULANG isinya; menukar nilai `order` tidak
     menyentuh DOM sama sekali, jadi chart yang ditukar posisinya tidak
     berkedip apalagi mengulang dari nol. */
  const [urut, setUrut] = useState<string[]>([]);
  const [seret, setSeret] = useState('');
  /* id panel yang sedang hidup sebagai jendela terpisah. Ref jendelanya di
     luar state: objek Window tidak bisa dan tidak perlu memicu render. */
  const [lepas, setLepas] = useState<Record<string, boolean>>({});
  const jendela = useRef(new Map<string, Window>());

  /* ── Kepala panel dikendalikan DARI SINI ──────────────────────────────
     Sakelarnya duduk di baris nomor panel, sejajar ikon lepas-jendela —
     permintaan pemilik, dan ia memperbaiki tumpukan: dulu baris nomor panel
     dan strip di dalam panel sama-sama menuliskan simbol dan TF, dua baris
     untuk satu keterangan.

     `true` berarti TERBUKA. Bawaannya tertutup, sama dengan bawaan di dalam
     panel — dua sisi yang menyimpan keadaan yang sama harus berangkat dari
     nilai yang sama, atau ikonnya akan berbohong sampai ditekan sekali. */
  /* Menu timeframe yang menggantung dari label panel. Menyimpan id panel,
     bukan indeksnya: panel bisa ditutup selagi menunya terbuka, dan indeks
     akan menunjuk ke tetangganya. */
  const [menuTf, setMenuTf] = useState<{ id: string; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!menuTf) return;
    const tutup = () => setMenuTf(null);
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuTf(null); };
    const t = setTimeout(() => document.addEventListener('click', tutup), 0);
    document.addEventListener('keydown', tekan);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', tutup);
      document.removeEventListener('keydown', tekan);
    };
  }, [menuTf]);

  /* ── Panel cari pasangan ──────────────────────────────────────────────
     "Tambah chart" dulu langsung menaruh pasangan dari daftar calon —
     tebakan yang benar sesekali dan salah selebihnya, lalu orangnya harus
     mengganti simbolnya sendiri sesudah panelnya lahir. Sekarang ia bertanya
     dulu. */
  const [cariBuka, setCariBuka] = useState(false);
  const [ketik, setKetik] = useState('');
  const [tfBaru, setTfBaru] = useState('4h');
  const [semuaSimbol, setSemuaSimbol] = useState<string[]>([]);
  const kotakCari = useRef<HTMLInputElement | null>(null);

  /* Daftar simbol diambil SEKALI saat panel cari pertama kali dibuka, bukan
     saat grid dipasang: kebanyakan sesi tidak pernah menambah chart, dan
     dua permintaan jaringan untuk fitur yang tidak dipakai adalah dua
     permintaan yang tidak perlu ada. */
  useEffect(() => {
    if (!cariBuka || semuaSimbol.length) return;
    let hidup = true;
    void (async () => {
      const [tk, mt5] = await Promise.all([
        ambilTickers().catch(() => ({} as Record<string, unknown>)),
        daftarSimbolMt5().catch(() => [] as string[]),
      ]);
      if (!hidup) return;
      setSemuaSimbol([...Object.keys(tk).sort(), ...mt5.map((s) => 'MT5:' + s)]);
    })();
    return () => { hidup = false; };
  }, [cariBuka, semuaSimbol.length]);

  useEffect(() => { if (cariBuka) setTimeout(() => kotakCari.current?.focus(), 30); }, [cariBuka]);

  const hasilCari = (() => {
    const q = ketik.trim().toUpperCase();
    const sumber = semuaSimbol.length ? semuaSimbol : [];
    if (!q) return sumber.slice(0, 40);
    /* Yang DIAWALI kata kuncinya naik ke atas: mengetik "BTC" harus
       memunculkan BTCUSDT lebih dulu daripada WBTCUSDT. */
    const awal = sumber.filter((s) => s.startsWith(q));
    const tengah = sumber.filter((s) => !s.startsWith(q) && s.includes(q));
    return [...awal, ...tengah].slice(0, 40);
  })();

  const pilihPasangan = (s: string) => {
    tambahPanel({ simbol: s, tf: tfBaru });
    setCariBuka(false);
    setKetik('');
  };

  const [kepalaBuka, setKepalaBuka] = useState<Record<string, boolean>>({});
  const gantiKepala = (id: string) => {
    const buka = !kepalaBuka[id];
    setKepalaBuka((k) => ({ ...k, [id]: buka }));
    kirimBus({ jenis: 'kepala', panel: id, sembunyi: !buka });
  };

  /* Panel melapor simbol/TF-nya sendiri; label di baris nomor panel dan menu
     "buka di panel mana" keduanya membacanya dari sini. Tanpa laporan ini
     keduanya menyebut simbol AWAL selamanya. */
  useEffect(() => dengarBus((p) => {
    if (p && p.jenis === 'lapor' && typeof p.panel === 'string') {
      perbaruiPanel(p.panel, p.simbol, p.tf);
    }
  }), []);

  /* Belahan grid 2 kolom: persen kolom kiri dan baris atas. Disimpan di
     state saja — susunan ruang kerja layak diatur ulang per sesi, dan
     menyimpannya menambah satu kunci localStorage untuk manfaat tipis. */
  const [kolomPct, setKolomPct] = useState(50);
  const [barisPct, setBarisPct] = useState(50);
  const wadahRef = useRef<HTMLDivElement | null>(null);
  const geser = useRef<'' | 'kolom' | 'baris'>('');

  /* ── Layar penuh SELURUH grid ─────────────────────────────────────────
     Polanya disamakan dengan layar penuh chart tunggal, termasuk kedua
     pelajaran yang sudah dibayar di sana:

     1. Keadaannya diikuti dari EVENT `fullscreenchange`, bukan dari tombol.
        Orang keluar dengan Esc jauh lebih sering daripada menekan tombolnya
        lagi, dan state yang cuma di-toggle akan tertinggal menyala.
     2. Ada mode SEMU untuk peramban tanpa Fullscreen API (iOS Safari) atau
        yang menolak permintaannya. Di sana requestFullscreen tidak melempar
        apa pun — ia cuma tidak terjadi, dan tombolnya diam tanpa jejak. */
  const bingkaiRef = useRef<HTMLDivElement | null>(null);
  const [penuhAsli, setPenuhAsli] = useState(false);
  const [penuhSemu, setPenuhSemu] = useState(false);
  const penuh = penuhAsli || penuhSemu;

  useEffect(() => {
    const ubah = () => setPenuhAsli(document.fullscreenElement === bingkaiRef.current);
    document.addEventListener('fullscreenchange', ubah);
    return () => document.removeEventListener('fullscreenchange', ubah);
  }, []);

  /* Esc harus bekerja di mode semu juga — mode yang cuma bisa ditutup lewat
     satu tombol kecil terasa seperti jebakan. Gulir badan dikunci selama
     menyala supaya halaman di belakang tidak ikut bergeser. */
  useEffect(() => {
    if (!penuhSemu) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setPenuhSemu(false); };
    document.addEventListener('keydown', tekan);
    const asal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tekan);
      document.body.style.overflow = asal;
    };
  }, [penuhSemu]);

  const gantiPenuh = () => {
    const el = bingkaiRef.current;
    if (!el) return;
    if (penuhSemu) { setPenuhSemu(false); return; }
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    /* Dicek DULU, bukan dicoba lalu ditangkap: di iOS Safari
       requestFullscreen tidak ada sama sekali, jadi `?.()` menghasilkan
       undefined tanpa melempar apa pun — tidak ada yang bisa ditangkap. */
    if (document.fullscreenEnabled && typeof el.requestFullscreen === 'function') {
    /* requestFullscreen bisa gagal DUA CARA, dan keduanya harus jatuh ke
       mode semu:

       1. Promise-nya ditolak (izin, kebijakan) -> .catch()
       2. Ia MELEMPAR SERENTAK. Terukur di peramban tersemat:
          "TypeError: Permissions check failed" keluar sebelum promise-nya
          sempat ada, jadi .catch() tidak pernah tersentuh dan galatnya
          melompat keluar dari penangan klik. Yang terlihat orang: tombol
          ditekan, tidak ada yang bergerak, tidak ada yang bisa dilaporkan.

       try/catch DI LUAR menangkap keduanya. */
      try {
        void el.requestFullscreen().catch(() => setPenuhSemu(true));
      } catch { setPenuhSemu(true); }
      return;
    }
    setPenuhSemu(true);
  };

  useEffect(() => {
    setUrut((u) => {
      const ada = m.panel.map((p) => p.id);
      const bersih = u.filter((id) => ada.includes(id));
      return [...bersih, ...ada.filter((id) => !bersih.includes(id))];
    });
  }, [m.panel]);

  /* Popup yang ditutup orangnya (tombol X jendela) terdeteksi lewat polling
     `closed` — tidak ada event lintas-jendela untuk itu. Panelnya kembali
     jadi iframe di grid secara otomatis. */
  useEffect(() => {
    const t = setInterval(() => {
      const mati: string[] = [];
      jendela.current.forEach((w, id) => { if (w.closed) mati.push(id); });
      if (mati.length) {
        mati.forEach((id) => jendela.current.delete(id));
        setLepas((l) => {
          const b = { ...l };
          mati.forEach((id) => delete b[id]);
          return b;
        });
      }
    }, 2000);
    return () => clearInterval(t);
  }, []);

  /* Mode dimatikan / aplikasi ditutup → popup yang KITA buka ikut ditutup.
     Popup yatim tetap berfungsi (ia halaman chart penuh), tapi "tutup
     multi-chart" yang meninggalkan tiga jendela tercecer bukan "kembali
     seperti semula" yang dimaksud siapa pun. */
  useEffect(() => () => {
    jendela.current.forEach((w) => { try { w.close(); } catch { /* sudah mati */ } });
  }, []);

  if (!m.aktif) return null;
  const tampil = pathname === '/chart-entry';

  const kolom = m.panel.length > 4 ? 3 : Math.min(2, m.panel.length);
  const baris = Math.max(1, Math.ceil(m.panel.length / kolom));
  const belahKolom = kolom === 2;
  const belahBaris = kolom === 2 && baris === 2;

  const tukar = (a: string, b: string) => {
    if (a === b) return;
    setUrut((u) => {
      const i = u.indexOf(a), j = u.indexOf(b);
      if (i < 0 || j < 0) return u;
      const v = [...u];
      v[i] = b; v[j] = a;
      return v;
    });
  };

  const bukaJendela = (p: PanelMulti, utama: boolean) => {
    const w = window.open(ALAMAT(p, utama), 'jt-panel-' + p.id, 'popup=yes,width=1100,height=720');
    if (!w) return; /* diblokir pemblokir popup — panelnya tetap di grid */
    jendela.current.set(p.id, w);
    setLepas((l) => ({ ...l, [p.id]: true }));
  };

  const tarikKembali = (id: string) => {
    try { jendela.current.get(id)?.close(); } catch { /* sudah mati */ }
    jendela.current.delete(id);
    setLepas((l) => { const b = { ...l }; delete b[id]; return b; });
  };

  /* Geser belahan memakai pointer capture: tanpa itu, kursor yang lewat di
     atas iframe "ditelan" iframe dan seretannya putus di tengah jalan. */
  const mulaiGeser = (arah: 'kolom' | 'baris') => (e: React.PointerEvent<HTMLDivElement>) => {
    geser.current = arah;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const saatGeser = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geser.current || !wadahRef.current) return;
    const r = wadahRef.current.getBoundingClientRect();
    if (geser.current === 'kolom') {
      const pct = ((e.clientX - r.left) / r.width) * 100;
      setKolomPct(Math.min(80, Math.max(20, pct)));
    } else {
      const pct = ((e.clientY - r.top) / r.height) * 100;
      setBarisPct(Math.min(80, Math.max(20, pct)));
    }
  };
  const selesaiGeser = () => { geser.current = ''; };

  return (
    /* Kelas posisinya BERGANTIAN, bukan ditumpuk: `absolute` dan `fixed`
       sama-sama utility position dengan bobot sama, jadi yang menang
       ditentukan urutan di berkas CSS hasil build — bukan urutan tulis di
       sini. Menumpuk keduanya berarti menyerahkan tata letak pada undian. */
    <div ref={bingkaiRef} className={cn(
      'flex flex-col bg-zinc-950',
      penuhSemu ? 'fixed inset-0 z-[60]' : 'absolute inset-0 z-30',
      !tampil && 'hidden'
    )}>
      {/* Selagi LAYAR PENUH bilah ini menyingkir dan baru muncul saat kursor
          mendekat tepi atas. Layar penuh diminta supaya chartnya sebesar
          mungkin; bilah tetap setinggi 40 px memakan kembali sebagian dari
          yang baru saja diberikan. Ia MUNCUL, bukan hilang selamanya —
          jalan keluarnya ada di bilah itu, dan mode yang hanya bisa
          ditinggalkan lewat tombol yang tidak terlihat adalah jebakan.
          (Esc tetap bekerja, tapi tidak semua orang menebaknya.) */}
      <div className={cn('group/bilah flex shrink-0 items-center gap-3 border-b border-zinc-800/80 px-3 transition-all duration-200',
        penuh
          ? 'h-2 overflow-hidden border-transparent opacity-0 hover:h-10 hover:overflow-visible hover:border-zinc-800/80 hover:opacity-100'
          : 'h-10')}>
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-200">
          <LayoutGrid className="size-3.5 text-zinc-400" strokeWidth={2} />
          Multi-Chart
          <span className="angka text-[11px] text-zinc-600">{m.panel.length}/{MAKS_PANEL}</span>
        </span>
        <button onClick={() => setCariBuka(true)} disabled={m.panel.length >= MAKS_PANEL}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-default disabled:opacity-40">
          <Plus className="size-3" /> Tambah chart
        </button>
        <span className="hidden min-w-0 truncate text-[11px] text-zinc-600 lg:block">
          Seret kepala panel untuk menukar posisi · ikon ↗ melepas panel jadi jendela sendiri untuk monitor lain
        </span>
        <button onClick={gantiPenuh}
          title={penuh ? 'Keluar dari layar penuh (Esc)' : 'Layar penuh — semua panel chart'}
          aria-label={penuh ? 'Keluar dari layar penuh' : 'Layar penuh multi-chart'}
          className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
          {penuh ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
          <span className="hidden sm:inline">{penuh ? 'Keluar layar penuh' : 'Layar penuh'}</span>
        </button>
        {/* Tutup TIDAK ditawarkan selagi layar penuh. Menutup mode saat itu
            juga melepas bingkainya dari DOM, dan peramban keluar dari layar
            penuh sebagai efek samping — dua hal terjadi dari satu klik,
            yang satunya tidak diminta. Keluar dulu, baru tutup. */}
        {!penuh && (
          <button onClick={matikanMulti}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
            <X className="size-3" /> Tutup multi-chart
          </button>
        )}
      </div>

      <div ref={wadahRef} className="relative min-h-0 flex-1"
           style={{
             display: 'grid',
             gridTemplateColumns: kolom === 3 ? 'repeat(3, 1fr)'
               : belahKolom ? `${kolomPct}% 1fr` : '1fr',
             gridTemplateRows: belahBaris ? `${barisPct}% 1fr` : `repeat(${baris}, 1fr)`,
           }}>
        {m.panel.map((p, i) => (
          <div key={p.id} style={{ order: Math.max(0, urut.indexOf(p.id)) }}
               className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border border-zinc-800/60">
            <div draggable
                 onDragStart={(e) => { setSeret(p.id); e.dataTransfer.effectAllowed = 'move'; }}
                 onDragEnd={() => setSeret('')}
                 onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                 onDrop={() => { tukar(seret, p.id); setSeret(''); }}
                 className="flex h-7 shrink-0 cursor-grab items-center gap-2 border-b border-zinc-800/60 bg-zinc-950 px-2 active:cursor-grabbing">
              <GripVertical className="size-3.5 shrink-0 text-zinc-600" />
              {/* Tanpa kata "mulai": simbolnya kini dilaporkan panel dan
                  selalu yang sedang tampil, jadi tidak ada lagi yang perlu
                  dijelaskan sebagai titik berangkat. */}
              <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-zinc-500">
                Panel {i + 1} · <span className="angka truncate text-zinc-400">{p.simbol}</span>
                {/* TF-nya sebuah TOMBOL, bukan teks. Ia bagian keterangan
                    yang paling sering diubah, dan di baris ini ia sudah
                    tertulis — menjadikannya bisa diklik memangkas jalan
                    "buka kepala panel, cari pemilih, tutup lagi". */}
                <button onClick={(e) => {
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenuTf(menuTf?.id === p.id ? null : { id: p.id, x: r.left, y: r.bottom + 2 });
                        }}
                        title="Ganti timeframe panel ini"
                        className="angka shrink-0 cursor-pointer rounded px-1 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100">
                  {p.tf}
                </button>
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                {!lepas[p.id] && (
                  <button onClick={() => gantiKepala(p.id)}
                    title={kepalaBuka[p.id]
                      ? 'Sembunyikan kepala panel — beri ruang untuk chart'
                      : 'Tampilkan kepala panel — simbol, timeframe, indikator, replay'}
                    aria-label={kepalaBuka[p.id] ? 'Sembunyikan kepala panel' : 'Tampilkan kepala panel'}
                    className="cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300">
                    {kepalaBuka[p.id] ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                )}
                {!lepas[p.id] && (
                  <button onClick={() => bukaJendela(p, i === 0)}
                    title="Lepas jadi jendela sendiri — tarik ke monitor lain"
                    className="cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300">
                    <ExternalLink className="size-3" />
                  </button>
                )}
                <button onClick={() => { tarikKembali(p.id); hapusPanel(p.id); }}
                  title="Tutup panel ini"
                  className="cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:text-red-400">
                  <X className="size-3" />
                </button>
              </span>
            </div>

            {lepas[p.id] ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
                <ExternalLink className="size-5 text-zinc-700" />
                <p className="max-w-[16rem] text-[11.5px] leading-snug text-zinc-500">
                  Panel ini sedang hidup sebagai jendela terpisah — tarik jendelanya ke monitor mana pun.
                </p>
                <button onClick={() => tarikKembali(p.id)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
                  <Undo2 className="size-3" /> Tarik kembali ke grid
                </button>
              </div>
            ) : (
              /* `fullscreen` WAJIB ada di allow. Tanpa itu tombol layar
                 penuh MILIK CHART di dalam panel gagal dengan
                 "Permissions check failed" — iframe tidak mewarisi izin
                 fullscreen dari induknya, ia harus diberikan. Terlewat
                 saat panel pertama kali dibuat, dan tidak berbunyi seperti
                 galat: tombolnya cuma diam. */
              <iframe src={ALAMAT(p, i === 0)} title={`Chart ${p.simbol} ${p.tf}`}
                      allow="clipboard-read; clipboard-write; fullscreen"
                      className="min-h-0 w-full flex-1 border-0" />
            )}

            {/* Selama seretan berlangsung, iframe ditutupi lapisan tembus
                pandang. HTML5 drag-and-drop tidak pernah sampai ke elemen di
                belakang iframe — tanpa lapisan ini, menjatuhkan panel di
                atas chart lain tidak menjatuhkannya di mana pun. */}
            {seret && (
              <div onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                   onDrop={() => { tukar(seret, p.id); setSeret(''); }}
                   className={cn('absolute inset-0 z-10 border-2',
                     seret === p.id ? 'border-transparent bg-zinc-100/5' : 'border-dashed border-zinc-600/60 bg-zinc-950/40')} />
            )}
          </div>
        ))}

        {/* Sel kosong grid diisi ajakan, bukan dibiarkan hitam. Menutup satu
            panel dari empat menyisakan lubang seukuran seperempat layar yang
            terbaca sebagai "ada yang gagal dimuat" — padahal itu ruang yang
            memang tersedia. */}
        {m.panel.length < MAKS_PANEL && m.panel.length < kolom * baris && (
          <div style={{ order: 999 }}
               className="flex min-h-0 min-w-0 items-center justify-center border border-dashed border-zinc-800/70">
            <button onClick={() => setCariBuka(true)}
              className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md px-4 py-3 text-zinc-600 transition-colors hover:bg-zinc-900/60 hover:text-zinc-300">
              <Plus className="size-5" />
              <span className="text-[11.5px]">Tambah chart</span>
            </button>
          </div>
        )}

        {belahKolom && (
          <div onPointerDown={mulaiGeser('kolom')} onPointerMove={saatGeser}
               onPointerUp={selesaiGeser} onPointerCancel={selesaiGeser}
               title="Geser untuk mengatur lebar kolom"
               className="absolute inset-y-0 z-20 w-2 -translate-x-1/2 cursor-col-resize touch-none hover:bg-zinc-100/10"
               style={{ left: `${kolomPct}%` }} />
        )}
        {belahBaris && (
          <div onPointerDown={mulaiGeser('baris')} onPointerMove={saatGeser}
               onPointerUp={selesaiGeser} onPointerCancel={selesaiGeser}
               title="Geser untuk mengatur tinggi baris"
               className="absolute inset-x-0 z-20 h-2 -translate-y-1/2 cursor-row-resize touch-none hover:bg-zinc-100/10"
               style={{ top: `${barisPct}%` }} />
        )}
      </div>

      {cariBuka && (
        <div onClick={() => setCariBuka(false)}
             className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 pt-[12vh]">
          <div onClick={(e) => e.stopPropagation()}
               className="flex max-h-[70vh] w-[min(30rem,92vw)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-zinc-800/80 px-3 py-2.5">
              <Search className="size-4 shrink-0 text-zinc-600" />
              <input ref={kotakCari} value={ketik}
                     onChange={(e) => setKetik(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Escape') setCariBuka(false);
                       /* Enter mengambil hasil TERATAS. Untuk orang yang sudah
                          tahu simbolnya, mengetik lalu Enter jauh lebih cepat
                          daripada mengetik lalu mencari barisnya dengan mata. */
                       if (e.key === 'Enter' && hasilCari[0]) pilihPasangan(hasilCari[0]);
                     }}
                     placeholder="Cari pasangan — BTC, ETH, XAU…"
                     className="min-w-0 grow bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600" />
              <button onClick={() => setCariBuka(false)}
                className="cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300">
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1 border-b border-zinc-800/80 px-3 py-2">
              <span className="mr-1 text-[11px] text-zinc-500">Timeframe</span>
              {TF_PANEL.map((t) => (
                <button key={t.nilai} onClick={() => setTfBaru(t.nilai)}
                  className={cn('angka cursor-pointer rounded px-1.5 py-0.5 text-[11px] transition-colors',
                    t.nilai === tfBaru ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200')}>
                  {t.nilai}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!semuaSimbol.length ? (
                <p className="px-3 py-6 text-center text-[12px] text-zinc-600">Memuat daftar pasangan…</p>
              ) : !hasilCari.length ? (
                <p className="px-3 py-6 text-center text-[12px] text-zinc-600">
                  Tidak ada pasangan yang cocok dengan “{ketik}”.
                </p>
              ) : hasilCari.map((s) => (
                <button key={s} onClick={() => pilihPasangan(s)}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-900">
                  <span className="angka grow truncate text-[12.5px] text-zinc-200">{s}</span>
                  {s.startsWith('MT5:') && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[8.5px] font-semibold tracking-wide text-amber-300">MT5</span>
                  )}
                  <span className="angka shrink-0 text-[11px] text-zinc-600">{tfBaru}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {menuTf && (
        <div style={{ left: menuTf.x, top: menuTf.y }}
             onClick={(e) => e.stopPropagation()}
             className="fixed z-[80] min-w-[132px] overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
          <div className="border-b border-zinc-800/80 px-2.5 pb-1.5 pt-1 text-[10.5px] text-zinc-500">
            Timeframe
          </div>
          {TF_PANEL.map((t) => {
            const kini = m.panel.find((x) => x.id === menuTf.id)?.tf;
            return (
              <button key={t.nilai}
                onClick={() => { kirimBus({ jenis: 'tf', panel: menuTf.id, tf: t.nilai }); setMenuTf(null); }}
                className={cn('flex w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-1.5 text-left text-[11.5px] transition-colors hover:bg-zinc-900',
                  t.nilai === kini ? 'text-emerald-400' : 'text-zinc-300')}>
                {t.label}
                <span className="angka text-[10px] text-zinc-600">{t.nilai}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
