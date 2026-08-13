/* ══════════════════════════════════════════════════════════════════════
   DOKTER PINE — SUSUN PERMINTAAN & TERAPKAN TAMBALAN
   ══════════════════════════════════════════════════════════════════════
   Isi modul ini KEMBARAN dari dua node Code di workflow n8n
   "Dokter Pine". Disengaja, dan bukan karena malas menyatukannya:
   jalur otomatis (backend → n8n → model) dan jalur manual (salin →
   Claude desktop → tempel) harus tunduk pada pagar yang SAMA PERSIS.

   Kalau penerapan tambalan cuma ada di n8n, memakai Claude desktop
   berarti menempel kode mentah tanpa pemeriksaan apa pun — dan justru
   jalur manual itulah yang paling gampang membawa jawaban model yang
   ngawur langsung ke skrip yang sudah benar.

   Kenapa TAMBALAN, bukan skrip utuh: jawaban model dibatasi token, jadi
   skrip panjang yang dikembalikan utuh akan terpotong di tengah — dan
   potongan yang rapi masih terlihat seperti skrip yang sah sampai
   dijalankan. Dengan tambalan, panjang jawaban ditentukan jumlah galat,
   bukan panjang skrip. Efek sampingnya yang paling berharga: model jadi
   mustahil menulis ulang skrip diam-diam, karena yang bisa ia kirim
   hanya baris yang ia sebut nomornya.
   ══════════════════════════════════════════════════════════════════════ */

/** Di atas ambang ini, hanya jendela di sekitar baris bermasalah yang
 *  dikirim — plus kepala berkas, tempat indicator() dan input berada. */
const AMBANG = 60000;
const JENDELA = 20;
const KEPALA = 15;

export interface HasilTambalan {
  kode: string;
  penjelasan: string;
  perubahan: string[];
}

/* ══════════════════════════════════════════════════════════════════════
   CELAH MESIN — apa yang DIMINTA skrip tapi belum ada di mesin kita
   ══════════════════════════════════════════════════════════════════════
   Mesin Pine kita tidak akan pernah selengkap TradingView, dan tiap skrip
   baru punya peluang menyentuh sesuatu yang belum ada. Menunggu pengguna
   melapor satu per satu berarti yang dilaporkan cuma yang paling kesal;
   yang diam-diam menyerah tidak pernah terhitung.

   Jadi yang dikirim balik CUMA NAMA FITURNYA — `timeframe.in_seconds`,
   `table.cell`, `array.avg`. Bukan skripnya. Skrip indikator itu milik
   penulisnya, kadang dibeli mahal, dan mengunggahnya ke server orang lain
   demi telemetri adalah pengkhianatan yang tidak sebanding dengan
   manfaatnya. Nama fungsi sudah cukup untuk memberi peringkat.
   ══════════════════════════════════════════════════════════════════════ */

/** Ambil nama fitur dari daftar galat & baris yang dilewati. */
export function fiturHilang(galat: string[], dilewati: string[]): string[] {
  const set = new Set<string>();

  for (const g of galat) {
    const fn = /fungsi "([^"]+)"/.exec(g);
    if (fn) { set.add(fn[1]); continue; }
    /* "variabel X belum didefinisikan" bisa berarti dua hal: salah ketik
       di skripnya (bukan urusan kita), atau bawaan Pine yang belum kita
       kenal. Yang bertitik hampir pasti bawaan — `syminfo.timezone`,
       `chart.bg_color`. Yang tanpa titik dibiarkan, supaya daftar ini
       tidak penuh nama variabel pribadi orang. */
    const v = /variabel "([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z0-9_.]+)"/.exec(g);
    if (v) { set.add(v[1]); continue; }
    /* Sisanya diringkas jadi PENANDA TETAP, bukan potongan pesannya.
       Percobaan pertama saya mengirim 40 karakter pertama galatnya — dan
       itu membawa serta nama variabel pribadi dari skrip orang
       ("variabel myStrategyEdge belum didefinisikan"). Nama variabel
       adalah isi skrip, dan janji kita jelas: yang dikirim cuma nama
       fitur Pine. Jadi yang dilaporkan sekarang cuma JENIS galatnya. */
    if (/variabel "/.test(g)) { set.add('lain.variabel_tak_dikenal'); continue; }
    if (/riwayat|indeks/.test(g)) { set.add('lain.riwayat'); continue; }
    if (/tidak paham|sisa yang tidak terbaca/.test(g)) { set.add('lain.sintaks'); continue; }
    set.add('lain.tak_terurai');
  }

  for (const d of dilewati) {
    /* Bentuknya "baris 153: table.cell(statTable, 0, 0, ... — dilewati" */
    const m = /^baris \d+: ([A-Za-z_][A-Za-z0-9_.]*)\s*\(/.exec(d);
    if (m) set.add(m[1]);
  }

  /* Batas atas supaya satu skrip aneh tidak membanjiri peringkat. */
  return [...set].slice(0, 20);
}

