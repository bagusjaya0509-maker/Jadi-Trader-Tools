import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, SkipForward, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useAkunMt5 } from '@/lib/akun';
import { daftarLangganan } from '@/lib/copy-langganan';
import { bacaWaktuPindai, bacaLogCopy, type LogCopy } from '@/lib/pengikut-copy';

/* ════════════════════════════════════════════════════════════════════════
   STATUS AUTO-COPY — apa yang sebenarnya sedang terjadi
   ════════════════════════════════════════════════════════════════════════
   Penyalinan otomatis sudah berjalan sejak seseorang menekan "Ikuti", tapi
   sampai sekarang ia berjalan TANPA SUARA. Sinyal yang tidak masuk terlihat
   persis sama dengan penyalin yang mati: layar diam, terminal kosong, dan
   tidak ada satu pun kalimat yang bisa membedakan keduanya.

   Itu bukan kekurangan kecil. Fitur yang mengirim uang tanpa ada yang
   menekan tombol HARUS bisa ditanyai "kamu hidup?" dan "kenapa yang tadi
   tidak masuk?" — kalau tidak, satu-satunya cara memeriksanya adalah
   memposting sinyal sungguhan dan menunggu, dan itu ujicoba yang harganya
   uang sungguhan.

   Tiga hal yang dijawab kotak ini, berurutan menurut yang paling sering
   jadi sebabnya:
     1. Hidup atau tidak, dan kapan terakhir benar-benar memindai.
     2. Terminalnya siap atau tidak — sebab nomor satu kalau tidak ada
        apa-apa yang masuk.
     3. Sinyal apa saja yang lewat sini, dan kalau dilewati: kenapa.
   ════════════════════════════════════════════════════════════════════════ */

function jam(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function selang(ms: number): string {
  if (!ms) return 'belum pernah';
  const detik = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (detik < 90) return `${detik} detik lalu`;
  const menit = Math.round(detik / 60);
  if (menit < 90) return `${menit} menit lalu`;
  return `${Math.round(menit / 60)} jam lalu`;
}

const RUPA = {
  terkirim: { Ikon: CheckCircle2, warna: 'text-emerald-500' },
  dilewati: { Ikon: SkipForward, warna: 'text-zinc-500' },
  gagal: { Ikon: XCircle, warna: 'text-red-400' },
} as const;

export function StatusAutoCopy() {
  const { pengguna } = useAuth();
  const akun = useAkunMt5();
  const [pindai, setPindai] = useState(0);
  const [log, setLog] = useState<LogCopy[]>([]);
  const [buka, setBuka] = useState(false);

  /* Dibaca ULANG tiap 15 detik. Penyalinnya berjalan di kerangka aplikasi
     dan menulis ke localStorage; tanpa pembacaan berkala, kotak yang
     mengaku menampilkan keadaan sekarang justru membeku di keadaan saat
     halamannya dibuka — persis kesalahan yang ingin diperbaikinya. */
  useEffect(() => {
    function baca() {
      setPindai(bacaWaktuPindai(pengguna?.uid));
      setLog(bacaLogCopy(pengguna?.uid));
    }
    baca();
    const jam = setInterval(baca, 15_000);
    return () => clearInterval(jam);
  }, [pengguna?.uid]);

  if (!pengguna) return null;
  const jumlah = daftarLangganan(pengguna.uid).length;
  if (jumlah === 0) return null;

  const eaHidup = akun.terhubung === true;
  const pernah = pindai > 0;

  return (
    <div className={cn('mb-3 rounded-lg border px-3 py-2.5',
      eaHidup ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
              : 'border-amber-500/25 bg-amber-500/[0.05]')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn('size-1.5 shrink-0 rounded-full',
          eaHidup ? 'animate-pulse bg-emerald-500' : 'bg-amber-400')} />
        <span className="text-[12px] font-medium text-zinc-200">
          {eaHidup ? 'Auto-copy aktif' : 'Auto-copy menunggu terminal'}
        </span>
        <span className="text-[11.5px] text-zinc-500">
          · {jumlah} analis · pindai terakhir {pernah ? `${jam(pindai)} (${selang(pindai)})` : 'belum pernah'}
        </span>
        {log.length > 0 && (
          <button type="button" onClick={() => setBuka((b) => !b)}
            className="ml-auto rounded px-1.5 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200">
            {buka ? 'Tutup catatan' : `Catatan ${log.length}`}
          </button>
        )}
      </div>

      {/* SEBAB NOMOR SATU DITULIS DULUAN. Kalau EA-nya mati, semua
          keterangan lain di bawah ini tidak menjelaskan apa-apa: tidak ada
          sinyal yang bisa masuk ke terminal yang tidak berjalan. */}
      {!eaHidup && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-amber-300/90">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          <span>
            MT5 belum melapor. Sinyal yang terbit sekarang tidak akan masuk —
            buka MT5, pastikan EA Trade-Fi Sync terpasang dan AutoTrading menyala.
          </span>
        </p>
      )}

      {/* Keterbatasannya disebut di tempat orang menilai apakah fiturnya
          bekerja, bukan di halaman bantuan yang tidak akan dibuka. */}
      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
        Penyalinan berjalan selama aplikasi ini terbuka, dipindai tiap menit.
        Sinyal yang terbit saat semua tab tertutup tidak tersalin.
      </p>

      {buka && log.length > 0 && (
        <div className="gulir-senyap mt-2 max-h-[220px] space-y-1 overflow-y-auto border-t border-zinc-800/60 pt-2">
          {log.map((e, i) => {
            const { Ikon, warna } = RUPA[e.hasil];
            return (
              <div key={e.waktu + '|' + i} className="flex items-start gap-2">
                <Ikon className={cn('mt-px size-3.5 shrink-0', warna)} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-[11.5px] text-zinc-300">{e.pasangan}</span>
                    <span className="text-[10.5px] text-zinc-600">{e.analis}</span>
                    <span className="angka text-[10.5px] text-zinc-600">{jam(e.waktu)}</span>
                  </div>
                  <p className="text-[11px] leading-snug text-zinc-500">{e.sebab}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
