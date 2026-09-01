/* ══════════════════════════════════════════════════════════════════════════
   mata-lokal.mjs — pekerja Hermes/VLM di PC pemilik
   ══════════════════════════════════════════════════════════════════════════
   Jalan di PC, BUKAN di VPS. Ia menjemput pekerjaan dari antrean yang sudah
   ada di backend (otaklokal.js) lalu menjawabnya dengan model Ollama lokal.

   ── KENAPA ARAHNYA MENJEMPUT, BUKAN DIPANGGIL ──────────────────────────
   PC ada di balik NAT: VPS tidak bisa menghubunginya. Alat terowongan
   (cloudflared, tailscale, ngrok) butuh akun baru dan unduhan. Sebaliknya
   PC selalu bisa menghubungi VPS — itu yang dipakai deploy tiap hari. Jadi
   PC yang menjemput, dan tidak ada satu pun port yang perlu dibuka.

   Prinsip ini sudah dipakai penggolong teks sejak 19 Agu 2026; berkas ini
   memakai jalur yang sama dan menambahkan satu kemampuan: gambar.

   ── APA YANG DIKERJAKAN DI SINI, DAN APA YANG TIDAK ────────────────────
   Diukur langsung 1 Sep 2026 dengan 3 chart sungguhan dari ruang Telegram,
   memakai qwen2.5vl:3b di GTX 1650:

     BISA  · nama instrumen dari judul chart   "Solana / USDT · 30 · MEXC" ✓
           · tulisan di dalam gambar           "Break", "FVG" ✓
           · arah panah                        naik / turun ✓

     TIDAK · label harga     salah 1 dari 2 (77.20, seharusnya 75.86)
           · label sumbu     ada yang dilewati, ada yang dikarang (77.86)

   Maka pekerja ini TIDAK PERNAH menyebut angka. Ia mengenali, dan hasil
   pengenalannya dipakai untuk memutuskan apakah gambar itu layak dibaca
   model berbayar. Angkanya diurus mata-chart.js di VPS, yang punya wasit
   yang tidak dimiliki model mana pun: harga pasar sungguhan.

   Pembagian itu bukan kompromi. Model 3B di kartu 4 GB memang bagus
   mengenali dan buruk membaca angka kecil; memberinya pekerjaan yang
   pertama saja membuatnya berguna, sementara memaksanya mengerjakan yang
   kedua membuat seluruh rantainya tidak bisa dipercaya.

   ── CARA MENJALANKAN ───────────────────────────────────────────────────
       node skrip/mata-lokal.mjs

   Butuh satu rahasia: APP_TOKEN backend. Ditaruh di variabel lingkungan
   JT_APP_TOKEN, atau di berkas `mata-lokal.env` di sebelah berkas ini
   dengan isi satu baris:

       JT_APP_TOKEN=<token dari .env VPS>

   Berkas itu TIDAK ikut ke repo (lihat .gitignore) dan tidak pernah
   dicetak ke layar oleh skrip ini.
   ══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

/* ── Setelan ─────────────────────────────────────────────────────────── */
function bacaEnvBerkas() {
  try {
    const t = fs.readFileSync(path.join(DIR, 'mata-lokal.env'), 'utf8');
    for (const baris of t.split(/\r?\n/)) {
      const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* tidak ada berkasnya — pakai variabel lingkungan saja */ }
}
bacaEnvBerkas();

const DASAR = (process.env.JT_DASAR || 'https://jaditrader.co.id').replace(/\/+$/, '');
const TOKEN = process.env.JT_APP_TOKEN || '';
const OLLAMA = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const MODEL_GAMBAR = process.env.OLLAMA_MODEL_MATA || 'qwen2.5vl:3b';
const MODEL_TEKS = process.env.OLLAMA_MODEL_TEKS || 'hermes3:8b';

function jam() { return new Date().toLocaleTimeString('id-ID', { hour12: false }); }
function catat(...a) { console.log('[' + jam() + ']', ...a); }

if (!TOKEN) {
  console.error('APP_TOKEN belum diisi.');
  console.error('Buat berkas ' + path.join(DIR, 'mata-lokal.env') + ' berisi satu baris:');
  console.error('  JT_APP_TOKEN=<token dari .env VPS>');
  process.exit(1);
}

/* ── PERINTAH: MENYALIN, BUKAN MENAFSIRKAN ────────────────────────────
   Ini seluruh rahasianya. Waktu diminta "baca chart ini dan laporkan
   levelnya", model 3B mengarang: tanda air analis dibaca sebagai nama
   pasangan, angka indikator Stochastic dilaporkan sebagai take profit, dan
   semuanya ditandai "pasti". Waktu diminta MENYALIN teks yang tercetak,
   jawabannya benar.

   Bedanya bukan kepintaran, melainkan besarnya ruang untuk salah. */
const PERINTAH_GAMBAR = `Kamu MENYALIN TEKS dari satu tangkapan layar chart trading.
Jangan menafsirkan, jangan menghitung, jangan mengubah format angka.

- chart: true kalau gambarnya memang chart trading, false kalau bukan.
- judul: teks kecil di pojok KIRI ATAS area chart (nama instrumen, timeframe, bursa).
- teks_gambar: tulisan yang tercetak DI DALAM gambar (mis. FVG, Break, BUY, SELL).
- panah: "naik", "turun", atau "tidak ada".
- catatan: satu kalimat pendek tentang apa yang tergambar.

ATURAN MUTLAK: jangan menambah apa pun yang tidak tercetak di gambar.
Kalau ragu, kosongkan.`;

const SKEMA_GAMBAR = {
  type: 'object',
  properties: {
    chart: { type: 'boolean' },
    judul: { type: 'string' },
    teks_gambar: { type: 'array', items: { type: 'string' } },
    panah: { type: 'string' },
    catatan: { type: 'string' },
  },
  required: ['chart', 'judul', 'teks_gambar', 'panah', 'catatan'],
};

/* ── Ollama ──────────────────────────────────────────────────────────── */
async function ollamaHidup() {
  try {
    const r = await fetch(OLLAMA + '/api/version', { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch { return false; }
}

async function tanyaOllama({ model, pesan, gambar, skema, tungguMs }) {
  const isi = { role: 'user', content: pesan };
  if (gambar) isi.images = [gambar];
  const body = {
    model, stream: false,
    options: { temperature: 0, num_predict: 600 },
    messages: [isi],
  };
  /* Skema JSON DIPAKSAKAN di sisi Ollama, bukan sekadar diminta di
     perintah. Tanpa itu hermes3 mengarang aksi yang tidak ada di daftar
     dan qwen mengisi `arah` dengan "Break" — nilai yang tidak pernah jadi
     pilihan. Perintah bisa dilanggar; skema tidak. */
  if (skema) body.format = skema;
  const r = await fetch(OLLAMA + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(tungguMs),
  });
  if (!r.ok) throw new Error('ollama ' + r.status);
  const j = await r.json();
  return (j && j.message && j.message.content) || '';
}

/* ── Antrean ─────────────────────────────────────────────────────────── */
async function jemput() {
  const r = await fetch(DASAR + '/api/otak/ambil', {
    headers: { 'X-App-Token': TOKEN },
    signal: AbortSignal.timeout(40000),
  });
  if (!r.ok) throw new Error('ambil ' + r.status);
  const j = await r.json();
  return j && j.kerja ? j.kerja : null;
}

async function setor(id, jawaban, galat) {
  await fetch(DASAR + '/api/otak/hasil', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Token': TOKEN },
    body: JSON.stringify({ id, jawaban, galat }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => {});
}

async function kerjakan(k) {
  const adaGambar = !!k.gambar;
  const model = adaGambar ? MODEL_GAMBAR : MODEL_TEKS;
  /* Gambar diberi waktu jauh lebih panjang. Diukur di GTX 1650: 40-60 detik
     per gambar, sementara penggolong teks selesai dalam dua detik. Satu
     angka untuk keduanya pasti salah untuk salah satunya. */
  const tunggu = adaGambar ? 180000 : 25000;
  const t0 = Date.now();
  const jawab = await tanyaOllama({
    model,
    pesan: adaGambar ? (k.pesan || PERINTAH_GAMBAR) : k.pesan,
    gambar: k.gambar,
    skema: k.skema || (adaGambar ? SKEMA_GAMBAR : null),
    tungguMs: tunggu,
  });
  const detik = ((Date.now() - t0) / 1000).toFixed(1);
  catat('  ' + (adaGambar ? 'gambar' : 'teks') + ' · ' + model + ' · ' + detik + ' dtk · '
        + String(jawab).replace(/\s+/g, ' ').slice(0, 110));
  return jawab;
}

/* ── Putaran utama ───────────────────────────────────────────────────── */
let berhenti = false;
process.on('SIGINT', () => { berhenti = true; catat('berhenti diminta…'); });

(async () => {
  catat('pekerja mata lokal hidup');
  catat('  backend :', DASAR);
  catat('  ollama  :', OLLAMA, '· gambar', MODEL_GAMBAR, '· teks', MODEL_TEKS);
  if (!(await ollamaHidup())) {
    catat('  PERINGATAN: Ollama belum jalan. Nyalakan dengan: ollama serve');
  }
  let sepi = 0;
  while (!berhenti) {
    let k = null;
    try { k = await jemput(); }
    catch (e) {
      /* Gagal menjemput BUKAN alasan berhenti. Backend restart, wifi
         berkedip, VPS sibuk — semuanya lewat sendiri, dan pekerja yang mati
         karena satu permintaan gagal harus dinyalakan tangan tiap kali. */
      catat('jemput gagal:', (e && e.message) || '?', '— coba lagi 5 detik lagi');
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (!k) {
      /* Long-poll sudah menahan 25 detik di sisi server, jadi tidak perlu
         jeda lagi di sini. Dicatat tiap sepuluh putaran sepi saja supaya
         layar tidak penuh oleh kabar "tidak ada apa-apa". */
      if (++sepi % 10 === 0) catat('sepi ·', sepi, 'putaran tanpa pekerjaan');
      continue;
    }
    sepi = 0;
    catat('kerja', k.id, k.gambar ? '(dengan gambar)' : '(teks)');
    try {
      const jawab = await kerjakan(k);
      await setor(k.id, jawab, null);
    } catch (e) {
      const pesan = (e && e.message) || 'tidak diketahui';
      catat('  GAGAL:', pesan);
      /* Kegagalan DISETORKAN, bukan didiamkan. Pemanggil di VPS menunggu
         sampai batas waktunya kalau tidak ada jawaban — dan menunggu 20
         detik untuk sesuatu yang sudah pasti gagal adalah 20 detik yang
         dibayar dua kali: sekali di sini, sekali di sana. */
      await setor(k.id, '', pesan);
    }
  }
  catat('pekerja berhenti.');
})();