/** Susun teks permintaan yang siap ditempel ke Claude desktop.
 *
 *  Aturan dan bentuk jawabannya identik dengan yang dipakai node
 *  "Susun permintaan" di n8n, supaya jawaban dari jalur mana pun bisa
 *  diproses fungsi yang sama di bawah. */
export function susunPermintaanPine(
  kode: string,
  galat: string[],
  dilewati: string[],
  catatan?: string,
): string {
  const baris = kode.split('\n');

  /* Nomor baris yang disebut mesin Pine di pesan galatnya. */
  const nomor: number[] = [];
  for (const p of [...galat, ...dilewati]) {
    const m = String(p).match(/baris\s+(\d+)/i);
    if (m) nomor.push(parseInt(m[1], 10));
  }

  let potongan: string;
  let sebagian = false;
  if (kode.length <= AMBANG || nomor.length === 0) {
    potongan = baris.map((t, i) => `${i + 1}| ${t}`).join('\n');
  } else {
    sebagian = true;
    const perlu = new Set<number>();
    for (let i = 1; i <= Math.min(KEPALA, baris.length); i++) perlu.add(i);
    for (const n of nomor) {
      for (let i = Math.max(1, n - JENDELA); i <= Math.min(baris.length, n + JENDELA); i++) perlu.add(i);
    }
    const urut = [...perlu].sort((x, y) => x - y);
    const out: string[] = [];
    let akhir = 0;
    for (const n of urut) {
      if (n > akhir + 1) out.push(`   ... (${n - akhir - 1} baris tidak ditampilkan)`);
      out.push(`${n}| ${baris[n - 1]}`);
      akhir = n;
    }
    if (akhir < baris.length) out.push(`   ... (${baris.length - akhir} baris tidak ditampilkan)`);
    potongan = out.join('\n');
  }

  const aturan = [
    'Kamu memperbaiki skrip Pine v5/v6 agar bisa dijalankan mesin Pine sederhana milik Jadi Trader Tools.',
    'Kode diberikan BERNOMOR dengan format "12| isi baris". Nomor dan tanda | itu BUKAN bagian dari kode.',
    '',
    'ATURAN YANG TIDAK BOLEH DILANGGAR:',
    '1. Balas hanya TAMBALAN untuk baris yang bermasalah. Jangan mengirim ulang seluruh skrip.',
    '2. Jangan menyentuh baris yang tidak disebut dalam daftar galat, kecuali baris itu memang penyebab langsungnya.',
    '3. Jangan mengubah maksud indikatornya. Kalau sebuah fitur memang tidak didukung, KOMENTARI barisnya (awali //) lalu jelaskan; jangan menggantinya dengan perhitungan lain yang sekadar terlihat mirip.',
    '4. Jangan mengubah deklarasi indicator()/study(), termasuk overlay=.',
    '5. Balas HANYA JSON valid, tanpa pagar kode markdown, dengan bentuk:',
    '   {"perbaikan":[{"baris":82,"jadi":"    plot(x, color=color.red)"}],"penjelasan":"2-4 kalimat","perubahan":["baris 82: ..."]}',
    '',
    'Bentuk tambalan:',
    '- {"baris":N,"jadi":"teks pengganti"} menimpa baris N. Boleh memuat \\n kalau satu baris perlu menjadi beberapa baris.',
    '- {"baris":N,"hapus":true} membuang baris N.',
    'Tulis "jadi" sebagai baris utuh lengkap dengan indentasi aslinya.',
  ].join('\n');

  return [
    aturan,
    '',
    '## Baris yang DITOLAK mesin',
    galat.length ? galat.map((g, i) => `${i + 1}. ${g}`).join('\n') : '(tidak ada)',
    '',
    '## Baris yang DILEWATI (belum didukung)',
    dilewati.length ? dilewati.map((g, i) => `${i + 1}. ${g}`).join('\n') : '(tidak ada)',
    '',
    catatan ? `## Catatan pengguna\n${catatan}\n` : '',
    `## Skrip (${baris.length} baris${sebagian ? ', ditampilkan sekitar baris bermasalah saja' : ''})`,
    potongan,
  ].join('\n');
}

