#!/usr/bin/env node
/* Mengunduh gambar dari topik yang dipantau ke /tmp/chart/, TANPA memanggil
   model apa pun. Untuk melihat sendiri isi gambarnya — termasuk apakah ada
   tanda air sumbernya. Nol biaya.

   Pakai: node ambil-gambar.js 4        (4 gambar terbaru di topik) */
'use strict';
require('dotenv').config();
const fs = require('fs');
const { TelegramClient } = require('teleproto');
const { StringSession } = require('teleproto/sessions');

const GRUP = Number(process.env.TG2_GRUP);
const TOPIK = Number(process.env.TG2_TOPIK_ID);
const BERAPA = Number(process.argv[2] || 4);
const KE = '/tmp/chart';

(async () => {
  fs.mkdirSync(KE, { recursive: true });
  const c = new TelegramClient(new StringSession(process.env.TELEGRAM_SESI),
    Number(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH,
    { connectionRetries: 3, deviceModel: 'Jadi Trader - Pemantau Sinyal', systemVersion: 'VPS', appVersion: '1.0' });
  await c.connect();
  const ruang = await c.getEntity(GRUP);
  let n = 0;
  for await (const m of c.iterMessages(ruang, { limit: 600 })) {
    if (n >= BERAPA) break;
    const rt = m.replyTo;
    const idT = rt ? (rt.replyToTopId || (rt.forumTopic ? rt.replyToMsgId : null) || null) : null;
    if ((idT === null ? 1 : idT) !== TOPIK) continue;
    if (!m.photo && !(m.media && m.media.photo)) continue;
    const bita = typeof m.downloadMedia === 'function' ? await m.downloadMedia() : await c.downloadMedia(m);
    const berkas = KE + '/' + m.id + '.jpg';
    fs.writeFileSync(berkas, bita);
    console.log(berkas, '·', Math.round(bita.length / 1024) + ' KB', '·',
      String(m.message || '').replace(/\s+/g, ' ').slice(0, 70) || '(tanpa keterangan)');
    n++;
  }
  await c.disconnect();
  process.exit(0);
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
