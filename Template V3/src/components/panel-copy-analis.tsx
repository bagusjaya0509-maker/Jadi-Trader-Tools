import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, TriangleAlert, CircleCheck, Plug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, uang } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useAkunMt5 } from '@/lib/akun';
import {
  kontrakBawaan, kontrakBerlaku, deteksiJenisAkun, lotUntukCopy,
} from '@/lib/ukuran-posisi';
import {
  bacaLangganan, simpanLangganan, hapusLangganan, type LanggananCopy,
} from '@/lib/copy-langganan';

/* ════════════════════════════════════════════════════════════════════════
   COPY SIGNAL — BERLANGGANAN KE SEORANG ANALIS (Trade-Fi)
   ════════════════════════════════════════════════════════════════════════
   Dibuka SEBELUM ada sinyal yang jalan, dan itu memang tempatnya: ukuran
   posisi harus ditetapkan selagi kepala dingin, bukan saat sinyal baru
   terbit dan tangan sedang buru-buru.

   ── SATU PERTANYAAN, BUKAN ENAM ─────────────────────────────────────────
   Versi sebelumnya menanyakan modal, persen risiko, lot tetap, ukuran
   kontrak, jenis akun, dan jarak SL acuan. Lima dari enam itu sudah
   dipegang aplikasi atau bisa diturunkan:

     modal        -> saldo akun brokernya, sudah terbaca
     jenis akun   -> dari mata uang terminal (USC/cent), sudah terbaca
     kontrak      -> dari simbol yang dipakai analisnya
     jarak SL     -> dari sinyalnya sendiri, saat ia terbit
     lot          -> HASIL, bukan masukan

   Yang tersisa satu: berapa paling banyak boleh rugi per trade. Itu
   satu-satunya angka yang cuma orangnya sendiri tahu.

   Menanyakan hal yang sudah dipegang aplikasi bukan cuma merepotkan — ia
   membuka jalan untuk jawaban yang SALAH. Salah pilih jenis akun menggeser
   ukuran posisi seratus kali lipat, dan itu kesalahan yang tidak bisa
   ditarik kembali sesudah ordernya masuk.
   ════════════════════════════════════════════════════════════════════════ */

const ISIAN = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-zinc-600';

/** Contoh jarak SL — untuk memperlihatkan akibat angka yang baru diketik.
 *  Panel ini dibuka saat belum ada sinyal, jadi tanpa contoh kolom lotnya
 *  cuma bisa bertuliskan "—", dan panel yang tidak bisa menunjukkan akibat
 *  dari masukannya tidak menolong siapa pun memutuskan. */
const CONTOH_JARAK = [
  { label: 'SL 20 poin', harga: 2 },
  { label: 'SL 50 poin', harga: 5 },
  { label: 'SL 100 poin', harga: 10 },
];

