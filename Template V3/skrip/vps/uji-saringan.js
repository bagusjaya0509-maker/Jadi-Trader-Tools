#!/usr/bin/env node
/* Menjalankan SARINGAN pemantau terhadap pesan yang benar-benar ada di ruang
   itu, tanpa menyentuh apa pun. Menjawab satu pertanyaan: kalau pesan
   seperti ini datang SEKARANG, apakah ia lolos sampai diarsipkan?

   Ada karena saringan yang menolak diam-diam tidak bisa dibedakan dari ruang
   yang sedang sepi — keduanya sama-sama arsip yang tidak bertambah. */
'use strict';
require('dotenv').config();
const { TelegramClient, Api } = require('teleproto');
const { StringSession } = require('teleproto/sessions');

const AWALAN = process.argv[2] || 'TG2';
const BERAPA = Number(process.argv[3] || 6);

const GRUP = String(process.env[AWALAN + '_GRUP'] || '').trim();
const TOPIK = Number(process.env[AWALAN + '_TOPIK_ID'] || 0) || null;
const HANYA_ADMIN = process.env[AWALAN + '_HANYA_ADMIN'] !== '0';

(async () => {
  if (!GRUP) { console.log(AWALAN + '_GRUP kosong.'); process.exit(0); }
  const c = new TelegramClient(new StringSession(process.env.TELEGRAM_SESI),
    Number(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH,
    { connectionRetries: 3, deviceModel: 'Jadi Trader - Pemantau Sinyal', systemVersion: 'VPS', appVersion: '1.0' });
  await c.connect();
  const ruang = await c.getEntity(Number(GRUP));
  const kunciRuang = String(ruang.id);

  const r = await c.invoke(new Api.channels.GetParticipants({
    channel: ruang, filter: new Api.ChannelParticipantsAdmins(), offset: 0, limit: 100, hash: 0,
  }));
  const admin = new Set((r.users || []).map((u) => String(u.id)));
  const namaAdmin = new Map((r.users || []).map((u) => [String(u.id), u.username ? '@' + u.username : (u.firstName || u.id)]));

  console.log('ruang      :', ruang.title, '· id', kunciRuang);
  console.log('topik      :', TOPIK, '· hanyaAdmin:', HANYA_ADMIN);
  console.log('admin      :', [...namaAdmin.values()].join(', '));
  console.log('');

  let n = 0;
  for await (const m of c.iterMessages(ruang, { limit: 400 })) {
    if (n >= BERAPA) break;
    const rt = m.replyTo;
    const idTopik = rt ? (rt.replyToTopId || (rt.forumTopic ? rt.replyToMsgId : null) || null) : null;
    const topikOk = TOPIK === null
      ? true
      : (TOPIK === 1 ? (idTopik === null || idTopik === 1) : idTopik === TOPIK);
    if (!topikOk) continue;

    const dari = m.senderId ? String(m.senderId) : '';
    /* Cabang yang sama persis dengan pemantau, termasuk kelonggaran untuk
       admin anonim (id yang datang = id KANAL, bukan id orangnya). */
    const anonim = dari === kunciRuang;
    const adminOk = !(HANYA_ADMIN && admin.size && dari && !anonim && !admin.has(dari));
    const adaGambar = !!m.photo || !!(m.media && m.media.photo);
    const teks = String(m.message || '').trim();
    const adaIsi = !!teks || adaGambar;

    const lolos = topikOk && adminOk && adaIsi;
    console.log((lolos ? '✔ LOLOS' : '✖ DITOLAK') + '  pesan ' + m.id
      + '  ' + new Date(m.date * 1000).toISOString().slice(5, 16).replace('T', ' '));
    console.log('   pengirim :', dari,
      anonim ? '(ANONIM — atas nama grup)' : (namaAdmin.get(dari) ? namaAdmin.get(dari) + ' (admin)' : 'BUKAN ADMIN'));
    console.log('   topik    :', idTopik, topikOk ? 'cocok' : 'TIDAK cocok');
    console.log('   isi      :', (adaGambar ? '[gambar] ' : '') + (teks.replace(/\s+/g, ' ').slice(0, 50) || '(tanpa teks)'));
    if (!lolos) {
      console.log('   SEBAB    :', !topikOk ? 'topik tidak cocok'
        : !adminOk ? 'pengirim bukan admin — ' + AWALAN + '_HANYA_ADMIN=1 membuangnya'
        : 'tidak ada teks maupun gambar');
    }
    console.log('');
    n++;
  }
  await c.disconnect();
  process.exit(0);
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
