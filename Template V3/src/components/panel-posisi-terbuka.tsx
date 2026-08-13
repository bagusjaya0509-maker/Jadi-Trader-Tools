import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, uang, harga as fHarga } from '@/lib/utils';
import { usePosisi } from '@/lib/data';
import { useAkunMt5, versiKurangDari, VERSI_EA_PENDING } from '@/lib/akun';
import { useEmosiPosisi, EMOSI } from '@/lib/emosi-posisi';
import { useHargaPasar } from '@/lib/harga';
import { TabelPosisi, type BarisPosisi } from '@/components/tabel-posisi';
import type { Sumber } from '@/data/contoh';
import { simbolDasarMt5 } from '@/lib/simbol';

/* ════════════════════════════════════════════════════════════════════════
   POSISI TERBUKA — dipindah dari Jurnal ke Chart & Backtest
   ════════════════════════════════════════════════════════════════════════
   Panel ini dulu tinggal di Jurnal. Pindah karena tempatnya salah: jurnal
   adalah tempat MENILAI yang sudah lewat, sementara posisi terbuka adalah
   sesuatu yang masih bisa DIPERBUAT — digeser SL-nya, ditutup, ditambah.
   Semua perbuatan itu terjadi di halaman chart, dan memisahkan "apa yang
   sedang jalan" dari tempat orang menanganinya memaksa bolak-balik
   halaman untuk satu keputusan.

   Dibuat komponen tersendiri, bukan disalin: kripto dan Trade-Fi memakai
   isi yang sama persis dan cuma berbeda sumbernya.
   ════════════════════════════════════════════════════════════════════════ */

/** Posisi yang SEDANG terbuka untuk sumber ini.
 *
 *  Kripto dari `public/posisiTerbuka` (dan dari bursa langsung kalau App
 *  Token ada); Trade-Fi dari laporan EA. Dua sumber berbeda, satu tampilan —
 *  yang ditanyakan sama: apa yang sedang berjalan sekarang. */
/** Order yang dipilih untuk disunting di chart. Bentuknya sengaja SATU
 *  untuk kedua pasar dan kedua jenis: yang membedakan cuma isian mana
 *  yang terisi, bukan bentuk datanya — pemanggilnya tidak perlu bercabang
 *  empat kali. */
export interface OrderSunting {
  pasar: 'kripto' | 'mt5';
  jenis: 'posisi' | 'pending';
  /** Simbol chart: "BTCUSDT" atau "MT5:XAUUSD". */
  simbolChart: string;
  /** Simbol asli di bursa/broker. */
  simbol: string;
  arah: 'BUY' | 'SELL';
  entry: number;
  sl: number;
  tp: number;
  /** Ukuran: jumlah koin (kripto) atau lot (MT5). */
  ukuran: number;
  /** Tiket MT5, atau id order pending kripto. */
  tiket?: string;
}

