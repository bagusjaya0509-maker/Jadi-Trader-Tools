import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Check, Loader2, Copy } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, tanggalPendek } from '@/lib/utils';
import { bacaKoneksi } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   CELAH MESIN PINE — daftar yang menentukan pekerjaan berikutnya
   ════════════════════════════════════════════════════════════════════════
   Mesin Pine kita tidak akan pernah selengkap TradingView, dan tiap skrip
   baru punya peluang menyentuh sesuatu yang belum ada. Pertanyaannya bukan
   "bagaimana supaya lengkap" — itu proyek tanpa ujung — melainkan "mana
   yang harus ditutup lebih dulu".

   Panel ini menjawabnya dengan angka dari pemakaian NYATA, bukan tebakan.
   Yang tercatat cuma nama fiturnya; skrip penggunanya tidak pernah
   dikirim ke mana pun.

   Yang TIDAK dilakukan: memperbaiki mesin secara otomatis. Kode mesin yang
   ditulis model lalu dipasang tanpa ditinjau akan menghasilkan indikator
   yang salah DIAM-DIAM, dan indikator yang salah diam-diam adalah cara
   tercepat kehilangan uang orang. Yang otomatis di sini pencatatan dan
   pemeringkatannya.
   ════════════════════════════════════════════════════════════════════════ */

interface Celah { nama: string; jumlah: number; pertama: number; terakhir: number; versi?: string[] }

function dasar() {
  return (bacaKoneksi().url.trim() || 'https://103-253-145-38.sslip.io').replace(/\/+$/, '');
}

/** Kelompok kasar supaya daftarnya bisa dibaca sebagai keputusan, bukan
 *  sebagai tumpukan nama. Yang menggambar di panel harga bisa kita
 *  kerjakan; yang butuh permukaan baru (tabel, latar) pekerjaan lain. */
function kelompok(nama: string): { label: string; warna: string } {
  if (/^table\./.test(nama)) return { label: 'butuh tabel', warna: 'text-zinc-500' };
  if (/^(bgcolor|barcolor|fill)/.test(nama)) return { label: 'butuh pewarna latar', warna: 'text-zinc-500' };
  if (/^(alert|alertcondition)/.test(nama)) return { label: 'peringatan', warna: 'text-zinc-500' };
  if (/^(strategy|request)\./.test(nama)) return { label: 'di luar cakupan', warna: 'text-red-400/70' };
  if (/^lain\./.test(nama)) return { label: 'perlu ditelusuri', warna: 'text-amber-400/80' };
  return { label: 'bisa ditambahkan', warna: 'text-emerald-500/80' };
}

