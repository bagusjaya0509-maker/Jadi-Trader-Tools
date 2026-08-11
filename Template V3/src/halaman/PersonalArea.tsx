import { useEffect, useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Plus, RefreshCw, Wallet, TrendingUp, Banknote, Scale, Radio, Trash2, Loader2 } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { WARNA_KATEGORI, rupiah, rupiahRingkas, type KategoriAset } from '@/data/porto';
import { usePorto, bawaan, idBaru, type PosAset } from '@/lib/porto';
import { useHargaPasar } from '@/lib/harga';
import { useAuth } from '@/lib/auth';

/* ════════════════════════════════════════════════════════════════════════
   PERSONAL AREA — pelacak portofolio
   ════════════════════════════════════════════════════════════════════════
   Semua pos tersimpan di Firestore (`users/{uid}/porto/daftar`) dan hanya
   bisa dibaca pemiliknya. Sebelum ini halamannya memakai `ASET`/`KEWAJIBAN`
   dari data/porto.ts: tombol "Tambah pos" dan "Simpan pos" tidak melakukan
   apa pun, dan angka siapa pun yang membuka halaman ini adalah portofolio
   orang lain.

   HARGA PASAR. Pos yang punya `simbol` ikut bergerak mengikuti harga
   sungguhan dari proxy VPS. Dulu pergerakannya diacak tiap 6 detik — terlihat
   hidup, tapi setiap angka yang ditampilkannya salah.

   Kenapa hanya sebagian aset yang bergerak: saldo bank dan emas fisik tidak
   berubah tiap detik. Membuat SEMUANYA berkedip akan terlihat canggih tapi
   berbohong.
   ════════════════════════════════════════════════════════════════════════ */

const KATEGORI: KategoriAset[] = ['Kripto', 'Sekuritas', 'Emas', 'Bank', 'E-Wallet', 'Tunai'];

