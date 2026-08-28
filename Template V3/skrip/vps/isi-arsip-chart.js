#!/usr/bin/env node
/* Mengisi arsip chart dengan postingan yang SUDAH ADA di ruang pantauan.
   Pemantau hanya menangkap pesan baru, jadi tanpa ini panelnya kosong
   sampai ruangnya memposting lagi — dan panel kosong di hari pertama
   terbaca seperti fitur yang tidak jalan.

   Nol biaya: tidak ada model yang dipanggil. Aman diulang — simpanChart
   melewati id yang sudah ada.

   Pakai: node isi-arsip-chart.js [berapa]     (bawaan 12) */
'use strict';
require('dotenv').config();
const { TelegramClient } = require('teleproto');
const { StringSession } = require('teleproto/sessions');
const { simpanChart } = require('./arsip-chart-vps');

const BERAPA = Number(process.argv[2] || 12);
/* Ruang mana saja yang mengarsip — dibaca dari .env yang SAMA dengan
   pemantau, bukan ditulis ulang di sini. Dua daftar yang harus sepakat
   selamanya adalah kesepakatan yang cepat atau lambat putus. */
const RUANG = ['TG', 'TG2', 'TG3', 'TG4']
  .map((a) => ({
    grup: String(process.env[a + '_GRUP'] || '').trim(),
    topik: Number(process.env[a + '_TOPIK_ID'] || 0) || null,
    agen: String(process.env[a + '_AGEN_NAMA'] || 'AI Telg').trim(),
    arsip: process.env[a + '_ARSIP'] === '1',
  }))
  .filter((r) => r.grup && r.arsip);

(async () => {
  if (!RUANG.length) { console.log('Tidak ada ruang dengan TG*_ARSIP=1.'); process.exit(0); }
  const c = new TelegramClient(new StringSession(process.env.TELEGRAM_SESI),
    Number(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH,
    { connectionRetries: 3, deviceModel: 'Jadi Trader - Pemantau Sinyal', systemVersion: 'VPS', appVersion: '1.0' });
  await c.connect();

  for (const r of RUANG) {
    const ruang = await c.getEntity(Number(r.grup));
    console.log('\n── ' + (ruang.title || r.grup) + ' · agen ' + r.agen + ' ──');
    let n = 0;
    for await (const m of c.iterMessages(ruang, { limit: 600 })) {
      if (n >= BERAPA) break;
      const rt = m.replyTo;
      const idT = rt ? (rt.replyToTopId || (rt.forumTopic ? rt.replyToMsgId : null) || null) : null;
      if (r.topik !== null && (idT === null ? 1 : idT) !== r.topik) continue;
      if (!m.photo && !(m.media && m.media.photo)) continue;

      const bita = typeof m.downloadMedia === 'function' ? await m.downloadMedia() : await c.downloadMedia(m);
      if (!bita || !bita.length) continue;
      /* Id-nya HARUS sama bentuknya dengan yang dipakai pemantau
         (`<idKanal>:<idPesan>` lalu dibersihkan), supaya pesan yang sama
         tidak masuk dua kali lewat dua pintu. */
      const id = (String(ruang.id) + ':' + m.id).replace(/[^\w-]/g, '');
      const berkas = simpanChart(__dirname, {
        id, agen: r.agen,
        keterangan: String(m.message || '').trim(),
        waktu: m.date ? m.date * 1000 : Date.now(),
        bita,
      });
      console.log('  ' + (berkas ? '+ ' + berkas : '· sudah ada') + '  '
        + (String(m.message || '').replace(/\s+/g, ' ').slice(0, 60) || '(tanpa keterangan)'));
      n++;
    }
    if (!n) console.log('  (tidak ada gambar di topik itu)');
  }

  await c.disconnect();
  process.exit(0);
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
