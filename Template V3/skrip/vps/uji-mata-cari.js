#!/usr/bin/env node
/* Membaca gambar TERTENTU: dicari berdasarkan kata di keterangannya, bukan
   "N terbaru". Dipakai untuk memeriksa postingan yang disebut pemilik.
   Tidak memposting apa pun ke mana pun.

   Pakai: node uji-mata-cari.js HYPERLIQUID XAUT
   Tambah --mentah untuk melihat jawaban model apa adanya (mendiagnosis
   bacaan yang pulang kosong). */
'use strict';
require('dotenv').config();
const { TelegramClient } = require('teleproto');
const { StringSession } = require('teleproto/sessions');
const mata = require('./mata-chart');
const { layakKartu } = require('./kartu-agen');

const MENTAH = process.argv.includes('--mentah');
const KATA = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase());
const GRUP = Number(process.env.TG2_GRUP);
const TOPIK = Number(process.env.TG2_TOPIK_ID);

/* Panggilan mentah, sengaja MENGULANG isi mata-chart.js alih-alih
   mengeksposnya: yang diuji di sini justru bentuk jawaban yang TIDAK
   dipahami modul itu, dan membungkusnya lewat modul yang sama akan
   menyembunyikan persis apa yang mau dilihat. */
async function mentah(bita, ket) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: mata.MODEL, max_tokens: 700, temperature: 0,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Sebutkan pasangan dan zona yang tergambar. Jawab JSON.'
          + (ket ? '\nKeterangan: ' + ket : '') },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + bita.toString('base64') } },
      ] }],
    }),
  });
  const j = await r.json();
  console.log('  RAW status :', r.status);
  console.log('  RAW pilihan:', JSON.stringify(j.choices && j.choices[0], null, 1).slice(0, 900));
  console.log('  RAW pakai  :', JSON.stringify(j.usage));
  if (j.error) console.log('  RAW galat  :', JSON.stringify(j.error).slice(0, 300));
}

(async () => {
  const c = new TelegramClient(new StringSession(process.env.TELEGRAM_SESI),
    Number(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH,
    { connectionRetries: 3, deviceModel: 'Jadi Trader - Pemantau Sinyal', systemVersion: 'VPS', appVersion: '1.0' });
  await c.connect();
  const ruang = await c.getEntity(GRUP);
  console.log('cari :', KATA.join(' / '), '· jatah sisa', mata.sisaJatah());

  const sisa = new Set(KATA);
  for await (const m of c.iterMessages(ruang, { limit: 600 })) {
    if (!sisa.size) break;
    const rt = m.replyTo;
    const idT = rt ? (rt.replyToTopId || (rt.forumTopic ? rt.replyToMsgId : null) || null) : null;
    if ((idT === null ? 1 : idT) !== TOPIK) continue;
    if (!m.photo && !(m.media && m.media.photo)) continue;
    const ket = String(m.message || '').trim();
    const kena = [...sisa].find((k) => ket.toUpperCase().includes(k));
    if (!kena) continue;
    sisa.delete(kena);

    console.log('\n──────── ' + kena + ' · pesan ' + m.id + ' ────────');
    console.log('keterangan:', ket.replace(/\s+/g, ' ').slice(0, 140));
    const bita = typeof m.downloadMedia === 'function' ? await m.downloadMedia() : await c.downloadMedia(m);
    console.log('gambar    :', Math.round(bita.length / 1024), 'KB');

    const h = await mata.bacaGambarChart(bita, ket);
    if (h.galat) {
      console.log('GALAT     :', h.galat);
      if (MENTAH) await mentah(bita, ket);
    } else {
      console.log('hasil     :', JSON.stringify({
        pasangan: h.pasangan, arah: h.arah, zona: h.zona,
        entry: h.entry, sl: h.sl, tp: h.tp, pasti: h.pasti,
      }));
      console.log('catatan   :', h.catatan);
      const sn = mata.keSinyal(h, 'uji-' + m.id);
      if (!sn) console.log('KEPUTUSAN : bukan sinyal — lonceng saja kalau ada zona, tidak ada kartu');
      else {
        const ragu = sn.dariGambar && !sn.pasti;
        console.log('sinyal    :', sn.jenis, sn.pasangan, sn.arah,
          'entry', sn.rentang ? sn.rentang.join('-') : sn.entry, 'sl', sn.sl, 'tp', sn.tp.join('/'));
        console.log('KEPUTUSAN :', layakKartu(sn)
          ? (ragu ? 'lonceng saja — angkanya taksiran, kartu DITAHAN' : 'KARTU TERBIT')
          : 'lonceng saja — SL/TP belum lengkap');
      }
    }
  }
  if (sisa.size) console.log('\nTidak ketemu dalam 600 pesan:', [...sisa].join(', '));
  console.log('\nsisa jatah:', mata.sisaJatah());
  await c.disconnect();
  process.exit(0);
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