export default function PersonalArea() {
  const { pengguna } = useAuth();
  const { isi, memuat, galat, kosong, simpan } = usePorto();
  const [pesan, setPesan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [baru, setBaru] = useState<{ nama: string; nilai: string; kategori: KategoriAset; simbol: string }>(
    { nama: '', nilai: '', kategori: 'Bank', simbol: '' });

  /* Harga sungguhan dari proxy VPS, bukan angka acak. `harga` di sini adalah
     harga SEKARANG; yang disimpan bersama pos adalah harga saat dicatat, jadi
     rasionya yang dipakai sebagai faktor. */
  const simbolDipakai = useMemo(
    () => [...new Set(isi.aset.map((a) => a.simbol).filter(Boolean) as string[])],
    [isi.aset]
  );
  const hargaPasar = useHargaPasar(simbolDipakai);
  const [berdenyut, setBerdenyut] = useState(false);
  useEffect(() => {
    if (!Object.keys(hargaPasar).length) return;
    setBerdenyut(true);
    const j = setTimeout(() => setBerdenyut(false), 700);
    return () => clearTimeout(j);
  }, [hargaPasar]);

  /* Nilai kini = nilai saat dicatat x (harga sekarang / harga saat dicatat).
     Tanpa `hargaCatat` tidak ada pembanding, jadi nilainya dibiarkan apa
     adanya — lebih baik diam daripada mengalikan dengan angka karangan. */
  const asetHidup = useMemo(
    () => isi.aset.map((a) => {
      const kini = a.simbol ? hargaPasar[a.simbol] : undefined;
      const gerak = a.simbol && a.hargaCatat && kini ? kini / a.hargaCatat : 1;
      return { ...a, nilaiKini: a.nilai * gerak, bergerak: gerak !== 1 };
    }),
    [isi.aset, hargaPasar]
  );

  const totalAset = asetHidup.reduce((s, a) => s + a.nilaiKini, 0);
  const totalKewajiban = isi.kewajiban.reduce((s, k) => s + k.nilai, 0);
  const portoBersih = totalAset - totalKewajiban;
  const likuid = asetHidup
    .filter((a) => a.kategori !== 'Emas' && a.kategori !== 'Sekuritas')
    .reduce((s, a) => s + a.nilaiKini, 0);

  const perKategori = KATEGORI.map((k) => ({
    nama: k,
    nilai: asetHidup.filter((a) => a.kategori === k).reduce((s, a) => s + a.nilaiKini, 0),
  })).filter((k) => k.nilai > 0);

  /* Riwayat bulanan DICATAT, bukan dikarang. Tiap kali halaman dibuka, porto
     bersih bulan berjalan ditulis ulang — jadi grafiknya tumbuh sejak hari
     pertama dipakai, bukan menampilkan enam bulan yang tidak pernah terjadi. */
  const kunciBulan = new Date().toISOString().slice(0, 7);
  /* Yang dicatat adalah nilai TERSIMPAN, bukan nilai yang sudah disesuaikan
     harga pasar. Kalau harga yang dipakai, angkanya berubah tiap kali harga
     bergerak — dan setiap pergerakan memicu satu tulisan ke Firestore. Satu
     halaman yang dibiarkan terbuka semalam akan menulis ribuan kali untuk
     mencatat satu angka bulanan. */
  const portoTercatat = isi.aset.reduce((s, a) => s + a.nilai, 0) - totalKewajiban;
  useEffect(() => {
    if (memuat || kosong || !pengguna || !isi.aset.length) return;
    if (isi.bulanan[kunciBulan] === portoTercatat) return;
    const j = setTimeout(() => {
      void simpan({ ...isi, bulanan: { ...isi.bulanan, [kunciBulan]: portoTercatat } }).catch(() => {});
    }, 2000);
    return () => clearTimeout(j);
  }, [memuat, kosong, pengguna, isi, portoTercatat, kunciBulan, simpan]);

  const riwayatBulan = useMemo(
    () => Object.entries(isi.bulanan).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      bulan: new Date(k + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      porto: v,
    })),
    [isi.bulanan]
  );
  const bulanIni = riwayatBulan[riwayatBulan.length - 1];
  const bulanLalu = riwayatBulan[riwayatBulan.length - 2];
  const tumbuh = bulanIni && bulanLalu && bulanLalu.porto !== 0
    ? ((bulanIni.porto - bulanLalu.porto) / Math.abs(bulanLalu.porto)) * 100
    : null;

  async function jalankan(kerja: () => Promise<unknown>, kabar: string) {
    setSibuk(true); setPesan('');
    try { await kerja(); setPesan(kabar); }
    catch (e) { setPesan('Gagal menyimpan: ' + (e instanceof Error ? e.message : 'tidak diketahui')); }
    finally { setSibuk(false); }
  }

  function tambahPos() {
    const nilai = Number(baru.nilai.replace(/[^\d.-]/g, ''));
    if (!baru.nama.trim()) { setPesan('Nama pos wajib diisi.'); return; }
    if (!isFinite(nilai)) { setPesan('Nilai harus berupa angka.'); return; }
    const sim = baru.simbol.trim().toUpperCase();
    /* Harga saat dicatat disimpan bersama posnya. Itulah titik nol yang
       membuat "nilai kini" punya arti — tanpanya pos bersimbol cuma angka
       tetap dengan lencana "live" yang menipu. */
    const pos: PosAset = {
      id: idBaru(), nama: baru.nama.trim(), nilai, kategori: baru.kategori,
      ...(sim ? { simbol: sim, ...(hargaPasar[sim] ? { hargaCatat: hargaPasar[sim] } : {}) } : {}),
    };
    void jalankan(() => simpan({ ...isi, aset: [...isi.aset, pos] }), `${pos.nama} tersimpan.`)
      .then(() => setBaru({ nama: '', nilai: '', kategori: 'Bank', simbol: '' }));
  }

  const hapusPos = (id: string) =>
    void jalankan(() => simpan({ ...isi, aset: isi.aset.filter((a) => a.id !== id) }), 'Pos dihapus.');

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Aset Kotor"    nilai={rupiahRingkas(totalAset)}      catatan={`${isi.aset.length} pos tercatat`} Ikon={Wallet} />
        <KartuKpi label="Porto Bersih"  nilai={rupiahRingkas(portoBersih)}
                  delta={tumbuh === null ? undefined : Number(tumbuh.toFixed(1))}
                  catatan={tumbuh === null ? 'belum ada bulan pembanding' : undefined} Ikon={TrendingUp} />
        <KartuKpi label="Liquid Cash"   nilai={rupiahRingkas(likuid)}         catatan="tanpa emas & sekuritas" Ikon={Banknote} />
        <KartuKpi label="Total Bon"     nilai={rupiahRingkas(totalKewajiban)} catatan={`${isi.kewajiban.length} kewajiban`} Ikon={Scale} warna="text-red-400" />
      </div>

      {pesan && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-[12.5px] text-zinc-300">
          {pesan}
        </div>
      )}
      {galat && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-[12.5px] text-amber-200/90">
          {galat}
        </div>
      )}
      {!memuat && !pengguna && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-[12.5px] text-zinc-400">
          Masuk dulu untuk mencatat portofoliomu. Data ini tersimpan di akunmu sendiri dan tidak dilihat siapa pun.
        </div>
      )}
      {/* Tawaran isi awal — hanya kalau memang belum ada apa-apa, dan hanya
          sebagai TAWARAN. Menulisnya sendiri diam-diam berarti menaruh
          portofolio orang lain di akun seseorang tanpa dia minta. */}
      {!memuat && pengguna && isi.aset.length === 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <span className="text-[12.5px] text-zinc-400">Belum ada pos tercatat.</span>
          <button onClick={() => void jalankan(() => simpan(bawaan()), 'Daftar bawaan dimuat — sunting sesuai punyamu.')}
                  disabled={sibuk}
                  className="cursor-pointer rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50">
            Isi dari daftar contoh
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Komposisi */}
        <Panel>
          <PanelHead
            judul="Komposisi Porto"
            sub="Sebaran aset menurut jenisnya."
            kanan={
              <span className={cn(
                'flex items-center gap-1.5 text-[11px] transition-colors',
                berdenyut ? 'text-emerald-400' : 'text-zinc-600'
              )}>
                <Radio className="size-3" /> live
              </span>
            }
          />
          <div className="px-5 pb-5">
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={perKategori} dataKey="nilai" nameKey="nama"
                    innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none"
                    isAnimationActive={false}
                  >
                    {perKategori.map((k) => (
                      <Cell key={k.nama} fill={WARNA_KATEGORI[k.nama as KategoriAset]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }: any) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
                          <div className="text-[11px] text-zinc-500">{payload[0].name}</div>
                          <div className="angka text-[12.5px] text-zinc-100">{rupiah(payload[0].value)}</div>
                          <div className="text-[11px] text-zinc-500">
                            {((payload[0].value / totalAset) * 100).toFixed(1)}% dari total
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {perKategori.map((k) => (
                <div key={k.nama} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: WARNA_KATEGORI[k.nama as KategoriAset] }} />
                  <span className="flex-1 text-zinc-400">{k.nama}</span>
                  <span className="angka text-zinc-300">{((k.nilai / totalAset) * 100).toFixed(1)}%</span>
                  <span className="angka w-24 text-right text-zinc-500">{rupiahRingkas(k.nilai)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Perkembangan */}
        <Panel className="lg:col-span-2">
          <PanelHead judul="Perkembangan Porto" sub="Porto bersih tiap bulan, dicatat sejak kamu mulai memakai halaman ini." />
          <div className="h-[300px] px-2 pb-4">
            {riwayatBulan.length < 2 ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-[12.5px] leading-relaxed text-zinc-600">
                {/* Satu titik bukan grafik. Menariknya jadi garis lurus akan
                    terbaca sebagai "porto stabil", padahal artinya cuma
                    "belum ada bulan pembanding". */}
                Riwayat bulanan mulai terisi begitu ada dua bulan tercatat.
                Bulan ini sudah tersimpan; grafiknya muncul bulan depan.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riwayatBulan} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPorto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffcd75" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#ffcd75" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={56}
                       tickFormatter={(v) => `${Math.round(v / 1_000_000)}jt`} />
                <Tooltip
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
                        <div className="text-[11px] text-zinc-500">{label}</div>
                        <div className="angka text-[12.5px] text-zinc-100">{rupiah(payload[0].value)}</div>
                      </div>
                    ) : null
                  }
                  cursor={{ stroke: 'rgba(255,255,255,.12)' }}
                />
                <Area type="monotone" dataKey="porto" stroke="#ffcd75" strokeWidth={1.8} fill="url(#gPorto)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {/* Panel "Pemasukan vs Pengeluaran" dihapus. Ia menggambar `masuk`
          dan `keluar` dari PORTO_BULANAN — buku kas bulanan yang tidak pernah
          ada sumbernya di mana pun, tidak di backend maupun di Firestore.
          Grafik arus kas yang isinya karangan lebih buruk daripada tidak ada
          grafik arus kas; kalau nanti pencatatannya dibuat, panelnya bisa
          kembali dengan angka yang benar-benar berasal dari sesuatu. */}

      {/* Daftar aset + cara mengisi */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            judul="Rincian Aset"
            sub="Pos bertanda live ikut bergerak mengikuti harga pasar."
            kanan={
              <button onClick={() => document.getElementById('isiManual')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
                <Plus className="size-3.5" /> Tambah pos
              </button>
            }
          />
          <div className="px-5 pb-5">
            <TabelBungkus className="max-h-[420px] overflow-y-auto">
              <Tabel>
                <thead className="sticky top-0 bg-zinc-950">
                  <tr><Th>Pos</Th><Th>Jenis</Th><Th className="text-right">Nilai</Th><Th className="text-right">Porsi</Th></tr>
                </thead>
                <tbody>
                  {asetHidup.length === 0 && (
                    <Tr><Td colSpan={4} className="py-6 text-center text-zinc-600">
                      {memuat ? 'Memuat…' : 'Belum ada pos. Tambahkan lewat kotak "Tambah Pos" di samping.'}
                    </Td></Tr>
                  )}
                  {asetHidup.map((a) => (
                    /* key = id, bukan nama. Dua pos boleh bernama sama
                       ("Bank Mandiri" pribadi dan usaha), dan key yang bentrok
                       membuat React menukar isinya saat daftarnya berubah. */
                    <Tr key={a.id}>
                      <Td>
                        <span className="text-zinc-200">{a.nama}</span>
                        {/* Lencana "live" hanya kalau nilainya BENAR-BENAR
                            bergerak — pos bersimbol tanpa harga acuan tidak
                            boleh mengaku hidup. */}
                        {a.bergerak && (
                          <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] text-emerald-500">live</span>
                        )}
                      </Td>
                      <Td>
                        <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                          <span className="size-2 rounded-sm" style={{ background: WARNA_KATEGORI[a.kategori] }} />
                          {a.kategori}
                        </span>
                      </Td>
                      <Td className="angka text-right text-zinc-100">{rupiah(a.nilaiKini)}</Td>
                      <Td className="angka text-right text-zinc-500">
                        <span className="mr-2">{totalAset ? ((a.nilaiKini / totalAset) * 100).toFixed(1) : '0.0'}%</span>
                        <button onClick={() => { if (confirm(`Hapus pos "${a.nama}"?`)) hapusPos(a.id); }}
                                disabled={sibuk} aria-label={`Hapus ${a.nama}`}
                                className="cursor-pointer rounded p-1 align-middle text-zinc-700 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:opacity-40">
                          <Trash2 className="size-3.5" />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                  <Tr className="border-t border-zinc-800">
                    <Td className="font-medium text-zinc-100" colSpan={2}>Aset Kotor</Td>
                    <Td className="angka text-right font-medium text-zinc-100">{rupiah(totalAset)}</Td>
                    <Td className="angka text-right text-zinc-500">100%</Td>
                  </Tr>
                </tbody>
              </Tabel>
            </TabelBungkus>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            {/* Kotak "Unggah Excel / CSV" dibuang. Ia tidak pernah membaca
                berkas apa pun — memilih berkas lalu tidak terjadi apa-apa
                terbaca sebagai kerusakan, dan menyisakannya berarti terus
                menjanjikan sesuatu yang tidak ada. */}
            <PanelHead judul="Tambah Pos" sub="Ketik satu pos; tersimpan di akunmu." />
            <div className="space-y-3 px-5 pb-5">
              <div id="isiManual" className="rounded-lg border border-zinc-800/60 p-3">
                <div className="space-y-2">
                  <input value={baru.nama} onChange={(e) => setBaru({ ...baru, nama: e.target.value })}
                    placeholder="Nama pos, mis. Bank Mandiri" disabled={!pengguna}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={baru.nilai} onChange={(e) => setBaru({ ...baru, nilai: e.target.value })}
                      placeholder="Nilai (Rp)" inputMode="numeric" disabled={!pengguna}
                      className="angka h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                    <select value={baru.kategori} onChange={(e) => setBaru({ ...baru, kategori: e.target.value as KategoriAset })}
                      disabled={!pengguna}
                      className="h-9 w-full cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[12.5px] text-zinc-300 outline-none disabled:opacity-50">
                      {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <input value={baru.simbol} onChange={(e) => setBaru({ ...baru, simbol: e.target.value })}
                    placeholder="Simbol pasar (opsional), mis. BTCUSDT" disabled={!pengguna}
                    className="angka h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] uppercase text-zinc-100 outline-none transition-colors placeholder:normal-case placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-50" />
                  <button onClick={tambahPos} disabled={sibuk || !pengguna}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                    {sibuk && <Loader2 className="size-3.5 animate-spin" />} Simpan pos
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-zinc-600">
                <RefreshCw className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Pos yang diberi simbol pasar mengikuti harga sungguhan lewat proxy VPS.
                  Saldo bank dan emas fisik tidak ikut berkedip — nilainya memang tidak
                  berubah tiap detik.
                </span>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHead judul="Kewajiban" sub="Dikurangkan dari aset kotor." />
            <div className="px-5 pb-5">
              <TabelBungkus>
                <Tabel>
                  <tbody>
                    {isi.kewajiban.length === 0 && (
                      <Tr><Td colSpan={2} className="py-4 text-center text-zinc-600">Belum ada kewajiban tercatat.</Td></Tr>
                    )}
                    {isi.kewajiban.map((k) => (
                      <Tr key={k.id}>
                        <Td className="text-zinc-300">{k.nama}</Td>
                        <Td className="angka text-right text-red-400">
                          <span className="mr-2">{rupiah(k.nilai)}</span>
                          <button onClick={() => { if (confirm(`Hapus "${k.nama}"?`)) void jalankan(() => simpan({ ...isi, kewajiban: isi.kewajiban.filter((x) => x.id !== k.id) }), 'Kewajiban dihapus.'); }}
                                  disabled={sibuk} aria-label={`Hapus ${k.nama}`}
                                  className="cursor-pointer rounded p-1 align-middle text-zinc-700 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:opacity-40">
                            <Trash2 className="size-3.5" />
                          </button>
                        </Td>
                      </Tr>
                    ))}
                    <Tr className="border-t border-zinc-800">
                      <Td className="font-medium text-zinc-100">Porto Bersih</Td>
                      <Td className="angka text-right font-medium text-zinc-100">{rupiah(portoBersih)}</Td>
                    </Tr>
                  </tbody>
                </Tabel>
              </TabelBungkus>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