/** Terapkan jawaban model ke skrip asli.
 *
 *  Yang menempel MESIN, bukan model: model cuma bilang "baris 82 jadi
 *  begini", dan kode di bawah ini yang menyalin, menggeser, dan menyusun
 *  ulang berkasnya — perilakunya sama persis setiap kali. */
export function terapkanTambalanPine(
  kodeAsli: string,
  balasan: string,
): HasilTambalan | { error: string } {
  const barisAsli = kodeAsli.split('\n');

  let teks = String(balasan).trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let j: any;
  try {
    j = JSON.parse(teks);
  } catch {
    /* Model sering menambah kalimat pengantar. Ambil objek JSON pertama
       yang utuh di dalamnya sebelum menyerah. */
    const m = teks.match(/\{[\s\S]*\}/);
    if (!m) return { error: 'Jawaban itu bukan JSON yang bisa dibaca. Salin ulang seluruh jawaban Claude, termasuk kurung kurawalnya.' };
    try { j = JSON.parse(m[0]); }
    catch { return { error: 'Jawaban itu bukan JSON yang bisa dibaca. Salin ulang seluruh jawaban Claude, termasuk kurung kurawalnya.' }; }
  }

  const tambalan: any[] = Array.isArray(j?.perbaikan) ? j.perbaikan : [];
  if (!tambalan.length) {
    return { error: j?.penjelasan ? `Tidak ada perbaikan yang diusulkan. Katanya: ${j.penjelasan}` : 'Jawaban itu tidak memuat tambalan apa pun.' };
  }
  if (tambalan.length > 60) {
    return { error: `Ditolak: jawaban itu ingin mengubah ${tambalan.length} baris sekaligus. Itu penulisan ulang, bukan perbaikan.` };
  }

  /* Ditempel dari nomor besar ke kecil, supaya penyisipan tidak menggeser
     nomor baris tambalan berikutnya. */
  const hasil = barisAsli.slice();
  const diabaikan: string[] = [];
  for (const t of tambalan.slice().sort((a, z) => Number(z?.baris) - Number(a?.baris))) {
    const n = Number(t?.baris);
    if (!Number.isInteger(n) || n < 1 || n > barisAsli.length) {
      diabaikan.push(`baris ${t?.baris} di luar jangkauan skrip`); continue;
    }
    if (t?.hapus === true) { hasil.splice(n - 1, 1); continue; }
    if (typeof t?.jadi !== 'string') {
      diabaikan.push(`baris ${n} dikirim tanpa teks pengganti`); continue;
    }
    hasil.splice(n - 1, 1, ...String(t.jadi).split('\n'));
  }
  const kode = hasil.join('\n');

  /* Pagar terakhir: baris indicator() tidak boleh berubah. overlay= yang
     bergeser memindahkan indikator ke panel lain — perubahan yang tidak
     diminta, dan paling membingungkan saat tiba-tiba muncul. */
  const dekl = (s: string) => (s.match(/(?:indicator|study)\s*\([^\n]*\)/i) || [''])[0];
  if (dekl(kodeAsli) !== dekl(kode)) {
    return { error: 'Ditolak: jawaban itu menyentuh baris indicator(). Deklarasi indikator tidak boleh diubah.' };
  }

  const perubahan = Array.isArray(j?.perubahan) ? j.perubahan.map(String) : [];
  for (const d of diabaikan) perubahan.push(`DIABAIKAN — ${d}`);

  return { kode, penjelasan: String(j?.penjelasan || ''), perubahan };
}
