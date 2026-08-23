import { useEffect, useState } from 'react';
import { Download, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   TOMBOL PASANG APLIKASI
   ════════════════════════════════════════════════════════════════════════
   Chrome dan Edge menembakkan `beforeinstallprompt` saat situsnya memenuhi
   syarat pasang. Kejadian itu HARUS ditahan — sekali dilewatkan, tawarannya
   hilang sampai halaman dimuat ulang, dan tidak bisa dibangkitkan sendiri.

   Tombolnya muncul HANYA kalau kejadian itu benar-benar datang. Jadi ia
   tidak pernah tampil di Firefox (tidak mendukung pasang), tidak di jendela
   yang SUDAH terpasang, dan tidak di peramban yang menganggap situsnya
   belum layak. Tombol "Pasang" yang tidak bisa memasang apa pun lebih buruk
   daripada tidak ada tombol.

   Kenapa ada sama sekali: tanpa ini, memasang aplikasi tersembunyi di ikon
   kecil pada bilah alamat Chrome atau tiga titik → "Install page as app".
   Praktis tidak ada pengguna yang menemukannya sendiri, dan yang paling
   diuntungkan justru mereka — jendela chart lepasan kehilangan bilah
   alamatnya begitu situs ini berjalan sebagai aplikasi.
   ════════════════════════════════════════════════════════════════════════ */

/** Kejadian `beforeinstallprompt` belum ada di lib DOM TypeScript. */
interface KejadianPasang extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function TombolPasang({ ciut }: { ciut?: boolean }) {
  const [tawaran, setTawaran] = useState<KejadianPasang | null>(null);
  const [terpasang, setTerpasang] = useState(false);

  useEffect(() => {
    const tangkap = (e: Event) => {
      /* preventDefault menahan bilah pasang bawaan Chrome supaya tawarannya
         muncul di tempat yang kita pilih, bukan menutupi bagian atas
         halaman pada kunjungan pertama. */
      e.preventDefault();
      setTawaran(e as KejadianPasang);
    };
    const sudah = () => { setTerpasang(true); setTawaran(null); };
    window.addEventListener('beforeinstallprompt', tangkap);
    window.addEventListener('appinstalled', sudah);
    return () => {
      window.removeEventListener('beforeinstallprompt', tangkap);
      window.removeEventListener('appinstalled', sudah);
    };
  }, []);

  /* Sedang BERJALAN sebagai aplikasi → tidak ada yang perlu ditawarkan.
     Diperiksa lewat media query display-mode, bukan lewat `appinstalled`:
     kejadian itu cuma menyala sekali seumur pemasangan, sedangkan jendela
     aplikasi dibuka berkali-kali sesudahnya. */
  const modeAplikasi = (() => {
    try { return window.matchMedia('(display-mode: standalone)').matches; }
    catch { return false; }
  })();

  if (modeAplikasi) return null;

  if (terpasang) {
    return (
      <div className={cn('flex items-center gap-2 px-2 py-2 text-[12.5px] text-emerald-500', ciut && 'justify-center px-0')}>
        <Check className="size-4 shrink-0" />
        {!ciut && <span>Aplikasi terpasang</span>}
      </div>
    );
  }

  if (!tawaran) return null;

  return (
    <button
      onClick={async () => {
        try {
          await tawaran.prompt();
          const { outcome } = await tawaran.userChoice;
          /* Tawarannya sekali pakai — sesudah dijawab, objeknya tidak boleh
             dipakai lagi. Dibuang apa pun jawabannya; kalau ditolak, Chrome
             akan menembakkan yang baru di kunjungan berikutnya. */
          setTawaran(null);
          if (outcome === 'accepted') setTerpasang(true);
        } catch { setTawaran(null); }
      }}
      title="Pasang sebagai aplikasi — jendela sendiri tanpa bilah alamat, termasuk untuk panel multi-chart yang dilepas"
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[12.5px] text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100',
        ciut && 'justify-center px-0'
      )}
    >
      <Download className="size-4 shrink-0" />
      {!ciut && <span>Pasang aplikasi</span>}
    </button>
  );
}
