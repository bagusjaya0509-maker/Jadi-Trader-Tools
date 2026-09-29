import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Memuat } from '@/components/memuat';

/* ════════════════════════════════════════════════════════════════════════
   ORDER BOOK HYPERLIQUID — kolom di kiri watchlist, khusus chart Hyperliquid
   ════════════════════════════════════════════════════════════════════════
   Diminta pemilik 29 Sep 2026, meniru order book di halaman trade
   Hyperliquid.

   ── LANGSUNG DARI PERAMBAN, TIDAK LEWAT VPS ───────────────────────────
   api.hyperliquid.xyz terbuka untuk peramban (CORS `*`, diperiksa 29 Sep),
   dan WebSocket-nya memang tidak kenal CORS. Order book diperbarui beberapa
   kali per detik — melewatkannya lewat VPS 961 MB kita berarti membebani
   server yang baru saja dirampingkan, untuk data yang sama persis.

   ── NAMA KOIN DARI META, BUKAN DARI MEMOTONG "USDT" ────────────────────
   Nama koin Hyperliquid peka huruf: `kPEPE`, bukan `KPEPE`. Simbol chart
   kita ditulis huruf besar semua, jadi koinnya dicocokkan lewat daftar
   `meta` resmi (sekali per sesi) — memotong akhiran saja akan berlangganan
   ke koin yang tidak ada, dan bursanya diam, tidak menolak.

   ── PENGELOMPOKAN HARGA ────────────────────────────────────────────────
   Hyperliquid mengelompokkan di sisi bursa lewat `nSigFigs` (2–5) dan
   `mantissa` (1/2/5, hanya untuk 5). Pilihan di layar dihitung dari harga
   tengah dan `szDecimals` koinnya — ETH ±2.700 menghasilkan 0.1, 0.2, 0.5,
   1, 10, 100, persis pilihan di halaman Hyperliquid.
   ════════════════════════════════════════════════════════════════════════ */

const API = 'https://api.hyperliquid.xyz';
const WS = 'wss://api.hyperliquid.xyz/ws';
const KUNCI_BUKA = 'jt.bukuOrder.buka';
const TINGGI_BARIS = 19;

interface Level { px: number; sz: number }
interface Meta { nama: string; szDec: number }
interface Kelompok { nSigFigs: number | null; mantissa?: number; langkah: number }

/* Satu permintaan meta per sesi, dipakai semua panel. Kegagalan tidak
   disimpan — panel berikutnya mencoba lagi. */
let janjiMeta: Promise<Map<string, Meta>> | null = null;
function ambilMeta(): Promise<Map<string, Meta>> {
  if (!janjiMeta) {
    janjiMeta = fetch(`${API}/info`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        const m = new Map<string, Meta>();
        for (const u of j?.universe ?? []) {
          m.set(String(u.name).toUpperCase() + 'USDT', { nama: String(u.name), szDec: Number(u.szDecimals) || 0 });
        }
        return m;
      })
      .catch((e) => { janjiMeta = null; throw e; });
  }
  return janjiMeta;
}

/** Pilihan pengelompokan dari harga tengah — lihat kepala berkas. Harga
 *  perp Hyperliquid paling banyak 5 angka penting DAN paling banyak
 *  (6 − szDecimals) desimal; langkah terkecil adalah yang lebih besar. */
function daftarKelompok(tengah: number, szDec: number): Kelompok[] {
  if (!(tengah > 0)) return [{ nSigFigs: null, langkah: 0 }];
  const eksp = Math.floor(Math.log10(tengah));
  const sig = (k: number) => Math.pow(10, eksp + 1 - k);
  const asli = Math.max(sig(5), Math.pow(10, -(6 - szDec)));
  const hasil: Kelompok[] = [{ nSigFigs: null, langkah: asli }];
  for (const c of [{ n: 5, m: 2 }, { n: 5, m: 5 }, { n: 4 }, { n: 3 }, { n: 2 }] as { n: number; m?: number }[]) {
    const langkah = sig(c.n) * (c.m ?? 1);
    if (langkah > hasil[hasil.length - 1].langkah * 1.0001) hasil.push({ nSigFigs: c.n, mantissa: c.m, langkah });
  }
  return hasil;
}

