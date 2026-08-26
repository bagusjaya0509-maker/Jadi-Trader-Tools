import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Copy, TriangleAlert } from 'lucide-react';
import { cn, uang } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { daftarSimbolMt5 } from '@/lib/pasar';
import { simbolDasarMt5 } from '@/lib/simbol';
import { kirimPerintahMt5, tungguHasilMt5 } from '@/lib/mt5-order';
import { useAkunMt5 } from '@/lib/akun';
import {
  bacaSetelanRisiko, kontrakBawaan, kontrakBerlaku, deteksiJenisAkun, besarPip,
  lotUntukCopy,
} from '@/lib/ukuran-posisi';
import { daftarLangganan } from '@/lib/copy-langganan';

/* ════════════════════════════════════════════════════════════════════════
   COPY TRADE — TRADE-FI (MT5)
   ════════════════════════════════════════════════════════════════════════
   Meniru sinyal orang lain ke akun sendiri. Yang ditiru LEVELNYA, bukan
   ukurannya: entry, SL, dan TP milik analis; berapa lot yang dipasang
   dihitung dari modal dan toleransi risiko PENGGUNA sendiri.

   Itu bukan kelonggaran, itu intinya. Analis dengan modal $50.000
   memasang 0,5 lot untuk risiko 1%; orang yang meniru lotnya mentah-mentah
   dengan modal $500 mempertaruhkan seratus kali lipat porsinya. Sinyal
   yang sama, akun yang habis.

   KRIPTO SENGAJA BELUM ADA di sini. Bukan karena rumusnya sulit, tapi
   karena jalurnya lain: MT5 lewat antrean perintah yang sudah dijaga login
   Firebase dan dieksekusi EA di terminal orangnya sendiri, sementara
   kripto menuntut kunci API bursa. Menggabung keduanya di satu panel
   membuat satu tombol punya dua arti keamanan yang sangat berbeda.
   ════════════════════════════════════════════════════════════════════════ */

const ISIAN = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-200 outline-none transition-colors focus:border-zinc-600';

