import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, TriangleAlert, CircleCheck, Plug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, uang } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useAkunMt5 } from '@/lib/akun';
import {
  bacaSetelanRisiko, simpanSetelanRisiko, kontrakBawaan,
  hitungUkuran, bulatkanLot, type SetelanRisiko,
} from '@/lib/ukuran-posisi';
import {
  bacaLangganan, simpanLangganan, hapusLangganan, type LanggananCopy,
} from '@/lib/copy-langganan';

/* ════════════════════════════════════════════════════════════════════════
   COPY SIGNAL — BERLANGGANAN KE SEORANG ANALIS (Trade-Fi)
   ════════════════════════════════════════════════════════════════════════
   Panel ini dibuka SEBELUM ada sinyal yang jalan, dan itu memang tempatnya.
   Orang perlu menetapkan berapa lot dan melihat berapa dolar yang
   dipertaruhkan selagi kepalanya dingin — bukan saat sinyal baru saja
   terbit dan tangannya sedang buru-buru.

   Urutan yang salah sempat terpasang: tombolnya dimatikan sampai sinyalnya
   ada. Akibatnya keputusan ukuran posisi terdorong ke detik-detik paling
   buruk untuk mengambilnya.

   ── APA YANG SUDAH HIDUP, APA YANG BELUM ────────────────────────────────
   Yang disimpan di sini SETELAN dan KEIKUTSERTAAN. Eksekusi otomatis saat
   sinyal baru terbit dikerjakan pengikut di VPS, dan itu bagian yang belum
   berdiri. Panel ini mengatakannya apa adanya alih-alih memasang lencana
   "aktif" yang tidak menggerakkan apa pun.
   ════════════════════════════════════════════════════════════════════════ */

const ISIAN = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-200 outline-none transition-colors focus:border-zinc-600';

/** Contoh jarak SL untuk mengintip risiko SEBELUM ada sinyal.
 *
 *  Panel ini dibuka saat belum ada sinyal apa pun, jadi tidak ada jarak SL
 *  sungguhan untuk dihitung. Tanpa contoh, kolom risikonya cuma bisa
 *  bertuliskan "—" — dan panel yang tidak bisa menunjukkan akibat dari
 *  angka yang baru saja diketik tidak menolong siapa pun memutuskan.
 *
 *  Ditulis sebagai CONTOH di layar, bukan disamarkan sebagai kepastian. */
const CONTOH_JARAK: { label: string; harga: number }[] = [
  { label: 'SL 20 poin', harga: 2 },
  { label: 'SL 50 poin', harga: 5 },
  { label: 'SL 100 poin', harga: 10 },
];

