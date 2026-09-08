import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, BadgeCheck, XCircle, Save } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, tanggalPendek } from '@/lib/utils';
import {
  referralAdmin, putuskanPencairan, simpanSetelanReferral, rupiah, dolar, namaPaketRef,
  ringkasSetelan, PAKET_KOMISI, persenPaketRef,
  type DataReferralAdmin, type SetelanReferral,
} from '@/lib/referral';

/* ════════════════════════════════════════════════════════════════════════
   PROGRAM REFERRAL — panel pemilik (Maintenance)
   ════════════════════════════════════════════════════════════════════════
   Tempat uang komisi benar-benar berpindah: pemilik membaca permintaan
   pencairan, mentransfer dari rekening usahanya, lalu menandai "Dibayar".
   Sistem tidak menyentuh bank mana pun — ia mencatat keputusan, dan
   keputusan itulah yang mengubah status komisi orangnya.

   "Tolak" mengembalikan komisi ke SIAP, bukan menghanguskannya. Yang salah
   pada permintaan biasanya nomor rekening; orangnya boleh mengajukan lagi.
   ════════════════════════════════════════════════════════════════════════ */

const kelasIsian = 'h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600';

export function PanelReferralPemilik() {
  const [data, setData] = useState<DataReferralAdmin | null>(null);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [setelan, setSetelan] = useState<SetelanReferral | null>(null);
  /* Nilai yang BENAR-BENAR tersimpan saat panel ini terakhir membaca
     server. Dibandingkan lagi sebelum menyimpan — lihat catatan di
     simpan(). */
  const [setelanAwal, setSetelanAwal] = useState<SetelanReferral | null>(null);
  const [sibukSetelan, setSibukSetelan] = useState(false);
  const [kabarSetelan, setKabarSetelan] = useState('');
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [sibukId, setSibukId] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true); setGalat('');
    try {
      const d = await referralAdmin();
      setData(d); setSetelan(d.setelan); setSetelanAwal(d.setelan);
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal memuat.'); }
    finally { setMemuat(false); }
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  /* ── FORMULIR BASI TIDAK BOLEH MENIMPA DIAM-DIAM ────────────────────
     Panel ini membaca setelan sekali saat dibuka. Tab yang dibiarkan
     terbuka sejak pagi masih memegang angka pagi itu, dan satu klik
     Simpan mengembalikannya tanpa terlihat salah bagi yang menekannya.

     BELUM PERNAH TERJADI. Ia sempat saya kira penyebab komisi yang
     berubah 8 Sep 2026, dan dugaan itu meleset — pemiliknya sendiri yang
     mengubahnya. Penjaganya tetap dipasang karena yang disimpan di sini
     menentukan berapa uang keluar, dan ongkosnya cuma satu pembacaan
     ulang sebelum menulis. Kalau nilai di server sudah berbeda dari yang
     dimuat panel, orangnya melihat keduanya dan memilih sendiri.

     Pelajaran yang lebih mahal ada di riwayat di bawah: yang benar-benar
     kurang bukan penjaganya, melainkan catatan siapa mengubah apa. */
  async function simpan() {
    if (!setelan) return;
    setSibukSetelan(true); setKabarSetelan('');
    try {
      const kini = (await referralAdmin()).setelan;
      if (setelanAwal && JSON.stringify(kini) !== JSON.stringify(setelanAwal)) {
        const lanjut = window.confirm(
          'Setelan di server sudah berubah sejak panel ini dibuka.\n\n'
          + 'Tersimpan sekarang: ' + ringkasSetelan(kini) + '\n'
          + 'Yang ada di layar ini: ' + ringkasSetelan(setelan) + '\n\n'
          + 'Menyimpan akan menimpanya dengan angka di layar. Lanjutkan?');
        if (!lanjut) {
          setSetelan(kini); setSetelanAwal(kini);
          setKabarSetelan('Dibatalkan. Formulir disegarkan ke nilai yang tersimpan.');
          return;
        }
      }
      const s = await simpanSetelanReferral(setelan);
      setSetelan(s); setSetelanAwal(s); setKabarSetelan('Setelan tersimpan.');
      void muat();
    } catch (e) { setKabarSetelan(e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setSibukSetelan(false); }
  }

  async function putuskan(id: string, tindakan: 'bayar' | 'tolak') {
    if (tindakan === 'bayar' && !window.confirm('Tandai sudah ditransfer? Komisi di dalamnya akan berstatus "dibayar".')) return;
    setSibukId(id);
    try {
      await putuskanPencairan(id, tindakan, catatan[id] || '');
      await muat();
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal memutuskan.'); }
    finally { setSibukId(''); }
  }

  if (memuat && !data) {
    return <div className="flex items-center gap-2 py-8 text-[12.5px] text-zinc-500"><Loader2 className="size-4 animate-spin" /> Memuat program referral…</div>;
  }
  if (!data || !setelan) {
    return (
      <Panel className="p-5">
        <div className="text-[12.5px] text-red-400">{galat || 'Data kosong.'}</div>
        <button onClick={() => void muat()} className="mt-3 cursor-pointer rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 hover:border-zinc-700">Coba lagi</button>
      </Panel>
    );
  }

  const menunggu = data.pencairan.filter((p) => p.status === 'diajukan');
  const selesai = data.pencairan.filter((p) => p.status !== 'diajukan');

  return (
    <div className="space-y-4">
      {galat && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">{galat}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Menunggu dicairkan" nilai={rupiah(data.ringkas.diajukanRp)} catatan={`${data.ringkas.pencairanMenunggu} permintaan`} />
        <KartuKpi label="Komisi siap (belum diminta)" nilai={rupiah(data.ringkas.siapRp)} catatan="kewajiban yang belum diajukan" />
        <KartuKpi label="Sudah dibayar" nilai={rupiah(data.ringkas.dibayarRp)} catatan="seluruh masa program" />
        <KartuKpi label="Perujuk aktif" nilai={String(data.ringkas.perujuk)} catatan={`${data.ringkas.rujukan} rujukan · ${data.ringkas.komisi} komisi`} />
      </div>

      {/* ── Pencairan menunggu ─────────────────────────────────────── */}
      <Panel>
        <PanelHead judul={<>Permintaan pencairan {menunggu.length > 0 && <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-400">{menunggu.length}</span>}</>}
          sub="Transfer dulu dari rekening usaha, baru tandai. Menolak mengembalikan komisinya ke status siap."
          kanan={<button onClick={() => void muat()} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11.5px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"><RefreshCw className="size-3.5" /> Segarkan</button>} />
        {menunggu.length === 0 ? (
          <div className="px-5 pb-6 pt-1 text-[12.5px] text-zinc-500">Tidak ada permintaan yang menunggu.</div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {menunggu.map((p) => (
              <div key={p.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="angka text-[16px] font-semibold text-zinc-100">{rupiah(p.jumlahRp)}</span>
                    <span className="angka text-[11.5px] text-zinc-500">{dolar(p.jumlahUsd)} · {p.komisiIds.length} komisi</span>
                    <span className="angka text-[11.5px] text-zinc-500">{tanggalPendek(p.waktu)}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-zinc-200">
                    {p.bank} <span className="angka">{p.rekening}</span> <span className="text-zinc-400">a.n. {p.nama}</span>
                  </div>
                  <div className="angka mt-0.5 text-[11.5px] text-zinc-500">{p.email || p.uid}</div>
                  <input value={catatan[p.id] || ''} onChange={(e) => setCatatan({ ...catatan, [p.id]: e.target.value })}
                    placeholder="Catatan untuk penerima (opsional) — mis. nomor referensi transfer"
                    className={cn(kelasIsian, 'mt-2 max-w-xl')} maxLength={300} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void putuskan(p.id, 'bayar')} disabled={sibukId === p.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-putih-mutlak transition-colors hover:bg-emerald-500 disabled:opacity-50">
                    {sibukId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" />} Sudah ditransfer
                  </button>
                  <button onClick={() => void putuskan(p.id, 'tolak')} disabled={sibukId === p.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50">
                    <XCircle className="size-3.5" /> Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Setelan ────────────────────────────────────────────────── */}
      <Panel className="p-5">
        <div className="mb-3">
          <h3 className="text-[13.5px] font-medium text-zinc-200">Setelan program</h3>
          <p className="text-[12px] text-zinc-500">Berlaku untuk komisi yang lahir SESUDAH disimpan. Komisi yang sudah tercatat tidak dihitung ulang.</p>
        </div>
        {/* Satu kolom per paket. Diminta pemilik 8 Sep 2026: paket murah
            dipakai menarik orang masuk sehingga separuhnya boleh
            diserahkan, sementara paket tahunan bernilai paling besar dan
            paling menarik untuk diakali lewat akun kedua sendiri. */}
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          {PAKET_KOMISI.map((k) => (
            <div key={k.id}>
              <label className="mb-1 block text-[11px] text-zinc-500">Komisi {k.nama} (%)</label>
              <input type="number" min={0} max={100} step={0.5} value={persenPaketRef(setelan, k.id)}
                onChange={(e) => setSetelan({
                  ...setelan,
                  persenPaket: { ...(setelan.persenPaket ?? {}), [k.id]: Number(e.target.value) },
                })} className={cn(kelasIsian, 'angka')} />
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">Minimal pencairan (Rp)</label>
            <input type="number" min={0} step={1000} value={setelan.minimalRp}
              onChange={(e) => setSetelan({ ...setelan, minimalRp: Number(e.target.value) })} className={cn(kelasIsian, 'angka')} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">Masa berlaku rujukan (bulan)</label>
            <input type="number" min={1} max={120} value={setelan.masaBulan}
              onChange={(e) => setSetelan({ ...setelan, masaBulan: Number(e.target.value) })} className={cn(kelasIsian, 'angka')} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">Program</label>
            <button type="button" onClick={() => setSetelan({ ...setelan, aktif: !setelan.aktif })}
              className={cn('h-9 w-full cursor-pointer rounded-md border text-[12.5px] font-medium transition-colors',
                setelan.aktif ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900/60 text-zinc-400')}>
              {setelan.aktif ? 'Aktif' : 'Dijeda'}
            </button>
          </div>
        </div>
        {/* Riwayat singkat, tepat di bawah formulirnya. Setelan yang
            menentukan berapa uang keluar pantas punya jejak yang bisa
            dilihat tanpa membuka log server. */}
        {!!data.jejakSetelan?.length && (
          <div className="mt-3 border-t border-zinc-800/80 pt-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">Perubahan terakhir</div>
            <ul className="space-y-1">
              {data.jejakSetelan.slice(0, 4).map((j) => (
                <li key={j.waktu} className="flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-zinc-500">
                  <span className="angka text-zinc-400">{tanggalPendek(j.waktu)}</span>
                  <span>{ringkasSetelan(j.sebelum)}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-zinc-300">{ringkasSetelan(j.sesudah)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => void simpan()} disabled={sibukSetelan}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
            {sibukSetelan ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Simpan setelan
          </button>
          {kabarSetelan && <span className="text-[12px] text-zinc-400">{kabarSetelan}</span>}
        </div>
      </Panel>

      {/* ── Perujuk teratas & riwayat ──────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHead judul="Perujuk teratas" sub="Siapa yang benar-benar mendatangkan pembeli." />
          {data.perujukTeratas.length === 0 ? (
            <div className="px-5 pb-6 pt-1 text-[12.5px] text-zinc-500">Belum ada rujukan tercatat.</div>
          ) : (
            <TabelBungkus>
              <Tabel>
                <thead><tr><Th>Perujuk</Th><Th>Kode</Th><Th className="text-right">Daftar</Th><Th className="text-right">Beli</Th><Th className="text-right">Komisi</Th></tr></thead>
                <tbody>
                  {data.perujukTeratas.map((p) => (
                    <Tr key={p.uid}>
                      <Td><div className="text-zinc-200">{p.nama || '—'}</div><div className="angka text-[11px] text-zinc-500">{p.email || p.uid}</div></Td>
                      <Td className="angka text-zinc-300">{p.kode}</Td>
                      <Td className="angka text-right text-zinc-300">{p.rujukan}</Td>
                      <Td className="angka text-right text-zinc-300">{p.membeli}</Td>
                      <Td className="angka text-right text-emerald-400">{rupiah(p.komisiRp)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabel>
            </TabelBungkus>
          )}
        </Panel>

        <Panel>
          <PanelHead judul="Pencairan selesai" sub="Yang sudah dibayar atau ditolak." />
          {selesai.length === 0 ? (
            <div className="px-5 pb-6 pt-1 text-[12.5px] text-zinc-500">Belum ada.</div>
          ) : (
            <TabelBungkus>
              <Tabel>
                <thead><tr><Th>Tanggal</Th><Th>Penerima</Th><Th className="text-right">Jumlah</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {selesai.slice(0, 40).map((p) => (
                    <Tr key={p.id}>
                      <Td className="angka text-zinc-400">{tanggalPendek(p.diputusPada || p.waktu)}</Td>
                      <Td><div className="text-zinc-200">{p.nama}</div><div className="angka text-[11px] text-zinc-500">{p.bank} {p.rekening}</div></Td>
                      <Td className="angka text-right text-zinc-100">{rupiah(p.jumlahRp)}</Td>
                      <Td>
                        <span className={cn('rounded px-1.5 py-0.5 text-[10.5px] font-medium',
                          p.status === 'dibayar' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                          {p.status === 'dibayar' ? 'Dibayar' : 'Ditolak'}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabel>
            </TabelBungkus>
          )}
        </Panel>
      </div>

      {data.komisi.length > 0 && (
        <Panel>
          <PanelHead judul="Komisi terbaru" sub="Satu baris per pembelian berbayar yang punya perujuk." />
          <TabelBungkus>
            <Tabel>
              <thead><tr><Th>Tanggal</Th><Th>Perujuk</Th><Th>Pembeli</Th><Th>Paket</Th><Th className="text-right">Harga</Th><Th className="text-right">Komisi</Th><Th>Status</Th></tr></thead>
              <tbody>
                {data.komisi.slice(0, 60).map((k) => (
                  <Tr key={k.id}>
                    <Td className="angka text-zinc-400">{tanggalPendek(k.waktu)}</Td>
                    <Td className="angka text-zinc-300">{k.perujukEmail || k.perujuk}</Td>
                    <Td className="angka text-zinc-300">{k.dariEmail || k.dari}</Td>
                    <Td className="text-zinc-300">{namaPaketRef(k.paket)}</Td>
                    <Td className="angka text-right text-zinc-400">{dolar(k.usd)}</Td>
                    <Td className="angka text-right text-emerald-400">{rupiah(k.jumlahRp)}</Td>
                    <Td className="text-[11.5px] text-zinc-400">{k.status}</Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          </TabelBungkus>
        </Panel>
      )}
    </div>
  );
}
