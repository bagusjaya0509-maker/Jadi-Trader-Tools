import { useCallback, useEffect, useState } from 'react';
import {
  Gift, Copy, Check, MessageCircle, Users, ShoppingBag, Coins, Wallet, Loader2,
  Clock, BadgeCheck, XCircle, Info, Link2, ArrowRight,
} from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { useAuth } from '@/lib/auth';
import { cn, tanggalPendek } from '@/lib/utils';
import {
  referralSaya, ajukanPencairan, rupiah, dolar, namaPaketRef,
  PAKET_KOMISI, persenPaketRef, persenMaks,
  type DataReferral, type StatusPencairan,
} from '@/lib/referral';

/* ════════════════════════════════════════════════════════════════════════
   PROGRAM REFERRAL — halaman pengguna
   ════════════════════════════════════════════════════════════════════════
   Diminta pemilik 8 Sep 2026. Satu halaman di grup Administration yang
   menjawab empat pertanyaan berurutan: apa tautanku, siapa yang sudah
   masuk lewat tautan itu, berapa komisiku, dan bagaimana mencairkannya.

   Urutannya sengaja: tautan di paling atas karena itu satu-satunya hal
   yang harus DILAKUKAN orang di sini; sisanya cuma dibaca. Formulir
   pencairan di bawah, bukan di samping — ia baru berarti sesudah ada
   angka di atasnya, dan formulir yang tampil sebelum ada uang cuma
   mengundang permintaan kosong.

   Semua angka dari server. Lihat catatan di lib/referral.ts.
   ════════════════════════════════════════════════════════════════════════ */

function Bagian({ judul, sub }: { judul: string; sub: string }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <h2 className="text-[14px] font-medium text-zinc-200">{judul}</h2>
      <p className="text-[12px] text-zinc-500">{sub}</p>
    </div>
  );
}

function LencanaStatus({ status }: { status: StatusPencairan }) {
  const peta = {
    diajukan: { teks: 'Diproses', kelas: 'bg-amber-500/15 text-amber-400', Ikon: Clock },
    dibayar:  { teks: 'Dibayar',  kelas: 'bg-emerald-500/15 text-emerald-400', Ikon: BadgeCheck },
    ditolak:  { teks: 'Ditolak',  kelas: 'bg-red-500/15 text-red-400', Ikon: XCircle },
  }[status] ?? { teks: status, kelas: 'bg-zinc-800 text-zinc-300', Ikon: Info };
  const Ikon = peta.Ikon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium', peta.kelas)}>
      <Ikon className="size-3" /> {peta.teks}
    </span>
  );
}

/* Menyalin dengan dua jalan: Clipboard API, lalu execCommand untuk
   peramban yang menolak API-nya di luar gestur — salinan yang gagal
   diam-diam adalah tautan yang tidak pernah tersebar. */