export function PanelCelahPine() {
  const [daftar, setDaftar] = useState<Celah[] | null>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  const muat = useCallback(async () => {
    const token = bacaKoneksi().token.trim();
    if (!token) { setGalat('App Token belum diisi di Integrations.'); setDaftar([]); return; }
    setSibuk(true); setGalat('');
    try {
      const r = await fetch(`${dasar()}/api/pine/galat`, { headers: { 'X-App-Token': token } });
      if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
      const j = await r.json();
      setDaftar(Array.isArray(j.daftar) ? j.daftar : []);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat');
      setDaftar([]);
    } finally { setSibuk(false); }
  }, []);

  useEffect(() => { void muat(); }, [muat]);

  async function tandaiSelesai(nama: string) {
    const token = bacaKoneksi().token.trim();
    if (!token) return;
    /* Dihapus HANYA setelah celahnya benar-benar ditutup di mesin —
       kalau tidak, peringkatnya berhenti mencerminkan keadaan. */
    if (!confirm(`Tandai "${nama}" sudah didukung mesin?\n\nEntrinya dibuang dari daftar. Kalau ternyata belum, ia akan muncul lagi sendiri saat ada yang memakainya.`)) return;
    try {
      await fetch(`${dasar()}/api/pine/galat/hapus`, {
        method: 'POST',
        headers: { 'X-App-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama }),
      });
      setDaftar((d) => (d ?? []).filter((x) => x.nama !== nama));
    } catch { /* biarkan; muat ulang akan menunjukkan keadaan sebenarnya */ }
  }

  /* ── Laporan siap diserahkan ──────────────────────────────────────
     Tujuannya satu kali jalan: satu teks yang memuat SEMUA yang perlu
     diketahui untuk memperbaiki — nama fiturnya, berapa sering
     tertabrak, kapan terakhir, dan sudah dikelompokkan menurut jenis
     pekerjaannya. Menyalin daftar mentah berarti pekerjaan memilah itu
     dikerjakan dua kali: sekali olehmu saat menyalin, sekali lagi saat
     dibaca. Di sini dikerjakan sekali, oleh yang punya datanya. */
  async function salinLaporan() {
    const d = daftar ?? [];
    if (!d.length) return;
    const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const grup = new Map<string, Celah[]>();
    for (const c of d) {
      const k = kelompok(c.nama).label;
      grup.set(k, [...(grup.get(k) ?? []), c]);
    }
    const bagian = [...grup.entries()].map(([label, isi]) => {
      const baris = isi
        .sort((a, b) => b.jumlah - a.jumlah)
        .map((c) => `- ${c.nama} — ${c.jumlah}× (terakhir ${tanggalPendek(c.terakhir)}${c.versi?.length ? `, versi ${c.versi.join('/')}` : ''})`);
      return `## ${label} (${isi.length})\n${baris.join('\n')}`;
    });

    const teks = [
      `# Celah Mesin Pine — ${tgl}`,
      '',
      `${d.length} fitur belum didukung, ${d.reduce((s, x) => s + x.jumlah, 0)} kali tertabrak pengguna.`,
      'Diurutkan menurut seberapa sering menghambat. Yang atas lebih dulu.',
      '',
      ...bagian,
      '',
      '## Catatan',
      '- Daftar ini berisi NAMA FITUR saja; skrip penggunanya tidak dikirim ke server.',
      '- "bisa ditambahkan" = fungsi bawaan Pine yang tinggal dipasang di mesin.',
      '- "butuh tabel" / "butuh pewarna latar" = perlu permukaan gambar baru di chart, bukan sekadar fungsi.',
      '- "perlu ditelusuri" = galat yang belum bisa dipetakan ke satu nama fungsi.',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      window.setTimeout(() => setTersalin(false), 2500);
    } catch {
      setGalat('Peramban menolak menyalin. Buka konsol atau salin manual dari daftar di bawah.');
    }
  }

  const total = (daftar ?? []).reduce((s, x) => s + x.jumlah, 0);
  const maks = Math.max(1, ...(daftar ?? []).map((x) => x.jumlah));

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Celah Mesin Pine"
        sub="Fitur yang diminta skrip pengguna tapi belum ada di mesin. Hanya namanya yang dicatat — skripnya tidak pernah dikirim."
        kanan={
          <span className="flex items-center gap-2">
            <button onClick={() => void salinLaporan()} disabled={!daftar?.length}
              title="Salin laporan lengkap — siap diserahkan untuk sekali jalan perbaikan"
              className="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
              {tersalin ? <Check className="size-3" /> : <Copy className="size-3" />}
              {tersalin ? 'Tersalin' : 'Salin laporan'}
            </button>
            <button onClick={() => void muat()} disabled={sibuk}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 disabled:opacity-50">
              {sibuk ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Segarkan
            </button>
          </span>
        }
      />
      <div className="px-5 pb-5">
        {galat && <div className="mb-2 text-[12px] text-amber-400/80">{galat}</div>}

        {daftar === null ? (
          <div className="py-6 text-center text-[12.5px] text-zinc-500">Memuat…</div>
        ) : daftar.length === 0 ? (
          <div className="py-6 text-center text-[12.5px] text-zinc-500">
            Belum ada celah tercatat. Daftarnya terisi sendiri begitu ada skrip yang menabrak batas mesin.
          </div>
        ) : (
          <>
            <div className="mb-2 text-[11.5px] text-zinc-500">
              {daftar.length} fitur · {total} kali tertabrak
            </div>
            <div className="gulir-senyap max-h-[420px] divide-y divide-zinc-800/60 overflow-y-auto">
              {daftar.map((c) => {
                const k = kelompok(c.nama);
                return (
                  <div key={c.nama} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="angka truncate text-[12.5px] text-zinc-200">{c.nama}</span>
                        <span className={cn('shrink-0 text-[10.5px]', k.warna)}>{k.label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="angka text-[12px] text-amber-400/90">{c.jumlah}×</span>
                        <button onClick={() => void tandaiSelesai(c.nama)}
                          title="Tandai sudah didukung — buang dari daftar"
                          className="cursor-pointer rounded border border-zinc-800 p-1 text-zinc-500 transition-colors hover:border-emerald-500/40 hover:text-emerald-400">
                          <Check className="size-3" />
                        </button>
                      </span>
                    </div>
                    {/* Batang sebanding, bukan angka saja: yang perlu terbaca
                        sekilas adalah JARAK antara yang teratas dan sisanya —
                        itu yang menentukan mana yang layak dikerjakan dulu. */}
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800/60">
                        <div className="h-full rounded-full bg-amber-500/50"
                             style={{ width: `${Math.round((c.jumlah / maks) * 100)}%` }} />
                      </div>
                      <span className="shrink-0 text-[10.5px] text-zinc-600">
                        terakhir {tanggalPendek(c.terakhir)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