export function PanelPosisiTerbuka({ sumber, onSunting }: {
  sumber: Sumber;
  /** Klik baris = buka order itu di chart. Tanpa ini barisnya tidak bisa
   *  diklik sama sekali. */
  onSunting?: (o: OrderSunting) => void;
}) {
  const { data: posisiKripto, pending: pendingKripto, stop: stopKripto } = usePosisi();
  const mt5 = useAkunMt5();
  /* Order menggantung dari DUA pasar, disamakan bentuknya di sini.
     Keduanya menjawab pertanyaan yang sama — "order-ku sampai atau
     tidak?" — jadi keduanya pantas tampil dengan cara yang sama, walau
     satuannya beda: kripto memakai jumlah koin, MT5 memakai lot. */
  const pending = sumber === 'kripto'
    ? pendingKripto.map((o) => {
        /* SL/TP dicari dari simbol yang sama — di bursa ia order
           terpisah, bukan bagian dari order entry ini. Yang terdekat ke
           harga entry yang ditampilkan. */
        const sl = stopKripto.filter((x) => x.simbol === o.simbol && x.jenis === 'SL')
          .sort((a, b) => Math.abs(a.pemicu - o.harga) - Math.abs(b.pemicu - o.harga))[0];
        const tp = stopKripto.filter((x) => x.simbol === o.simbol && x.jenis === 'TP')
          .sort((a, b) => Math.abs(a.pemicu - o.harga) - Math.abs(b.pemicu - o.harga))[0];
        return {
          kunci: o.id, simbol: o.simbol, arah: o.arah,
          ukuran: o.qty.toLocaleString('id-ID', { maximumFractionDigits: 4 }),
          jenis: o.tipe.replace('_MARKET', ' Stop').replace('LIMIT', 'Limit'),
          harga: o.pemicu || o.harga,
          sl: sl?.pemicu ?? 0, tp: tp?.pemicu ?? 0,
        };
      })
    /* Yang paling BARU dipasang di atas. Order pending dibuat berurutan
       waktu, dan yang baru saja dikirim adalah yang sedang dipikirkan —
       menaruhnya di ekor daftar berarti ia harus dicari dulu. */
    : [...mt5.pending].sort((a, b) => b.waktu - a.waktu).map((o) => ({
        kunci: o.tiket, simbol: o.simbol, arah: o.arah,
        ukuran: `${o.lot} lot`,
        jenis: o.jenis.replace('_', ' '),
        harga: o.harga, sl: o.sl, tp: o.tp,
      }));

  const emosiPos = useEmosiPosisi();

  /* Ukuran, entry, SL, dan TP ikut ditampilkan — tanpa keempatnya, panel
     ini cuma memberi tahu ADA posisi, bukan posisi seperti apa. Kripto
     memakai jumlah koin (size order), Trade-Fi memakai lot; keduanya
     ditulis dengan satuannya sendiri karena "0,05" tanpa satuan berarti
     dua hal yang sangat berbeda di dua pasar itu. */
  /* Harga berjalan diambil sendiri di sini, sama seperti Dashboard.
     Tanpa itu `hargaKini` sama dengan entry — dan kolom Gerak akan
     menulis "+0.00%", yang terbaca sebagai "harga tidak bergerak"
     padahal artinya "harganya tidak kita ketahui". Salah satu dari dua
     itu bohong; yang jujur adalah mengambil harganya. */
  const hargaPasar = useHargaPasar(sumber === 'kripto' ? posisiKripto.map((p) => p.simbol) : []);

  const baris: BarisPosisi[] = sumber === 'kripto'
    ? posisiKripto.map((p) => ({
        kunci: p.id, simbol: p.simbol, arah: p.arah,
        ket: p.tf && p.tf !== '—' ? p.tf : p.venue,
        ukuran: p.jumlah ? p.jumlah.toLocaleString('id-ID', { maximumFractionDigits: 4 }) : '',
        entry: p.entry, hargaKini: hargaPasar[p.simbol], sl: p.sl, tp: p.tp,
        pnl: p.pnlFloat,
      }))
    : mt5.posisi.map((p) => ({
        kunci: p.tiket, simbol: p.simbol, arah: p.arah,
        ket: `#${p.tiket}`,
        ukuran: `${p.lot} lot`,
        entry: p.hargaBuka, hargaKini: p.hargaKini, sl: p.sl, tp: p.tp,
        pnl: p.profit,
        tiket: p.tiket,
      }));

  const total = baris.some((b) => b.pnl !== undefined)
    ? baris.reduce((s, b) => s + (b.pnl ?? 0), 0)
    : null;

  return (
    /* self-start: panel ini setinggi ISINYA, tidak ikut meregang
       mengikuti kolom kalender di sebelahnya. Kotak tinggi yang isinya
       dua baris terbaca seperti ada yang gagal dimuat. */
    <Panel className="self-start">
      <PanelHead
        /* Judul menyebut PASARNYA, sama persis dengan Dashboard —
           dua panel berdampingan yang sama-sama berjudul "Posisi
           Terbuka" memaksa membaca sub-judulnya dulu untuk tahu yang
           mana. */
        judul={sumber === 'kripto' ? 'Posisi Terbuka — Kripto' : 'Order Terbuka — Trade-Fi'}
        sub={sumber === 'kripto' ? 'Order yang sedang berjalan di Binance.' : 'Dari MetaTrader 5, lewat EA JadiTraderSync.'}
        kanan={
          total === null
            ? <span className="text-[11.5px] text-zinc-500">{baris.length} posisi</span>
            : <span className={cn('angka text-[12.5px]', total >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {uang(total, true)}
              </span>
        }
      />
      <div className="px-5 pb-5">
        {/* Susunan kolom SAMA dengan Dashboard: Pair | Size | Entry |
            Gerak | P/L, SL & TP di baris keterangan. Dulu di sini kartu
            sendiri — dan panel yang menjawab pertanyaan yang sama dengan
            bentuk berbeda memaksa orang belajar dua kali. Emosi jadi
            kolom terakhir; tetap bisa disunting, tetap dibaca sebagai
            data, bukan formulir. */}
        <TabelPosisi
          baris={baris}
          onKlikBaris={onSunting && ((b) => onSunting({
            pasar: sumber === 'kripto' ? 'kripto' : 'mt5',
            jenis: 'posisi',
            /* Nama DASAR, bukan nama broker: chart & tick dikirim EA
               dengan nama dasar. */
            simbolChart: sumber === 'kripto' ? b.simbol : `MT5:${simbolDasarMt5(b.simbol)}`,
            simbol: b.simbol,
            arah: b.arah,
            entry: b.entry, sl: b.sl, tp: b.tp,
            /* Ukuran dibaca dari sumber aslinya, bukan dari teks
               berformat di kolom Size — "1.234,5" akan jadi 1,2345 kalau
               diurai sebagai angka Inggris. */
            ukuran: sumber === 'kripto'
              ? (posisiKripto.find((p) => p.id === b.kunci)?.jumlah ?? 0)
              : (mt5.posisi.find((p) => p.tiket === b.kunci)?.lot ?? 0),
            tiket: b.tiket,
          }))}
          kosong={sumber === 'kripto'
            ? 'Tidak ada posisi kripto terbuka.'
            : mt5.terhubung === true ? 'Tidak ada posisi MT5 terbuka.' : mt5.ket}
          kolomEmosi={(b) => (
            <select
              value={emosiPos.peta[b.kunci] ?? ''}
              disabled={!emosiPos.bisaTulis}
              onChange={(e) => { void emosiPos.simpan(b.kunci, e.target.value, b.tiket).catch(() => {}); }}
              title="Emosi saat posisi ini berjalan — ikut tercatat di riwayat order saat ditutup"
              className={cn('cursor-pointer appearance-none border-0 bg-transparent p-0 text-right text-[11px] outline-none disabled:cursor-not-allowed',
                emosiPos.peta[b.kunci] ? 'text-zinc-300' : 'text-zinc-600')}>
              <option value="">—</option>
              {EMOSI.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
        />

        {/* Sama seperti di Dashboard: EA lama tidak bisa melaporkan
            pending, dan layar yang diam soal itu memberi kesan order-nya
            tidak terkirim. */}
        {sumber !== 'kripto' && mt5.terhubung === true && mt5.versiEa
          && versiKurangDari(mt5.versiEa, VERSI_EA_PENDING) && (
          <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
            EA v{mt5.versiEa} belum mengirim pending order.
            <span className="text-amber-200/60">
              {' '}Kompilasi ulang ke v{VERSI_EA_PENDING} (F7 di MetaEditor), lalu pasang ulang EA-nya.
            </span>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mt-3 border-t border-zinc-800/60 pt-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-amber-400/80">
              Menunggu harga · {pending.length} order
            </div>
            {/* Garis pemisah, bukan kotak berbingkai — order menunggu tidak
                boleh terlihat lebih berbobot daripada posisi yang benar-
                benar berjalan di atasnya. Empat terlihat, sisanya digulir
                supaya panelnya berhenti tumbuh. */}
            <div className={cn('gulir-senyap divide-y divide-zinc-800/60 overflow-y-auto',
              /* Tinggi tepat EMPAT baris, diukur langsung dari CSS
                 terkompilasi — bukan ditebak. Baris MT5 dua baris teks
                 (SL/TP ikut), baris kripto satu; tinggi yang sama untuk
                 keduanya akan memotong baris keempat di satu sisi dan
                 menampilkan enam di sisi lain. */
              /* ENAM baris terlihat, bukan empat: panel di bawahnya masih
                 punya ruang, dan daftar yang berhenti di empat memaksa
                 menggulir untuk hal yang sebenarnya muat. Angkanya
                 kelipatan tinggi baris yang sama seperti sebelumnya
                 (kripto 35,5 px; Trade-Fi 53,25 px). */
              sumber === 'kripto' ? 'max-h-[213px]' : 'max-h-[320px]')}>
              {pending.map((o) => (
                <div key={o.kunci}
                     onClick={onSunting ? () => onSunting({
                       pasar: sumber === 'kripto' ? 'kripto' : 'mt5',
                       jenis: 'pending',
                       simbolChart: sumber === 'kripto' ? o.simbol : `MT5:${simbolDasarMt5(o.simbol)}`,
                       simbol: o.simbol,
                       arah: o.arah,
                       entry: o.harga, sl: o.sl, tp: o.tp,
                       ukuran: sumber === 'kripto'
                         ? (pendingKripto.find((x) => x.id === o.kunci)?.qty ?? 0)
                         : (mt5.pending.find((x) => x.tiket === o.kunci)?.lot ?? 0),
                       tiket: o.kunci,
                     }) : undefined}
                     title={onSunting ? 'Buka di chart untuk mengubah harga/SL/TP' : undefined}
                     className={cn('py-2', onSunting && 'cursor-pointer rounded transition-colors hover:bg-zinc-800/40')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[12.5px] text-zinc-200">{o.simbol}</span>
                      <span className={cn('text-[10.5px]',
                        o.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                        {o.jenis}
                      </span>
                      <span className="angka shrink-0 text-[11px] text-zinc-400">{o.ukuran}</span>
                    </span>
                    <span className="angka shrink-0 text-[12px] text-amber-400/90">{fHarga(o.harga)}</span>
                  </div>
                  {/* SL/TP hanya ditulis kalau order-nya memang membawanya.
                      Order kripto pending belum punya penjaga sampai ia
                      ke-fill, dan menulis "SL —" untuk itu memberi kesan
                      SL-nya hilang, padahal memang belum waktunya ada. */}
                  {(o.sl > 0 || o.tp > 0) && (
                    <div className="mt-0.5 flex gap-4 text-[10.5px] text-zinc-600">
                      <span>SL <span className="angka text-red-400/90">{o.sl ? fHarga(o.sl) : '—'}</span></span>
                      <span>TP <span className="angka text-emerald-500/90">{o.tp ? fHarga(o.tp) : '—'}</span></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
