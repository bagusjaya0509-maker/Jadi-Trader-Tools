import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, harga } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   TABEL POSISI TERBUKA — satu bentuk untuk empat tempat
   ════════════════════════════════════════════════════════════════════════
   Posisi terbuka tampil di empat panel: kripto & Trade-Fi, masing-masing
   di Dashboard dan Jurnal. Sebelumnya keempatnya ditulis terpisah — dua
   sebagai tabel, dua sebagai kartu — dan akibatnya bukan sekadar tidak
   seragam: kolom yang ada di satu tempat HILANG di tempat lain. Posisi
   MT5 di Dashboard tidak punya kolom Gerak, posisi kripto di Jurnal tidak
   punya Size sebagai kolom. Orang yang membandingkan dua panel jadi
   mengira datanya berbeda, padahal cuma penulisannya.

   Satu komponen, satu susunan kolom: Pair | Size | Entry | Gerak |
   Risk SL | Target TP | P/L,
   dengan SL & TP menumpang baris keterangan di bawah nama pair. SL/TP
   tidak dijadikan kolom sendiri karena lima kolom sudah penuh di panel
   setengah lebar — tapi ia WAJIB terlihat, karena "posisi tanpa stop"
   adalah hal terpenting yang bisa diberitahukan panel ini.
   ════════════════════════════════════════════════════════════════════════ */

export interface BarisPosisi {
  kunci: string;
  simbol: string;
  arah: 'BUY' | 'SELL';
  /** Alasan baris ini patut diragukan, siap tampil. Kosong = tidak ada.
   *
   *  Dipakai posisi yang datang dari dokumen publik screener: dokumen itu
   *  hanya ditulis ulang selama halaman screener terbuka, jadi posisi yang
   *  sudah tertutup bisa tertinggal di sana berhari-hari. */
  ragu?: string;
  /** Sudah lengkap dengan satuannya: "223,8 THETA" atau "0,01 lot". */
  ukuran: string;
  /** Ukuran sebagai ANGKA, untuk dijumlah saat baris digabung.
   *
   *  Kenapa tidak diurai balik dari `ukuran` saja: teks itu ditulis untuk
   *  dibaca manusia, dan format angkanya TIDAK seragam antar sumber. Lot
   *  MT5 keluar sebagai "0.05 lot" (titik desimal, dari toString), jumlah
   *  koin keluar sebagai "223,8 THETA" (koma desimal, dari toLocaleString
   *  id-ID). Pengurai yang menebak salah satunya pasti salah membaca yang
   *  lain -- dan itu benar-benar terjadi: "0.05" dan "0.1" terbaca 5 dan 1,
   *  jadi dua order 0,15 lot dilaporkan 6 lot. Enam kali lipat, tanpa satu
   *  pun galat.
   *
   *  Menghitung dari teks tampilan memang selalu salah. Angkanya dibawa
   *  utuh dari sumbernya. */
  ukuranNum?: number;
  /** Nilai posisi dalam DOLAR (jumlah x entry).
   *
   *  Kenapa bukan sekadar menempelkan "$" di depan `ukuran`: 298 itu
   *  jumlah KOIN THETA, dan "$298" adalah angka yang salah — nilainya
   *  sebenarnya sekitar $40. Lambang mata uang di depan angka yang bukan
   *  uang bukan sekadar keliru dibaca; ia membuat orang menilai besar
   *  posisinya tujuh kali lipat dari kenyataan.
   *
   *  Jadi dolarnya dihitung, dan jumlah koinnya TETAP ditampilkan di
   *  bawahnya — tidak ada data yang hilang. undefined untuk Trade-Fi:
   *  di sana ukurannya lot, dan nilai notionalnya bergantung ukuran
   *  kontrak broker. */
  ukuranUsd?: number;
  entry: number;
  /** Harga berjalan — dipakai menghitung Gerak. */
  hargaKini?: number;
  sl: number;
  tp: number;
  /** undefined = tidak disiarkan (bukan nol). */
  pnl?: number;
  /** Venue, timeframe, atau nomor tiket. */
  ket?: string;
  /** Tiket MT5. */
  tiket?: string;
  /** Uang yang HILANG kalau SL tersentuh, dan uang yang DIDAPAT kalau TP
   *  tersentuh. Dihitung di pemanggilnya karena rumusnya berbeda per pasar:
   *  kripto memakai jumlah koin, Trade-Fi memakai lot x nilai per lot.
   *  undefined = tidak bisa dihitung (SL/TP belum dipasang, atau ukuran
   *  posisinya tidak diketahui) — dan itu ditulis apa adanya, bukan nol. */
  risikoUsd?: number;
  imbalUsd?: number;
}

