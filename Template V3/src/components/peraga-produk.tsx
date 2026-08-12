/* ════════════════════════════════════════════════════════════════════════
   PERAGA PRODUK — animasi "cara kerjanya" di halaman detail
   ════════════════════════════════════════════════════════════════════════
   Digambar sebagai SVG, bukan GIF atau video: nol byte tambahan, tajam di
   layar mana pun, dan warnanya ikut tema sehingga tidak pernah terlihat
   seperti tempelan dari situs lain.

   TIGA HAL YANG DIPERBAIKI dari versi sebelumnya:

     1. Gerakannya pindah dari SMIL <animate> ke animasi CSS
        (kelas .peraga-* di index.css). SMIL-nya sebenarnya benar, tapi ia
        berhenti diam-diam tanpa pesan apa pun di beberapa keadaan — dan
        "tidak bergerak" adalah persis laporan yang masuk.

     2. Satu titik 4 piksel yang berdenyut tidak dianggap gerakan oleh siapa
        pun. Yang membuat mata tahu ada gerakan adalah sesuatu yang MELINTAS,
        jadi sekarang ada garis pemutar menyapu dari kiri ke kanan sambil
        memunculkan lilin satu per satu.

     3. Channel-nya dulu digambar asal: lilinnya naik-turun tanpa hubungan
        dengan garis rail, sehingga peraga "sentuh rail lalu balik" justru
        tidak pernah menyentuh rail. Koordinat di bawah dihitung terhadap
        kemiringan rail yang sebenarnya (−40 px per 380 px), bukan dikira.
   ════════════════════════════════════════════════════════════════════════ */

function Bingkai({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-3">
      <div className="mb-2 text-[11.5px] text-zinc-500">{judul}</div>
      <svg viewBox="0 0 420 150" className="block w-full" style={{ height: 150 }} aria-hidden>
        {children}
      </svg>
    </div>
  );
}

function lilin(x: number, o: number, c: number, h: number, l: number, key: number) {
  const naik = c < o; // koordinat SVG: y kecil = harga tinggi
  const warna = naik ? '#10b981' : '#ef4444';
  return (
    <g key={key}>
      <line x1={x} x2={x} y1={h} y2={l} stroke={warna} strokeWidth={1} />
      <rect x={x - 3} y={Math.min(o, c)} width={6} height={Math.max(2, Math.abs(c - o))} fill={warna} />
    </g>
  );
}

/** Tirai yang menyapu ke kanan: lilin muncul satu per satu, lalu diam
 *  sebentar sebelum diulang. Jeda di akhir penting — tanpa itu peraga
 *  terlihat berkedip, bukan memutar.
 *
 *  Persegi klipnya berukuran penuh dan digeser dari −420 ke 0, bukan
 *  dilebarkan dari 0. Menggeser cuma transform; melebarkan mengubah geometri
 *  dan tidak bisa dianimasikan CSS di semua peramban. */
function Tirai({ id }: { id: string }) {
  return (
    <defs>
      <clipPath id={id}>
        <rect className="peraga-tirai" x="0" y="0" width="420" height="150" />
      </clipPath>
    </defs>
  );
}

function Pemutar() {
  return (
    <line className="peraga-pemutar" x1="0" y1="6" x2="0" y2="144"
          stroke="#fafafa" strokeWidth="1" opacity=".22" />
  );
}

/** Parallel channel + sweep di bawah rail bawah → BUY.
 *
 *  Rail bawah: (20,118) → (400,78), jadi y_rail(x) = 118 − 0,10526·(x−20).
 *  Lilin ke-8 (x=208) punya rail di y≈98,2; low-nya 107 (menembus 9 px ke
 *  bawah) dan close-nya 93 (kembali 5 px di dalam). Itu definisi sweep yang
 *  dipakai indikatornya, bukan sekadar "candle hijau dekat garis". */
