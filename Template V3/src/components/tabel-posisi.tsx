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
  if (!baris.length) {
    return <div className="py-5 text-center text-[12.5px] text-zinc-600">{kosong}</div>;
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
          {baris.map((b) => {
            /* Gerak butuh harga berjalan. Tanpa itu kolomnya diisi tanda
               hubung — BUKAN 0%, yang akan terbaca sebagai "harga tidak
               bergerak" padahal artinya "harganya tidak kita ketahui". */
            const bisaGerak = b.hargaKini !== undefined && b.entry > 0;
            const gerak = bisaGerak
              ? ((b.hargaKini! - b.entry) / b.entry) * 100 * (b.arah === 'BUY' ? 1 : -1)
              : null;
            return (
              <Tr key={b.kunci}
                  onClick={onKlikBaris ? () => onKlikBaris(b) : undefined}
                  title={onKlikBaris ? 'Buka di chart untuk mengubah SL/TP' : undefined}
                  className={onKlikBaris ? 'cursor-pointer transition-colors hover:bg-zinc-800/40' : undefined}>
                <Td>
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
                {onTutup && (
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