/* ════════════════════════════════════════════════════════════════════════
   PENGGABUNGAN ORDER BERLAPIS
   ════════════════════════════════════════════════════════════════════════
   Layering menghasilkan sepuluh baris BTCUSDc SELL yang isinya hampir
   sama, dan tabel yang menampilkannya satu per satu memaksa orang
   menjumlahkan sendiri di kepala untuk menjawab pertanyaan yang paling
   dasar: sebenarnya saya pegang berapa, di harga rata-rata berapa, dan
   sedang rugi berapa. Sepuluh angka kecil menutupi satu angka besar.

   Digabung menurut simbol + arah, dan HANYA kalau memang ada lebih dari
   satu. Penggabung yang menggabung satu baris cuma menambah lapisan
   tanpa memberi apa pun.

   ENTRY DIRATA-RATA MENURUT UKURAN, bukan dibagi rata. Order 0,05 lot di
   75.890 dan 0,02 lot di 76.204 tidak berhenti di tengah-tengah keduanya
   — yang besar menarik lebih kuat. Rata-rata polos akan memberi harga
   yang tidak pernah jadi titik impas posisinya, dan kolom Gerak yang
   dihitung darinya ikut salah.

   RISK, TARGET, DAN P/L DIJUMLAH, bukan dirata-rata. Ketiganya uang; yang
   ingin diketahui pemiliknya total yang dipertaruhkan dan total yang
   sedang mengambang, bukan rata-rata per order.

   SL & TP juga dirata-rata menurut ukuran. Kalau nilainya berbeda-beda,
   itu disebut apa adanya di baris keterangan — angka gabungan yang
   menyamar sebagai satu level tunggal lebih buruk daripada angka yang
   mengaku dirinya campuran. */

/** Ambil angka dari "0,05 lot" atau "223,8 THETA". Format Indonesia:
 *  titik ribuan, koma desimal. */
function angkaUkuran(teks: string): number {
  const t = (teks || '').trim().split(/\s+/)[0] || '';
  const x = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(x) && x > 0 ? x : 0;
}
function satuanUkuran(teks: string): string {
  return (teks || '').trim().split(/\s+/).slice(1).join(' ');
}