function PeragaChannel() {
  const D: [number, number, number, number, number][] = [
    [40, 72, 78, 68, 82], [64, 78, 84, 74, 88], [88, 84, 90, 80, 94],
    [112, 90, 95, 86, 99], [136, 95, 99, 91, 103], [160, 99, 101, 95, 102],
    [184, 101, 99, 97, 102],
    [208, 99, 93, 91, 107],          // ← sweep: wick tembus rail, close balik
    [232, 93, 88, 85, 96], [256, 88, 82, 79, 90], [280, 82, 76, 73, 85],
    [304, 76, 70, 67, 79], [328, 70, 64, 61, 73], [352, 64, 58, 55, 67],
    [376, 58, 52, 49, 61],
  ];

  return (
    <Bingkai judul="Channel digambar dari pivot — sweep di bawah rail, close balik ke dalam → BUY">
      <Tirai id="jtv3-tirai" />

      <polygon points="20,58 400,18 400,78 20,118" fill="#10b981" opacity=".05" />
      <line x1="20" y1="58"  x2="400" y2="18" stroke="#71717a" strokeWidth="1.4" />
      <line x1="20" y1="118" x2="400" y2="78" stroke="#71717a" strokeWidth="1.4" />
      <line x1="20" y1="88"  x2="400" y2="48" stroke="#52525b" strokeWidth="1" strokeDasharray="5 5" opacity=".6" />
      <text x="404" y="20" fill="#71717a" fontSize="7.5" fontFamily="IBM Plex Mono">R</text>
      <text x="404" y="80" fill="#71717a" fontSize="7.5" fontFamily="IBM Plex Mono">S</text>

      <g clipPath="url(#jtv3-tirai)">
        {D.map((k, i) => lilin(k[0], k[1], k[2], k[3], k[4], i))}
      </g>

      <Pemutar />

      {/* Sinyal muncul tepat saat tirai melewati lilin sweep (x=208 → 36% dur),
          lalu ikut hilang saat peraga diulang. */}
      <g className="peraga-sinyal" opacity="0">
        <circle className="peraga-denyut" cx="208" cy="110" r="4" fill="#10b981" />
        <rect x="185" y="121" width="46" height="16" rx="4" fill="#10b981" />
        <text x="208" y="132.5" fill="#09090b" fontSize="9.5" fontFamily="IBM Plex Mono" textAnchor="middle">BUY</text>
      </g>
    </Bingkai>
  );
}

/** Zona SNR multi-timeframe: harga menandai R1, berbalik, lalu menyapu S1. */
function PeragaSnr() {
  const D: [number, number, number, number, number][] = [
    [50, 104, 96, 92, 108], [80, 96, 84, 80, 100], [110, 84, 70, 66, 88],
    [140, 70, 58, 54, 74], [170, 58, 48, 42, 62],
    [200, 48, 44, 34, 52],           // ← wick masuk R1, close di bawahnya
    [230, 44, 56, 40, 60], [260, 56, 70, 52, 74], [290, 70, 86, 66, 90],
    [320, 86, 100, 82, 104],
    [350, 100, 112, 96, 126],        // ← wick menembus S1
    [380, 112, 102, 98, 116],        // ← close balik naik
  ];

  return (
    <Bingkai judul="Zona SNR & Supply-Demand — di TF kecil, zonanya tetap diambil dari TF 4 jam">
      <Tirai id="snr-tirai" />

      <rect className="peraga-zona" x="10" y="30" width="400" height="20" fill="#ef4444" opacity=".2" />
      <text x="16" y="44" fill="#ef4444" fontSize="8.5" fontFamily="IBM Plex Mono">R1 (4H)</text>

      <rect className="peraga-zona-b" x="10" y="104" width="400" height="20" fill="#10b981" opacity=".2" />
      <text x="16" y="118" fill="#10b981" fontSize="8.5" fontFamily="IBM Plex Mono">S1 (4H)</text>

      <g clipPath="url(#snr-tirai)">
        {D.map((k, i) => lilin(k[0], k[1], k[2], k[3], k[4], i))}
      </g>

      <Pemutar />
    </Bingkai>
  );
}

