import { Activity, HardDrive, Cpu, MemoryStick, ShieldAlert, CheckCircle2, TriangleAlert } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { useStatusVps } from '@/lib/admin';

/* ════════════════════════════════════════════════════════════════════════
   KESEHATAN SERVER — panel Maintenance
   ════════════════════════════════════════════════════════════════════════
   Menjawab tiga pertanyaan pemilik tanpa harus SSH: seberapa berat server
   sekarang, apakah ada yang mendekati penuh, dan adakah tanda-tanda orang
   mencoba masuk tanpa hak. Sarannya dihitung dari ambang yang tertulis di
   sini — bukan tebakan, dan bukan janji.

   BATAS YANG DIAKUI TERBUKA: angka-angka ini datang dari proses backend
   sendiri (penghitung di memori + os.* + df). Ia indikator dini, bukan
   sistem pemantauan penuh — audit keamanan menyeluruh, deteksi intrusi, dan
   riwayat jangka panjang butuh alat server terpisah (mis. netdata/fail2ban).
   ════════════════════════════════════════════════════════════════════════ */

function Ukur({ label, nilai, sub, Ikon, buruk }: {
  label: string; nilai: string; sub?: string;
  Ikon: typeof Activity; buruk?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/60 p-3.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
        <Ikon className="size-3.5" /> {label}
      </div>
      <div className={cn('angka mt-1.5 text-[19px] font-semibold leading-tight',
        buruk ? 'text-red-400' : 'text-zinc-100')}>{nilai}</div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-600">{sub}</div>}
    </div>
  );
}

function hariJam(detik: number) {
  const h = Math.floor(detik / 86400), j = Math.floor((detik % 86400) / 3600);
  return h > 0 ? `${h} hari ${j} jam` : `${j} jam ${Math.floor((detik % 3600) / 60)} mnt`;
}

