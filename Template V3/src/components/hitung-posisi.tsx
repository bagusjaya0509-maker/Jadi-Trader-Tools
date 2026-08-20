import { useEffect, useState } from 'react';
import { Calculator, TriangleAlert } from 'lucide-react';
import { cn, uang } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   PENGHITUNG POSISI — menerjemahkan sinyal jadi ukuran yang aman DIIKUTI
   ════════════════════════════════════════════════════════════════════════
   Panel ini menjawab satu pertanyaan yang selama ini dibiarkan menggantung:
   "sinyal ini SL-nya sekian persen — saya harus masuk sebesar apa?"

   ── KENAPA IA PERLU ADA ────────────────────────────────────────────────
   Jarak SL BUKAN risiko. Risiko = ukuran posisi x jarak SL. Orang yang
   meniru sinyal ber-SL 2% dengan lot yang sama seperti sinyal ber-SL 0,2%
   menanggung sepuluh kali lipat — tanpa satu pun angka di layar yang
   memberitahunya.

   ── DUA PASAR, DUA CARA MENGUKUR ───────────────────────────────────────
   Dipisah atas permintaan pemilik, dan perhitungannya memang beda jenis.

   KRIPTO (futures): ukurannya NILAI POSISI dalam dolar. Leverage cuma
   menentukan berapa margin yang tertahan, bukan berapa yang dirisikokan.
   Yang membalik intuisi kebanyakan orang, dan karena itu ditulis terang:
   SL yang LEBAR justru butuh leverage lebih KECIL. Untuk risiko 1% dari
   $1.000 —

       SL 2%    -> posisi $500     (0,5x modal, tidak perlu leverage)
       SL 0,5%  -> posisi $2.000   (2x)
       SL 0,06% -> posisi $16.667  (16,7x)

   Justru stop yang rapat yang menuntut leverage besar, dan di situ selisih
   harga serta slippage memakan bagian jauh lebih besar dari risikonya.

   TRADE-FI (MT5): ukurannya LOT, dan leverage tidak masuk hitungan sama
   sekali. Yang menentukan kerugian per lot adalah UKURAN KONTRAK simbol
   dikali jarak SL dalam harga:

       lot = risiko$ / (ukuran kontrak x |entry - SL|)

   Leverage di MT5 milik AKUNNYA, bukan posisinya — ia cuma menentukan
   berapa margin yang tertahan broker, dan mengubahnya tidak mengubah satu
   sen pun kerugian saat SL kena. Menampilkan "leverage minimum" di sinyal
   MT5 karena itu bukan cuma tidak berguna, ia menyuruh orang menyetel
   sesuatu yang tidak menyentuh risikonya.

   ── HANYA CATATAN ──────────────────────────────────────────────────────
   Tidak satu pun angka di sini mengubah sinyalnya, mengubah papan
   peringkat, atau terkirim ke mana pun. Ia hitungan di peramban orang yang
   sedang menimbang meniru — dan itu memang miliknya sendiri, karena modal
   dan toleransi risikonya juga miliknya sendiri.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.hitung.posisi';

type Simpanan = { modal: number; risiko: number; leverage: number };
const BAWAAN: Simpanan = { modal: 1000, risiko: 1, leverage: 10 };

function baca(): Simpanan {
  try {
    const j = JSON.parse(localStorage.getItem(KUNCI) || '{}');
    return {
      modal: Number(j.modal) > 0 ? Number(j.modal) : BAWAAN.modal,
      risiko: Number(j.risiko) > 0 ? Number(j.risiko) : BAWAAN.risiko,
      leverage: Number(j.leverage) > 0 ? Number(j.leverage) : BAWAAN.leverage,
    };
  } catch { return BAWAAN; }
}