async function salin(teks: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(teks); return true; } catch { /* lanjut */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = teks; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/* ── SATU PESAN, MENEMPEL DI TOMBOLNYA ───────────────────────────────────
   Sempat dibuat empat kartu naskah di badan halaman, dan pemilik
   menolaknya 8 Sep 2026: yang ia minta bukan galeri pilihan, melainkan
   tombol Bagikan yang pesannya sudah terisi. Ia benar. Orang membuka
   halaman ini untuk membagikan tautan, bukan untuk membaca empat versi
   kalimat lalu memilih salah satunya; pilihan yang tidak diminta adalah
   pekerjaan tambahan yang menyamar jadi fitur.

   `{tautan}` diganti tautan referralnya. Tanpa tanda pisah panjang:
   sebagian ponsel menampilkannya sebagai kotak di WhatsApp.

   Komisi TIDAK disebut, dengan sengaja. Yang menerima pesan bukan calon
   perujuk, dan menyebut angkanya membuat ajakannya terbaca seperti orang
   yang sedang dibayar untuk mengirimnya. */
const PESAN_AJAKAN =
  'Saya pakai Jadi Trader Tools untuk chart, screener, dan jurnal trading dalam satu halaman. '
  + 'Ada pratinjau 24 jam kalau mau lihat isinya dulu tanpa daftar: {tautan}';

export default function Referral() {
  const { pengguna, memuat: memuatAuth } = useAuth();
  const [data, setData] = useState<DataReferral | null>(null);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [disalin, setDisalin] = useState(false);
  const [pesanDisalin, setPesanDisalin] = useState(false);

  const [nama, setNama] = useState('');
  const [bank, setBank] = useState('');
  const [rekening, setRekening] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState<{ jenis: 'ok' | 'galat'; teks: string } | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true); setGalat('');
    try { setData(await referralSaya()); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal memuat.'); }
    finally { setMemuat(false); }
  }, []);

  useEffect(() => {
    if (memuatAuth) return;
    if (!pengguna) { setMemuat(false); return; }
    void muat();
  }, [pengguna?.uid, memuatAuth, muat]);

  /* Nama rekening diisi dari nama akun sebagai awalan yang bisa diubah —
     kebanyakan orang memakai nama yang sama, dan yang tidak tinggal
     mengganti. */
  useEffect(() => {
    if (!nama && pengguna?.displayName) setNama(pengguna.displayName);
  }, [pengguna?.displayName, nama]);

  async function salinTautan() {
    if (!data) return;
    if (await salin(data.tautan)) { setDisalin(true); setTimeout(() => setDisalin(false), 2200); }
  }

  const pesanAjakan = () => PESAN_AJAKAN.replace('{tautan}', data?.tautan ?? '');

  /* ── DISALIN SEKALIGUS DIBUKA ────────────────────────────────────────
     wa.me?text= sudah mengisi kolom pesannya sendiri, dan di ponsel itu
     cukup. Di desktop tidak selalu: sebagian pemasangan WhatsApp Web
     membuka jendela tanpa membawa teksnya, dan yang tersisa kolom kosong
     tepat setelah orang mengira pesannya sudah siap.

     Jadi papan klip diisi juga. Kalau teksnya terbawa, salinan itu tidak
     mengganggu apa pun; kalau tidak, satu tempel menyelesaikannya.

     Keduanya dipanggil BERURUTAN DI DALAM satu gestur klik, dan itu yang
     menentukan: `salin()` menyimpan janjinya lalu window.open jalan
     seketika, jadi peramban tidak pernah melihat jendela yang dibuka
     sesudah `await` -- yang justru diblokirnya sebagai popup. */
  function keWhatsApp() {
    if (!data) return;
    const teks = pesanAjakan();
    void salin(teks).then((ok) => {
      if (!ok) return;
      setPesanDisalin(true);
      setTimeout(() => setPesanDisalin(false), 2600);
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank', 'noopener');
  }

  async function kirimPencairan(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSibuk(true); setKabar(null);
    try {
      const h = await ajukanPencairan({ nama: nama.trim(), bank: bank.trim(), rekening: rekening.trim() });
      setKabar({ jenis: 'ok', teks: `Permintaan pencairan ${rupiah(h.jumlahRp)} terkirim. Biasanya diproses 1–3 hari kerja.` });
      await muat();
    } catch (err) {
      setKabar({ jenis: 'galat', teks: err instanceof Error ? err.message : 'Gagal mengirim.' });
    } finally { setSibuk(false); }
  }

  if (!memuatAuth && !pengguna) {
    return (
      <div className="p-4 sm:p-6">
        <Panel className="p-6 text-center">
          <Gift className="mx-auto mb-2 size-6 text-zinc-500" strokeWidth={1.6} />
          <div className="text-[13.5px] text-zinc-200">Masuk dulu untuk melihat kode referralmu.</div>
          <p className="mt-1 text-[12px] text-zinc-500">Kode rujukan terikat ke akun, jadi komisinya tercatat atas namamu.</p>
        </Panel>
      </div>
    );
  }

  if (memuat && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6 text-zinc-500">
        <Loader2 className="mr-2 size-4 animate-spin" /> Memuat program referral…
      </div>
    );
  }

  if (galat && !data) {
    return (
      <div className="p-4 sm:p-6">
        <Panel className="p-5">
          <div className="text-[13px] text-red-400">{galat}</div>
          <button onClick={() => void muat()} className="mt-3 cursor-pointer rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 hover:border-zinc-700">Coba lagi</button>
        </Panel>
      </div>
    );
  }
  if (!data) return null;

  const { ringkas, setelan } = data;
  const siapCair = ringkas.siapRp >= setelan.minimalRp && ringkas.siapRp > 0;
  const adaDiproses = data.pencairan.some((p) => p.status === 'diajukan');

  return (
    <div className="p-4 sm:p-6">
      {!setelan.aktif && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3 text-[12.5px] text-amber-300">
          Program referral sedang dijeda. Tautanmu tetap ada, tapi rujukan dan komisi baru tidak dicatat sampai program dibuka lagi.
        </div>
      )}

      {/* ── Tautan ─────────────────────────────────────────────────── */}
      <Panel className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border border-emas/30 bg-emas/10">
                <Gift className="size-4 text-emas" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-[15px] font-medium text-zinc-100">Ajak trader lain, dapat komisi sampai {persenMaks(setelan)}%</h1>
                <p className="text-[12px] text-zinc-500">
                  Dari setiap paket berbayar yang dibeli orang rujukanmu dalam {setelan.masaBulan} bulan pertama.
                </p>
              </div>
            </div>

            {/* Rincian per paket ditaruh tepat di bawah judulnya. "Sampai
                50%" tanpa rinciannya adalah janji yang baru ketahuan
                salah waktu komisinya masuk, dan itu tempat paling buruk
                untuk mengoreksi harapan orang. */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {PAKET_KOMISI.map((k) => (
                <span key={k.id} className="rounded-md border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-[11.5px] text-zinc-400">
                  {k.nama} <span className="angka font-medium text-emas">{persenPaketRef(setelan, k.id)}%</span>
                </span>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Tautan referralmu</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <Link2 className="size-3.5 shrink-0 text-zinc-500" />
                  <input readOnly value={data.tautan} onFocus={(e) => e.currentTarget.select()}
                    className="angka min-w-0 flex-1 bg-transparent text-[12.5px] text-zinc-200 outline-none" />
                </div>
                <button onClick={() => void salinTautan()}
                  className={cn('flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-[12.5px] font-medium transition-colors',
                    disalin ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-100 text-zinc-950 hover:bg-white')}>
                  {disalin ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {disalin ? 'Tersalin' : 'Salin tautan'}
                </button>
                <button onClick={keWhatsApp}
                  title={pesanAjakan()}
                  className={cn('flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3.5 py-2 text-[12.5px] transition-colors',
                    pesanDisalin
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100')}>
                  {pesanDisalin ? <Check className="size-3.5" /> : <MessageCircle className="size-3.5" />}
                  {pesanDisalin ? 'Pesan tersalin' : 'Bagikan ke WhatsApp'}
                </button>
              </div>
              <div className="mt-2 text-[11.5px] text-zinc-500">
                Tombol WhatsApp membawa ajakan yang sudah tertulis, tinggal kirim.
                {' · '}Kode referral: <span className="angka text-zinc-300">{data.kode}</span>
                {data.dirujukOleh && <span> · kamu masuk lewat kode <span className="angka">{data.dirujukOleh}</span></span>}
              </div>
            </div>
          </div>

          {/* Tiga langkah — keterangan, bukan hiasan: yang baru pertama
              membuka halaman ini harus tahu kapan uangnya "jadi". */}
          <ol className="grid shrink-0 gap-2 text-[12px] text-zinc-400 lg:w-[300px]">
            {[
              ['Bagikan tautan', 'Lewat WhatsApp, grup, atau bio media sosial.'],
              ['Mereka mendaftar', 'Masuk lewat tautanmu, akun BARU tercatat sebagai rujukanmu.'],
              ['Mereka beli paket', `Komisinya masuk begitu paket itu disetujui, siap dicairkan mulai ${rupiah(setelan.minimalRp)}.`],
            ].map(([j, k], i) => (
              <li key={j} className="flex gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <span className="angka mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10.5px] text-zinc-300">{i + 1}</span>
                <span><span className="text-zinc-200">{j}.</span> {k}</span>
              </li>
            ))}
          </ol>
        </div>
      </Panel>

      {/* ── Angka ──────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Daftar lewat tautanmu" nilai={String(ringkas.terdaftar)} catatan="akun baru yang tercatat" Ikon={Users} />
        <KartuKpi label="Sudah membeli paket" nilai={String(ringkas.membeli)} catatan={ringkas.terdaftar ? `${Math.round((ringkas.membeli / ringkas.terdaftar) * 100)}% dari yang daftar` : 'belum ada'} Ikon={ShoppingBag} />
        <KartuKpi label="Total komisi" nilai={rupiah(ringkas.totalRp)} catatan={`${dolar(ringkas.totalUsd)} · termasuk yang sudah cair`} Ikon={Coins} />
        <KartuKpi label="Siap dicairkan" nilai={rupiah(ringkas.siapRp)} catatan={ringkas.diajukanRp ? `${rupiah(ringkas.diajukanRp)} sedang diproses` : `minimal ${rupiah(setelan.minimalRp)}`} Ikon={Wallet} />
      </div>

      {/* ── Rujukan ────────────────────────────────────────────────── */}
      <Bagian judul="Pengguna dari tautanmu" sub="Siapa yang masuk lewat tautanmu, paket yang diambil, dan komisi yang lahir darinya." />
      <Panel>
        {data.rujukan.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Users className="mx-auto mb-2 size-5 text-zinc-600" strokeWidth={1.6} />
            <div className="text-[13px] text-zinc-300">Belum ada yang mendaftar lewat tautanmu.</div>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-zinc-500">
              Yang paling sering berhasil: kirim tautannya langsung ke satu orang yang memang sedang mencari alat trading, bukan disebar ke grup besar.
            </p>
          </div>
        ) : (
          <TabelBungkus>
            <Tabel>
              <thead>
                <tr>
                  <Th>Tanggal</Th><Th>Pengguna</Th><Th>Status</Th><Th className="text-right">Komisi</Th>
                </tr>
              </thead>
              <tbody>
                {data.rujukan.map((r, i) => (
                  <Tr key={i}>
                    <Td className="angka text-zinc-400">{tanggalPendek(r.waktu)}</Td>
                    <Td>
                      <div className="text-zinc-200">{r.pengguna}</div>
                      {r.email && r.email !== r.pengguna && <div className="angka text-[11px] text-zinc-500">{r.email}</div>}
                    </Td>
                    <Td>
                      {r.status === 'bayar' ? (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-400">{namaPaketRef(r.paket)}</span>
                      ) : r.status === 'gratis' ? (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-300">Akses gratis</span>
                      ) : (
                        <span className="text-[11.5px] text-zinc-500">Belum beli paket</span>
                      )}
                    </Td>
                    <Td className="angka text-right">
                      {r.komisiRp ? <span className="text-emerald-400">{rupiah(r.komisiRp)}</span> : <span className="text-zinc-600">—</span>}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          </TabelBungkus>
        )}
      </Panel>

      {/* ── Pencairan ──────────────────────────────────────────────── */}
      <Bagian judul="Pencairan komisi" sub={`Diproses manual oleh pemilik, biasanya 1–3 hari kerja. Minimal ${rupiah(setelan.minimalRp)}; seluruh komisi yang siap dicairkan sekaligus.`} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="p-5 lg:col-span-2">
          <form onSubmit={kirimPencairan} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-zinc-500">Akan dicairkan</span>
              <span className="angka text-[18px] font-semibold text-zinc-100">{rupiah(ringkas.siapRp)}</span>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Nama pemilik rekening</label>
              <input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={80} required
                className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600"
                placeholder="Sesuai buku tabungan" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] text-zinc-500">Bank / e-wallet</label>
                <input value={bank} onChange={(e) => setBank(e.target.value)} maxLength={40} required
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600"
                  placeholder="BCA, Mandiri, DANA…" />
              </div>
              <div className="col-span-3">
                <label className="mb-1 block text-[11px] text-zinc-500">Nomor rekening</label>
                <input value={rekening} onChange={(e) => setRekening(e.target.value.replace(/[^0-9 -]/g, ''))} maxLength={24} required inputMode="numeric"
                  className="angka h-9 w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600"
                  placeholder="Angka saja" />
              </div>
            </div>
            <button type="submit" disabled={sibuk || !siapCair || adaDiproses}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
              {sibuk ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Ajukan pencairan
            </button>
            {!siapCair && !adaDiproses && (
              <p className="text-[11.5px] text-zinc-500">
                {ringkas.siapRp > 0
                  ? `Kurang ${rupiah(setelan.minimalRp - ringkas.siapRp)} lagi untuk mencapai minimal pencairan.`
                  : 'Belum ada komisi yang siap dicairkan.'}
              </p>
            )}
            {adaDiproses && <p className="text-[11.5px] text-amber-400/90">Ada permintaan yang masih diproses. Ajukan lagi sesudah yang itu selesai.</p>}
            {kabar && (
              <p className={cn('text-[12px] leading-relaxed', kabar.jenis === 'ok' ? 'text-emerald-400' : 'text-red-400')}>{kabar.teks}</p>
            )}
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Data rekening hanya dipakai untuk transfer komisi ini dan tidak ditampilkan ke siapa pun selain pemilik.
            </p>
          </form>
        </Panel>

        <Panel className="lg:col-span-3">
          <PanelHead judul="Riwayat pencairan" sub="Setiap permintaan beserta keputusannya." />
          {data.pencairan.length === 0 ? (
            <div className="px-5 pb-6 pt-1 text-[12.5px] text-zinc-500">Belum ada permintaan pencairan.</div>
          ) : (
            <TabelBungkus>
              <Tabel>
                <thead><tr><Th>Tanggal</Th><Th>Tujuan</Th><Th className="text-right">Jumlah</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {data.pencairan.map((p) => (
                    <Tr key={p.id}>
                      <Td className="angka text-zinc-400">{tanggalPendek(p.waktu)}</Td>
                      <Td>
                        <div className="text-zinc-200">{p.bank} <span className="angka text-zinc-500">{p.rekening}</span></div>
                        <div className="text-[11px] text-zinc-500">a.n. {p.nama}</div>
                        {p.catatan && <div className="mt-0.5 text-[11px] text-zinc-500">Catatan: {p.catatan}</div>}
                      </Td>
                      <Td className="angka text-right text-zinc-100">{rupiah(p.jumlahRp)}</Td>
                      <Td><LencanaStatus status={p.status} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabel>
            </TabelBungkus>
          )}
        </Panel>
      </div>

      {/* ── Riwayat komisi ─────────────────────────────────────────── */}
      {data.komisi.length > 0 && (
        <>
          <Bagian judul="Rincian komisi" sub="Satu baris per pembelian. Persennya dihitung dari harga yang benar-benar dibayar." />
          <Panel>
            <TabelBungkus>
              <Tabel>
                <thead><tr><Th>Tanggal</Th><Th>Dari</Th><Th>Paket</Th><Th className="text-right">Harga</Th><Th className="text-right">Komisi</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {data.komisi.map((k) => (
                    <Tr key={k.id}>
                      <Td className="angka text-zinc-400">{tanggalPendek(k.waktu)}</Td>
                      <Td className="angka text-zinc-300">{k.dari || '—'}</Td>
                      <Td className="text-zinc-300">{namaPaketRef(k.paket)}</Td>
                      <Td className="angka text-right text-zinc-400">{dolar(k.usd)}</Td>
                      <Td className="angka text-right text-emerald-400">{rupiah(k.jumlahRp)} <span className="text-zinc-600">({k.persen}%)</span></Td>
                      <Td>
                        <span className={cn('rounded px-1.5 py-0.5 text-[10.5px] font-medium',
                          k.status === 'dibayar' ? 'bg-emerald-500/15 text-emerald-400'
                            : k.status === 'diajukan' ? 'bg-amber-500/15 text-amber-400'
                            : k.status === 'batal' ? 'bg-red-500/15 text-red-400'
                            : 'bg-zinc-800 text-zinc-300')}>
                          {k.status === 'siap' ? 'Siap cair' : k.status === 'diajukan' ? 'Diproses' : k.status === 'dibayar' ? 'Sudah cair' : 'Batal'}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabel>
            </TabelBungkus>
          </Panel>
        </>
      )}

      {/* ── Ketentuan ──────────────────────────────────────────────── */}
      <Bagian judul="Ketentuan" sub="Singkat, supaya tidak ada yang kaget saat komisinya dihitung." />
      <Panel className="p-5">
        <ul className="grid gap-2 text-[12.5px] leading-relaxed text-zinc-400 sm:grid-cols-2">
          {[
            `Besar komisinya berbeda per paket: ${PAKET_KOMISI.map((k) => `${k.nama} ${persenPaketRef(setelan, k.id)}%`).join(', ')}.`,
            'Dihitung dari harga yang benar-benar dibayar dalam dolar, lalu dirupiahkan dengan kurs yang berlaku saat itu.',
            'Yang dihitung hanya paket akses Jadi Trader Tools (Starter, Premium 3 Bulan, Tahunan). Produk Marketplace satuan tidak termasuk.',
            'Rujukan hanya sah untuk akun yang benar-benar baru — belum pernah punya akses, gratis maupun berbayar.',
            `Pembelian dihitung selama ${setelan.masaBulan} bulan sejak orang itu mendaftar lewat tautanmu.`,
            'Merujuk akun sendiri, akun yang saling merujuk, atau pendaftaran massal palsu membatalkan komisinya.',
            `Pencairan minimal ${rupiah(setelan.minimalRp)}, ditransfer manual 1–3 hari kerja. Biaya transfer antarbank ditanggung penerima.`,
          ].map((t) => (
            <li key={t} className="flex gap-2"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-zinc-600" />{t}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