function desimalDari(langkah: number): number {
  if (!(langkah > 0)) return 2;
  return Math.max(0, Math.ceil(-Math.log10(langkah) - 1e-9));
}
function angka(v: number, desimal: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });
}
function ringkas(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e4) return (v / 1e3).toFixed(1) + 'K';
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function bacaBuka(): boolean {
  try {
    const v = localStorage.getItem(KUNCI_BUKA);
    if (v !== null) return v === '1';
  } catch { /* privat */ }
  /* Belum pernah memilih: terbuka kalau layarnya cukup lebar untuk chart
     yang tetap layak dibaca sesudah dikurangi 232 px. */
  return typeof window !== 'undefined' && window.innerWidth >= 1100;
}

export function BukuOrderHl({ simbol, tinggi, bisaIsi, onPilihHarga, onLebar }: {
  simbol: string;
  /** Tinggi chart — order book setinggi chart di sebelahnya. */
  tinggi: number;
  /** Tiket BUY/SELL sedang terbuka: klik harga mengisi harga entry-nya. */
  bisaIsi: boolean;
  onPilihHarga: (harga: number) => void;
  /** Lebar kolom ini (232 terbuka, 24 terlipat, 0 saat hilang) — dipakai
   *  ikon multi-chart & setelan di pojok chart supaya tetap di chart, tidak
   *  duduk di atas order book. Angka tetap, bukan hasil ukur. */
  onLebar?: (px: number) => void;
}) {
  const [buka, setBukaState] = useState(bacaBuka);
  const setBuka = (v: boolean) => {
    setBukaState(v);
    try { localStorage.setItem(KUNCI_BUKA, v ? '1' : '0'); } catch { /* privat */ }
  };
  const [meta, setMeta] = useState<Meta | null>(null);
  const [galatMeta, setGalatMeta] = useState('');
  const [buku, setBuku] = useState<{ bid: Level[]; ask: Level[] } | null>(null);
  const [status, setStatus] = useState<'sambung' | 'hidup' | 'tersendat' | 'putus'>('sambung');
  const [iKelompok, setIKelompok] = useState(0);
  const [satuan, setSatuan] = useState<'koin' | 'usd'>('koin');
  const terakhir = useRef(0);
  useEffect(() => { onLebar?.(buka ? 232 : 24); }, [buka, onLebar]);
  useEffect(() => () => onLebar?.(0), [onLebar]);

  /* ── Koin dari meta ─────────────────────────────────────────────────── */
  useEffect(() => {
    let hidup = true;
    setMeta(null); setBuku(null); setIKelompok(0); setGalatMeta('');
    ambilMeta()
      .then((m) => {
        if (!hidup) return;
        const x = m.get(simbol.toUpperCase());
        if (x) setMeta(x); else setGalatMeta(`${simbol} tidak ada di daftar perp Hyperliquid.`);
      })
      .catch(() => { if (hidup) setGalatMeta('Daftar koin Hyperliquid tidak terbaca.'); });
    return () => { hidup = false; };
  }, [simbol]);

  const tengah = buku && buku.bid[0] && buku.ask[0] ? (buku.bid[0].px + buku.ask[0].px) / 2 : 0;
  /* Pilihan dihitung ulang hanya saat ORDE harganya berganti — bukan tiap
     detak. Kalau tiap detak, daftar select-nya dibangun ulang terus. */
  const orde = tengah > 0 ? Math.floor(Math.log10(tengah)) : 0;
  const kelompok = useMemo(
    () => daftarKelompok(tengah > 0 ? Math.pow(10, orde) * 1.5 : 0, meta?.szDec ?? 0),
    [orde, meta?.szDec, tengah > 0]);
  const kel = kelompok[Math.min(iKelompok, kelompok.length - 1)];

  /* ── Langganan WebSocket ─────────────────────────────────────────────
     Mengganti pengelompokan = sambungan baru. Berhenti berlangganan lalu
     berlangganan lagi di sambungan yang sama bisa, tapi pesan dari
     langganan lama yang masih di jalan akan tercampur ke buku baru. */
  useEffect(() => {
    if (!meta || !buka) return;
    let ws: WebSocket | null = null;
    let hidup = true;
    let jeda = 1000;
    let tunda: ReturnType<typeof setTimeout> | undefined;
    let denyut: ReturnType<typeof setInterval> | undefined;
    const langganan: Record<string, unknown> = { type: 'l2Book', coin: meta.nama };
    if (kel?.nSigFigs) langganan.nSigFigs = kel.nSigFigs;
    if (kel?.mantissa) langganan.mantissa = kel.mantissa;

    const sambung = () => {
      setStatus('sambung');
      ws = new WebSocket(WS);
      ws.onopen = () => {
        jeda = 1000;
        ws?.send(JSON.stringify({ method: 'subscribe', subscription: langganan }));
        /* Hyperliquid menutup sambungan yang diam 60 detik. Buku yang
           bergerak mengirim terus, tapi koin sepi bisa hening lebih lama. */
        denyut = setInterval(() => { if (ws?.readyState === 1) ws.send('{"method":"ping"}'); }, 45_000);
      };
      ws.onmessage = (ev) => {
        let m: any;
        try { m = JSON.parse(String(ev.data)); } catch { return; }
        if (m?.channel !== 'l2Book' || m?.data?.coin !== meta.nama) return;
        const [b, a] = m.data.levels ?? [[], []];
        const ubah = (x: any): Level => ({ px: Number(x.px), sz: Number(x.sz) });
        setBuku({ bid: (b ?? []).map(ubah), ask: (a ?? []).map(ubah) });
        terakhir.current = Date.now();
        setStatus('hidup');
      };
      ws.onclose = () => {
        clearInterval(denyut);
        if (!hidup) return;
        setStatus('putus');
        tunda = setTimeout(sambung, jeda);
        jeda = Math.min(jeda * 2, 15_000);
      };
      ws.onerror = () => ws?.close();
    };
    sambung();
    /* Buku yang berhenti bergerak tanpa sambungannya putus: disebut, bukan
       dibiarkan terlihat hidup. */
    const jaga = setInterval(() => {
      if (terakhir.current && Date.now() - terakhir.current > 8000) setStatus((s) => (s === 'hidup' ? 'tersendat' : s));
    }, 2000);
    return () => {
      hidup = false;
      clearTimeout(tunda); clearInterval(denyut); clearInterval(jaga);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [meta, buka, kel?.nSigFigs, kel?.mantissa]);

  if (!buka) {
    return (
      <button onClick={() => setBuka(true)} title="Tampilkan order book Hyperliquid"
        style={{ height: tinggi }}
        className="flex w-6 shrink-0 cursor-pointer flex-col items-center gap-2 border-l border-zinc-800/80 bg-zinc-950 pt-2 text-zinc-500 transition-colors hover:text-zinc-100">
        <ChevronsLeft className="size-3.5" />
        <span className="text-[10.5px] font-medium tracking-wide [writing-mode:vertical-rl]">Order Book</span>
      </button>
    );
  }

  /* ── Hitung baris ───────────────────────────────────────────────────── */
  const n = Math.max(3, Math.min(20, Math.floor((tinggi - 30 - 22 - 28 - 6) / 2 / TINGGI_BARIS)));
  const ask = (buku?.ask ?? []).slice(0, n);
  const bid = (buku?.bid ?? []).slice(0, n);
  const nilai = (l: Level) => (satuan === 'usd' ? l.sz * l.px : l.sz);
  const kumulatif = (xs: Level[]) => { let t = 0; return xs.map((l) => (t += nilai(l))); };
  const kumAsk = kumulatif(ask), kumBid = kumulatif(bid);
  const maks = Math.max(kumAsk[kumAsk.length - 1] ?? 0, kumBid[kumBid.length - 1] ?? 0) || 1;
  const des = desimalDari(kel?.langkah ?? 0);
  const fmtUkuran = (v: number) => (satuan === 'usd' ? ringkas(v) : v.toLocaleString('en-US', { maximumFractionDigits: meta?.szDec ?? 2 }));
  const spread = ask[0] && bid[0] ? ask[0].px - bid[0].px : 0;

  const baris = (l: Level, total: number, sisi: 'ask' | 'bid', i: number) => (
    <button key={sisi + i} type="button" onClick={() => bisaIsi && onPilihHarga(l.px)}
      title={bisaIsi ? `Isi ${angka(l.px, des)} ke harga entry tiket` : 'Buka tiket BUY/SELL untuk memakai harga ini'}
      style={{ height: TINGGI_BARIS }}
      className={cn('relative grid w-full grid-cols-[1fr_1fr_1fr] items-center px-2 text-right text-[11px] tabular-nums',
        bisaIsi ? 'cursor-pointer hover:bg-zinc-800/60' : 'cursor-default')}>
      <span aria-hidden className={cn('absolute inset-y-0 right-0', sisi === 'ask' ? 'bg-red-500/[0.12]' : 'bg-emerald-500/[0.12]')}
            style={{ width: `${Math.min(100, (total / maks) * 100)}%` }} />
      <span className={cn('relative text-left', sisi === 'ask' ? 'text-red-400' : 'text-emerald-400')}>{angka(l.px, des)}</span>
      <span className="relative text-zinc-300">{fmtUkuran(nilai(l))}</span>
      <span className="relative text-zinc-500">{fmtUkuran(total)}</span>
    </button>
  );

  const namaSatuan = satuan === 'usd' ? 'USD' : (meta?.nama ?? '');

  return (
    <div style={{ height: tinggi }}
      className="flex w-[232px] shrink-0 flex-col overflow-hidden border-l border-zinc-800/80 bg-zinc-950">
      {/* Kepala: judul, status, pengelompokan, satuan, lipat */}
      <div className="flex h-[30px] shrink-0 items-center gap-1.5 border-b border-zinc-800/80 px-2">
        <span className={cn('size-1.5 shrink-0 rounded-full',
          status === 'hidup' ? 'bg-emerald-400' : status === 'tersendat' ? 'bg-amber-400' : status === 'putus' ? 'bg-red-400' : 'bg-zinc-600')}
          title={status === 'hidup' ? 'Tersambung langsung ke Hyperliquid' : status === 'tersendat' ? 'Buku tidak bergerak lebih dari 8 detik'
            : status === 'putus' ? 'Sambungan terputus — menyambung ulang' : 'Menyambung…'} />
        <span className="text-[11.5px] font-semibold text-zinc-200">Order Book</span>
        <select value={Math.min(iKelompok, kelompok.length - 1)} onChange={(e) => setIKelompok(Number(e.target.value))}
          title="Kelompokkan harga"
          className="ml-auto h-6 cursor-pointer rounded border border-zinc-800 bg-zinc-900 px-1 text-[10.5px] tabular-nums text-zinc-300 outline-none">
          {kelompok.map((k, i) => (
            <option key={i} value={i}>{k.langkah ? angka(k.langkah, desimalDari(k.langkah)) : '—'}</option>
          ))}
        </select>
        <button onClick={() => setSatuan(satuan === 'koin' ? 'usd' : 'koin')}
          title="Tampilkan ukuran dalam koin atau USD"
          className="h-6 cursor-pointer rounded border border-zinc-800 px-1.5 text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
          {satuan === 'usd' ? 'USD' : (meta?.nama ?? '…')}
        </button>
        <button onClick={() => setBuka(false)} title="Sembunyikan order book"
          className="flex size-6 cursor-pointer items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300">
          <ChevronsRight className="size-3.5" />
        </button>
      </div>

      {galatMeta ? (
        <p className="px-3 py-4 text-[11.5px] leading-relaxed text-zinc-500">{galatMeta}</p>
      ) : !buku ? (
        <Memuat className="min-h-0 flex-1" pesan="Menyambung ke Hyperliquid…" />
      ) : (
        <>
          <div className="grid h-[22px] shrink-0 grid-cols-[1fr_1fr_1fr] items-center px-2 text-right text-[10px] text-zinc-500">
            <span className="text-left">Harga</span>
            <span>Size ({namaSatuan})</span>
            <span>Total</span>
          </div>
          {/* Ask di atas, terbalik: harga terendah menempel ke spread. */}
          <div className="flex min-h-0 flex-1 flex-col justify-end">
            {ask.map((l, i) => ({ l, t: kumAsk[i], i })).reverse().map(({ l, t, i }) => baris(l, t, 'ask', i))}
          </div>
          <div className="flex h-[28px] shrink-0 items-center justify-between border-y border-zinc-800/80 bg-zinc-900/60 px-2 text-[11px] tabular-nums">
            <span className="text-zinc-500">Spread</span>
            <span className="text-zinc-300">{angka(spread, des)}</span>
            <span className="text-zinc-500">{tengah ? ((spread / tengah) * 100).toFixed(3) : '0'}%</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {bid.map((l, i) => baris(l, kumBid[i], 'bid', i))}
          </div>
        </>
      )}
    </div>
  );
}