function gabungBaris(g: BarisPosisi[]): BarisPosisi {
  const bobot = g.map((b) => (b.ukuranNum !== undefined ? b.ukuranNum : angkaUkuran(b.ukuran)) || 1);
  const adaAngka = g.every((b) => b.ukuranNum !== undefined);
  const total = bobot.reduce((a, b) => a + b, 0);
  const rata = (ambil: (b: BarisPosisi) => number) =>
    g.reduce((a, b, i) => a + ambil(b) * bobot[i], 0) / total;
  /* Dijumlah HANYA kalau semua barisnya punya angkanya. Satu order tanpa
     SL membuat total risikonya tidak diketahui — dan menuliskan jumlah
     yang sembilan dari sepuluh berarti melaporkan risiko lebih kecil dari
     yang sebenarnya. */
  const jumlah = (ambil: (b: BarisPosisi) => number | undefined) => {
    if (g.some((b) => ambil(b) === undefined)) return undefined;
    return g.reduce((a, b) => a + (ambil(b) as number), 0);
  };
  const seragam = (ambil: (b: BarisPosisi) => number) =>
    g.every((b) => ambil(b) === ambil(g[0]));

  const beda: string[] = [];
  if (!seragam((b) => b.sl)) beda.push('SL');
  if (!seragam((b) => b.tp)) beda.push('TP');

  const satuan = satuanUkuran(g[0].ukuran);
  return {
    kunci: 'gabung|' + g[0].simbol + '|' + g[0].arah,
    simbol: g[0].simbol,
    arah: g[0].arah,
    /* Ditulis dengan gaya yang SAMA dengan baris anaknya, supaya induk dan
       anak tidak terlihat seperti dua satuan yang berbeda: lot memakai
       titik desimal (mengikuti toString), jumlah koin memakai koma. */
    ukuran: !adaAngka ? '—'
      : (satuan === 'lot' ? String(Number(total.toFixed(2)))
                          : total.toLocaleString('id-ID', { maximumFractionDigits: 4 }))
        + (satuan ? ' ' + satuan : ''),
    ukuranNum: adaAngka ? total : undefined,
    ukuranUsd: jumlah((b) => b.ukuranUsd),
    entry: rata((b) => b.entry),
    hargaKini: g.find((b) => b.hargaKini !== undefined)?.hargaKini,
    sl: rata((b) => b.sl),
    tp: rata((b) => b.tp),
    pnl: jumlah((b) => b.pnl),
    risikoUsd: jumlah((b) => b.risikoUsd),
    imbalUsd: jumlah((b) => b.imbalUsd),
    ket: g.length + ' order' + (beda.length ? ' · ' + beda.join(' & ') + ' beragam' : ''),
    ragu: g.map((b) => b.ragu).find(Boolean),
  };
}

