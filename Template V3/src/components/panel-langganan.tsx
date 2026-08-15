import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, CalendarClock, KeyRound, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
import { useLisensi } from '@/lib/admin';
import { useKuota } from '@/lib/akses';

/* ════════════════════════════════════════════════════════════════════════
   LANGGANAN & LISENSI
   ════════════════════════════════════════════════════════════════════════
   Dua pertanyaan yang jawabannya selalu dicari terburu-buru saat sudah
   terlambat: "kapan layanan ini habis" dan "lisensi yang aktif ada berapa".

   TANGGALNYA DIISI TANGAN. Registrar dan penyedia hosting tidak menyediakan
   API yang bisa ditanyakan tanpa menyimpan kredensial tagihan mereka di
   server ini — dan menyimpan kredensial tagihan demi satu angka tanggal
   adalah pertukaran yang buruk. Yang bisa dilakukan sistem adalah
   MENGINGATKAN, dan itu yang dikerjakannya: hitung mundur, warna, dan
   peringatan sebelum jatuh tempo.

   Yang KOSONG ditandai "belum diisi", bukan diisi tanggal karangan yang
   terlihat sah. Tanggal palsu di panel pengingat lebih berbahaya daripada
   kolom kosong: ia membuat orang berhenti memeriksa.
   ════════════════════════════════════════════════════════════════════════ */

interface Layanan {
  id: string; nama: string; penyedia: string;
  habis: string; biaya: string; catatan: string;
}

const KELAS_ISIAN =
  'h-8 w-full rounded border border-zinc-800 bg-zinc-900/60 px-2 text-[12px] text-zinc-200 ' +
  'outline-none transition-colors focus-visible:border-zinc-600';

/** Sisa hari sampai tanggal habis. null = belum diisi. */
function sisaHari(habis: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(habis)) return null;
  const t = new Date(habis + 'T23:59:59');
  if (Number.isNaN(t.getTime())) return null;
  return Math.ceil((t.getTime() - Date.now()) / 86_400_000);
}

function LencanaSisa({ sisa }: { sisa: number | null }) {
  if (sisa === null) {
    return <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10.5px] text-zinc-500">belum diisi</span>;
  }
  if (sisa < 0) {
    return <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10.5px] font-semibold text-red-300">
      SUDAH HABIS {Math.abs(sisa)} hari lalu
    </span>;
  }
  /* Ambangnya bukan hiasan: 14 hari cukup untuk memperpanjang domain lewat
     transfer bank yang lambat, 30 hari cukup untuk memutuskan pindah
     penyedia kalau harganya naik. */
  const nada = sisa <= 14 ? 'bg-red-500/20 text-red-300'
    : sisa <= 30 ? 'bg-amber-500/20 text-amber-300'
    : 'bg-emerald-500/15 text-emerald-400';
  return <span className={cn('rounded px-1.5 py-0.5 text-[10.5px] font-semibold', nada)}>{sisa} hari lagi</span>;
}