export function PanelCopyTradeFi({ pasangan, arah, entry, sl, tp, penulis, tutup }: {
  pasangan: string;
  arah: 'BUY' | 'SELL';
  entry: number;
  sl: number;
  tp: number;
  penulis: string;
  tutup: () => void;
}) {
  const { pengguna } = useAuth();
  const akun = useAkunMt5();
  /* Ukuran kontrak TIDAK ikut disimpan: ia milik SIMBOLNYA, bukan milik
     orangnya. Satu slot simpanan untuk angka yang berbeda tiap simbol
     berarti nilai emas terbawa ke sinyal EURUSD berikutnya. */
  const [kontrak, setKontrak] = useState(() => kontrakBawaan(pasangan));
  const [simbolBroker, setSimbolBroker] = useState<string | null>(null);
  const [memuatSimbol, setMemuatSimbol] = useState(true);
  /* BATAS RUGI DOLAR — sama persis dengan yang dipakai panel langganan.
     Di sinilah ia paling penting: panel inilah yang benar-benar mengirim
     order. Batas yang cuma hidup di layar setelan dan tidak ikut ke jalur
     eksekusi bukan batas, ia hiasan.

     Bawaannya diturunkan dari modal x persen yang tersimpan, jadi orang
     yang sudah menyetel risikonya tidak menemukan kolom kosong. */
  /* Bawaannya dari LANGGANAN yang sudah disetel orangnya, bukan angka
     pabrik. Yang sudah menetapkan batas rugi di panel Copy Signal tidak
     seharusnya menetapkannya lagi tiap kali menyalin satu sinyal. */
  const [rugiMaks, setRugiMaks] = useState(() => {
    const l = daftarLangganan(pengguna?.uid).find((x) => x.rugiMaks > 0);
    if (l) return l.rugiMaks;
    const x = bacaSetelanRisiko(pengguna?.uid);
    return Math.max(1, Math.round(x.modal * (x.risiko / 100) * 100) / 100);
  });
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [selesai, setSelesai] = useState(false);

  /* ── NAMA SIMBOL DI BROKER PENGGUNA, bukan nama di sinyalnya ─────────
     Analis menulis "XAUUSD"; terminal orang yang meniru mungkin menamainya
     "XAUUSDc", "XAUUSD.m", atau "GOLD". Mengirim nama sinyal apa adanya
     akan ditolak EA — dan ditolak adalah hasil terbaiknya. Yang lebih
     buruk: broker yang kebetulan punya simbol bernama sama tapi kontrak
     berbeda. */
  useEffect(() => {
    let hidup = true;
    const cari = pasangan.replace(/^MT5:/i, '').toUpperCase();
    daftarSimbolMt5()
      .then((daftar) => {
        if (!hidup) return;
        const persis = daftar.find((s) => s.toUpperCase() === cari);
        const sesuaiDasar = daftar.find((s) => simbolDasarMt5(s) === cari);
        setSimbolBroker(persis ?? sesuaiDasar ?? null);
      })
      .catch(() => { if (hidup) setSimbolBroker(null); })
      .finally(() => { if (hidup) setMemuatSimbol(false); });
    return () => { hidup = false; };
  }, [pasangan]);

  const jarakHarga = Math.abs(entry - sl);
  const pip = besarPip(pasangan);
  /* Jarak SL SINYAL INI yang dipakai, bukan contoh. Di sinilah batas dolar
     benar-benar bekerja: sinyal ber-SL lebar otomatis dapat lot lebih kecil,
     jadi angka rugi di bawah tetap sama berapa pun analis melebarkan
     stopnya. */
  /* DIBACA dari mata uang terminal, tidak ditanyakan — jawabannya sudah
     dipegang aplikasi, dan salah jawab menggeser lot seratus kali. */
  const jenisAkun = deteksiJenisAkun(akun.mataUang);
  const kontrakEfektif = kontrakBerlaku(kontrak, jenisAkun);
  const h = useMemo(
    () => lotUntukCopy({ lotDiminta: 0, rugiMaks, kontrak: kontrakEfektif, jarakHarga }),
    [rugiMaks, kontrakEfektif, jarakHarga]);
  const lot = h.lot;
  /* Rugi SESUDAH pembulatan lot, bukan angka yang diketik. Lot dibulatkan ke
     bawah, jadi yang benar-benar dipertaruhkan selalu sedikit lebih kecil —
     dan yang ditampilkan harus yang benar-benar terjadi. */
  const risikoNyata = h.rugi;
  const jarakPersen = entry > 0 ? (jarakHarga / entry) * 100 : 0;

  const sisiBenar = arah === 'BUY' ? sl < entry && tp > entry : sl > entry && tp < entry;
  const halangan = !pengguna ? 'Masuk dulu untuk memakai Copy Trade.'
    : !(entry > 0) || !(sl > 0) ? 'Sinyal ini belum punya entry dan SL yang bisa dihitung.'
    : !sisiBenar ? 'SL/TP sinyal ini berada di sisi yang salah terhadap entry — tidak dikirim.'
    : h.sebab ? h.sebab
    : memuatSimbol ? ''
    : !simbolBroker ? `Terminal MT5-mu tidak punya simbol yang cocok dengan ${pasangan}. Pastikan EA jalan dan simbolnya tampil di Market Watch.`
    : '';

  async function copySatu() {
    if (halangan || !simbolBroker) return;
    setSibuk(true);
    setKabar('Mengirim ke terminal MT5…');
    try {
      /* entry DIIKUTSERTAKAN: rencananya yang ditiru, bukan harga sekarang.
         EA v2.04+ yang memutuskan market atau pending — hanya terminal yang
         tahu harga pasar pada detik eksekusi, dan hanya ia yang tahu stops
         level brokernya. */
      const { id } = await kirimPerintahMt5({
        aksi: 'BUKA', simbol: simbolBroker, arah, lot, sl, tp, entry,
      });
      const h = await tungguHasilMt5(id);
      if (h.status === 'sukses') {
        setSelesai(true);
        setKabar(`Terkirim — ${h.pesan}`);
      } else {
        setKabar(`Gagal: ${h.pesan}`);
      }
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal mengirim perintah.');
    } finally { setSibuk(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
         onClick={tutup}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
           className="relative w-full max-w-[380px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <Copy className="size-4 text-zinc-400" strokeWidth={1.8} />
          <span className="text-[13px] font-medium text-zinc-100">Copy 1 trade</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-zinc-400">
            Trade-Fi
          </span>
          <button onClick={tutup} aria-label="Tutup"
            className="ml-auto cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-200">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="px-4 py-3">
          {/* Level analisnya — ditampilkan apa adanya dan TIDAK bisa disunting
              di sini. Panel ini meniru rencana orang lain; mengubah levelnya
              berarti itu bukan lagi sinyalnya, dan hasilnya akan tercatat
              atas nama analis yang tidak pernah menyarankannya. */}
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-zinc-100">{pasangan}</span>
            <span className={cn('text-[11px] font-medium',
              arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{arah}</span>
            <span className="ml-auto truncate text-[10.5px] text-zinc-600">oleh {penulis}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2">
            {([['Entry', entry, 'text-zinc-200'],
               ['SL', sl, 'text-red-400'],
               ['TP', tp, 'text-emerald-500']] as const).map(([k, v, w]) => (
              <div key={k}>
                <div className="text-[9.5px] uppercase tracking-wide text-zinc-600">{k}</div>
                <div className={cn('angka text-[12px]', w)}>{v || '—'}</div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 text-[10.5px] text-zinc-500">
            Akun terbaca sebagai{' '}
            <span className={jenisAkun === 'cent' ? 'text-amber-300' : 'text-zinc-300'}>{jenisAkun}</span>
            {jenisAkun === 'cent' && ' — 1 lot = 1/100 standar'}
            {akun.saldo != null && <span className="text-zinc-700"> · saldo {uang(akun.saldo)}</span>}
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {/* DOLAR, bukan persen. Yang dirasakan orang saat posisinya merah
                bukan persen melainkan dolar, dan persen menuntut ia mengalikan
                di kepalanya lebih dulu untuk tahu apa yang dipertaruhkan. */}
            <label className="block">
              <span className="mb-1 block text-[10.5px] text-amber-300/80">Rugi maks ($)</span>
              <input value={rugiMaks} inputMode="decimal"
                onChange={(e) => setRugiMaks(Math.max(0, Number(e.target.value) || 0))}
                className={cn(ISIAN, 'angka border-amber-500/30')} />
            </label>
            {/* Ukuran kontrak BISA DISUNTING: ia ditebak dari nama simbolnya,
                dan broker tidak sepakat (emas 100 oz di sebagian, 10 di
                sebagian). Tebakan yang tidak bisa dikoreksi akan diam-diam
                salah, dan salahnya berupa lot yang terlalu besar. */}
            <label className="block">
              <span className="mb-1 block text-[10.5px] text-zinc-500">Kontrak/lot</span>
              <input value={kontrak} inputMode="decimal"
                onChange={(e) => setKontrak(Math.max(0, Number(e.target.value) || 0))}
                className={cn(ISIAN, 'angka')} />
            </label>
          </div>

          <div className="mt-3 space-y-1 rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5 text-[11px]">
            <Baris k="Jarak SL" v={jarakHarga > 0
              ? `${jarakHarga.toFixed(pip < 0.01 ? 5 : 2)} (${(jarakHarga / pip).toFixed(0)} pip · ${jarakPersen.toFixed(2)}%)`
              : '—'} />
            <Baris k="Batas rugimu" v={rugiMaks > 0 ? uang(rugiMaks) : '—'} />
            <Baris k="Rugi kalau SL kena" v={lot >= 0.01 ? uang(risikoNyata) : '—'}
              ket="setelah lot dibulatkan ke bawah" />
            <div className="mt-1.5 flex items-baseline gap-2 border-t border-zinc-800/70 pt-2">
              <span className="text-[11px] text-zinc-500">Lot dikirim</span>
              <span className="angka ml-auto text-[16px] font-semibold text-zinc-100">
                {lot >= 0.01 ? lot.toFixed(2) : '—'}
              </span>
            </div>
            {simbolBroker && (
              <div className="text-[10px] text-zinc-600">
                ke simbol <span className="angka text-zinc-400">{simbolBroker}</span> di terminalmu
              </div>
            )}
          </div>

          {halangan && (
            <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-2.5 py-2 text-[11px] leading-relaxed text-amber-200">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              {halangan}
            </div>
          )}

          <button
            onClick={() => void copySatu()}
            disabled={!!halangan || sibuk || selesai || memuatSimbol}
            className={cn('mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors',
              'bg-zinc-100 text-zinc-950 hover:bg-white',
              'disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500')}>
            {sibuk && <Loader2 className="size-3.5 animate-spin" />}
            {selesai ? 'Sudah dikirim' : sibuk ? 'Mengirim…' : `Copy 1 trade — ${lot >= 0.01 ? lot.toFixed(2) : '0'} lot`}
          </button>

          {kabar && (
            <div className={cn('mt-2 text-[11px] leading-relaxed',
              selesai ? 'text-emerald-400' : 'text-zinc-400')}>{kabar}</div>
          )}

          {/* Dikatakan SEKARANG, bukan setelah orangnya mencari-cari. Order
              yang menggantung bisa dibatalkan, tapi tempatnya bukan di sini
              — dan panel yang diam soal itu membuat orang mengira sekali
              tekan berarti tidak bisa mundur lagi. */}
          <p className="mt-2.5 text-[10.5px] leading-relaxed text-zinc-600">
            Lot dihitung dari <span className="text-amber-300/90">batas rugimu</span>,
            bukan dari lot analis — SL yang lebih lebar berarti lot yang lebih kecil,
            bukan rugi yang lebih besar. Entry-nya mengikuti rencana analis; kalau
            harga belum menyentuhnya, EA memasangnya sebagai pending — batalkan lewat
            tabel Order Terbuka di Chart &amp; Entry.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Baris({ k, v, ket }: { k: string; v: string; ket?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-zinc-500">{k}</span>
      {ket && <span className="text-[9.5px] text-zinc-700">{ket}</span>}
      <span className="angka ml-auto text-zinc-200">{v}</span>
    </div>
  );
}