/** Ukuran kontrak MT5 per 1 lot, ditebak dari nama simbolnya.
 *
 *  DITEBAK, dan karena itu bisa disunting di panelnya. Ukuran kontrak
 *  ditentukan BROKER, bukan standar dunia: sebagian broker menulis emas
 *  100 oz per lot, sebagian 10. Angka yang tidak bisa dikoreksi orangnya
 *  akan diam-diam salah di broker yang tidak kita duga — dan salahnya
 *  berupa lot yang terlalu besar, bukan sekadar tampilan yang keliru. */
function kontrakBawaan(pasangan: string): number {
  const s = (pasangan || '').replace(/^MT5:/i, '').toUpperCase();
  if (s.startsWith('XAU')) return 100;        // emas, 100 oz per lot
  if (s.startsWith('XAG')) return 5000;       // perak, 5.000 oz per lot
  if (/^[A-Z]{6}$/.test(s)) return 100_000;   // pasangan forex, 100.000 unit
  return 100_000;
}

const ISIAN = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[12px] text-zinc-200 outline-none transition-colors focus:border-zinc-600';

export function HitungPosisi({ entry, sl, kripto, pasangan = '' }: {
  entry: number; sl: number; kripto: boolean; pasangan?: string;
}) {
  const [n, setN] = useState<Simpanan>(baca);
  /* Ukuran kontrak TIDAK ikut disimpan: ia milik SIMBOLNYA, bukan milik
     orangnya. Satu slot simpanan untuk angka yang berbeda tiap simbol
     berarti nilai emas terbawa ke kartu EURUSD berikutnya. */
  const [kontrak, setKontrak] = useState(() => kontrakBawaan(pasangan));
  useEffect(() => { setKontrak(kontrakBawaan(pasangan)); }, [pasangan]);

  /* Modal dan toleransi risiko DISIMPAN supaya tidak diketik ulang di tiap
     sinyal — keduanya tidak berubah dari kartu ke kartu, dan memaksa
     mengisi ulang membuat panel ini lebih merepotkan daripada menghitung
     sendiri di kalkulator. */
  useEffect(() => {
    try { localStorage.setItem(KUNCI, JSON.stringify(n)); } catch { /* mode privat */ }
  }, [n]);

  if (!(entry > 0) || !(sl > 0)) return null;

  const jarakHarga = Math.abs(entry - sl);
  const jarakPersen = (jarakHarga / entry) * 100;
  if (!(jarakPersen > 0)) return null;

  const risikoDolar = n.modal * (n.risiko / 100);

  const ubah = (k: keyof Simpanan) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setN((s) => ({ ...s, [k]: Math.max(0, Number(e.target.value) || 0) }));

  return (
    <div className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-300">
        <Calculator className="size-3.5 text-zinc-500" />
        Ukuran posisi supaya risikomu pas
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-zinc-500">Modal ($)</span>
          <input value={n.modal} onChange={ubah('modal')} inputMode="decimal" className={cn(ISIAN, 'angka')} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10.5px] text-zinc-500">Risiko (%)</span>
          <input value={n.risiko} onChange={ubah('risiko')} inputMode="decimal" className={cn(ISIAN, 'angka')} />
        </label>
        {kripto ? (
          <label className="block">
            <span className="mb-1 block text-[10.5px] text-zinc-500">Leverage (x)</span>
            <input value={n.leverage} onChange={ubah('leverage')} inputMode="decimal" className={cn(ISIAN, 'angka')} />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-[10.5px] text-zinc-500">Kontrak / lot</span>
            <input value={kontrak} inputMode="decimal"
                   onChange={(e) => setKontrak(Math.max(0, Number(e.target.value) || 0))}
                   className={cn(ISIAN, 'angka')} />
          </label>
        )}
      </div>

      {kripto
        ? <Kripto entry={entry} jarakPersen={jarakPersen} risikoDolar={risikoDolar} n={n} />
        : <Mt5 jarakHarga={jarakHarga} jarakPersen={jarakPersen} risikoDolar={risikoDolar}
               kontrak={kontrak} risikoPersen={n.risiko} entry={entry} modal={n.modal} />}
    </div>
  );
}

