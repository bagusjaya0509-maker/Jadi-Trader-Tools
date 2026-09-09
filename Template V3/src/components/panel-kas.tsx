/* ═══════════════════════════════════════════════════════════════════════
   panel-kas.tsx — Catatan Kas di Personal Area
   ═══════════════════════════════════════════════════════════════════════
   Diminta pemilik 9 Sep 2026: catatan pemasukan & pengeluaran per bulan
   dengan kategori, plus "catat otomatis" — ketik seperti chat ("beli kopi
   25rb") dan barisnya jadi sendiri. Kotak yang sama itulah yang dipakai
   bot Telegram; pengurainya satu (urai-kas.ts), jadi hasilnya sama.

   Yang sengaja TIDAK ada di sini: grafik bulanan bertumpuk. Untuk catatan
   kas, tabel yang bisa dipindai per baris lebih jujur daripada kurva —
   orang mencari "kemarin bayar apa", bukan tren. Ringkasan per kategori
   sudah cukup untuk melihat ke mana uangnya pergi.
   ═══════════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus, Send, Trash2, Wand2, Link2, Unlink, Check } from 'lucide-react';
import { Panel, PanelHead, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import {
  useKas, useTautanTelegram, mintaKodeTelegram, lepasTelegram, ringkasBulan, kunciBulan, geserBulan, namaBulan,
  uraiBanyak, rupiahKas, KATEGORI_KELUAR, KATEGORI_MASUK, type BarisKas, type JenisKas, type KodeTelegram,
} from '@/lib/kas';

const AKUN = ['Bank', 'E-Wallet', 'Tunai', 'Kripto', 'Sekuritas', 'Emas'];

function tanggalPendek(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/* ── Isian angka dengan draf teks ─────────────────────────────────────
   Pola yang sama dengan tiket order: yang diketik disimpan sebagai teks,
   dan baru jadi angka saat dipakai. Kalau langsung jadi angka, "25000"
   tidak bisa diketik karena "2" sudah tersimpan lalu ditulis ulang. */
function IsianRupiah({ nilai, atur, placeholder }: { nilai: number | ''; atur: (n: number | '') => void; placeholder?: string }) {
  const [draf, setDraf] = useState(nilai === '' ? '' : String(nilai));
  useEffect(() => { setDraf(nilai === '' ? '' : String(nilai)); }, [nilai]);
  return (
    <input value={draf} inputMode="numeric" placeholder={placeholder}
           onChange={(e) => {
             const t = e.target.value.replace(/[^\d.,]/g, '');
             setDraf(t);
             const n = Number(t.replace(/\./g, '').replace(',', '.'));
             atur(t && Number.isFinite(n) ? Math.round(n) : '');
           }}
           className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
  );
}