export function PanelCopyAnalis({ analisUid, analisNama, contohPasangan, tutup }: {
  analisUid: string;
  analisNama: string;
  /** Simbol yang paling sering dipakai analis ini — dipakai menebak ukuran
   *  kontrak supaya angka contohnya tidak asal. */
  contohPasangan?: string;
  tutup: () => void;
}) {
  const { pengguna } = useAuth();
  const akun = useAkunMt5();

  const [n, setN] = useState<SetelanRisiko>(() => bacaSetelanRisiko(pengguna?.uid));
  const [kontrak, setKontrak] = useState(() => kontrakBawaan(contohPasangan || 'XAUUSD'));
  /* Lot tetap ATAU otomatis dari risiko. Keduanya sah dan orang memakai
     keduanya: yang baru mulai biasanya memasang lot tetap yang kecil supaya
     tahu persis apa yang terjadi, yang sudah terbiasa membiarkan risikonya
     yang tetap dan lotnya yang menyesuaikan tiap sinyal. */
  const [mode, setMode] = useState<'risiko' | 'lot'>('risiko');
  const [lotTetap, setLotTetap] = useState(0.01);
  const [langganan, setLangganan] = useState<LanggananCopy | null>(null);
  const [kabar, setKabar] = useState('');

  useEffect(() => {
    setLangganan(bacaLangganan(pengguna?.uid, analisUid));
  }, [pengguna?.uid, analisUid]);

  useEffect(() => { simpanSetelanRisiko(n, pengguna?.uid); }, [n, pengguna?.uid]);

  /* Setelan yang sudah tersimpan MENANG atas bawaan. Orang yang membuka
     lagi panelnya harus melihat angka yang ia tetapkan, bukan angka pabrik
     — kalau tidak, ia akan mengira setelannya hilang lalu memasangnya
     ulang, dan yang tersimpan jadi berbeda dari yang ia kira. */
  useEffect(() => {
    const l = bacaLangganan(pengguna?.uid, analisUid);
    if (!l) return;
    setMode(l.mode);
    setLotTetap(l.lotTetap);
    setKontrak(l.kontrak);
  }, [pengguna?.uid, analisUid]);

  const contoh = useMemo(() => CONTOH_JARAK.map((c) => {
    const u = hitungUkuran({
      entry: 1000, sl: 1000 - c.harga, kripto: false,
      pasangan: contohPasangan, setelan: n, kontrak,
    });
    const lot = mode === 'lot' ? lotTetap : bulatkanLot(u.lot);
    return { ...c, lot, risiko: lot * kontrak * c.harga };
  }), [n, kontrak, mode, lotTetap, contohPasangan]);

  const belumLogin = !pengguna;
  const belumTerhubung = akun.terhubung === false;

  function simpan() {
    if (belumLogin) return;
    const isi: LanggananCopy = {
      analisUid, analisNama, mode,
      lotTetap: Math.max(0.01, lotTetap),
      modal: n.modal, risiko: n.risiko, kontrak,
      sejak: langganan?.sejak ?? Date.now(),
    };
    simpanLangganan(pengguna!.uid, isi);
    setLangganan(isi);
    setKabar('Setelan tersimpan. Kamu terdaftar mengikuti analis ini.');
  }

  function batal() {
    if (!pengguna) return;
    hapusLangganan(pengguna.uid, analisUid);
    setLangganan(null);
    setKabar('Berhenti mengikuti. Tidak ada sinyal analis ini yang akan disalin.');
  }

  const ubah = (k: keyof SetelanRisiko) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setN((s) => ({ ...s, [k]: Math.max(0, Number(e.target.value) || 0) }));

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={tutup}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
           className="relative flex max-h-[88vh] w-full max-w-[400px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
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
          {/* ── AKUN BROKER ────────────────────────────────────────────
              Ditaruh PALING ATAS, sebelum satu pun angka bisa diketik.
              Ukuran posisi tanpa saldo yang terlihat adalah tebakan, dan
              orang yang tidak melihat saldonya cenderung memakai modal
              karangan yang lebih besar dari kenyataan. */}
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
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                <Kolom k="Saldo" v={akun.saldo != null ? uang(akun.saldo) : '—'} />
                <Kolom k="Ekuitas" v={akun.ekuitas != null ? uang(akun.ekuitas) : '—'} />
                <Kolom k="Akun" v={akun.loginAktif || akun.mataUang || '—'} />
              </div>
            )}
            <div className="mt-1.5 truncate text-[10px] text-zinc-600">{akun.ket}</div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[11px] text-zinc-500">Mengikuti</span>
            <span className="truncate text-[13px] font-semibold text-zinc-100">{analisNama}</span>
          </div>

          {/* ── CARA MENENTUKAN LOT ────────────────────────────────────── */}
          <div className="mt-2.5 flex gap-1.5">
            {([['risiko', 'Lot dari risiko'], ['lot', 'Lot tetap']] as const).map(([v, t]) => (
              <button key={v} onClick={() => setMode(v)}
                className={cn('flex-1 cursor-pointer rounded-md border px-2 py-1.5 text-[11.5px] transition-colors',
                  mode === v ? 'border-zinc-500 bg-zinc-800/60 text-zinc-100'
                             : 'border-zinc-800 text-zinc-400 hover:border-zinc-700')}>
                {t}
              </button>
            ))}
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {mode === 'risiko' ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[10.5px] text-zinc-500">Modal ($)</span>
                  <input value={n.modal} onChange={ubah('modal')} inputMode="decimal" className={cn(ISIAN, 'angka')} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10.5px] text-zinc-500">Risiko (%)</span>
                  <input value={n.risiko} onChange={ubah('risiko')} inputMode="decimal" className={cn(ISIAN, 'angka')} />
                </label>
              </>
            ) : (
              <label className="col-span-2 block">
                <span className="mb-1 block text-[10.5px] text-zinc-500">Lot tiap sinyal</span>
                <input value={lotTetap} inputMode="decimal"
                  onChange={(e) => setLotTetap(Math.max(0, Number(e.target.value) || 0))}
                  className={cn(ISIAN, 'angka')} />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-[10.5px] text-zinc-500">Kontrak/lot</span>
              <input value={kontrak} inputMode="decimal"
                onChange={(e) => setKontrak(Math.max(0, Number(e.target.value) || 0))}
                className={cn(ISIAN, 'angka')} />
            </label>
          </div>

          {/* ── AKIBATNYA, DALAM DOLAR ─────────────────────────────────
              Inilah alasan panel ini dibuka lebih dulu. "Risiko 1%" tidak
              berarti apa-apa sampai ia diterjemahkan jadi berapa dolar
              yang hilang pada jarak SL yang biasa dipakai. */}
          <div className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Perkiraan · contoh jarak SL
            </div>
            <div className="mt-1.5 space-y-1">
              {contoh.map((c) => (
                <div key={c.label} className="flex items-baseline gap-2 text-[11.5px]">
                  <span className="text-zinc-500">{c.label}</span>
                  <span className="angka ml-auto text-zinc-400">{c.lot.toFixed(2)} lot</span>
                  <span className={cn('angka w-16 text-right', c.risiko > 0 ? 'text-red-400' : 'text-zinc-600')}>
                    −{uang(c.risiko)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
              Angka contoh, bukan sinyal sungguhan. Lot sebenarnya dihitung dari
              jarak SL tiap sinyal saat ia terbit.
            </div>
          </div>

          {/* ── STATUS ─────────────────────────────────────────────────── */}
          <div className={cn('mt-3 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed',
            langganan ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-200'
                      : 'border-zinc-800 bg-zinc-900/30 text-zinc-500')}>
            {langganan ? <CircleCheck className="mt-px size-3.5 shrink-0" />
                       : <TriangleAlert className="mt-px size-3.5 shrink-0" />}
            {langganan
              ? `Terdaftar mengikuti ${analisNama}. Setelan tersimpan: ${
                  langganan.mode === 'lot' ? `${langganan.lotTetap} lot tetap` : `${langganan.risiko}% dari ${uang(langganan.modal)}`}.`
              : 'Belum mengikuti analis ini.'}
          </div>

          {/* Dikatakan apa adanya. Lencana "aktif" yang tidak menggerakkan
              apa pun adalah kebohongan di layar yang mengurus uang. */}
          <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
            Setelan ini tersimpan untuk akunmu. Penyalinan otomatis saat sinyal baru
            terbit dijalankan pengikut di VPS — bagian itu masih dibangun. Sementara
            ini sinyal bisa disalin satu per satu lewat tombol{' '}
            <span className="text-zinc-400">Copy trade</span> di kartu sinyal.
          </p>

          {kabar && <div className="mt-2 text-[11px] text-zinc-400">{kabar}</div>}
        </div>

        <div className="flex gap-2 border-t border-zinc-800 px-4 py-3">
          <button onClick={simpan} disabled={belumLogin}
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