/* ── KRIPTO: nilai posisi, margin, leverage ─────────────────────────── */
function Kripto({ entry, jarakPersen, risikoDolar, n }: {
  entry: number; jarakPersen: number; risikoDolar: number; n: Simpanan;
}) {
  const nilaiPosisi = risikoDolar / (jarakPersen / 100);
  const levMin = nilaiPosisi / n.modal;
  const marginTerpakai = n.leverage > 0 ? nilaiPosisi / n.leverage : 0;
  const kurangMargin = marginTerpakai > n.modal;
  /* Di atas 10x, satu gerak kecil melawan sudah memakan sebagian besar
     margin. Angkanya bukan hukum — ia ambang untuk MENYEBUTKAN, bukan
     untuk melarang. */
  const levTinggi = levMin > 10;

  return (
    <>
      <div className="mt-3 space-y-1 text-[11.5px]">
        <Baris k="Jarak SL sinyal ini" v={jarakPersen.toFixed(2) + '%'} />
        <Baris k={`Rugi kalau kena SL (${n.risiko}% modal)`} v={uang(risikoDolar)} />
        <Baris k="Nilai posisi yang dipakai" v={uang(nilaiPosisi)} tebal />
        <Baris k="Jumlah kontrak" v={(nilaiPosisi / entry).toPrecision(4)} />
        <Baris k={`Margin terpakai di ${n.leverage}x`} v={uang(marginTerpakai)}
               warna={kurangMargin ? 'text-red-400' : undefined} />
        <Baris k="Leverage minimum yang dibutuhkan"
               v={levMin <= 1 ? 'tidak perlu leverage' : levMin.toFixed(1) + 'x'} />
      </div>

      {kurangMargin && (
        <Peringatan nada="merah">
          Margin yang dibutuhkan lebih besar dari modalmu. Naikkan leverage ke minimal{' '}
          <span className="angka">{levMin.toFixed(1)}x</span>, atau turunkan risikonya.
        </Peringatan>
      )}

      {!kurangMargin && levTinggi && (
        <Peringatan nada="amber">
          SL sinyal ini rapat, jadi risiko {n.risiko}% menuntut leverage{' '}
          <span className="angka">{levMin.toFixed(1)}x</span>. Di leverage setinggi itu selisih
          harga dan slippage memakan bagian besar dari risikomu — dan jarak ke likuidasi jadi
          pendek kalau SL-nya sempat terlewat.
        </Peringatan>
      )}

      <Kaki>
        Futures: ukuran posisi diatur lewat jumlah kontrak, dan leverage cuma menentukan berapa
        margin yang tertahan — bukan berapa yang kamu risikokan. Yang menentukan risikomu tetap
        jarak SL dikali ukuran posisi.
      </Kaki>
    </>
  );
}

