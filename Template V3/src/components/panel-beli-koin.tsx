import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, Wallet, TriangleAlert, ExternalLink, ArrowDown, ShieldAlert } from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { adaDompet, alamatTersambung, sambungDompet } from '@/lib/dex-dompet';
import {
  kutip, beli, koinGas, tautanTx, jaringanDidukung, SLIP_BAWAAN,
  adaDompetSol, alamatSolTersambung, sambungSol,
  type Kutipan,
} from '@/lib/dex-swap';
import type { KoinPantau, FaktaAman } from '@/lib/coin-listing';

/* ════════════════════════════════════════════════════════════════════════
   BELI KOIN — tukar koin gas jaringannya dengan token yang sedang dipantau
   ════════════════════════════════════════════════════════════════════════
   Panel ini duduk di Coin Hunter dan bukan di Chart & Entry, dan itu
   keputusan yang disengaja. Coin Hunter adalah satu-satunya tempat di situs
   ini yang berurusan dengan koin yang BELUM ada di bursa mana pun — yang
   cuma punya alamat kontrak dan sebuah kolam yang baru lahir. Panel beli
   yang menempel di sana menjawab pertanyaan yang memang muncul di sana:
   "sudah listing, sekarang belinya di mana?"

   Menaruhnya di Chart & Entry akan membuatnya bertetangga dengan panel order
   Hyperliquid, dan dua panel bersebelahan yang satu punya SL/TP sementara
   yang lain tidak adalah undangan untuk salah menekan. Jaraknya dijaga.

   ── APA YANG PANEL INI TIDAK PUNYA, DAN KENAPA ITU DITULIS BESAR ─────────
   Tidak ada leverage, tidak ada SL, tidak ada TP, tidak ada likuidasi.
   Sesudah tombolnya ditekan, tokennya ada di dompet dan tidak ada satu pun
   mekanisme di situs ini yang akan menjualnya kembali — tidak saat harganya
   jatuh, tidak juga saat harganya naik.

   Itu ditulis di dalam panel, bukan di dokumentasi. Orang yang sehari-hari
   memakai panel order berpelindung akan membawa kebiasaannya ke sini, dan
   kebiasaan yang salah tempat paling murah dikoreksi tepat sebelum tombol.
   ════════════════════════════════════════════════════════════════════════ */

/** Nominal cepat per koin gas. Angkanya dipilih supaya nilai dolarnya
 *  sekitar $10–$150 pada harga wajar — cukup untuk mencoba, tidak cukup
 *  untuk menyakitkan kalau tokennya ternyata sampah. */
const CEPAT: Record<string, number[]> = {
  SOL: [0.05, 0.25, 1],
  ETH: [0.005, 0.02, 0.05],
  BNB: [0.02, 0.1, 0.25],
  POL: [20, 100, 300],
};

