import { useEffect, useState } from 'react';
import { Loader2, Trash2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, uang, tanggalPendek } from '@/lib/utils';
import { daftarAnalisa, hapusAnalisa, type RingkasAnalisa } from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   MODERASI SINYAL — menurunkan isi yang melanggar
   ════════════════════════════════════════════════════════════════════════
   Pindah ke sini dari kartu sinyal di halaman Copy Signal. Di sana ia
   tombol merah kecil yang duduk di tiap kartu, di layar yang dipakai orang
   MEMILIH sinyal — dan alat pengawasan yang menempel di alat belanja
   membuat keduanya terlihat sebagai satu jenis tindakan.

   ── INI BUKAN FITUR, INI KEWAJIBAN ─────────────────────────────────────
   Sebagai PSE, penyelenggara wajib bisa menurunkan isi yang melanggar dari
   platformnya sendiri. Kalau kemampuan itu tidak ada di mana pun, yang
   hilang bukan kenyamanan — yang hilang kepatuhan, dan tidak akan ada yang
   menyadarinya sampai ada yang memposting sesuatu yang harus diturunkan.
   Itu sebabnya ia dipindahkan, bukan dibuang.

   ── PENULIS TIDAK BISA MENGHAPUS SINYALNYA SENDIRI ─────────────────────
   Rekam jejak yang bisa dihapus bukan rekam jejak. Analis yang boleh
   menghapus sinyal ruginya akan punya papan peringkat yang mengukur
   kerajinannya menghapus, bukan ketepatan analisanya. Server menegakkan
   ini; layar ini cuma tidak menawarkannya.
   ════════════════════════════════════════════════════════════════════════ */

export function PanelModerasiSinyal() {
  const [daftar, setDaftar] = useState<RingkasAnalisa[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState('');
  const [kabar, setKabar] = useState('');
  const [cari, setCari] = useState('');

  function muat() {
    setMemuat(true);
    daftarAnalisa()
      .then(setDaftar)
      .catch(() => setKabar('Gagal memuat daftar sinyal.'))
      .finally(() => setMemuat(false));
  }
  useEffect(muat, []);

  async function hapus(a: RingkasAnalisa) {
    /* Dua kali tanya, dan yang kedua meminta MENGETIK. Penghapusan ini tidak
       bisa dibatalkan dan menghapus rekam jejak orang lain — konfirmasi satu
       klik terlalu murah untuk tindakan yang tidak punya jalan pulang. */
    if (!confirm(`Turunkan sinyal "${a.judul}" milik ${a.nama}?\n\nTindakan ini permanen dan tidak bisa dibatalkan.`)) return;
    const ketik = prompt('Ketik HAPUS untuk memastikan:');
    if (ketik !== 'HAPUS') { setKabar('Dibatalkan — konfirmasi tidak cocok.'); return; }

    setSibuk(a.id); setKabar('');
    try {
      await hapusAnalisa(a.id);
      setDaftar((d) => d.filter((x) => x.id !== a.id));
      setKabar(`Sinyal "${a.judul}" sudah diturunkan.`);
    } catch (e) {
      setKabar('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setSibuk(''); }
  }

  const q = cari.trim().toLowerCase();
  const tampil = q
    ? daftar.filter((a) =>
        [a.judul, a.nama, a.pasangan, a.ringkas].some((t) => String(t || '').toLowerCase().includes(q)))
    : daftar;

  return (
    <Panel>
      <PanelHead judul="Moderasi Sinyal"
        kanan={
          <button onClick={muat} disabled={memuat}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-50">
            <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} /> Muat ulang
          </button>
        } />

      <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] px-3 py-2.5 text-[11.5px] leading-relaxed text-zinc-400">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
        <span>
          Alat pengawasan, bukan alat penyuntingan. Menurunkan sinyal bersifat{' '}
          <span className="text-amber-300">permanen</span> dan ikut menghapus rekam jejaknya dari
          papan peringkat. Penulisnya sendiri tidak bisa melakukan ini — hanya penyelenggara.
        </span>
      </p>

      <input value={cari} onChange={(e) => setCari(e.target.value)}
        placeholder="Cari judul, analis, atau pasangan…"
        className="mb-3 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[12.5px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600" />

      {kabar && <p className="mb-3 text-[12px] text-zinc-400">{kabar}</p>}

      {memuat ? (
        <p className="flex items-center gap-2 py-6 text-[12.5px] text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> Memuat daftar sinyal…
        </p>
      ) : tampil.length === 0 ? (
        <p className="rounded-lg border border-zinc-800/60 px-4 py-6 text-center text-[12px] text-zinc-600">
          {daftar.length === 0 ? 'Belum ada sinyal yang diposting.' : 'Tidak ada yang cocok dengan pencarianmu.'}
        </p>
      ) : (
        <div className="space-y-2">
          {tampil.map((a) => (
            <div key={a.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-zinc-800/60 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-zinc-200">{a.judul}</span>
                <span className="block text-[11px] text-zinc-600">
                  {a.nama} · {a.pasangan} {a.arah}
                  {a.tf ? ` · ${a.tf}` : ''} · {tanggalPendek(a.dibuat)}
                  {a.harga > 0 ? ` · ${uang(a.harga)}` : ' · gratis'}
                </span>
              </span>
              {/* Keadaannya ikut ditulis: sinyal yang masih BERJALAN sedang
                  diikuti orang, dan menurunkannya menghilangkan level yang
                  mungkin sedang dipakai seseorang saat itu juga. */}
              <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                a.hasil === 'tp' ? 'bg-emerald-500/12 text-emerald-300'
                  : a.hasil === 'sl' ? 'bg-red-500/12 text-red-300'
                  : a.hasil === 'batal' ? 'bg-zinc-700/40 text-zinc-400'
                  : 'bg-sky-500/12 text-sky-300')}>
                {a.hasil === 'tp' ? 'TP' : a.hasil === 'sl' ? 'SL' : a.hasil === 'batal' ? 'Batal' : 'Berjalan'}
              </span>
              <button onClick={() => void hapus(a)} disabled={sibuk === a.id}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11.5px] text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50">
                {sibuk === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Turunkan
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
