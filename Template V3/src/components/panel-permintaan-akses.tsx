import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import { Panel, PanelHead, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import {
  daftarPermintaan, putuskanPermintaan, useKuota, type Permintaan,
} from '@/lib/akses';

/* ════════════════════════════════════════════════════════════════════════
   PERMINTAAN AKSES — panel pemilik
   ════════════════════════════════════════════════════════════════════════
   Menyetujui di sini melakukan tiga hal sekaligus di server: menerbitkan
   kode lisensi, menghitungnya ke dalam kuota, dan menulis masa berlaku 30
   hari ke `langganan/{uid}` di Firestore — tempat aplikasi web sebenarnya
   membaca status akses.

   Kalau langkah Firestore-nya gagal, baris ini akan mengatakannya. Tanpa
   itu, permintaan berstatus "disetujui" di layar ini sementara orangnya
   tetap terkunci di luar, dan tidak ada satu pun tanda kenapa.
   ════════════════════════════════════════════════════════════════════════ */

function Lencana({ status }: { status: string }) {
  const gaya = status === 'disetujui' ? 'bg-emerald-500/10 text-emerald-400'
    : status === 'ditolak' ? 'bg-red-500/10 text-red-400'
    : 'bg-amber-500/10 text-amber-300';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-medium', gaya)}>
      {status === 'baru' ? 'menunggu' : status}
    </span>
  );
}

export function PanelPermintaanAkses() {
  const [daftar, setDaftar] = useState<Permintaan[]>([]);
  const [baru, setBaru] = useState(0);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [kabar, setKabar] = useState('');
  const { kuota, muatUlang: muatKuota } = useKuota();

  const muat = useCallback(() => {
    setMemuat(true);
    daftarPermintaan()
      .then(({ permintaan, baru: n }) => { setDaftar(permintaan); setBaru(n); setGalat(null); })
      .catch((e) => setGalat(e.message))
      .finally(() => setMemuat(false));
  }, []);

  useEffect(muat, [muat]);

  async function putuskan(p: Permintaan, tindakan: 'setujui' | 'tolak') {
    const nama = p.email || p.nama || p.uid || p.id;
    const pesan = tindakan === 'setujui'
      ? `Setujui akses ${kuota.hari} hari untuk ${nama}?\n\nIni menerbitkan kode lisensi dan membuka aplikasi untuknya.`
      : `Tolak permintaan ${nama}?`;
    if (!confirm(pesan)) return;

    setSibuk(p.id); setKabar('');
    try {
      const h = await putuskanPermintaan(p.id, tindakan);
      /* Kegagalan menulis Firestore DIKATAKAN, tidak ditelan — di situlah
         letak bedanya antara "disetujui" dan "benar-benar bisa masuk". */
      setKabar(
        tindakan === 'tolak' ? 'Permintaan ditolak.'
        : h.firestoreOk === false
          ? `Kode terbit (${h.kode}) TAPI masa berlakunya gagal ditulis ke Firestore — orangnya masih terkunci. Periksa kunci firebase-admin di VPS.`
          : `Disetujui. Kode ${h.kode}, berlaku sampai ${h.berakhir ? new Date(h.berakhir).toLocaleDateString('id-ID') : '—'}.`,
      );
      muat(); muatKuota();
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal memutuskan');
    } finally { setSibuk(null); }
  }

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Permintaan Akses"
        sub="Persetujuanmu yang membuka aplikasi untuk mereka."
        kanan={
          <div className="flex items-center gap-3">
            <span className="angka text-[11.5px] text-zinc-500">
              gratis {kuota.gratisTerpakai}/{kuota.gratisTotal} · bayar {kuota.bayarTerpakai}/{kuota.bayarTotal}
            </span>
            {baru > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-medium text-amber-300">
                {baru} baru
              </span>
            )}
            <button onClick={muat} title="Muat ulang"
              className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200">
              <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} />
            </button>
          </div>
        }
      />
      <div className="px-5 pb-5">
        {galat ? (
          <div className="py-4 text-[12.5px] text-amber-400/90">{galat}</div>
        ) : memuat && !daftar.length ? (
          <div className="flex items-center gap-2 py-4 text-[12.5px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" /> Memuat…
          </div>
        ) : !daftar.length ? (
          <div className="py-5 text-center text-[12.5px] text-zinc-600">Belum ada permintaan.</div>
        ) : (
          <TabelBungkus>
            <Tabel>
              <thead>
                <tr>
                  <Th>Pemohon</Th>
                  <Th>Jenis</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Tindakan</Th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <div className="text-zinc-200">{p.email || p.nama || '—'}</div>
                      <div className="text-[10.5px] text-zinc-600">
                        {new Date(p.waktu).toLocaleString('id-ID')}
                        {p.catatan ? ` · ${p.catatan}` : ''}
                      </div>
                    </Td>
                    <Td className="text-zinc-400">{p.jenis === 'bayar' ? 'Berbayar' : 'Gratis'}</Td>
                    <Td><Lencana status={p.status} /></Td>
                    <Td className="text-right">
                      {p.status === 'baru' ? (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => void putuskan(p, 'setujui')} disabled={sibuk === p.id}
                            className="cursor-pointer rounded p-1.5 text-emerald-500 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                            title="Setujui">
                            {sibuk === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          </button>
                          <button onClick={() => void putuskan(p, 'tolak')} disabled={sibuk === p.id}
                            className="cursor-pointer rounded p-1.5 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                            title="Tolak">
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="angka text-[11px] text-zinc-600">
                          {p.berakhir ? `s/d ${new Date(p.berakhir).toLocaleDateString('id-ID')}` : '—'}
                        </span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          </TabelBungkus>
        )}
        {kabar && <div className="mt-3 text-[11.5px] leading-relaxed text-zinc-400">{kabar}</div>}
      </div>
    </Panel>
  );
}
