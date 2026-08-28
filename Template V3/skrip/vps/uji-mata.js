#!/usr/bin/env node
/* Uji jalur baca-gambar dari ujung ke ujung memakai chart SUNGGUHAN yang
   diposting di ruang yang dipantau. Tidak memposting apa pun ke mana pun:
   ia berhenti tepat sebelum kartu, dan mencetak apa yang AKAN terjadi. */
'use strict';
require('dotenv').config();
const { TelegramClient } = require('teleproto');
const { StringSession } = require('teleproto/sessions');
const mata = require('./mata-chart');
const { layakKartu } = require('./kartu-agen');

const GRUP = Number(process.env.TG2_GRUP);
const TOPIK = Number(process.env.TG2_TOPIK_ID);
const BERAPA = Number(process.argv[2] || 2);

(async () => {
  const c = new TelegramClient(new StringSession(process.env.TELEGRAM_SESI),
    Number(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH,
    { connectionRetries: 3, deviceModel: 'Jadi Trader - Pemantau Sinyal', systemVersion: 'VPS', appVersion: '1.0' });
  await c.connect();
  const ruang = await c.getEntity(GRUP);
  console.log('ruang :', ruang.title, '· topik', TOPIK, '· jatah sisa', mata.sisaJatah());

  let diuji = 0;
  for await (const m of c.iterMessages(ruang, { limit: 400 })) {
    const rt = m.replyTo;
    const idT = rt ? (rt.replyToTopId || (rt.forumTopic ? rt.replyToMsgId : null) || null) : null;
    if ((idT === null ? 1 : idT) !== TOPIK) continue;
    if (!m.photo && !(m.media && m.media.photo)) continue;

    const ket = String(m.message || '').trim();
    console.log('\n──────── pesan ' + m.id + ' ────────');
    console.log('keterangan:', ket.replace(/\s+/g, ' ').slice(0, 120) || '(kosong)');
    const bita = typeof m.downloadMedia === 'function' ? await m.downloadMedia() : await c.downloadMedia(m);
    console.log('gambar    :', Math.round((bita ? bita.length : 0) / 1024), 'KB');

    const t0 = Date.now();
    const h = await mata.bacaGambarChart(bita, ket);
    console.log('lama      :', ((Date.now() - t0) / 1000).toFixed(1) + ' d');
    if (h.galat) { console.log('GALAT     :', h.galat); }
    else {
      console.log('hasil     :', JSON.stringify({
        pasangan: h.pasangan, arah: h.arah, zona: h.zona,
        entry: h.entry, sl: h.sl, tp: h.tp, pasti: h.pasti,
      }));
      console.log('catatan   :', h.catatan);
      const sn = mata.keSinyal(h, 'uji-' + m.id);
      if (!sn) console.log('KEPUTUSAN : bukan sinyal — tidak ada kartu, tidak ada apa-apa');
      else {
        const meragukan = sn.dariGambar && !sn.pasti;
        console.log('sinyal    :', sn.jenis, sn.pasangan, sn.arah,
          'entry', sn.rentang ? sn.rentang.join('-') : sn.entry, 'sl', sn.sl, 'tp', sn.tp.join('/'));
        console.log('KEPUTUSAN :', layakKartu(sn)
          ? (meragukan ? 'lonceng saja — angkanya taksiran, kartu DITAHAN' : 'KARTU TERBIT')
          : 'lonceng saja — SL/TP belum lengkap');
      }
    }
    if (++diuji >= BERAPA) break;
  }
  if (!diuji) console.log('\nTidak ada gambar di topik itu dalam 400 pesan terakhir.');
  console.log('\nsisa jatah sekarang:', mata.sisaJatah());
  await c.disconnect();
  process.exit(0);
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