export function PanelKas() {
  const { daftar, memuat, galat, siap, tambah, hapus } = useKas();
  const [bulan, setBulan] = useState(kunciBulan());
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const ringkas = useMemo(() => ringkasBulan(daftar, bulan), [daftar, bulan]);
  const bulanIni = kunciBulan();

  /* ── Catat otomatis ─────────────────────────────────────────────── */
  const [teks, setTeks] = useState('');
  const pratinjau = useMemo(() => (teks.trim() ? uraiBanyak(teks) : null), [teks]);
  const kotak = useRef<HTMLTextAreaElement>(null);

  const jalankan = async (kerja: () => Promise<unknown>, sukses: string) => {
    setSibuk(true); setPesan(null);
    try { await kerja(); setPesan(sukses); }
    catch (e) { setPesan((e as Error).message || 'Gagal menyimpan.'); }
    finally { setSibuk(false); setTimeout(() => setPesan(null), 4000); }
  };

  const catatOtomatis = () => {
    if (!pratinjau || !pratinjau.hasil.length) return;
    const baris = pratinjau.hasil.map((h) => ({
      jenis: h.jenis, jumlah: h.jumlah, kategori: h.kategori, judul: h.judul, tanggal: h.tanggal,
      akun: h.akun, dicatat: 'otomatis' as const,
    }));
    /* Teks aslinya ikut disimpan per baris kalau cuma satu — untuk banyak
       baris, teks gabungannya tidak menjelaskan baris mana pun. */
    if (baris.length === 1) (baris[0] as Partial<BarisKas>).teks = teks.trim();
    void jalankan(async () => { await tambah(baris); setTeks(''); kotak.current?.focus(); },
      baris.length === 1 ? 'Tercatat.' : `${baris.length} baris tercatat.`);
  };

  /* ── Tambah manual ──────────────────────────────────────────────── */
  const [manualBuka, setManualBuka] = useState(false);
  const [mJenis, setMJenis] = useState<JenisKas>('keluar');
  const [mJumlah, setMJumlah] = useState<number | ''>('');
  const [mKategori, setMKategori] = useState('');
  const [mJudul, setMJudul] = useState('');
  const [mTanggal, setMTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [mAkun, setMAkun] = useState('');
  const kategoriPilihan = mJenis === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR;

  const catatManual = () => {
    if (mJumlah === '' || mJumlah <= 0) { setPesan('Isi jumlahnya dulu.'); return; }
    void jalankan(async () => {
      await tambah([{ jenis: mJenis, jumlah: mJumlah, kategori: mKategori || 'Lainnya', judul: mJudul, tanggal: mTanggal, akun: mAkun || undefined, dicatat: 'manual' }]);
      setMJumlah(''); setMJudul('');
    }, 'Tercatat.');
  };

  const daftarBulan = useMemo(
    () => [...ringkas.isi].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id.localeCompare(a.id)),
    [ringkas.isi]
  );
  const totalKeluar = ringkas.keluar || 1;

  return (
    <Panel className="p-4 sm:p-5">
      <PanelHead
        judul="Catatan Kas"
        sub="Pemasukan dan pengeluaran per bulan. Ketik seperti chat, barisnya jadi sendiri."
        kanan={
          <div className="flex items-center gap-1 text-[12.5px]">
            <button onClick={() => setBulan(geserBulan(bulan, -1))} aria-label="Bulan sebelumnya"
                    className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><ChevronLeft className="size-4" /></button>
            <span className="min-w-[8.5rem] text-center font-medium text-zinc-200">{namaBulan(bulan)}</span>
            <button onClick={() => setBulan(geserBulan(bulan, 1))} disabled={bulan >= bulanIni} aria-label="Bulan berikutnya"
                    className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-default disabled:opacity-30"><ChevronRight className="size-4" /></button>
          </div>
        }
      />

      {/* Tiga angka bulan ini */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Masuk', nilai: ringkas.masuk, warna: 'text-emerald-400' },
          { label: 'Keluar', nilai: ringkas.keluar, warna: 'text-red-400' },
          { label: 'Selisih', nilai: ringkas.selisih, warna: ringkas.selisih >= 0 ? 'text-zinc-100' : 'text-red-400' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">{k.label}</div>
            <div className={cn('angka mt-0.5 text-[15px] font-semibold sm:text-[17px]', k.warna)}>
              {k.nilai < 0 ? '−' : ''}{rupiahKas(Math.abs(k.nilai))}
            </div>
          </div>
        ))}
      </div>

      {/* Catat otomatis */}
      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-zinc-200">
          <Wand2 className="size-3.5 text-amber-300" /> Catat otomatis
          <span className="font-normal text-zinc-500">— contoh: <span className="text-zinc-400">beli kopi 25rb</span>, <span className="text-zinc-400">gaji masuk 5jt</span>, <span className="text-zinc-400">bayar listrik 350.000 bca kemarin</span></span>
        </div>
        <div className="flex gap-2">
          <textarea ref={kotak} value={teks} rows={1} placeholder="Ketik di sini, Enter untuk mencatat. Beberapa baris sekaligus juga bisa."
                    onChange={(e) => setTeks(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); catatOtomatis(); } }}
                    className="min-h-[38px] flex-1 resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
          <button onClick={catatOtomatis} disabled={sibuk || !pratinjau?.hasil.length || !siap}
                  className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-md bg-zinc-100 px-3 py-2 text-[12.5px] font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-default disabled:opacity-40">
            {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Catat
          </button>
        </div>
        {pratinjau && (
          <div className="mt-2 space-y-1">
            {pratinjau.hasil.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', h.jenis === 'masuk' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                  {h.jenis === 'masuk' ? 'Masuk' : 'Keluar'}
                </span>
                <span className="angka font-semibold text-zinc-100">{rupiahKas(h.jumlah)}</span>
                <span className="text-zinc-400">{h.kategori}</span>
                <span className="text-zinc-500">· {h.judul}</span>
                <span className="text-zinc-500">· {tanggalPendek(h.tanggal)}</span>
                {h.akun && <span className="text-zinc-500">· dari {h.akun}</span>}
                {h.tebakanRibu && <span className="text-amber-300/90">· angkanya dibaca ribuan — tulis “rb” atau “000” kalau maksudnya lain</span>}
              </div>
            ))}
            {pratinjau.gagal.map((g, i) => (
              <div key={'g' + i} className="text-[12px] text-amber-300/90">Belum terbaca jumlahnya: “{g}” — tambahkan angkanya, mis. “25rb”.</div>
            ))}
            {!siap && pratinjau.hasil.length > 0 && <div className="text-[12px] text-zinc-500">Masuk dulu untuk menyimpan.</div>}
          </div>
        )}
      </div>

      {/* Per kategori + daftar */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <div className="mb-2 text-[12px] font-medium text-zinc-400">Pengeluaran per kategori</div>
          {ringkas.kategoriKeluar.length === 0 ? (
            <div className="text-[12.5px] text-zinc-600">Belum ada pengeluaran tercatat bulan ini.</div>
          ) : (
            <ul className="space-y-1.5">
              {ringkas.kategoriKeluar.slice(0, 8).map((k) => (
                <li key={k.nama}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-zinc-300">{k.nama}</span>
                    <span className="angka text-zinc-400">{rupiahKas(k.nilai)} <span className="text-zinc-600">· {Math.round((k.nilai / totalKeluar) * 100)}%</span></span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-red-400/70" style={{ width: `${Math.max(2, (k.nilai / totalKeluar) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {ringkas.kategoriMasuk.length > 0 && (
            <>
              <div className="mb-2 mt-4 text-[12px] font-medium text-zinc-400">Pemasukan per kategori</div>
              <ul className="space-y-1 text-[12.5px]">
                {ringkas.kategoriMasuk.slice(0, 6).map((k) => (
                  <li key={k.nama} className="flex items-center justify-between">
                    <span className="text-zinc-300">{k.nama}</span>
                    <span className="angka text-emerald-400">{rupiahKas(k.nilai)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <TautanTelegramKartu />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12px] font-medium text-zinc-400">{daftarBulan.length} catatan · {namaBulan(bulan)}</div>
            <button onClick={() => setManualBuka((v) => !v)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-800">
              <Plus className="size-3.5" /> Tambah manual
            </button>
          </div>

          {manualBuka && (
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 sm:grid-cols-3">
              <div className="col-span-2 flex gap-1 sm:col-span-3">
                {(['keluar', 'masuk'] as JenisKas[]).map((j) => (
                  <button key={j} onClick={() => { setMJenis(j); setMKategori(''); }}
                          className={cn('cursor-pointer rounded-md px-3 py-1 text-[12px] font-medium transition-colors',
                            mJenis === j ? (j === 'masuk' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300') : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200')}>
                    {j === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}
                  </button>
                ))}
              </div>
              <label className="text-[11.5px] text-zinc-500">Jumlah (Rp)<IsianRupiah nilai={mJumlah} atur={setMJumlah} placeholder="25000" /></label>
              <label className="text-[11.5px] text-zinc-500">Kategori
                <input list="kategoriKas" value={mKategori} onChange={(e) => setMKategori(e.target.value)} placeholder="Pilih atau ketik"
                       className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
                <datalist id="kategoriKas">{kategoriPilihan.map((k) => <option key={k} value={k} />)}</datalist>
              </label>
              <label className="text-[11.5px] text-zinc-500">Tanggal
                <input type="date" value={mTanggal} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setMTanggal(e.target.value)}
                       className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-600" />
              </label>
              <label className="text-[11.5px] text-zinc-500">Dari / ke
                <select value={mAkun} onChange={(e) => setMAkun(e.target.value)}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-zinc-600">
                  <option value="">—</option>{AKUN.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-[11.5px] text-zinc-500 sm:col-span-2">Keterangan
                <input value={mJudul} onChange={(e) => setMJudul(e.target.value)} placeholder="mis. Kopi pagi" maxLength={120}
                       onKeyDown={(e) => { if (e.key === 'Enter') catatManual(); }}
                       className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
              </label>
              <div className="col-span-2 flex items-end sm:col-span-3">
                <button onClick={catatManual} disabled={sibuk || !siap}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12.5px] font-medium text-zinc-900 hover:bg-white disabled:opacity-40">
                  <Plus className="size-3.5" /> Catat
                </button>
              </div>
            </div>
          )}

          {memuat ? (
            <div className="flex items-center gap-2 py-6 text-[12.5px] text-zinc-500"><Loader2 className="size-3.5 animate-spin" /> Memuat catatan…</div>
          ) : galat ? (
            <div className="py-4 text-[12.5px] text-red-400">Gagal memuat: {galat}</div>
          ) : daftarBulan.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center text-[12.5px] text-zinc-500">
              {siap ? 'Belum ada catatan di bulan ini. Ketik di kotak “Catat otomatis” di atas.' : 'Masuk untuk mulai mencatat — kotak di atas sudah bisa dicoba tanpa login.'}
            </div>
          ) : (
            <TabelBungkus className="max-h-[420px] overflow-y-auto">
              <Tabel>
                <thead><Tr><Th>Tgl</Th><Th>Keterangan</Th><Th>Kategori</Th><Th className="text-right">Jumlah</Th><Th /></Tr></thead>
                <tbody>
                  {daftarBulan.map((b) => (
                    <Tr key={b.id}>
                      <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(b.tanggal)}</Td>
                      <Td className="text-zinc-200">
                        {b.judul}
                        {b.akun && <span className="ml-1.5 text-[11px] text-zinc-600">{b.akun}</span>}
                        {b.dicatat === 'telegram' && <span className="ml-1.5 text-[10.5px] text-sky-300/80">via Telegram</span>}
                      </Td>
                      <Td className="text-zinc-400">{b.kategori}</Td>
                      <Td className={cn('angka whitespace-nowrap text-right', b.jenis === 'masuk' ? 'text-emerald-400' : 'text-red-400')}>
                        {b.jenis === 'masuk' ? '+' : '−'}{rupiahKas(b.jumlah)}
                      </Td>
                      <Td className="w-8 text-right">
                        <button onClick={() => { if (confirm(`Hapus “${b.judul}” (${rupiahKas(b.jumlah)})?`)) void jalankan(() => hapus(b.id), 'Dihapus.'); }}
                                disabled={sibuk} aria-label={`Hapus ${b.judul}`}
                                className="cursor-pointer rounded p-1 text-zinc-700 transition-colors hover:bg-zinc-800 hover:text-red-400">
                          <Trash2 className="size-3.5" />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabel>
            </TabelBungkus>
          )}
        </div>
      </div>

      {pesan && <div className="mt-3 text-[12.5px] text-zinc-400">{pesan}</div>}
    </Panel>
  );
}

/* ── Kartu tautan Telegram ───────────────────────────────────────────── */
function TautanTelegramKartu() {
  const { tautan, memuat } = useTautanTelegram();
  const [kode, setKode] = useState<KodeTelegram | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sisa, setSisa] = useState(0);

  useEffect(() => {
    if (!kode) return;
    setSisa(kode.berlakuDetik);
    const j = setInterval(() => setSisa((s) => { if (s <= 1) { clearInterval(j); setKode(null); return 0; } return s - 1; }), 1000);
    return () => clearInterval(j);
  }, [kode]);
  /* Begitu tersambung, kode tidak relevan lagi. */
  useEffect(() => { if (tautan) setKode(null); }, [tautan]);

  const minta = async () => {
    setSibuk(true); setGalat(null);
    try { setKode(await mintaKodeTelegram()); }
    catch (e) { setGalat((e as Error).message); }
    finally { setSibuk(false); }
  };
  const lepas = async () => {
    if (!confirm('Lepas sambungan Telegram? Pesan ke bot tidak akan tercatat lagi.')) return;
    setSibuk(true); setGalat(null);
    try { await lepasTelegram(); } catch (e) { setGalat((e as Error).message); } finally { setSibuk(false); }
  };

  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-200">
        <Send className="size-3.5 text-sky-300" /> Catat lewat Telegram
      </div>
      {memuat ? null : tautan ? (
        <div className="mt-2 text-[12.5px] text-zinc-400">
          <div className="flex items-center gap-1.5 text-emerald-400"><Check className="size-3.5" /> Tersambung{tautan.nama ? ` sebagai ${tautan.nama}` : ''}.</div>
          <div className="mt-1">Kirim pesan seperti <span className="text-zinc-300">beli kopi 25rb</span> ke bot — tercatat di sini. Balas <span className="text-zinc-300">/batal</span> untuk menghapus yang terakhir, <span className="text-zinc-300">/bulan</span> untuk ringkasan.</div>
          <button onClick={lepas} disabled={sibuk} className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[12px] text-zinc-500 hover:text-red-400">
            <Unlink className="size-3.5" /> Lepas sambungan
          </button>
        </div>
      ) : kode ? (
        <div className="mt-2 text-[12.5px] text-zinc-400">
          <div>Buka bot lalu tekan <b className="text-zinc-200">Start</b>. Kode ini berlaku {Math.floor(sisa / 60)}:{String(sisa % 60).padStart(2, '0')} lagi.</div>
          <a href={kode.tautan} target="_blank" rel="noopener noreferrer"
             className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 px-3 py-1.5 text-[12.5px] font-medium text-sky-300 hover:bg-sky-500/25">
            <Link2 className="size-3.5" /> Buka @{kode.bot}
          </a>
          <div className="mt-2 text-zinc-500">Kalau tombolnya tidak jalan, kirim ke bot: <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">/hubungkan {kode.kode}</code></div>
          <div className="mt-1 flex items-center gap-1.5 text-zinc-600"><Loader2 className="size-3 animate-spin" /> Menunggu sambungan…</div>
        </div>
      ) : (
        <div className="mt-2 text-[12.5px] text-zinc-400">
          <div>Ketik pengeluaranmu di Telegram, tercatat di sini tanpa buka aplikasi.</div>
          <button onClick={minta} disabled={sibuk}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-[12.5px] font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">
            {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />} Sambungkan Telegram
          </button>
        </div>
      )}
      {galat && <div className="mt-2 text-[12px] text-red-400">{galat}</div>}
    </div>
  );
}