/** Aliran data MT5 -> jurnal. */
function PeragaSync() {
  return (
    <Bingkai judul="MT5 mengirim ke jurnal — satu arah, tidak pernah sebaliknya">
      <rect x="24" y="46" width="118" height="58" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.2" />
      <text x="83" y="72" fill="#e4e4e7" fontSize="11.5" fontFamily="IBM Plex Mono" textAnchor="middle">MetaTrader 5</text>
      <text x="83" y="88" fill="#71717a" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">akun kamu</text>

      <rect x="278" y="46" width="118" height="58" rx="8" fill="#18181b" stroke="#ffcd75" strokeWidth="1.2" />
      <text x="337" y="72" fill="#ffcd75" fontSize="11.5" fontFamily="IBM Plex Mono" textAnchor="middle">Jurnal</text>
      <text x="337" y="88" fill="#71717a" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">terisi sendiri</text>

      <line x1="146" y1="75" x2="272" y2="75" stroke="#10b981" strokeWidth="1.4" strokeDasharray="6 4" opacity=".55" />
      <polygon points="272,75 262,70 262,80" fill="#10b981" />
      <text x="209" y="62" fill="#10b981" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">saldo · posisi · riwayat</text>

      {/* Paket data yang benar-benar berjalan di sepanjang garis — panah diam
          menjelaskan arah, titik yang bergerak menjelaskan bahwa ia hidup. */}
      <circle className="peraga-paket" cx="146" cy="75" r="3" fill="#10b981" opacity="0" />

      <line x1="160" y1="126" x2="262" y2="126" stroke="#ef4444" strokeWidth="1.1" opacity=".6" />
      <polygon points="160,126 170,121 170,131" fill="#ef4444" opacity=".6" />
      <line x1="199" y1="119" x2="223" y2="133" stroke="#ef4444" strokeWidth="2" />
      <line x1="223" y1="119" x2="199" y2="133" stroke="#ef4444" strokeWidth="2" />
      <text x="211" y="146" fill="#ef4444" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">tidak ada order dikirim balik</text>
    </Bingkai>
  );
}

/** SMI dengan area jenuh. Garisnya menggambar dirinya sendiri dari kiri ke
 *  kanan lewat stroke-dashoffset — dengan pathLength=100, panjangnya
 *  dinormalkan jadi 100 satuan sehingga keyframe-nya tidak perlu tahu berapa
 *  panjang polyline yang sebenarnya. */
function PeragaSmi() {
  const titik = Array.from({ length: 60 }, (_, i) => {
    const v = Math.sin(i / 6) * 70 + Math.sin(i / 2.3) * 12;
    return `${(10 + i * 6.7).toFixed(1)},${(75 - (v / 100) * 55).toFixed(1)}`;
  }).join(' ');

  return (
    <Bingkai judul="Skala -100 s/d +100 — titik nol berarti harga persis di tengah rentang">
      <rect x="10" y="20" width="400" height="20" fill="#ef4444" opacity=".12" />
      <rect x="10" y="110" width="400" height="20" fill="#10b981" opacity=".12" />
      <line x1="10" y1="75" x2="410" y2="75" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" />
      <text x="14" y="32" fill="#ef4444" fontSize="8" fontFamily="IBM Plex Mono">+40 jenuh beli</text>
      <text x="14" y="126" fill="#10b981" fontSize="8" fontFamily="IBM Plex Mono">-40 jenuh jual</text>
      <polyline className="peraga-gambar" points={titik} fill="none" stroke="#fafafa" strokeWidth="1.6"
                pathLength={100} strokeDasharray="100" />
    </Bingkai>
  );
}

/** Trade-Fi Sync v2: dua arah, dan geser SL/TP dari chart web.
 *
 *  Sengaja DIBEDAKAN dari peraga EA v1 di atas. Yang v1 justru menekankan
 *  "tidak ada order dikirim balik" — kalau produk ini memakai gambar yang
 *  sama, ia menjanjikan hal yang berlawanan dengan isinya. */
