import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutGrid, Plus, X, GripVertical, ExternalLink, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMulti, matikanMulti, tambahPanel, hapusPanel, MAKS_PANEL, type PanelMulti,
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

const ALAMAT = (p: PanelMulti) =>
  `/chart-entry?simbol=${encodeURIComponent(p.simbol)}&tf=${encodeURIComponent(p.tf)}&polos=1`;

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

  /* Belahan grid 2 kolom: persen kolom kiri dan baris atas. Disimpan di
     state saja — susunan ruang kerja layak diatur ulang per sesi, dan
     menyimpannya menambah satu kunci localStorage untuk manfaat tipis. */
  const [kolomPct, setKolomPct] = useState(50);
  const [barisPct, setBarisPct] = useState(50);
  const wadahRef = useRef<HTMLDivElement | null>(null);
  const geser = useRef<'' | 'kolom' | 'baris'>('');

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

  const bukaJendela = (p: PanelMulti) => {
    const w = window.open(ALAMAT(p), 'jt-panel-' + p.id, 'popup=yes,width=1100,height=720');
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
    <div className={cn(
      'absolute inset-0 z-30 flex flex-col bg-zinc-950',
      !tampil && 'hidden'
    )}>
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-800/80 px-3">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-200">
          <LayoutGrid className="size-3.5 text-zinc-400" strokeWidth={2} />
          Multi-Chart
          <span className="angka text-[11px] text-zinc-600">{m.panel.length}/{MAKS_PANEL}</span>
        </span>
        <button onClick={tambahPanel} disabled={m.panel.length >= MAKS_PANEL}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-default disabled:opacity-40">
          <Plus className="size-3" /> Tambah chart
        </button>
        <span className="hidden min-w-0 truncate text-[11px] text-zinc-600 lg:block">
          Seret kepala panel untuk menukar posisi · ikon ↗ melepas panel jadi jendela sendiri untuk monitor lain
        </span>
        <button onClick={matikanMulti}
          className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
          <X className="size-3" /> Tutup multi-chart
        </button>
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
              <span className="truncate text-[11px] text-zinc-500">Panel {i + 1} · mulai {p.simbol} {p.tf}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                {!lepas[p.id] && (
                  <button onClick={() => bukaJendela(p)}
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
              <iframe src={ALAMAT(p)} title={`Chart ${p.simbol} ${p.tf}`}
                      allow="clipboard-read; clipboard-write"
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
    </div>
  );
}
