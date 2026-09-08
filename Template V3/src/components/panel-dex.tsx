import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Loader2, TriangleAlert, X, CandlestickChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  adaDompet, sambungDompet, alamatTersambung, rantaiKini,
  bacaAgen, hapusAgen, agenKedaluwarsa, type AgenTersimpan,
} from '@/lib/dex-dompet';
import { tautkanDompetDiam } from '@/lib/profil-pengguna';
import { KartuDompet } from '@/components/ui/wallet-card-2';
import {
  setujuiAgen, keadaanAkun, orderTerbuka, kirimOrderDex, tutupPosisiDex,
  batalOrderDex, cariAset, hargaKini,
  type KeadaanDex, type OrderDex,
} from '@/lib/dex-hl';

/* ════════════════════════════════════════════════════════════════════════
   DEX TRADING — PROTOTIPE NON-KUSTODIAL
   ════════════════════════════════════════════════════════════════════════
   Menjawab satu pertanyaan yang dibawa pemilik: bisakah situs ini jadi
   tempat orang menghubungkan dompetnya sendiri lalu langsung trading?

   Bisa — dan halaman ini buktinya, dengan batas yang sengaja tegas:

     · TIDAK ADA VPS di jalur order. Peramban bicara langsung ke
       api.hyperliquid.xyz. Selama order tidak lewat server kami, tidak ada
       satu detik pun di mana kami memegang perintah orang lain.
     · TIDAK ADA builder fee. Satu baris konfigurasi memisahkan "situs yang
       menampilkan bursa" dari "pihak yang mengambil potongan dari
       transaksi orang" — dan yang kedua adalah kategori hukum yang
       berbeda. Baris itu sengaja belum ada.
     · TIDAK MENYENTUH jalur order pemilik. Chart & Entry tetap lewat
       order-nyata.ts → VPS → kunci agent milik pemilik. Dua jalur, dua
       kunci, dua tingkat risiko; menyatukannya berarti satu kekeliruan di
       sini bisa menyentuh uang di sana.

   ── KENAPA PEMILIK SAJA, UNTUK SEKARANG ─────────────────────────────────
   Halaman ini mengirim order uang sungguhan. Membukanya untuk umum bukan
   keputusan teknis melainkan keputusan hukum — menyediakan akses perpetual
   futures ke pengguna ritel lewat frontend sendiri adalah kegiatan yang
   diatur, dan non-kustodial tidak otomatis membebaskan. Gerbangnya dibuka
   sesudah ada pendapat hukum, bukan sesudah kodenya rapi.
   ════════════════════════════════════════════════════════════════════════ */

const KOTAK = 'w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 '
            + 'text-[13px] text-zinc-100 outline-none focus:border-zinc-500';
const TOMBOL = 'flex cursor-pointer items-center justify-center gap-1.5 rounded-md '
             + 'bg-zinc-100 px-3 py-1.5 text-[12.5px] font-semibold text-zinc-950 '
             + 'transition-colors hover:bg-white disabled:cursor-default disabled:opacity-50';
const TOMBOL2 = 'flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 '
              + 'px-2.5 py-1 text-[11.5px] text-zinc-300 transition-colors '
              + 'hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40';

/* ── CATATAN KESELAMATAN DIBACA SEKALI ────────────────────────────────
   Kalimatnya penting tapi tidak berubah, dan sesuatu yang tidak berubah
   berhenti dibaca sesudah kali kedua — yang tersisa cuma kotak kuning
   setinggi enam baris di panel selebar 180 px. Diminta pemilik 8 Sep 2026
   supaya tampil sekali lalu berhenti.

   Ditandai saat pertama digambar, bukan saat ditutup: kalau menunggu
   tombol ditutup, orang yang menggulir lewat akan melihatnya lagi selamanya.
   Isi yang paling perlu diingat — bahwa agent wallet TIDAK BISA menarik
   dana — tetap tertulis di kartu "Aktifkan trading", yaitu tepat pada saat
   tanda tangannya diminta. */