export function PanelCopyAnalis({ analisUid, analisNama, contohPasangan, tutup }: {
  analisUid: string;
  analisNama: string;
  contohPasangan?: string;
  tutup: () => void;
}) {
  const { pengguna } = useAuth();
  const akun = useAkunMt5();

  /* DOLAR atau PERSEN — satu angka, dua satuan. Yang dirasakan orang saat
     posisinya merah adalah dolar; yang dipakai orang menyusun aturan
     biasanya persen. Memaksa salah satunya berarti separuh orang harus
     mengalikan di kepalanya sebelum bisa menjawab. */
  const [satuan, setSatuan] = useState<'usd' | 'persen'>('usd');
  const [nilai, setNilai] = useState(1);
  const [langganan, setLangganan] = useState<LanggananCopy | null>(null);
  const [kabar, setKabar] = useState('');

  const jenisAkun = deteksiJenisAkun(akun.mataUang);
  const saldo = akun.saldo ?? 0;
  const kontrak = kontrakBawaan(contohPasangan || 'XAUUSD');
  const kontrakEfektif = kontrakBerlaku(kontrak, jenisAkun);

  /* Persen SELALU dari saldo yang benar-benar ada, bukan modal karangan.
     Itu yang membuat kolom modal bisa dicabut sama sekali. */
  const rugiMaks = satuan === 'usd'
    ? nilai
    : Math.round(saldo * (nilai / 100) * 100) / 100;

  useEffect(() => {
    const l = bacaLangganan(pengguna?.uid, analisUid);
    setLangganan(l);
    if (l && l.rugiMaks > 0) { setSatuan('usd'); setNilai(l.rugiMaks); }
  }, [pengguna?.uid, analisUid]);

  const contoh = useMemo(() => CONTOH_JARAK.map((c) => ({
    ...c,
    ...lotUntukCopy({ lotDiminta: 0, rugiMaks, kontrak: kontrakEfektif, jarakHarga: c.harga }),
  })), [rugiMaks, kontrakEfektif]);

  const belumLogin = !pengguna;
  const belumTerhubung = akun.terhubung === false;

  function simpan() {
    if (belumLogin || !(rugiMaks > 0)) return;
    const isi: LanggananCopy = {
      analisUid, analisNama,
      mode: 'risiko', lotTetap: 0.01,
      rugiMaks,
      modal: saldo, risiko: saldo > 0 ? (rugiMaks / saldo) * 100 : 0,
      kontrak, jenisAkun,
      sejak: langganan?.sejak ?? Date.now(),
    };
    simpanLangganan(pengguna!.uid, isi);
    setLangganan(isi);
    setKabar(`Tersimpan. Tiap sinyal ${analisNama} disalin dengan rugi dibatasi ${uang(rugiMaks)}.`);
  }

  function batal() {
    if (!pengguna) return;
    hapusLangganan(pengguna.uid, analisUid);
    setLangganan(null);
    setKabar('Berhenti mengikuti. Tidak ada sinyal analis ini yang akan disalin.');
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={tutup}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
           className="relative flex max-h-[88vh] w-full max-w-[380px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <Copy className="size-4 text-zinc-400" strokeWidth={1.8} />
          <span className="text-[13px] font-medium text-zinc-100">Copy Signal</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-zinc-400">
            Trade-Fi
          </span>
          <button onClick={tutup} aria-label="Tutup"
            className="ml-auto cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-200">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* AKUN BROKER paling atas — ukuran posisi tanpa saldo yang
              terlihat adalah tebakan, dan orang yang tidak melihat saldonya
              cenderung memakai angka yang lebih besar dari kenyataan. */}
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <Plug className="size-3" strokeWidth={2} /> Akun broker
            </div>
            {belumTerhubung ? (
              <div className="mt-1.5 text-[11.5px] leading-relaxed text-amber-200">
                Terminal MT5 belum tersambung.{' '}
                <Link to="/integrations" onClick={tutup} className="underline underline-offset-2">
                  Pasang EA di Integrations
                </Link>{' '}
                dulu — tanpa itu tidak ada order yang bisa dikirim ke mana pun.
              </div>
            ) : (
              <>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <Kolom k="Saldo" v={akun.saldo != null ? uang(akun.saldo) : '—'} />
                  <Kolom k="Ekuitas" v={akun.ekuitas != null ? uang(akun.ekuitas) : '—'} />
                  <Kolom k="Akun" v={akun.loginAktif || '—'} />
                </div>
                {/* DIBACA, bukan ditanyakan. Ditulis apa adanya supaya bisa
                    diperiksa — deteksi yang salah menggeser ukuran posisi
                    seratus kali, dan itu harus bisa ketahuan sebelum
                    ordernya masuk, bukan sesudah. */}
                <div className="mt-1.5 text-[10.5px] text-zinc-500">
                  Terbaca sebagai{' '}
                  <span className={jenisAkun === 'cent' ? 'text-amber-300' : 'text-zinc-300'}>
                    akun {jenisAkun}
                  </span>
                  {jenisAkun === 'cent' && ' — 1 lot = 1/100 standar'}
                  {akun.mataUang && <span className="text-zinc-700"> · {akun.mataUang}</span>}
                </div>
              </>
            )}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[11px] text-zinc-500">Mengikuti</span>
            <span className="truncate text-[13px] font-semibold text-zinc-100">{analisNama}</span>
          </div>

          {/* ── SATU-SATUNYA PERTANYAAN ──────────────────────────────── */}
          <div className="mt-3">
            <span className="mb-1.5 block text-[11.5px] text-zinc-300">
              Paling banyak rugi per trade
            </span>
            <div className="flex items-stretch gap-2">
              <input value={nilai} inputMode="decimal"
                onChange={(e) => setNilai(Math.max(0, Number(e.target.value) || 0))}
                className={cn(ISIAN, 'angka')} />
              <div className="flex shrink-0 overflow-hidden rounded-md border border-zinc-800">
                {([['usd', '$'], ['persen', '%']] as const).map(([v, t]) => (
                  <button key={v} onClick={() => setSatuan(v)}
                    className={cn('cursor-pointer px-3 text-[12px] transition-colors',
                      satuan === v ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1.5 text-[10.5px] text-zinc-500">
              {satuan === 'persen'
                ? <>= <span className="angka text-amber-300">{uang(rugiMaks)}</span> dari saldo {uang(saldo)}</>
                : saldo > 0
                  ? <>= <span className="angka text-zinc-300">{((rugiMaks / saldo) * 100).toFixed(2)}%</span> dari saldo {uang(saldo)}</>
                  : 'Saldo belum terbaca — persennya tidak bisa dihitung.'}
            </div>
          </div>

          {/* Akibatnya, dalam lot. Ini yang membuktikan angkanya masuk akal
              sebelum sinyal pertama datang. */}
          <div className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Lot yang akan dipakai · contoh jarak SL
            </div>
            <div className="mt-1.5 space-y-1">
              {contoh.map((c) => (
                <div key={c.label} className="flex items-baseline gap-2 text-[11.5px]">
                  <span className="text-zinc-500">{c.label}</span>
                  <span className="angka ml-auto text-zinc-300">
                    {c.lot > 0 ? c.lot.toFixed(2) + ' lot' : '—'}
                  </span>
                  <span className={cn('angka w-16 text-right', c.rugi > 0 ? 'text-red-400' : 'text-zinc-600')}>
                    {c.rugi > 0 ? '−' + uang(c.rugi) : '—'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
              Lot sebenarnya dihitung dari jarak SL tiap sinyal saat ia terbit. Yang
              tetap: ruginya tidak pernah melewati{' '}
              <span className="angka text-amber-300/90">{uang(rugiMaks)}</span>, seberapa
              lebar pun analis memasang stopnya.
            </div>
          </div>

          <div className={cn('mt-3 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed',
            langganan ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-200'
                      : 'border-zinc-800 bg-zinc-900/30 text-zinc-500')}>
            {langganan ? <CircleCheck className="mt-px size-3.5 shrink-0" />
                       : <TriangleAlert className="mt-px size-3.5 shrink-0" />}
            {langganan
              ? `Terdaftar mengikuti ${analisNama}, rugi dibatasi ${uang(langganan.rugiMaks)} per trade.`
              : 'Belum mengikuti analis ini.'}
          </div>

          <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
            Setelan ini tersimpan untuk akunmu. Penyalinan otomatis saat sinyal baru
            terbit dijalankan pengikut di VPS — bagian itu masih dibangun. Sementara
            ini sinyalnya disalin lewat ikon salin di kartu sinyalnya.
          </p>

          {kabar && <div className="mt-2 text-[11px] text-zinc-400">{kabar}</div>}
        </div>

        <div className="flex gap-2 border-t border-zinc-800 px-4 py-3">
          <button onClick={simpan} disabled={belumLogin || !(rugiMaks > 0)}
            className="flex-1 cursor-pointer rounded-lg bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
            {langganan ? 'Simpan perubahan' : 'Ikuti analis ini'}
          </button>
          {langganan && (
            <button onClick={batal}
              className="cursor-pointer rounded-lg border border-red-500/40 px-3 py-2 text-[12px] font-medium text-red-300 transition-colors hover:bg-red-500/10">
              Batalkan Copy
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Kolom({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wide text-zinc-600">{k}</div>
      <div className="angka truncate text-[12px] text-zinc-200">{v}</div>
    </div>
  );
}