/* ── TRADE-FI (MT5): lot, dan cuma lot ──────────────────────────────── */
function Mt5({ jarakHarga, jarakPersen, risikoDolar, kontrak, risikoPersen, entry, modal }: {
  jarakHarga: number; jarakPersen: number; risikoDolar: number;
  kontrak: number; risikoPersen: number; entry: number; modal: number;
}) {
  /* Kerugian kalau SL kena, untuk SATU lot penuh. Inilah angka yang
     membuat lot bisa dihitung — dan yang tidak pernah muncul kalau
     panelnya berbicara leverage. */
  const rugiPerLot = kontrak * jarakHarga;
  const lotIdeal = rugiPerLot > 0 ? risikoDolar / rugiPerLot : 0;

  /* DIBULATKAN KE BAWAH, bukan ke terdekat. Membulatkan 0,014 jadi 0,01
     membuat risikonya lebih kecil dari yang diminta; membulatkannya ke
     0,02 membuatnya lebih BESAR — dan angka yang diam-diam melewati batas
     risiko orang adalah kesalahan yang tidak boleh dibuat kalkulator
     risiko. */
  const lotBulat = Math.floor(lotIdeal * 100) / 100;
  const bisaStandar = lotBulat >= 0.01;
  const risikoNyata = lotBulat * rugiPerLot;

  /* Akun cent: ukuran kontraknya 1/100, jadi lot yang sama menanggung
     risiko 1/100 — atau, dibalik, risiko yang sama butuh lot 100x. Itu
     satu-satunya cara memasang risiko kecil tanpa lot pecahan yang
     ditolak broker. */
  const lotSen = Math.floor(lotIdeal * 100 * 100) / 100;

  return (
    <>
      <div className="mt-3 space-y-1 text-[11.5px]">
        <Baris k="Jarak SL sinyal ini" v={`${jarakHarga.toPrecision(4)} (${jarakPersen.toFixed(2)}%)`} />
        <Baris k={`Rugi kalau kena SL (${risikoPersen}% modal)`} v={uang(risikoDolar)} />
        <Baris k="Rugi per 1 lot penuh" v={uang(rugiPerLot)} />
        <Baris k="Lot yang pas" v={lotIdeal.toFixed(4)} tebal />
        <Baris k="Dibulatkan ke step 0,01"
               v={bisaStandar ? `${lotBulat.toFixed(2)} lot · rugi ${uang(risikoNyata)}` : 'di bawah lot minimum'}
               warna={bisaStandar ? undefined : 'text-amber-300'} />
        <Baris k="Kalau pakai akun cent" v={`${lotSen.toFixed(2)} lot cent`} />
        <Baris k="Nilai posisi (1 lot)" v={uang(kontrak * entry)} />
      </div>

      {!bisaStandar && (
        <Peringatan nada="amber">
          Risiko {risikoPersen}% di sinyal ini butuh{' '}
          <span className="angka">{lotIdeal.toFixed(4)}</span> lot — lebih kecil dari lot minimum
          broker (0,01). Pakai <span className="text-amber-100">akun cent</span> dengan{' '}
          <span className="angka">{lotSen.toFixed(2)}</span> lot, atau naikkan modalmu. Memaksakan
          0,01 lot di akun standar berarti menanggung{' '}
          <span className="angka">{uang(0.01 * rugiPerLot)}</span>
          {modal > 0 && <> — {((0.01 * rugiPerLot / modal) * 100).toFixed(1)}% modal, bukan {risikoPersen}%</>}.
        </Peringatan>
      )}

      <Kaki>
        MT5 diukur dengan <span className="text-zinc-500">lot</span>, bukan leverage: yang
        menentukan kerugianmu adalah ukuran kontrak simbol dikali jarak SL. Leverage di MT5 milik
        akunmu — ia cuma mengatur berapa margin yang tertahan broker, dan mengubahnya tidak
        mengubah satu sen pun kerugian saat SL kena.{' '}
        <span className="text-zinc-500">Ukuran kontrak ditentukan brokermu</span> — kolom di atas
        bisa disunting kalau punyamu berbeda. Angka di sini mengandaikan simbolnya berharga dalam
        dolar.
      </Kaki>
    </>
  );
}

function Peringatan({ nada, children }: { nada: 'merah' | 'amber'; children: React.ReactNode }) {
  return (
    <p className={cn('mt-2 flex items-start gap-1.5 rounded-md border px-2.5 py-2 text-[11px] leading-relaxed',
      nada === 'merah'
        ? 'border-red-500/30 bg-red-500/[0.05] text-red-300/90'
        : 'border-amber-500/30 bg-amber-500/[0.05] text-amber-200/90')}>
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Kaki({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
      {children}{' '}
      Hitungan ini hanya catatan: ia tidak mengubah sinyalnya dan tidak terkirim ke mana pun.
    </p>
  );
}

function Baris({ k, v, tebal, warna }: { k: string; v: string; tebal?: boolean; warna?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-zinc-500">{k}</span>
      <span className={cn('angka shrink-0', warna ?? (tebal ? 'font-semibold text-zinc-100' : 'text-zinc-300'))}>{v}</span>
    </div>
  );
}
