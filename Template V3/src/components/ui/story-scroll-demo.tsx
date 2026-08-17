import FlowArt, { FlowSection } from '@/components/ui/story-scroll';

/* ════════════════════════════════════════════════════════════════════════
   TUR LAYAR — isi kotak gambar hero di /template
   ════════════════════════════════════════════════════════════════════════
   Isi demo aslinya (platform seni berbahasa Inggris) diganti tangkapan
   layar aplikasi kita sendiri. Kerangkanya tetap milik template: lima
   seksi yang berputar masuk dan menumpuk saat kotaknya digulir.

   Tangkapannya diambil dari server dev lokal lewat Playwright
   (`tangkap.mjs`), pada keadaan APA ADANYA — belum masuk, data contoh.
   Tidak ada angka yang disunting supaya terlihat lebih baik: yang
   diperlihatkan harus benar-benar layar yang akan orang temui. Pita
   "data contoh" di beberapa layar sengaja dibiarkan.

   Yang disembunyikan saat memotret hanya tempelan login (One Tap Google
   dan tombol Masuk) — keduanya menutupi bilah atas dan bukan bagian dari
   alat yang sedang diperlihatkan.

   Ukuran huruf memakai clamp() berbatas px, BUKAN cqw. Container query
   menuntut `container-type: inline-size` pada kotaknya, dan properti itu
   memasang containment layout — persis hal yang bisa mematahkan pin
   ScrollTrigger. Huruf yang rapi tidak sepadan dengan risiko mematahkan
   gerakan yang jadi inti tempelan ini.
   ════════════════════════════════════════════════════════════════════════ */

const DASAR = import.meta.env.BASE_URL;

type Layar = {
  no: string;
  berkas: string;
  judul: string;
  ket: string;
  aksen: string;
};

const LAYAR: Layar[] = [
  {
    no: '01', berkas: 'screener', aksen: '#ffcd75',
    judul: 'Screener Area',
    ket: 'Pindai ratusan pair sekaligus. Yang lolos saring muncul dengan alasannya, bukan cuma tanda panah.',
  },
  {
    no: '02', berkas: 'dashboard', aksen: '#34d399',
    judul: 'Dashboard',
    ket: 'Saldo, winrate, dan profit factor dihitung dari transaksimu sendiri — bukan dari angka yang kami karang.',
  },
  {
    no: '03', berkas: 'chart', aksen: '#60a5fa',
    judul: 'Chart & Entry',
    ket: 'Susun entry, SL, dan TP dengan menggeser garis. Order berangkat ke Binance lewat VPS-mu sendiri.',
  },
  {
    no: '04', berkas: 'jurnal', aksen: '#f472b6',
    judul: 'Journal',
    ket: 'Kurva ekuitas dan kalender P/L terisi sendiri dari MetaTrader 5 dan Binance. Tidak ada yang diketik ulang.',
  },
  {
    no: '05', berkas: 'marketplace', aksen: '#c084fc',
    judul: 'Marketplace',
    ket: 'Indikator Pine dan Expert Advisor yang dipakai terminal ini — termasuk yang gratis.',
  },
];

export default function TurLayar() {
  return (
    <FlowArt aria-label="Tur layar Jadi Trader Tools">
      {LAYAR.map((l) => (
        <FlowSection key={l.berkas} aria-label={l.judul} style={{ backgroundColor: '#09090b', color: '#fff' }}>
          <img
            src={`${DASAR}tangkapan/${l.berkas}.png`}
            alt={`Tampilan halaman ${l.judul}`}
            /* max-w-none WAJIB: preflight Tailwind memasang img { max-width:
               100% } yang mengalahkan w-full pada elemen berposisi absolut
               dan membuat gambarnya menyusut dari sisi kanan. */
            className="absolute inset-0 size-full max-w-none object-cover object-left-top"
            loading="lazy"
            decoding="async"
          />
          {/* Peneduh dari bawah supaya keterangan tetap terbaca di atas
              tangkapan layar yang isinya terang di beberapa tempat. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(9,9,11,0.94) 0%, rgba(9,9,11,0.72) 22%, rgba(9,9,11,0.05) 48%, transparent 70%)' }}
          />
          <div className="relative mt-auto">
            <p
              className="text-[clamp(9px,1.3vw,13px)] font-semibold uppercase tracking-[0.24em]"
              style={{ color: l.aksen }}
            >
              {l.no} — {l.judul}
            </p>
            <p className="mt-1.5 max-w-[52ch] text-[clamp(11px,1.7vw,17px)] leading-snug text-zinc-200">
              {l.ket}
            </p>
          </div>
        </FlowSection>
      ))}
    </FlowArt>
  );
}