export function PanelLangganan() {
  const [daftar, setDaftar] = useState<Layanan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');

  const { data: lisensi, memuat: memuatLisensi, galat: galatLisensi } = useLisensi();
  const { kuota, memuat: memuatKuota } = useKuota();

  const { url, token } = bacaKoneksi();
  const dasar = (url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');

  useEffect(() => {
    if (!token.trim()) { setGalat('App Token belum diisi di Integrations'); setMemuat(false); return; }
    let hidup = true;
    fetch(`${dasar}/api/layanan`, { headers: { 'X-App-Token': token.trim() } })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`Backend menjawab ${r.status}`)))
      .then((j) => { if (hidup) { setDaftar(j.daftar ?? []); setMemuat(false); } })
      .catch((e) => { if (hidup) { setGalat(e.message); setMemuat(false); } });
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function simpan() {
    setSibuk(true); setKabar('');
    try {
      const r = await fetch(`${dasar}/api/layanan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Token': token.trim() },
        body: JSON.stringify({ daftar }),
      });
      if (!r.ok) throw new Error(`Backend menjawab ${r.status}`);
      setKabar('Tersimpan.');
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally { setSibuk(false); }
  }

  function ubah(i: number, k: keyof Layanan, v: string) {
    setDaftar((d) => d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  }

  /* Lisensi dikelompokkan per PRODUK. "Ada berapa jenis dan masing-masing
     berapa" adalah dua pertanyaan yang dijawab satu tabel; daftar mentah
     berisi sidik jari perangkat menjawab keduanya dengan buruk. */
  const perProduk = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lisensi) m.set(l.produk || '(tanpa nama)', (m.get(l.produk || '(tanpa nama)') ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [lisensi]);

  const mendesak = daftar.filter((l) => { const s = sisaHari(l.habis); return s !== null && s <= 30; });

  return (
    <>
      {/* ── Masa aktif layanan ─────────────────────────────────────────── */}
      <Panel className="mb-4">
        <PanelHead
          judul="Masa Aktif Layanan"
          sub="Domain, VPS, mailbox, dan pengirim surel. Tanggalnya diisi tangan — penyedia tidak menyediakan API yang bisa ditanyakan tanpa menyimpan kredensial tagihan mereka di server ini."
          kanan={mendesak.length === 0
            ? <span className="flex items-center gap-1.5 text-[12px] text-emerald-500"><CheckCircle2 className="size-4" /> Tidak ada yang mendesak</span>
            : <span className="flex items-center gap-1.5 text-[12px] text-amber-400"><TriangleAlert className="size-4" /> {mendesak.length} akan habis ≤30 hari</span>}
        />

        {memuat ? (
          <div className="flex items-center gap-2 px-5 pb-5 text-[12.5px] text-zinc-500"><Loader2 className="size-3.5 animate-spin" /> Memuat…</div>
        ) : galat ? (
          <p className="px-5 pb-5 text-[12.5px] text-amber-300/90">{galat}</p>
        ) : (
          <>
            {/* KARTU, BUKAN TABEL. Tabel lima kolom berisi input lebar-tetap
                selalu melebihi panelnya begitu jendelanya menyempit —
                `overflow-x-auto` lalu memotongnya, dan yang terlihat adalah
                panel yang isinya terpenggal di tepi. Kartu mengalir: kolom
                yang tidak muat turun ke baris berikutnya, tidak ada yang
                hilang di lebar mana pun. */}
            <div className="space-y-2.5 px-5 pb-4">
              {daftar.map((l, i) => (
                <div key={l.id} className="rounded-lg border border-zinc-800/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-zinc-200">{l.nama}</div>
                      <div className="text-[11px] text-zinc-600">{l.penyedia}</div>
                    </div>
                    <LencanaSisa sisa={sisaHari(l.habis)} />
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2.5">
                    <label className="min-w-[150px] grow">
                      <span className="mb-1 block text-[10.5px] text-zinc-600">Tanggal habis</span>
                      <input type="date" value={l.habis} onChange={(e) => ubah(i, 'habis', e.target.value)}
                             className={cn(KELAS_ISIAN, 'angka cursor-pointer')} />
                    </label>
                    <label className="min-w-[150px] grow">
                      <span className="mb-1 block text-[10.5px] text-zinc-600">Biaya perpanjang</span>
                      <input value={l.biaya} onChange={(e) => ubah(i, 'biaya', e.target.value)}
                             placeholder="mis. Rp 180.000/th" className={KELAS_ISIAN} />
                    </label>
                  </div>

                  {l.catatan && (
                    <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">{l.catatan}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <button onClick={() => void simpan()} disabled={sibuk}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Simpan tanggal
              </button>
              {kabar && <span className="text-[12px] text-zinc-400">{kabar}</span>}
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-600">
                <CalendarClock className="size-3.5" /> Merah ≤14 hari · kuning ≤30 hari
              </span>
            </div>
          </>
        )}
      </Panel>

      {/* ── Lisensi aktif & kuota ──────────────────────────────────────── */}
      <Panel className="mb-4">
        <PanelHead
          judul="Lisensi Aktif & Sisa Kuota"
          sub="Berapa lisensi yang hidup, jenisnya apa saja, dan berapa tempat yang masih tersisa."
        />

        <div className="grid gap-3 px-5 pb-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800/60 p-3">
            <div className="text-[11px] text-zinc-500">Lisensi aktif</div>
            <div className="angka mt-0.5 text-[20px] font-semibold text-zinc-100">
              {memuatLisensi ? '…' : lisensi.length}
            </div>
            <div className="mt-0.5 text-[10.5px] text-zinc-600">{perProduk.length} jenis produk</div>
          </div>
          <div className="rounded-lg border border-zinc-800/60 p-3">
            <div className="text-[11px] text-zinc-500">Sisa akses gratis</div>
            <div className={cn('angka mt-0.5 text-[20px] font-semibold',
              kuota.gratisHabis ? 'text-red-400' : 'text-emerald-400')}>
              {memuatKuota ? '…' : kuota.gratisSisa}
            </div>
            <div className="mt-0.5 text-[10.5px] text-zinc-600">
              {kuota.gratisTerpakai} dari {kuota.gratisTotal} terpakai
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800/60 p-3">
            <div className="text-[11px] text-zinc-500">Sisa akses perintis</div>
            <div className={cn('angka mt-0.5 text-[20px] font-semibold',
              kuota.bayarHabis ? 'text-red-400' : 'text-zinc-100')}>
              {memuatKuota ? '…' : kuota.bayarSisa}
            </div>
            <div className="mt-0.5 text-[10.5px] text-zinc-600">
              {kuota.bayarTerpakai} dari {kuota.bayarTotal} terpakai
            </div>
          </div>
        </div>

        {galatLisensi ? (
          <p className="px-5 pb-5 text-[12.5px] text-amber-300/90">
            Daftar lisensi tidak terbaca: {galatLisensi}.
          </p>
        ) : perProduk.length === 0 ? (
          <p className="px-5 pb-5 text-[12.5px] text-zinc-600">
            {memuatLisensi ? 'Memuat…' : 'Belum ada lisensi aktif.'}
          </p>
        ) : (
          /* KARTU, BUKAN TABEL — dan inilah yang bikin panelnya terlihat
             terpotong sebelumnya. Tabelnya tanpa padding kiri-kanan dan
             tanpa jarak bawah, jadi baris terakhir berhimpit persis di garis
             tepi panel: bukan benar-benar terpotong, tapi terbaca begitu,
             dan itu sama saja. Dua kolom untuk dua angka juga tidak butuh
             tabel — apalagi tabel yang membawa overflow-x-auto sendiri. */
          <div className="space-y-2 px-5 pb-5">
            {perProduk.map(([produk, jml]) => (
              <div key={produk}
                   className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/60 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-zinc-200">
                  <KeyRound className="size-3.5 shrink-0 text-zinc-600" />
                  <span className="truncate">{produk}</span>
                </span>
                <span className="shrink-0 text-[11px] text-zinc-500">
                  <span className="angka text-[14px] font-semibold text-zinc-100">{jml}</span> aktif
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