const KUNCI_PERINGATAN = 'jt.dexPeringatanDibaca';
/* Saldo disamarkan bertahan antar muat halaman: yang menyalakannya sedang
   berbagi layar atau merekam, dan keadaan itu berlangsung lebih lama
   daripada satu kunjungan. */
const KUNCI_SEMBUNYI = 'jt.dexSaldoSembunyi';

const uang = (n: number) => '$' + n.toLocaleString('id-ID', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const pendek = (a: string) => a.slice(0, 6) + '…' + a.slice(-4);

export function PanelDex({ koinChart, sempit }: {
  /** Koin yang sedang tampil di chart, tanpa akhiran USDT. Dipakai HANYA
   *  sebagai isian awal — sesudah orangnya menyentuh kotaknya, koin di sini
   *  miliknya, bukan milik chart. Panel order yang berubah sendiri tiap kali
   *  chart digeser adalah panel yang tidak bisa dipakai. */
  koinChart?: string;
  /** Satu kolom, padat — untuk dipasang di sisi chart. */
  sempit?: boolean;
}) {
  const [alamat, setAlamat] = useState<string | null>(null);
  const [rantai, setRantai] = useState(0);
  const [agen, setAgen] = useState<AgenTersimpan | null>(null);
  const [keadaan, setKeadaan] = useState<KeadaanDex | null>(null);
  const [order, setOrder] = useState<OrderDex[]>([]);
  const [sibuk, setSibuk] = useState<string>('');
  const [galat, setGalat] = useState('');
  const [kabar, setKabar] = useState('');
  const [saldoSembunyi, setSaldoSembunyi] = useState(() => {
    try { return localStorage.getItem(KUNCI_SEMBUNYI) === '1'; } catch { return false; }
  });
  function aturSembunyi(v: boolean) {
    setSaldoSembunyi(v);
    try { localStorage.setItem(KUNCI_SEMBUNYI, v ? '1' : '0'); } catch { /* mode privat */ }
  }
  const [tampilPeringatan, setTampilPeringatan] = useState(() => {
    try { return localStorage.getItem(KUNCI_PERINGATAN) !== '1'; } catch { return true; }
  });
  useEffect(() => {
    if (!tampilPeringatan) return;
    try { localStorage.setItem(KUNCI_PERINGATAN, '1'); } catch { /* mode privat */ }
  }, [tampilPeringatan]);

  /* Isian tiket. Disimpan sebagai TEKS, bukan angka — isian angka yang
     menyimpan number tidak bisa diketik: "0." berubah jadi 0 di tengah
     ketikan dan titiknya hilang, jadi harga desimal mustahil dimasukkan
     tangan. Diurai saat dipakai, bukan saat diketik. */
  const [koin, setKoin] = useState('BTC');
  const [arah, setArah] = useState<'BUY' | 'SELL'>('BUY');
  const [jenis, setJenis] = useState<'MARKET' | 'LIMIT'>('LIMIT');
  const [modalTeks, setModalTeks] = useState('10');
  const [levTeks, setLevTeks] = useState('2');
  const [hargaTeks, setHargaTeks] = useState('');
  const [slTeks, setSlTeks] = useState('');
  const [tpTeks, setTpTeks] = useState('');
  const [pasar, setPasar] = useState(0);

  const modal = Number(modalTeks) || 0;
  const lev = Number(levTeks) || 1;

  /* ── Sambungan yang SUDAH ada, tanpa popup ───────────────────────────
     Halaman yang memunculkan popup MetaMask begitu dibuka mengajari orang
     menekan "tolak" secara refleks — dan refleks itu ia bawa ke permintaan
     tanda tangan yang sungguhan. */
  useEffect(() => {
    void (async () => {
      const a = await alamatTersambung();
      if (!a) return;
      setAlamat(a);
      tautkanDompetDiam(a);
      setAgen(bacaAgen(a));
      setRantai(await rantaiKini());
    })();
  }, []);

  /* Dompet bisa berganti akun atau berganti jaringan tanpa halaman ini
     tahu. Tanpa dua pendengar ini, layar tetap menampilkan akun lama —
     dan order berikutnya berangkat ke akun yang tidak sedang dilihat. */
  useEffect(() => {
    const p = typeof window !== 'undefined' ? window.ethereum : null;
    const pasang = p?.on;
    const lepas = p?.removeListener;
    if (!p || !pasang) return;
    const gantiAkun = (...a: unknown[]) => {
      const baru = (a[0] as string[])?.[0]?.toLowerCase() ?? null;
      setAlamat(baru);
      if (baru) tautkanDompetDiam(baru);
      setAgen(baru ? bacaAgen(baru) : null);
      setKeadaan(null);
      setOrder([]);
    };
    const gantiRantai = () => { void rantaiKini().then(setRantai); };
    pasang.call(p, 'accountsChanged', gantiAkun);
    pasang.call(p, 'chainChanged', gantiRantai);
    return () => {
      lepas?.call(p, 'accountsChanged', gantiAkun);
      lepas?.call(p, 'chainChanged', gantiRantai);
    };
  }, []);

  const segarkan = useCallback(async (a: string) => {
    try {
      const [k, o] = await Promise.all([keadaanAkun(a), orderTerbuka(a)]);
      setKeadaan(k);
      setOrder(o);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membaca akun dari Hyperliquid.');
    }
  }, []);

  useEffect(() => {
    if (!alamat) return;
    void segarkan(alamat);
    const jam = setInterval(() => { void segarkan(alamat); }, 15_000);
    return () => clearInterval(jam);
  }, [alamat, segarkan]);

  /* Harga pasar koin yang sedang diketik — dipakai mengisi harga limit
     bawaan dan menghitung ukuran di pratinjau. */
  useEffect(() => {
    let hidup = true;
    const ambil = () => {
      void hargaKini(koin.trim().toUpperCase())
        .then((h) => { if (hidup) setPasar(h); })
        .catch(() => { if (hidup) setPasar(0); });
    };
    ambil();
    const jam = setInterval(ambil, 10_000);
    return () => { hidup = false; clearInterval(jam); };
  }, [koin]);

  /* Harga limit diisikan SEKALI saat kotaknya masih kosong, lalu tidak
     pernah ditimpa lagi. Menimpanya tiap 10 detik akan menghapus angka
     yang sedang diketik orangnya di tengah kalimat. */
  useEffect(() => {
    if (jenis === 'LIMIT' && !hargaTeks && pasar > 0) setHargaTeks(String(pasar));
  }, [jenis, hargaTeks, pasar]);

  /* ── KOIN IKUT POSISI YANG SEDANG TERBUKA ──────────────────────────
     Sekali saja, saat posisi pertama terbaca. Yang paling mungkin ingin
     diurus orang yang baru membuka halaman ini adalah posisi yang SEDANG
     berjalan — bukan BTC, yang cuma kebetulan jadi bawaan.

     Sekali, bukan tiap penyegaran: sesudah itu koinnya milik orangnya. Isian
     yang ditimpa tiap 15 detik adalah isian yang tidak bisa diketik. */
  const koinTerisi = useRef(false);
  /* Chart yang menentukan koin awal kalau panelnya dipasang di sisi chart —
     tapi tetap SEKALI, dengan alasan yang sama seperti di bawah. */
  useEffect(() => {
    if (koinTerisi.current || !koinChart) return;
    koinTerisi.current = true;
    setKoin(koinChart.toUpperCase());
    setHargaTeks('');
  }, [koinChart]);

  useEffect(() => {
    if (koinTerisi.current) return;
    const p = keadaan?.posisi[0];
    if (!p) return;
    koinTerisi.current = true;
    setKoin(p.koin);
    setArah(p.arah === 'SHORT' ? 'SELL' : 'BUY');
    setHargaTeks('');
  }, [keadaan]);

  const nilaiPosisi = modal * lev;
  const hargaAcuan = jenis === 'LIMIT' ? (Number(hargaTeks) || 0) : pasar;
  const perkiraanUkuran = hargaAcuan > 0 ? nilaiPosisi / hargaAcuan : 0;

  const agenSiap = !!agen && !agenKedaluwarsa(agen);
  const sisaHari = useMemo(
    () => (agen ? Math.max(0, Math.ceil((agen.sampai - Date.now()) / 86400000)) : 0),
    [agen]);

  function bersih() { setGalat(''); setKabar(''); }

  async function jalankan(nama: string, kerja: () => Promise<void>) {
    bersih();
    setSibuk(nama);
    try { await kerja(); }
    catch (e) {
      /* Penolakan dompet BUKAN kegagalan sistem, dan menampilkannya sebagai
         galat merah panjang membuat orang mengira ada yang rusak padahal ia
         sendiri yang menekan "tolak". */
      const p = e instanceof Error ? e.message : String(e);
      setGalat(/user rejected|denied|4001/i.test(p) ? 'Tanda tangan dibatalkan di dompet.' : p);
    }
    finally { setSibuk(''); }
  }

  const sambung = () => jalankan('sambung', async () => {
    const a = await sambungDompet();
    setAlamat(a);
    /* Alamatnya ditautkan ke akun Google-nya. Bukan supaya panel ini bisa
       bekerja — ia sudah bekerja tanpa itu — melainkan supaya tautannya
       BERTAHAN sesudah sambungan peramban hilang. Jurnal yang mengisi
       dirinya sendiri dari riwayat on-chain perlu tahu alamat siapa yang
       harus dibaca saat dompetnya sedang tidak terbuka sama sekali. */
    tautkanDompetDiam(a);
    setAgen(bacaAgen(a));
    setRantai(await rantaiKini());
  });

  /* Pembungkus supaya ikon segarkan di kartu bisa berputar. `segarkan`
     sendiri dipakai juga oleh polling 15 detik, dan yang otomatis tidak
     boleh menyalakan penanda sibuk — panel yang berkedip tiap seperempat
     menit terbaca seperti sedang rusak. */
  const segarkanKlik = () => jalankan('segar', async () => {
    if (alamat) await segarkan(alamat);
  });

  const aktifkan = () => jalankan('agen', async () => {
    if (!alamat) return;
    const a = await setujuiAgen(alamat);
    setAgen(a);
    const hari = Math.round((a.sampai - Date.now()) / 86400000);
    setKabar(`Trading aktif. Agent wallet ${pendek(a.alamat)} berlaku ${hari} hari.`);
  });

  const putuskan = () => {
    if (!alamat) return;
    if (!confirm('Hapus agent wallet dari peramban ini?\n\n'
      + 'Posisi yang sedang terbuka TIDAK ikut tertutup — ia tetap hidup di Hyperliquid '
      + 'dan bisa diurus dari app.hyperliquid.xyz.\n\n'
      + 'Persetujuan di sisi Hyperliquid tidak ikut dicabut; untuk mencabutnya, '
      + 'buka Hyperliquid → API lalu hapus agent "jaditrader".')) return;
    hapusAgen(alamat);
    setAgen(null);
    bersih();
  };

  const kirim = () => jalankan('order', async () => {
    if (!alamat) return;
    const k = koin.trim().toUpperCase();
    const aset = await cariAset(k);
    if (!aset) throw new Error(`${k} tidak ada di Hyperliquid perps.`);
    if (!(modal > 0)) throw new Error('Modal wajib lebih dari nol.');
    if (jenis === 'LIMIT' && !(Number(hargaTeks) > 0)) throw new Error('Harga limit wajib diisi.');

    const ket = jenis === 'LIMIT'
      ? `limit ${hargaTeks}`
      : `market (± ${pasar > 0 ? pasar.toPrecision(5) : '?'})`;
    if (!confirm(`Kirim order UANG SUNGGUHAN ke Hyperliquid?\n\n`
      + `${arah} ${k} ${ket}\n`
      + `Modal ${uang(modal)} × ${lev}x = nilai posisi ${uang(nilaiPosisi)}\n`
      + `Perkiraan ukuran ${perkiraanUkuran.toPrecision(6)} ${k}\n\n`
      + `Ditandatangani agent wallet di peramban ini, tanpa lewat server Jadi Trader.`)) return;

    const h = await kirimOrderDex({
      pemilik: alamat, koin: k, arah, modal, leverage: lev, jenis,
      hargaLimit: Number(hargaTeks) || undefined,
      sl: Number(slTeks) || undefined,
      tp: Number(tpTeks) || undefined,
    });
    /* Kabar stop DIDAHULUKAN kalau ada. "Terisi 124 @ 0,24" yang benar tapi
       menyembunyikan "SL gagal dipasang" adalah kalimat yang membuat orang
       menutup layar dengan tenang di atas posisi telanjang. */
    if (h.stopKabar) { setGalat(h.stopKabar); await segarkan(alamat); return; }
    setKabar(h.terisi
      ? `Terisi ${h.terisi.ukuran} ${h.koin} @ ${h.terisi.harga}.`
      : h.menggantung
        ? `Order menggantung di buku (oid ${h.menggantung}) — ${h.ukuran} ${h.koin} @ ${h.hargaKirim}.`
        : `Order dikirim, bursa belum melaporkan isian maupun order menggantung.`);
    await segarkan(alamat);
  });

  const tutup = (k: string) => jalankan('tutup-' + k, async () => {
    if (!alamat) return;
    if (!confirm(`Tutup SELURUH posisi ${k} sekarang di harga pasar?`)) return;
    const h = await tutupPosisiDex(alamat, k);
    setKabar(h.terisi
      ? `Posisi ${k} ditutup — ${h.terisi.ukuran} @ ${h.terisi.harga}.`
      : `Perintah tutup ${k} terkirim, tapi bursa belum melaporkan isian. Periksa lagi sebentar.`);
    await segarkan(alamat);
  });

  const batal = (o: OrderDex) => jalankan('batal-' + o.oid, async () => {
    if (!alamat) return;
    await batalOrderDex(alamat, o.koin, o.oid);
    setKabar(`Order ${o.koin} #${o.oid} dibatalkan.`);
    await segarkan(alamat);
  });

  /* ────────────────────────────────────────────────────────────────────── */

  return (
    <div className={sempit ? 'flex h-full flex-col gap-3 overflow-y-auto p-3' : ''}>
      {/* Tanpa bingkai dan tanpa latar: yang tersisa cuma teks dengan ikon,
          jadi ia terbaca sebagai keterangan — bukan galat yang menuntut
          diperbuat sesuatu. */}
      {tampilPeringatan && (
        <div className="mb-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-amber-200/75">
          <TriangleAlert className="mt-[3px] size-3.5 shrink-0 text-amber-400/80" strokeWidth={1.8} />
          <p className="min-w-0">
            <b className="font-semibold text-amber-200">Uang sungguhan, langsung ke Hyperliquid.</b>{' '}
            Order dari halaman ini tidak lewat server Jadi Trader — ditandatangani di peramban
            Anda dan dikirim ke bursanya. Kami tidak pernah meminta seed phrase maupun kunci
            privat dompet utama.
          </p>
          <button onClick={() => setTampilPeringatan(false)}
                  title="Tutup — catatan ini memang hanya tampil sekali"
                  aria-label="Tutup catatan"
                  className="-mt-0.5 shrink-0 cursor-pointer rounded p-1 text-amber-200/50 transition-colors hover:text-amber-100">
            <X className="size-3" />
          </button>
        </div>
      )}

      {!adaDompet() ? (
        <Kartu>
          <p className="text-[12.5px] leading-relaxed text-zinc-400">
            Tidak ada dompet di peramban ini. Pasang MetaMask atau Rabby dulu, lalu muat
            ulang halaman.
          </p>
        </Kartu>
      ) : !alamat ? (
        <Kartu>
          <p className="mb-3 text-[12.5px] leading-relaxed text-zinc-400">
            Hubungkan dompet yang sudah punya saldo di Hyperliquid. Menyambung hanya
            memberi tahu alamat Anda — belum ada satu pun yang bisa dikirim atas nama Anda.
          </p>
          <button onClick={sambung} disabled={!!sibuk} className={TOMBOL}>
            {sibuk === 'sambung' ? <Loader2 className="size-3.5 animate-spin" /> : <Wallet className="size-3.5" />}
            Hubungkan dompet
          </button>
        </Kartu>
      ) : (
        <div className={cn('grid gap-4', !sempit && 'lg:grid-cols-[minmax(0,1fr)_320px]')}>
          <div className="space-y-4">
            {/* ── KARTU DOMPET ────────────────────────────────────────
                Menggantikan kartu ringkasan lama (alamat + tiga angka +
                blok aktivasi) dengan templat yang dipilih pemilik 8 Sep
                2026. Yang berpindah cuma cara menggambarnya; seluruh angka
                dan perbuatannya tetap dihitung di berkas ini.

                Catatan lama yang TIDAK ikut pindah dan sengaja tetap di
                sini: kenapa "USDC di spot" hanya menghitung USDC, bukan
                seluruh token. Yang bisa jadi jaminan margin perp di
                Hyperliquid memang hanya USDC — token spot lain adalah
                kepemilikan, bukan daya beli, dan menjumlahkannya akan
                menjanjikan ukuran posisi yang tidak akan diterima bursa. */}
            <KartuDompet
              alamat={alamat}
              rantai={rantai}
              diSpot={keadaan ? keadaan.diSpot : null}
              diPerps={keadaan ? keadaan.diPerps : null}
              bisaDipakai={keadaan ? keadaan.bisaDipakai : null}
              nilaiAkun={keadaan ? keadaan.nilaiAkun : null}
              jumlahPosisi={keadaan?.posisi.length ?? 0}
              pnlPosisi={(keadaan?.posisi ?? []).reduce((a, x) => a + x.pnl, 0)}
              jumlahOrder={order.length}
              agenSiap={agenSiap}
              agenAlamat={agen?.alamat}
              sisaHari={sisaHari}
              sibuk={sibuk}
              sembunyi={saldoSembunyi}
              onSembunyi={aturSembunyi}
              sempit={sempit}
              onSegarkan={segarkanKlik}
              onAktifkan={aktifkan}
              onPutuskan={putuskan}
            />

            {/* Hyperliquid menolak approveAgent untuk alamat yang belum
                pernah punya akun di sana, dengan pesan yang tidak
                menyebutkan setoran sama sekali. Ditulis di depan supaya
                orang tidak mengejar galat yang sebenarnya cuma "akunnya
                memang belum ada". */}
            {!agenSiap && keadaan && keadaan.bisaDipakai === 0 && !keadaan.posisi.length && (
              <p className="-mt-1 px-1 text-[11.5px] leading-relaxed text-zinc-500">
                Alamat ini belum punya saldo di Hyperliquid. Setor dulu lewat
                app.hyperliquid.xyz — persetujuan agent akan ditolak selama akunnya
                belum ada di sana.
              </p>
            )}

            {!agenSiap && (
              <p className="-mt-1 px-1 text-[11.5px] leading-relaxed text-zinc-500">
                {agen
                  ? 'Agent wallet di peramban ini sudah kedaluwarsa. Aktifkan ulang untuk trading.'
                  : 'Satu tanda tangan untuk mengaktifkan trading. Yang disetujui adalah agent '
                    + 'wallet yang dibuat di peramban ini — ia bisa membuka dan menutup posisi, '
                    + 'dan secara protokol TIDAK BISA menarik dana keluar.'}
              </p>
            )}

            {/* ── DAFTARNYA SAJA, JUDULNYA DI KARTU ───────────────────
                Baris ringkasan di dalam KartuDompet sudah menyebut "Posisi
                perp terbuka" beserta jumlah dan P/L-nya. Judul kedua di
                sini mengulang kata yang sama tepat 40 piksel di bawahnya.

                Keadaan kosongnya juga pindah ke sana, termasuk kalimat yang
                membedakan punya token dari punya posisi: pemilik pernah
                membaca daftar Balances Hyperliquid (XAUT, ZEC, HYPE) sebagai
                posisi terbuka lalu heran panel ini menyebut kosong. Yang
                dibaca di sini `assetPositions` — perps saja. */}
            {!!keadaan?.posisi.length && (
              <Kartu>
                <div className="space-y-2">
                  {keadaan.posisi.map((p) => (
                    <div key={p.koin} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-zinc-800 px-3 py-2">
                      <span className="text-[12.5px] font-medium text-zinc-100">{p.koin}</span>
                      <span className={cn('text-[11.5px] font-semibold',
                        p.arah === 'LONG' ? 'text-emerald-400' : 'text-red-400')}>{p.arah}</span>
                      <span className="angka text-[11.5px] text-zinc-400">{p.ukuran} @ {p.entry}</span>
                      <span className="angka text-[11.5px] text-zinc-500">{p.leverage}x · margin {uang(p.margin)}</span>
                      <span className={cn('angka ml-auto text-[12px] font-semibold',
                        p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {p.pnl >= 0 ? '+' : ''}{uang(p.pnl)}
                      </span>
                      {/* Chart-nya di halaman lain, dan itu memang benar: yang
                          di sana chart penuh dengan alat gambar, indikator,
                          dan replay. Menyalinnya ke sini berarti dua chart
                          yang harus dijaga tetap sepakat.

                          TAPI ia cuma MELIHAT. Order dari Chart & Entry
                          berangkat ke akun backend, bukan ke dompet yang
                          tersambung di halaman ini — dan itu ditulis di
                          judulnya supaya tidak ada yang menekan Kirim di sana
                          sambil mengira ia sedang memakai dompetnya. */}
                      <Link to={`/chart-entry?simbol=${p.koin}USDT`}
                            title="Lihat pair ini di Chart & Entry — untuk analisa saja, ordernya tidak lewat dompet ini"
                            className={TOMBOL2}>
                        <CandlestickChart className="size-3" /> Chart
                      </Link>
                      <button onClick={() => tutup(p.koin)} disabled={!!sibuk || !agenSiap} className={TOMBOL2}>
                        {sibuk === 'tutup-' + p.koin ? <Loader2 className="size-3 animate-spin" /> : null}
                        Tutup
                      </button>
                    </div>
                  ))}
                </div>
              </Kartu>
            )}

            {/* Judul dan keadaan kosongnya ada di baris ringkasan kartu. */}
            {!!order.length && (
              <Kartu>
                <div className="space-y-2">
                  {order.map((o) => (
                    <div key={o.oid} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-zinc-800 px-3 py-2">
                      <span className="text-[12.5px] font-medium text-zinc-100">{o.koin}</span>
                      <span className={cn('text-[11.5px] font-semibold',
                        o.arah === 'BUY' ? 'text-emerald-400' : 'text-red-400')}>{o.arah}</span>
                      <span className="text-[11.5px] text-zinc-400">{o.jenis}</span>
                      <span className="angka text-[11.5px] text-zinc-400">{o.ukuran} @ {o.harga}</span>
                      {o.reduceOnly && <span className="text-[10.5px] text-zinc-500">reduce-only</span>}
                      <button onClick={() => batal(o)} disabled={!!sibuk || !agenSiap}
                              className={cn(TOMBOL2, 'ml-auto')}>
                        {sibuk === 'batal-' + o.oid ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                        Batal
                      </button>
                    </div>
                  ))}
                </div>
              </Kartu>
            )}
          </div>

          <Kartu judul="Kirim order">
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Bidang label="Koin">
                  <input className={cn(KOTAK, 'uppercase')} value={koin}
                         onChange={(e) => { setKoin(e.target.value); setHargaTeks(''); }} />
                </Bidang>
                <Bidang label="Arah">
                  <select className={cn(KOTAK, 'cursor-pointer')} value={arah}
                          onChange={(e) => setArah(e.target.value as 'BUY' | 'SELL')}>
                    <option value="BUY">BUY / Long</option>
                    <option value="SELL">SELL / Short</option>
                  </select>
                </Bidang>
              </div>

              <Bidang label="Jenis">
                <select className={cn(KOTAK, 'cursor-pointer')} value={jenis}
                        onChange={(e) => setJenis(e.target.value as 'MARKET' | 'LIMIT')}>
                  <option value="LIMIT">Limit (GTC)</option>
                  <option value="MARKET">Market (IOC menyeberang buku)</option>
                </select>
              </Bidang>

              {jenis === 'LIMIT' && (
                <Bidang label={`Harga limit${pasar > 0 ? ` · pasar ${pasar}` : ''}`}>
                  <input className={cn(KOTAK, 'angka')} inputMode="decimal" value={hargaTeks}
                         onChange={(e) => setHargaTeks(e.target.value)} />
                </Bidang>
              )}

              {/* OPSIONAL, dan kosong berarti TIDAK DIPASANG — bukan nol.
                  Keduanya berangkat sebagai trigger reduce-only sesudah
                  entry-nya terisi, disizing dari fill yang sungguhan. */}
              <div className="grid grid-cols-2 gap-2">
                <Bidang label="SL (opsional)">
                  <input className={cn(KOTAK, 'angka')} inputMode="decimal" value={slTeks}
                         placeholder="—" onChange={(e) => setSlTeks(e.target.value)} />
                </Bidang>
                <Bidang label="TP (opsional)">
                  <input className={cn(KOTAK, 'angka')} inputMode="decimal" value={tpTeks}
                         placeholder="—" onChange={(e) => setTpTeks(e.target.value)} />
                </Bidang>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Bidang label="Modal (USD)">
                  <input className={cn(KOTAK, 'angka')} inputMode="decimal" value={modalTeks}
                         onChange={(e) => setModalTeks(e.target.value)} />
                </Bidang>
                <Bidang label="Leverage">
                  <input className={cn(KOTAK, 'angka')} inputMode="numeric" value={levTeks}
                         onChange={(e) => setLevTeks(e.target.value)} />
                </Bidang>
              </div>

              {/* Ditulis sebelum tombol, bukan sesudah dikirim. Nilai posisi
                  adalah angka yang sebenarnya dipertaruhkan, dan ia tidak
                  pernah sama dengan modal yang barusan diketik. */}
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11.5px] leading-relaxed text-zinc-400">
                Nilai posisi <span className="angka text-zinc-200">{uang(nilaiPosisi)}</span>
                {perkiraanUkuran > 0 && (
                  <> · perkiraan <span className="angka text-zinc-200">{perkiraanUkuran.toPrecision(6)} {koin.toUpperCase()}</span></>
                )}
                <br />
                Ukuran akhir dibulatkan ke aturan Hyperliquid dan bisa sedikit berbeda.
              </div>

              <button onClick={kirim} disabled={!!sibuk || !agenSiap} className={cn(TOMBOL, 'w-full')}>
                {sibuk === 'order' ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {agenSiap ? `Kirim ${arah}` : 'Aktifkan trading dulu'}
              </button>

              {jenis === 'MARKET' && (
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Hyperliquid tidak punya order market. Yang dikirim limit IOC yang
                  menyeberangi buku — sisanya yang tidak terisi seketika dibatalkan, jadi
                  order bisa terisi sebagian.
                </p>
              )}
            </div>
          </Kartu>
        </div>
      )}

      {galat && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-300">
          {galat}
        </p>
      )}
      {kabar && (
        <p className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 text-[12px] text-emerald-300">
          {kabar}
        </p>
      )}
    </div>
  );
}


function Kartu({ judul, children }: { judul?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      {judul && <h2 className="mb-3 text-[13px] font-semibold text-zinc-200">{judul}</h2>}
      {children}
    </div>
  );
}

function Bidang({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-zinc-500">{label}</div>
      {children}
    </label>
  );
}