function PeragaTradeFi() {
  return (
    <Bingkai judul="Dua arah — perintah dari web dieksekusi di MT5, hasilnya dilaporkan balik">
      <rect x="24" y="46" width="118" height="58" rx="8" fill="#18181b" stroke="#ffcd75" strokeWidth="1.2" />
      <text x="83" y="72" fill="#ffcd75" fontSize="11.5" fontFamily="IBM Plex Mono" textAnchor="middle">Halaman Chart</text>
      <text x="83" y="88" fill="#71717a" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">browser</text>

      <rect x="278" y="46" width="118" height="58" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.2" />
      <text x="337" y="72" fill="#e4e4e7" fontSize="11.5" fontFamily="IBM Plex Mono" textAnchor="middle">MetaTrader 5</text>
      <text x="337" y="88" fill="#71717a" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">akun kamu</text>

      {/* Perintah berangkat */}
      <line x1="146" y1="64" x2="272" y2="64" stroke="#10b981" strokeWidth="1.4" strokeDasharray="6 4" opacity=".5" />
      <polygon points="272,64 262,59 262,69" fill="#10b981" />
      <text x="209" y="54" fill="#10b981" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">BUKA · UBAH · TUTUP</text>
      <circle className="peraga-paket" cx="146" cy="64" r="3" fill="#10b981" opacity="0" />

      {/* Hasil kembali */}
      <line x1="146" y1="90" x2="272" y2="90" stroke="#ffcd75" strokeWidth="1.4" strokeDasharray="6 4" opacity=".5" />
      <polygon points="146,90 156,85 156,95" fill="#ffcd75" />
      <text x="209" y="104" fill="#ffcd75" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">tiket · saldo · posisi</text>
      <circle className="peraga-paket-balik" cx="272" cy="90" r="3" fill="#ffcd75" opacity="0" />

      <text x="210" y="136" fill="#71717a" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">
        kredensial broker tidak pernah meninggalkan komputermu
      </text>
    </Bingkai>
  );
}

/** Seret SL di chart web, tekan Kirim, EA memasangnya di MT5. */
function PeragaGeserSlTp() {
  return (
    <Bingkai judul="Geser SL/TP di chart, tekan Kirim — EA yang memasangnya di posisi aslinya">
      {/* Sumbu harga di kanan, seperti chart aslinya. */}
      <line x1="352" y1="10" x2="352" y2="140" stroke="#27272a" strokeWidth="1" />

      <line x1="14" y1="52" x2="352" y2="52" stroke="#10b981" strokeWidth="1.2" strokeDasharray="5 4" opacity=".7" />
      <rect x="352" y="45" width="56" height="14" rx="2" fill="#10b981" />
      <text x="380" y="55" fill="#09090b" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">TP</text>

      <line x1="14" y1="78" x2="352" y2="78" stroke="#e4e4e7" strokeWidth="1.2" opacity=".55" />
      <text x="18" y="74" fill="#e4e4e7" fontSize="8.5" fontFamily="IBM Plex Mono" opacity=".8">BUY 0.01</text>

      {/* Garis SL yang diseret naik — bersama label sumbunya. */}
      <g className="peraga-seret">
        <line x1="14" y1="118" x2="352" y2="118" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="5 4" opacity=".8" />
        <rect x="352" y="111" width="56" height="14" rx="2" fill="#ef4444" />
        <text x="380" y="121" fill="#09090b" fontSize="8.5" fontFamily="IBM Plex Mono" textAnchor="middle">SL</text>
        <circle cx="120" cy="118" r="3.5" fill="#ef4444" />
      </g>

      {/* Tombol Kirim muncul setelah seretannya berhenti. */}
      <g className="peraga-sinyal">
        <rect x="140" y="86" width="104" height="18" rx="9" fill="#fafafa" />
        <text x="192" y="99" fill="#09090b" fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle" fontWeight="600">
          Kirim SL/TP → MT5
        </text>
      </g>
    </Bingkai>
  );
}

/* Kunci peta HARUS sama dengan id di katalog Firestore, bukan dengan nama
   produknya. Indikator V3 tayang dengan id `jadi-traderindicator-v3`;
   selama kuncinya ditulis `jadi-trader-v3`, peraganya tidak pernah
   ketemu dan halaman detailnya berkata "belum ada peraga". Keduanya
   didaftarkan supaya id lama pun tetap terlayani. */
const PETA: Record<string, React.ReactNode> = {
  'jadi-traderindicator-v3': <><PeragaChannel /><PeragaSnr /></>,
  'jadi-trader-v3': <><PeragaChannel /><PeragaSnr /></>,
  'jadi-trader-sync': <PeragaSync />,
  'trade-fi-sync-v2': <><PeragaTradeFi /><PeragaGeserSlTp /></>,
  'smi-indikator': <PeragaSmi />,
  'news-gap-hunter-v2': <PeragaSnr />,
};

export function PeragaProduk({ id }: { id: string }) {
  const isi = PETA[id];
  if (!isi) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 py-10 text-center text-[12.5px] text-zinc-600">
        Belum ada peraga untuk produk ini.
      </div>
    );
  }
  return <div className="space-y-3">{isi}</div>;
}
