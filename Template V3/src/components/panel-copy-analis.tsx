import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, TriangleAlert, CircleCheck, Plug, ChevronUp, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, uang } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useAkunMt5 } from '@/lib/akun';
import {
  bacaSetelanRisiko, simpanSetelanRisiko, kontrakBawaan, kontrakBerlaku,
  langkahLot, lotUntukCopy, type SetelanRisiko, type JenisAkun,
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
  /* BATAS RUGI dalam DOLAR, bukan persen. Persen menuntut orang mengalikan
     di kepalanya sebelum tahu apa yang dipertaruhkan, dan yang ia rasakan
     saat posisinya merah bukan persen melainkan dolar. Persennya tetap ada
     di bawah sebagai penerjemah dua arah — mengetik salah satunya mengisi
     yang lain — supaya yang terbiasa berpikir dalam persen tidak kehilangan
     caranya. */
  const [rugiMaks, setRugiMaks] = useState(() => {
    const s = bacaSetelanRisiko(pengguna?.uid);
    return Math.max(1, Math.round(s.modal * (s.risiko / 100) * 100) / 100);
  });
  const [jenisAkun, setJenisAkun] = useState<JenisAkun>('standar');
  /* JARAK SL ACUAN untuk mengikat lot <-> rugi dua arah. Panel ini dibuka
     saat belum ada sinyal, jadi harus ada satu jarak yang disepakati supaya
     "naikkan lot" punya jawaban dolar. Yang dipilih orangnya sendiri, dan
     terlihat — mengikat ke angka tersembunyi berarti dolarnya berubah tanpa
     sebab yang bisa ditunjuk. */
  const [acuan, setAcuan] = useState(5);
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
    if (l.rugiMaks > 0) setRugiMaks(l.rugiMaks);
    if (l.jenisAkun) setJenisAkun(l.jenisAkun);
  }, [pengguna?.uid, analisUid]);

  const kontrakEfektif = kontrakBerlaku(kontrak, jenisAkun);

  const contoh = useMemo(() => CONTOH_JARAK.map((c) => {
    const h = lotUntukCopy({
      lotDiminta: mode === 'lot' ? lotTetap : 0,
      rugiMaks, kontrak: kontrakEfektif, jarakHarga: c.harga,
    });
    return { ...c, ...h };
  }), [rugiMaks, kontrakEfektif, mode, lotTetap]);

  /* ── IKATAN DUA ARAH ────────────────────────────────────────────────
     Menaikkan lot MENAIKKAN angka rugi maks, karena itulah akibatnya:
     lot lebih besar pada jarak SL yang sama berarti dolar yang lebih besar.
     Arah sebaliknya sudah berjalan lewat lotUntukCopy — mengetik dolar
     mengecilkan lotnya sendiri.

     Dipisah jadi fungsi, bukan efek: efek yang menulis balik ke state yang
     ia amati adalah gelung yang cuma kebetulan berhenti. */
  function pakaiLot(lotBaru: number) {
    setLotTetap(lotBaru);
    if (acuan > 0 && kontrakEfektif > 0) {
      setRugiMaks(Math.round(lotBaru * kontrakEfektif * acuan * 100) / 100);
    }
  }

  /* Persen DITURUNKAN dari dolar, bukan disimpan terpisah. Dua angka yang
     mengatakan hal yang sama tapi disimpan sendiri-sendiri pasti berselisih
     suatu hari, dan yang berselisih di sini ukuran posisi. */
  const persenDariModal = n.modal > 0 ? (rugiMaks / n.modal) * 100 : 0;

  const belumLogin = !pengguna;
  const belumTerhubung = akun.terhubung === false;

  function simpan() {
    if (belumLogin) return;
    const isi: LanggananCopy = {
      analisUid, analisNama, mode,
      lotTetap: Math.max(0.01, lotTetap),
      rugiMaks: Math.max(0, rugiMaks),
      modal: n.modal, risiko: n.risiko, kontrak, jenisAkun,
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

          {/* JENIS AKUN. Ditaruh menempel pada kotak akunnya, bukan di
              antara isian angka: ia menerangkan AKUN, dan salah memilihnya
              menggeser setiap angka dolar di bawah dengan faktor seratus.
              Yang mengira akunnya cent padahal standar akan memasang lot
              seratus kali terlalu besar. */}
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10.5px] text-zinc-500">Jenis akun</span>
            {(['standar', 'cent'] as const).map((v) => (
              <button key={v} onClick={() => setJenisAkun(v)}
                title={v === 'cent'
                  ? 'Akun cent — 1 lot bernilai seperseratus akun standar'
                  : 'Akun standar — 1 lot penuh'}
                className={cn('cursor-pointer rounded border px-2 py-0.5 text-[10.5px] uppercase transition-colors',
                  jenisAkun === v ? 'border-zinc-500 bg-zinc-800/60 text-zinc-100'
                                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-700')}>
                {v}
              </button>
            ))}
            {jenisAkun === 'cent' && (
              <span className="text-[10px] text-amber-300/80">1 lot = 1/100 standar</span>
            )}
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

          {/* ── BATAS RUGI: SELALU TAMPIL, DI KEDUA MODE ────────────────
              Ini pengamannya, dan pengaman yang menghilang saat orang
              memilih "lot tetap" bukan pengaman. Lot tetap yang tidak
              dibatasi punya persis kelemahan yang sama: stop yang melebar
              mengalikan kerugian tanpa satu pun angka di sini berubah. */}
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10.5px] text-amber-300/80">Rugi maks ($)</span>
              <input value={rugiMaks} inputMode="decimal"
                onChange={(e) => setRugiMaks(Math.max(0, Number(e.target.value) || 0))}
                className={cn(ISIAN, 'angka border-amber-500/30')} />
            </label>
            {mode === 'lot' ? (
              <label className="block">
                <span className="mb-1 block text-[10.5px] text-zinc-500">Lot tiap sinyal</span>
                {/* Naik-turun 0,01 — langkah terkecil yang diterima hampir
                    semua broker MT5. Mengetik tetap bisa; tombolnya untuk
                    yang menyetel sambil melihat dolarnya bergerak, dan itu
                    justru cara orang menemukan lot yang pas. */}
                <div className="flex items-stretch gap-1">
                  <input value={lotTetap} inputMode="decimal"
                    onChange={(e) => pakaiLot(Math.max(0, Number(e.target.value) || 0))}
                    className={cn(ISIAN, 'angka')} />
                  <div className="flex shrink-0 flex-col gap-px">
                    {([[1, ChevronUp], [-1, ChevronDown]] as const).map(([arah, Ikon]) => (
                      <button key={arah} type="button"
                        onClick={() => pakaiLot(langkahLot(lotTetap, arah))}
                        aria-label={arah === 1 ? 'Naikkan lot 0,01' : 'Turunkan lot 0,01'}
                        className="flex flex-1 cursor-pointer items-center justify-center rounded border border-zinc-800 px-1 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100">
                        <Ikon className="size-3" />
                      </button>
                    ))}
                  </div>
                </div>
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-[10.5px] text-zinc-500">Modal ($)</span>
                <input value={n.modal} onChange={ubah('modal')} inputMode="decimal" className={cn(ISIAN, 'angka')} />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-[10.5px] text-zinc-500">Kontrak/lot</span>
              <input value={kontrak} inputMode="decimal"
                onChange={(e) => setKontrak(Math.max(0, Number(e.target.value) || 0))}
                className={cn(ISIAN, 'angka')} />
            </label>
          </div>

          {/* Jarak SL yang dipakai mengikat lot dengan dolar. Tanpa ini
              "naikkan lot" tidak punya jawaban dolar sama sekali, karena
              belum ada sinyal yang jarak SL-nya bisa dipakai. */}
          {mode === 'lot' && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-zinc-500">
              <span>Dolarnya dihitung pada</span>
              {CONTOH_JARAK.map((c) => (
                <button key={c.harga} onClick={() => {
                  setAcuan(c.harga);
                  setRugiMaks(Math.round(lotTetap * kontrakEfektif * c.harga * 100) / 100);
                }}
                  className={cn('cursor-pointer rounded border px-1.5 py-0.5 transition-colors',
                    acuan === c.harga ? 'border-zinc-500 text-zinc-200'
                                      : 'border-zinc-800 hover:border-zinc-600 hover:text-zinc-200')}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Penerjemah dua arah. Ditulis sebagai kalimat, bukan kolom
              ketiga: ia keterangan atas angka di atasnya, bukan angka
              keempat yang harus diisi. Bisa diklik untuk mengisinya dari
              persen — yang terbiasa berpikir "1% dari modal" tidak perlu
              menghitung sendiri. */}
          {mode === 'risiko' && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-zinc-500">
              <span>= <span className="angka text-zinc-300">{persenDariModal.toFixed(2)}%</span> dari modal.</span>
              <span className="text-zinc-700">Pakai:</span>
              {[0.5, 1, 2].map((v) => (
                <button key={v} onClick={() => setRugiMaks(Math.round(n.modal * (v / 100) * 100) / 100)}
                  className="cursor-pointer rounded border border-zinc-800 px-1.5 py-0.5 transition-colors hover:border-zinc-600 hover:text-zinc-200">
                  {v}%
                </button>
              ))}
              {akun.saldo != null && (
                <button onClick={() => setN((s) => ({ ...s, modal: Math.round(akun.saldo!) }))}
                  title="Isi modal dari saldo akun brokermu"
                  className="cursor-pointer rounded border border-zinc-800 px-1.5 py-0.5 transition-colors hover:border-zinc-600 hover:text-zinc-200">
                  modal = saldo
                </button>
              )}
            </div>
          )}

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
                  {/* Pemotongan DIKATAKAN, bukan cuma terjadi. Lot yang
                      diam-diam mengecil terbaca sebagai hitungan yang salah;
                      lot yang mengecil DENGAN alasannya terbaca sebagai
                      pengaman yang bekerja. */}
                  {c.dibatasi && (
                    <span className="rounded bg-amber-500/15 px-1 text-[9.5px] text-amber-300">
                      dipotong dari {c.lotDiminta.toFixed(2)}
                    </span>
                  )}
                  <span className="angka ml-auto text-zinc-400">
                    {c.lot > 0 ? c.lot.toFixed(2) + ' lot' : '—'}
                  </span>
                  <span className={cn('angka w-16 text-right', c.rugi > 0 ? 'text-red-400' : 'text-zinc-600')}>
                    {c.rugi > 0 ? '−' + uang(c.rugi) : '—'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
              Angka contoh, bukan sinyal sungguhan — lot sebenarnya dihitung dari
              jarak SL tiap sinyal saat ia terbit. Yang tetap: ruginya tidak pernah
              melewati <span className="angka text-amber-300/90">{uang(rugiMaks)}</span>,
              seberapa lebar pun analis memasang stopnya.
            </div>
          </div>

          {/* ── STATUS ─────────────────────────────────────────────────── */}
          <div className={cn('mt-3 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed',
            langganan ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-200'
                      : 'border-zinc-800 bg-zinc-900/30 text-zinc-500')}>
            {langganan ? <CircleCheck className="mt-px size-3.5 shrink-0" />
                       : <TriangleAlert className="mt-px size-3.5 shrink-0" />}
            {langganan
              ? `Terdaftar mengikuti ${analisNama}. ${
                  langganan.mode === 'lot' ? `${langganan.lotTetap} lot tiap sinyal` : 'Lot menyesuaikan jarak SL'
                }, rugi dibatasi ${uang(langganan.rugiMaks)} per trade.`
              : 'Belum mengikuti analis ini.'}
          </div>

          {/* Dikatakan apa adanya. Lencana "aktif" yang tidak menggerakkan
              apa pun adalah kebohongan di layar yang mengurus uang. */}
          <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
            Setelan ini tersimpan untuk akunmu. Penyalinan otomatis saat sinyal baru
            terbit dijalankan pengikut di VPS — bagian itu masih dibangun.
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
