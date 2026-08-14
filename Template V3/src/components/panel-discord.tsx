import { useEffect, useState } from 'react';
import { MessageCircle, X, ExternalLink, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   JENDELA DISCORD — sejauh yang Discord izinkan
   ════════════════════════════════════════════════════════════════════════
   Discord TIDAK BISA ditanam utuh di halaman mana pun. `discord.com/app`
   dan `/channels/...` mengirim header `X-Frame-Options: DENY`, jadi peramban
   menolak menggambarnya di dalam bingkai — di situs siapa pun, dengan izin
   apa pun. Tidak ada jalan memutar dari sisi kita; yang mengaku bisa
   (proxy penghapus header) berarti menyalurkan sesi Discord orang lewat
   server kita, dan itu jauh lebih berbahaya daripada manfaatnya.

   Yang bisa, dua-duanya dipakai di sini:

   1. WIDGET RESMI (`/widget?id=`) — satu-satunya alamat Discord yang memang
      dirancang untuk ditanam, dan terbukti tidak mengirim X-Frame-Options.
      Isinya siapa yang sedang online. HANYA BACA: tidak bisa mengetik pesan.

   2. JENDELA KECIL sungguhan lewat `window.open` — Discord asli, lengkap,
      bisa dipakai mengobrol. Bukan tertanam, tapi berukuran seperti layar
      HP persis seperti yang dibayangkan.

   Widget butuh dinyalakan pemiliknya: Server Settings → Widget → Enable.
   Selama mati, `widget.json` menjawab 403 dan bingkainya kosong — karena itu
   ada penjelasan di layar, bukan kotak hitam tanpa keterangan.
   ════════════════════════════════════════════════════════════════════════ */

const SERVER_ID = '1536760161828347945';
const KANAL_OBROLAN = '1536760162289848504';
const UNDANGAN = `https://discord.com/channels/${SERVER_ID}/${KANAL_OBROLAN}`;

/** Ukuran seperti layar HP — cukup untuk membaca percakapan tanpa menutupi
 *  seluruh layar orangnya. */
function bukaJendelaObrolan() {
  const l = Math.max(0, window.screenX + window.outerWidth - 460);
  const t = Math.max(0, window.screenY + 80);
  window.open(
    UNDANGAN,
    'discord-jaditrader',
    `width=420,height=720,left=${l},top=${t},resizable=yes,scrollbars=yes`,
  );
}

export function PanelDiscord() {
  const [buka, setBuka] = useState(false);
  const [widgetHidup, setWidgetHidup] = useState<boolean | null>(null);

  /* Ditanyakan lebih dulu supaya layar bisa MENJELASKAN kalau widgetnya mati,
     bukan menampilkan bingkai kosong yang terbaca sebagai kerusakan. */
  useEffect(() => {
    if (!buka || widgetHidup !== null) return;
    let hidup = true;
    fetch(`https://discord.com/api/guilds/${SERVER_ID}/widget.json`)
      .then((r) => { if (hidup) setWidgetHidup(r.ok); })
      .catch(() => { if (hidup) setWidgetHidup(false); });
    return () => { hidup = false; };
  }, [buka, widgetHidup]);

  return (
    <>
      <button
        onClick={() => setBuka((v) => !v)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
      >
        <MessageCircle className="size-4 text-[#5865F2]" />
        Komunitas Discord
      </button>

      {buka && (
        /* Melayang di pojok, bukan mendorong isi halaman: panel obrolan yang
           menggeser katalog produk tiap dibuka membuat orang kehilangan
           tempatnya membaca. */
        <div className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
            <MessageCircle className="size-4 text-[#5865F2]" />
            <span className="text-[12.5px] font-medium text-zinc-200">Komunitas Jadi Trader</span>
            <button
              onClick={() => setBuka(false)}
              aria-label="Tutup panel Discord"
              className="ml-auto cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {widgetHidup === false ? (
            <div className="flex flex-col gap-2 px-4 py-5 text-[12px] leading-relaxed text-zinc-500">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Users className="size-3.5" /> Daftar anggota belum ditampilkan
              </span>
              Widget server masih mati. Nyalakan di Discord: Server Settings → Widget →
              Enable Server Widget. Tombol di bawah tetap berfungsi tanpa itu.
            </div>
          ) : (
            <iframe
              title="Anggota Discord yang sedang online"
              src={`https://discord.com/widget?id=${SERVER_ID}&theme=dark`}
              width="100%"
              height="320"
              allowTransparency
              frameBorder="0"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              className={cn('block bg-zinc-950', widgetHidup === null && 'opacity-0')}
            />
          )}

          <div className="flex flex-col gap-2 border-t border-zinc-800 p-3">
            <button
              onClick={bukaJendelaObrolan}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#4752c4]"
            >
              <ExternalLink className="size-4" /> Buka ruang obrolan
            </button>
            {/* Dikatakan terus terang: yang di atas cuma daftar orang, yang
                bisa dipakai mengobrol adalah jendela yang dibuka tombol ini.
                Menyembunyikan batas itu cuma memindahkan kekecewaannya. */}
            <p className="text-center text-[10.5px] leading-relaxed text-zinc-600">
              Daftar di atas hanya menampilkan siapa yang online. Mengetik pesan lewat
              jendela Discord.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