export function PanelBeliKoin({ koin, onTutup }: { koin: KoinPantau; onTutup: () => void }) {
  const pola: 'evm' | 'sol' = koin.jaringan === 'solana' ? 'sol' : 'evm';
  const gas = koinGas(koin.jaringan);
  const didukung = jaringanDidukung(koin.jaringan);

  const [dompet, setDompet] = useState('');
  const [teks, setTeks] = useState('');
  const [kuota, setKuota] = useState<Kutipan | null>(null);
  const [ambil, setAmbil] = useState(false);
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState('');
  const [tx, setTx] = useState('');
  const [sadar, setSadar] = useState(false);

  const jumlah = Number(teks.replace(',', '.'));
  const sah = Number.isFinite(jumlah) && jumlah > 0;

  /* Alamat yang SUDAH dipercaya, tanpa popup. Sama alasannya dengan
     `alamatTersambung` di dex-dompet.ts: halaman yang memunculkan popup
     begitu dibuka mengajari orang menekan "tolak" secara refleks. */
  useEffect(() => {
    let batal = false;
    void (pola === 'sol' ? alamatSolTersambung() : alamatTersambung())
      .then((a) => { if (!batal && a) setDompet(a); });
    return () => { batal = true; };
  }, [pola]);

  const sambung = async () => {
    setGalat('');
    try { setDompet(pola === 'sol' ? await sambungSol() : await sambungDompet()); }
    catch (e: any) { setGalat(pesan(e)); }
  };

  /* ── Kutipan otomatis, tapi TIDAK tiap ketukan ──────────────────────────
     500 ms sesudah ketikan terakhir. Dua sebab: agregatornya tidak perlu
     dihujani permintaan untuk angka setengah jadi, dan angka "kamu dapat
     sekian" yang berubah tiap huruf terbaca sebagai layar yang gelisah,
     bukan sebagai harga.

     `urutan` memutus balapan: kutipan lama yang datang terlambat tidak boleh
     menimpa kutipan baru — itu memasang angka yang tidak sesuai isian yang
     sedang terlihat, tepat pada layar tempat orang menekan Beli. */
  const urutan = useRef(0);
  const mintaKutipan = useCallback(async (n: number, alamatDompet: string) => {
    const ku = ++urutan.current;
    setAmbil(true); setGalat('');
    try {
      const k = await kutip({ jaringan: koin.jaringan, alamat: koin.alamat, dompet: alamatDompet, bayar: n });
      if (urutan.current === ku) { setKuota(k); setAmbil(false); }
    } catch (e: any) {
      if (urutan.current === ku) { setKuota(null); setGalat(pesan(e)); setAmbil(false); }
    }
  }, [koin.jaringan, koin.alamat]);

  useEffect(() => {
    if (!sah || !dompet || !didukung || tx) { setKuota(null); return; }
    const t = setTimeout(() => void mintaKutipan(jumlah, dompet), 500);
    return () => clearTimeout(t);
  }, [jumlah, sah, dompet, didukung, tx, mintaKutipan]);

  const kirimBeli = async () => {
    if (!kuota || !dompet) return;
    setKirim(true); setGalat('');
    try {
      setTx(await beli(kuota, dompet));
    } catch (e: any) {
      setGalat(pesan(e));
    } finally {
      setKirim(false);
    }
  };

  const bahaya = bacaBahaya(koin.aman);

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1">
          <h3 className="text-[13.5px] font-semibold text-zinc-100">
            Beli {koin.simbol || koin.nama || 'koin'}
          </h3>
          <p className="mt-0.5 text-[11.5px] text-zinc-500">
            Tukar {gas || 'koin gas'} dari dompetmu langsung di DEX. Tanpa perantara.
          </p>
        </div>
        <button onClick={onTutup} className="cursor-pointer rounded p-1 text-zinc-500 hover:text-zinc-200">
          <X className="size-4" />
        </button>
      </div>

      {!didukung ? (
        <Kabar warna="amber">
          Jaringan <b>{koin.jaringan}</b> belum didukung panel beli. Yang sudah:
          Solana, Ethereum, BNB Chain, Base, Arbitrum, Polygon.
        </Kabar>
      ) : tx ? (
        /* ── Sesudah terkirim ────────────────────────────────────────────
           Layar hasil MENGGANTI isian, bukan menempel di bawahnya. Isian yang
           masih hidup sesudah transaksi terkirim mengundang tekanan kedua —
           dan tekanan kedua di sini artinya membeli dua kali. */
        <div className="space-y-3">
          <Kabar warna="emerald">
            Transaksi terkirim. Token masuk ke dompet begitu ia masuk blok —
            biasanya beberapa detik, dan itu di luar kendali situs ini.
          </Kabar>
          <a href={tautanTx(koin.jaringan, tx)} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-[12px] text-sky-400 hover:text-sky-300">
            <ExternalLink className="size-3.5" /> Lihat transaksinya di penjelajah blok
          </a>
          <p className="angka break-all text-[10.5px] text-zinc-600">{tx}</p>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setTx(''); setTeks(''); setKuota(null); setSadar(false); }}
              className="cursor-pointer rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:border-zinc-500">
              Beli lagi
            </button>
            <button onClick={onTutup}
              className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 hover:bg-white">
              Selesai
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* ── Yang tidak dimiliki panel ini ───────────────────────────── */}
          <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
            <p className="text-[11.5px] leading-relaxed text-amber-200/90">
              Ini <b>beli spot di DEX</b>, bukan posisi. Tidak ada leverage, tidak ada SL/TP,
              tidak ada likuidasi — dan tidak ada apa pun di situs ini yang akan menjualnya
              kembali untukmu. Menjual dilakukan sendiri di dompet.
            </p>
          </div>

          {/* ── Fakta keamanan yang sudah dipunya barisnya ──────────────── */}
          {bahaya.length > 0 && (
            <div className="flex gap-2 rounded-md border border-red-500/40 bg-red-500/[0.07] px-3 py-2">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-red-400" />
              <div className="text-[11.5px] leading-relaxed text-red-200/90">
                Pemeriksaan kontrak menemukan: {bahaya.join(', ')}.
                <span className="text-red-200/60"> Bukan berarti pasti penipuan — tapi berarti pemiliknya masih bisa berbuat sesuatu pada tokenmu sesudah kamu membelinya.</span>
              </div>
            </div>
          )}

          {/* ── Dompet ──────────────────────────────────────────────────── */}
          {!dompet ? (
            <div className="space-y-2">
              <button onClick={() => void sambung()}
                disabled={pola === 'sol' ? !adaDompetSol() : !adaDompet()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                <Wallet className="size-4" />
                Sambungkan {pola === 'sol' ? 'Phantom' : 'MetaMask / Rabby'}
              </button>
              {(pola === 'sol' ? !adaDompetSol() : !adaDompet()) && (
                <p className="text-[11px] text-zinc-500">
                  {pola === 'sol'
                    ? 'Tidak ada dompet Solana di peramban ini. Pasang Phantom dulu.'
                    : 'Tidak ada dompet EVM di peramban ini. Pasang MetaMask atau Rabby dulu.'}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <Wallet className="size-3.5 text-emerald-500" />
                <span className="angka truncate">{dompet.slice(0, 8)}…{dompet.slice(-6)}</span>
              </div>

              {/* ── Bayar ───────────────────────────────────────────────── */}
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                  Bayar pakai {gas}
                </span>
                <input value={teks} inputMode="decimal" autoFocus
                  onChange={(e) => setTeks(e.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder={`0 ${gas}`}
                  className="angka w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-[15px] text-zinc-100 outline-none focus:border-zinc-500" />
              </label>

              <div className="flex gap-1.5">
                {(CEPAT[gas] || []).map((n) => (
                  <button key={n} onClick={() => setTeks(String(n))}
                    className="angka cursor-pointer rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
                    {n} {gas}
                  </button>
                ))}
              </div>

              {/* ── Dapat ───────────────────────────────────────────────── */}
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-zinc-600">
                  <ArrowDown className="size-3" /> Kamu dapat
                </div>
                {ambil ? (
                  <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                    <Loader2 className="size-3.5 animate-spin" /> Mencari rute terbaik…
                  </div>
                ) : kuota ? (
                  <div className="space-y-1.5">
                    <div className="angka text-[17px] font-semibold text-zinc-100">
                      {angka(kuota.terima)} <span className="text-[13px] font-normal text-zinc-400">{kuota.simbol}</span>
                    </div>
                    <Baris k="Paling sedikit" v={`${angka(kuota.terimaMin)} ${kuota.simbol}`} />
                    {kuota.bayarUsd != null && <Baris k="Nilai bayar" v={`≈ $${angka(kuota.bayarUsd, 2)}`} />}
                    {kuota.dampak != null && (
                      <Baris k="Dampak harga"
                        v={`${kuota.dampak.toFixed(2)}%`}
                        merah={kuota.dampak > 5} />
                    )}
                    <Baris k="Lewat" v={kuota.rute} />
                    <Baris k="Toleransi geser" v={`${SLIP_BAWAAN / 100}%`} />
                  </div>
                ) : (
                  <p className="text-[12px] text-zinc-600">
                    {sah ? '—' : `Isi jumlah ${gas} dulu.`}
                  </p>
                )}
              </div>

              {kuota && kuota.dampak != null && kuota.dampak > 10 && (
                <Kabar warna="red">
                  Dampak harga {kuota.dampak.toFixed(1)}% — kolamnya terlalu dangkal untuk
                  jumlah sebesar ini. Kecilkan nominalnya, atau harga belimu jauh di atas
                  harga pasar begitu transaksinya masuk.
                </Kabar>
              )}

              {galat && <Kabar warna="red">{galat}</Kabar>}

              {/* ── Sadar dulu, baru kirim ───────────────────────────────
                  Centang, bukan sekadar tombol. Yang dibeli di sini token
                  yang sering baru berumur jam-jaman, dan uangnya tidak bisa
                  ditarik kembali oleh siapa pun — tidak oleh kami, tidak oleh
                  bursa, tidak oleh siapa-siapa. Satu detik jeda yang dipaksa
                  adalah harga yang pantas untuk itu. */}
              <label className="flex cursor-pointer items-start gap-2 text-[11.5px] leading-relaxed text-zinc-400">
                <input type="checkbox" checked={sadar} onChange={(e) => setSadar(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-emerald-500" />
                Saya paham uang ini tidak bisa ditarik kembali dan token ini bisa jatuh ke nol.
              </label>

              <button onClick={() => void kirimBeli()}
                disabled={!kuota || kirim || !sadar || ambil}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                {kirim ? <Loader2 className="size-4 animate-spin" /> : null}
                {kirim ? 'Menunggu dompet…' : `Beli ${kuota?.simbol || koin.simbol || ''}`.trim()}
              </button>

              <p className="text-[10.5px] leading-relaxed text-zinc-600">
                Yang menandatangani dompetmu sendiri. Situs ini cuma menyiapkan
                transaksinya — kunci pribadimu tidak pernah lewat sini, dan tidak
                pernah kami minta.
              </p>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ── Bagian kecil ──────────────────────────────────────────────────────── */

function Baris({ k, v, merah }: { k: string; v: string; merah?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
      <span className="text-zinc-600">{k}</span>
      <span className={cn('angka truncate text-right', merah ? 'text-red-400' : 'text-zinc-400')}>{v}</span>
    </div>
  );
}

function Kabar({ warna, children }: { warna: 'red' | 'amber' | 'emerald'; children: React.ReactNode }) {
  const kelas = warna === 'red' ? 'border-red-500/40 bg-red-500/[0.07] text-red-200/90'
    : warna === 'amber' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-200/90'
      : 'border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-200/90';
  return (
    <div className={cn('rounded-md border px-3 py-2 text-[11.5px] leading-relaxed', kelas)}>
      {children}
    </div>
  );
}

/** Hanya yang benar-benar bisa merugikan SESUDAH membeli. `terpusat` tinggi
 *  dan `pemegang` sedikit sengaja TIDAK masuk: keduanya wajar untuk token
 *  yang baru lahir, dan peringatan yang menyala di semua kasus normal adalah
 *  peringatan yang berhenti dibaca. */
function bacaBahaya(a: FaktaAman | undefined): string[] {
  if (!a || a.kosong) return [];
  const d: string[] = [];
  if (a.bisaCetak) d.push('pasokan masih bisa dicetak');
  if (a.bisaBekukan) d.push('saldo bisa dibekukan');
  if (a.bisaDiubah) d.push('kontraknya masih bisa diubah');
  if ((a.pajakJual ?? 0) > 10) d.push(`pajak jual ${a.pajakJual}%`);
  if ((a.pajakBeli ?? 0) > 10) d.push(`pajak beli ${a.pajakBeli}%`);
  return d;
}

function angka(n: number, des?: number): string {
  if (!Number.isFinite(n)) return '—';
  if (des != null) return n.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des });
  /* Jumlah token bisa 12 juta atau 0,00004 — satu aturan desimal tidak
     melayani keduanya. Yang besar tidak butuh desimal, yang kecil tidak
     berarti apa-apa tanpa desimal. */
  if (n >= 1000) return n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('id-ID', { maximumFractionDigits: 4 });
  return n.toLocaleString('id-ID', { maximumFractionDigits: 8 });
}

function pesan(e: unknown): string {
  const m = (e as any)?.message || String(e);
  /* 4001 = penggunanya menekan "tolak" di dompet. Itu bukan kegagalan dan
     tidak layak digambar merah seperti kegagalan. */
  if ((e as any)?.code === 4001 || /user rejected|user denied/i.test(m)) {
    return 'Dibatalkan dari dompet.';
  }
  return m;
}