export function TabelPosisi({ baris, kosong, onKlikBaris, onTutup }: {
  baris: BarisPosisi[];
  /** Tombol Tutup per baris. Kolomnya hanya muncul kalau diberikan. */
  onTutup?: (b: BarisPosisi) => void;
  /** Klik baris = buka order ini di chart untuk disunting. Kalau tidak
   *  diberikan, barisnya tidak bisa diklik sama sekali — bukan bisa
   *  diklik tapi tidak melakukan apa-apa. */
  onKlikBaris?: (b: BarisPosisi) => void;
  /** Kalimat saat tidak ada posisi. */
  kosong: string;
}) {
  /* Kelompok mana yang sedang DILEPAS. Bawaannya digabung: pertanyaan
     pertama orang selalu "totalnya berapa", bukan "order ke-tujuh isinya
     apa". Yang perlu melihat satu-satu tinggal menekan Lepas. */
  const [dilepas, setDilepas] = useState<Record<string, boolean>>({});

  if (!baris.length) {
    return <div className="py-5 text-center text-[12.5px] text-zinc-600">{kosong}</div>;
  }

  /* Dikelompokkan menurut simbol + arah, urutan kemunculan dipertahankan
     supaya posisi tidak melompat-lompat tiap harga berubah. */
  const kelompok: BarisPosisi[][] = [];
  const dimana = new Map<string, number>();
  for (const b of baris) {
    const k = b.simbol + '|' + b.arah;
    const i = dimana.get(k);
    if (i === undefined) { dimana.set(k, kelompok.length); kelompok.push([b]); }
    else kelompok[i].push(b);
  }
  const tampil: { b: BarisPosisi; jml?: number; buka?: boolean; anak?: boolean }[] = [];
  for (const kel of kelompok) {
    if (kel.length < 2) { tampil.push({ b: kel[0] }); continue; }
    const induk = gabungBaris(kel);
    const buka = !!dilepas[induk.kunci];
    tampil.push({ b: induk, jml: kel.length, buka });
    if (buka) for (const a of kel) tampil.push({ b: a, anak: true });
  }

  return (
    <TabelBungkus>
      <Tabel>
        <thead>
          <tr>
            <Th>Pair</Th>
            <Th className="text-right">Size</Th>
            <Th className="text-right">Entry</Th>
            <Th className="text-right">Gerak</Th>
            {/* Risk & Target duduk TEPAT SEBELUM P/L, bukan di ujung.
                Ketiganya satu kalimat yang dibaca sekali jalan: berapa yang
                dipertaruhkan, berapa yang diincar, dan di mana posisinya
                sekarang di antara keduanya. Dipisah oleh kolom lain,
                hubungannya hilang. */}
            <Th className="text-right">Risk SL</Th>
            <Th className="text-right">Target TP</Th>
            <Th className="text-right">P/L</Th>
            {onTutup && <Th />}
          </tr>
        </thead>
        <tbody>
          {tampil.map(({ b, jml, buka, anak }) => {
            /* Gerak butuh harga berjalan. Tanpa itu kolomnya diisi tanda
               hubung — BUKAN 0%, yang akan terbaca sebagai "harga tidak
               bergerak" padahal artinya "harganya tidak kita ketahui". */
            const bisaGerak = b.hargaKini !== undefined && b.entry > 0;
            const gerak = bisaGerak
              ? ((b.hargaKini! - b.entry) / b.entry) * 100 * (b.arah === 'BUY' ? 1 : -1)
              : null;
            return (
              <Tr key={b.kunci}
                  /* Baris gabungan TIDAK bisa diklik: kuncinya sintetis dan
                     tidak menunjuk order mana pun, jadi membukanya di chart
                     akan menyunting sesuatu yang tidak ada. */
                  onClick={onKlikBaris && !jml ? () => onKlikBaris(b) : undefined}
                  title={onKlikBaris && !jml ? 'Buka di chart untuk mengubah SL/TP' : undefined}
                  className={cn(
                    onKlikBaris && !jml ? 'cursor-pointer transition-colors hover:bg-zinc-800/40' : undefined,
                    anak && 'bg-zinc-900/30')}>
                <Td className={anak ? 'pl-6' : undefined}>
                  {anak && <span className="mr-1 text-zinc-700">└</span>}
                  <span className={b.ragu ? 'text-zinc-400' : 'text-zinc-200'}>{b.simbol}</span>
                  <span className={cn('ml-1.5 text-[10.5px]',
                    b.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                    {b.arah}
                  </span>
                  {/* DITANDAI, BUKAN DISEMBUNYIKAN. Menyembunyikannya akan
                      menutupi dua kemungkinan yang berbeda jauh: posisinya
                      memang sudah tertutup dan dokumennya basi (tidak apa),
                      atau order stopnya GAGAL dan posisinya masih terbuka
                      tanpa perlindungan (harus segera diketahui). Baris yang
                      hilang diam-diam tidak pernah menanyakan yang kedua. */}
                  {b.ragu && (
                    <span title={b.ragu}
                      className="ml-1.5 rounded bg-amber-500/15 px-1 text-[9.5px] font-semibold text-amber-400/90">
                      perlu diperiksa
                    </span>
                  )}
                  {jml && (
                    <span title={jml + ' order digabung jadi satu baris'}
                      className="ml-1.5 rounded bg-sky-500/15 px-1 text-[9.5px] font-semibold text-sky-300/90">
                      {jml}x
                    </span>
                  )}
                  {/* SL yang belum dipasang ditulis terang-terangan dengan
                      warna peringatan. Menyamarkannya jadi tanda hubung
                      membuat posisi tak terlindungi terlihat sama dengan
                      posisi yang stopnya cuma tidak disiarkan. */}
                  <div className="text-[10.5px] text-zinc-600">
                    {b.ket ? `${b.ket} · ` : ''}
                    SL{' '}
                    <span className={cn('angka', b.sl > 0 ? 'text-red-400/80' : 'text-amber-400/80')}>
                      {b.sl > 0 ? harga(b.sl) : 'belum'}
                    </span>
                    {' · TP '}
                    <span className={cn('angka', b.tp > 0 ? 'text-emerald-500/80' : 'text-zinc-600')}>
                      {b.tp > 0 ? harga(b.tp) : '—'}
                    </span>
                  </div>
                </Td>
                <Td className="angka text-right">
                  {b.ukuranUsd !== undefined ? (
                    <>
                      <div className="text-zinc-200">{uang(b.ukuranUsd)}</div>
                      <div className="text-[10.5px] text-zinc-600">{b.ukuran || '—'}</div>
                    </>
                  ) : (
                    <span className="text-zinc-400">{b.ukuran || '—'}</span>
                  )}
                </Td>
                <Td className="angka text-right text-zinc-400">{harga(b.entry)}</Td>
                <Td className={cn('angka text-right',
                  gerak === null ? 'text-zinc-600' : gerak >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                  {gerak === null ? '—' : `${gerak >= 0 ? '+' : ''}${gerak.toFixed(2)}%`}
                </Td>
                {/* Risiko ditulis BERTANDA MINUS, target bertanda plus.
                    Dua angka telanjang bersebelahan terbaca sebagai dua
                    jumlah yang sama sifatnya; tandanya yang memberi tahu
                    mana yang keluar dari saku dan mana yang masuk. */}
                <Td className={cn('angka text-right',
                  b.risikoUsd === undefined ? 'text-zinc-600' : 'text-red-400/90')}>
                  {b.risikoUsd === undefined ? '—' : `-${uang(b.risikoUsd)}`}
                </Td>
                <Td className={cn('angka text-right',
                  b.imbalUsd === undefined ? 'text-zinc-600' : 'text-emerald-500/90')}>
                  {b.imbalUsd === undefined ? '—' : `+${uang(b.imbalUsd)}`}
                </Td>
                <Td className={cn('angka text-right',
                  b.pnl === undefined ? 'text-zinc-600' : b.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                  {b.pnl === undefined ? '—' : uang(b.pnl, true)}
                </Td>
                {onTutup && jml && (
                  <Td className="text-right">
                    {/* Baris induk TIDAK diberi tombol Tutup. Satu klik yang
                        menutup sepuluh posisi sekaligus adalah tindakan yang
                        tidak bisa dibatalkan dan tidak terbaca dari kata
                        \"Tutup\" — yang ingin menutup, melepasnya dulu lalu
                        memilih sendiri mana yang ditutup. */}
                    <button
                      onClick={(e) => { e.stopPropagation();
                        setDilepas((p) => ({ ...p, [b.kunci]: !p[b.kunci] })); }}
                      /* Ikon, bukan kata. Tapi judulnya WAJIB tetap ada:
                         panah sendirian tidak memberi tahu berapa banyak
                         yang akan terbuka, dan lencana "19x" di kolom Pair
                         ada di seberang tabel. Yang ragu tinggal menyentuh. */
                      title={buka ? 'Gabungkan kembali jadi satu baris' : 'Tampilkan ' + jml + ' order aslinya'}
                      aria-label={buka ? 'Gabungkan kembali' : 'Lepas ' + jml + ' order'}
                      aria-expanded={!!buka}
                      className="inline-flex cursor-pointer items-center rounded border border-zinc-800 p-1 text-zinc-500 transition-colors hover:border-sky-500/40 hover:text-sky-300">
                      {buka ? <ChevronUp className="size-3.5" strokeWidth={2} />
                            : <ChevronDown className="size-3.5" strokeWidth={2} />}
                    </button>
                  </Td>
                )}
                {onTutup && !jml && (
                  <Td className="text-right">
                    {/* stopPropagation: barisnya juga bisa diklik (buka di
                        chart), dan tanpa ini menekan Tutup menjalankan
                        keduanya. Warna merah baru muncul saat disentuh —
                        tombol yang menyala merah terus mengundang klik
                        refleks pada tindakan yang tidak bisa dibatalkan. */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onTutup(b); }}
                      title="Tutup posisi ini di harga pasar"
                      className="cursor-pointer rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400">
                      Tutup
                    </button>
                  </Td>
                )}
              </Tr>
            );
          })}
        </tbody>
      </Tabel>
    </TabelBungkus>
  );
}
