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

   Satu komponen, satu susunan kolom: Pair | Size | Entry | Gerak | P/L,
   dengan SL & TP menumpang baris keterangan di bawah nama pair. SL/TP
   tidak dijadikan kolom sendiri karena lima kolom sudah penuh di panel
   setengah lebar — tapi ia WAJIB terlihat, karena "posisi tanpa stop"
   adalah hal terpenting yang bisa diberitahukan panel ini.
   ════════════════════════════════════════════════════════════════════════ */

export interface BarisPosisi {
  kunci: string;
  simbol: string;
  arah: 'BUY' | 'SELL';
  /** Sudah lengkap dengan satuannya: "223,8 THETA" atau "0,01 lot". */
  ukuran: string;
  entry: number;
  /** Harga berjalan — dipakai menghitung Gerak. */
  hargaKini?: number;
  sl: number;
  tp: number;
  /** undefined = tidak disiarkan (bukan nol). */
  pnl?: number;
  /** Venue, timeframe, atau nomor tiket. */
  ket?: string;
  /** Tiket MT5 — dipakai penyimpan emosi. */
  tiket?: string;
}

export function TabelPosisi({ baris, kolomEmosi, kosong, onKlikBaris }: {
  baris: BarisPosisi[];
  /** Klik baris = buka order ini di chart untuk disunting. Kalau tidak
   *  diberikan, barisnya tidak bisa diklik sama sekali — bukan bisa
   *  diklik tapi tidak melakukan apa-apa. */
  onKlikBaris?: (b: BarisPosisi) => void;
  /** Sel emosi per baris (Jurnal). Kolomnya hanya muncul kalau diberikan. */
  kolomEmosi?: (b: BarisPosisi) => React.ReactNode;
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
            <Th className="text-right">P/L</Th>
            {kolomEmosi && <Th className="text-right">Emosi</Th>}
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
                  <span className="text-zinc-200">{b.simbol}</span>
                  <span className={cn('ml-1.5 text-[10.5px]',
                    b.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                    {b.arah}
                  </span>
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
                <Td className="angka text-right text-zinc-400">{b.ukuran || '—'}</Td>
                <Td className="angka text-right text-zinc-400">{harga(b.entry)}</Td>
                <Td className={cn('angka text-right',
                  gerak === null ? 'text-zinc-600' : gerak >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                  {gerak === null ? '—' : `${gerak >= 0 ? '+' : ''}${gerak.toFixed(2)}%`}
                </Td>
                <Td className={cn('angka text-right',
                  b.pnl === undefined ? 'text-zinc-600' : b.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                  {b.pnl === undefined ? '—' : uang(b.pnl, true)}
                </Td>
                {kolomEmosi && <Td className="text-right">{kolomEmosi(b)}</Td>}
              </Tr>
            );
          })}
        </tbody>
      </Tabel>
    </TabelBungkus>
  );
}