export function PanelKesehatan() {
  const { data: v, memuat, galat } = useStatusVps();

  if (galat) {
    return (
      <Panel className="mb-4 px-5 py-4 text-[12.5px] text-amber-300/90">
        Status VPS tidak terbaca: {galat}. Periksa Backend URL & App Token di Integrations.
      </Panel>
    );
  }
  if (memuat || !v.ramTotalMb) return null;

  const ramPakaiPersen = Math.round(((v.ramTotalMb - v.ramBebasMb) / v.ramTotalMb) * 100);
  const bebanPersen = v.cpu ? Math.round(((v.beban[0] ?? 0) / v.cpu) * 100) : 0;
  const disk = v.disk;
  const q = v.permintaan;

  /* ── Saran dihitung dari ambang yang TERTULIS ─────────────────────── */
  const saran: { nada: 'buruk' | 'awas'; teks: string }[] = [];
  if (ramPakaiPersen >= 90) saran.push({ nada: 'buruk', teks: `RAM terpakai ${ramPakaiPersen}% — proses bisa dibunuh OS. Saatnya upgrade RAM VPS atau restart backend.` });
  else if (ramPakaiPersen >= 80) saran.push({ nada: 'awas', teks: `RAM terpakai ${ramPakaiPersen}% — masih jalan, tapi siapkan rencana upgrade.` });
  if (bebanPersen >= 90) saran.push({ nada: 'buruk', teks: `CPU jenuh (beban ${v.beban[0]} pada ${v.cpu} inti). Halaman terasa lambat karena ini — upgrade CPU atau kurangi beban pindaian.` });
  else if (bebanPersen >= 70) saran.push({ nada: 'awas', teks: `CPU cukup sibuk (${bebanPersen}%). Belum genting, pantau saat jam ramai.` });
  if (disk && disk.persen >= 90) saran.push({ nada: 'buruk', teks: `Disk ${disk.persen}% penuh — log atau cadangan menumpuk. Bersihkan atau tambah disk sebelum server menolak menulis.` });
  else if (disk && disk.persen >= 75) saran.push({ nada: 'awas', teks: `Disk terisi ${disk.persen}%. Jadwalkan bersih-bersih.` });
  if (q && q.kena429 > 20) saran.push({ nada: 'awas', teks: `${q.kena429} permintaan tersandung rate limit sejak restart — trafik tinggi. Kalau ini pengunjung sah, naikkan batasnya; kalau bukan, biarkan bekerja.` });
  if (q && q.tolakanAuth > 50) saran.push({ nada: 'buruk', teks: `${q.tolakanAuth} permintaan DITOLAK karena token salah — pola percobaan masuk tanpa hak. Ganti APP_TOKEN di .env VPS dan perbarui di Integrations.` });
  else if (q && q.tolakanAuth > 10) saran.push({ nada: 'awas', teks: `${q.tolakanAuth} penolakan token sejak restart. Sebagian bisa jadi salah ketik sendiri; naik terus = patut dicurigai.` });
  if (q && q.galat5xx > 10) saran.push({ nada: 'awas', teks: `${q.galat5xx} galat server (5xx) — periksa log pm2 di VPS.` });

  return (
    <Panel className="mb-4">
      <PanelHead
        judul="Kesehatan Server"
        sub={`VPS 103.253.145.38 · backend hidup ${hariJam(v.waktuHidupDetik)} · mesin ${hariJam(v.waktuHidupMesinDetik)}`}
        kanan={saran.length === 0
          ? <span className="flex items-center gap-1.5 text-[12px] text-emerald-500"><CheckCircle2 className="size-4" /> Semua sehat</span>
          : <span className={cn('flex items-center gap-1.5 text-[12px]',
              saran.some((s) => s.nada === 'buruk') ? 'text-red-400' : 'text-amber-400')}>
              <TriangleAlert className="size-4" /> {saran.length} hal perlu dilihat
            </span>}
      />
      <div className="grid grid-cols-2 gap-3 px-5 pb-4 lg:grid-cols-4">
        <Ukur label="CPU" Ikon={Cpu} buruk={bebanPersen >= 90}
              nilai={`${bebanPersen}%`} sub={`beban ${v.beban.join(' / ') || '—'} · ${v.cpu} inti`} />
        <Ukur label="RAM" Ikon={MemoryStick} buruk={ramPakaiPersen >= 90}
              nilai={`${ramPakaiPersen}%`}
              sub={`${v.ramTotalMb - v.ramBebasMb} / ${v.ramTotalMb} MB · proses ${v.ramProsesMb} MB`} />
        <Ukur label="Disk" Ikon={HardDrive} buruk={!!disk && disk.persen >= 90}
              nilai={disk ? `${disk.persen}%` : '—'}
              sub={disk ? `${(disk.terpakaiMb / 1024).toFixed(1)} / ${(disk.totalMb / 1024).toFixed(1)} GB` : 'tidak terbaca'} />
        <Ukur label="Trafik" Ikon={Activity}
              nilai={q ? `${q.perMenit}/mnt` : '—'}
              sub={q ? `${q.total.toLocaleString('id-ID')} permintaan sejak restart` : 'menunggu data'} />
      </div>

      {q && (q.tolakanAuth > 0 || q.kena429 > 0 || q.galat5xx > 0) && (
        <div className="flex flex-wrap gap-4 border-t border-zinc-800/60 px-5 py-3 text-[12px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 text-zinc-600" />
            Penolakan token <span className={cn('angka', q.tolakanAuth > 50 ? 'text-red-400' : 'text-zinc-300')}>{q.tolakanAuth}</span>
          </span>
          <span>Rate limit <span className="angka text-zinc-300">{q.kena429}</span></span>
          <span>Galat 5xx <span className="angka text-zinc-300">{q.galat5xx}</span></span>
        </div>
      )}

      {saran.length > 0 && (
        <div className="space-y-1.5 border-t border-zinc-800/60 px-5 py-3.5">
          {saran.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] leading-relaxed">
              <TriangleAlert className={cn('mt-0.5 size-3.5 shrink-0',
                s.nada === 'buruk' ? 'text-red-400' : 'text-amber-400')} />
              <span className="text-zinc-400">{s.teks}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-zinc-800/60 px-5 py-2.5 text-[11px] leading-relaxed text-zinc-600">
        Angka dari proses backend sendiri; penghitung kembali nol tiap restart. Ini indikator dini,
        bukan sistem pemantauan penuh — deteksi intrusi dan riwayat jangka panjang butuh alat server
        terpisah, dan itu keputusan upgrade tersendiri.
      </div>
    </Panel>
  );
}
