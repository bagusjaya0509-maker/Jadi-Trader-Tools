import { readFileSync, writeFileSync } from 'node:fs';

/* ════════════════════════════════════════════════════════════════════════
   Jalur cepat penilai: tick hidup, diperiksa tiap 3 detik.
   ════════════════════════════════════════════════════════════════════════
   Chart & Entry hampir realtime karena EA mengirim TICK (satu harga per
   simbol, beberapa detik sekali) terpisah dari riwayat lilin yang 2 MB
   per 5 menit. Penilai selama ini cuma membaca pipa yang besar-dan-jarang;
   tambalan ini menyambungkan pipa yang kecil-dan-cepat ke penilai juga.

   PEMBAGIAN PERANNYA, dan kenapa dua-duanya tetap ada:
     · TICK = pemantau hidup. Menandai kena SL/TP dalam hitungan detik,
       memakai harga yang SAMA dengan yang mengeksekusi stop di broker.
     · LILIN = hakim sejarah. Menutup semua yang tick tidak bisa lihat:
       sinyal yang kejadiannya sebelum server menyala, simbol yang EA-nya
       sedang tidak mengirim tick, dan urutan sentuhan di masa lalu.
   Keduanya tidak bentrok: penilai lilin melewati sinyal yang sudah punya
   `hasil`, dan jalur tick hanya menulis untuk yang belum.

   Celah yang DITERIMA dengan sadar: kalau TP tersentuh dua menit lalu
   (lilinnya belum terkirim) lalu SL tersentuh hidup-hidup sekarang, jalur
   tick menandai SL — padahal sejarah akan bilang TP duluan. Jendelanya
   sesempit jeda feed lilin dan menuntut dua level tersentuh di jendela
   yang sama. Broker sendiri menyelesaikan urutan ini dengan eksekusi
   sungguhan; papan hanya bisa mendekatinya.
   ════════════════════════════════════════════════════════════════════════ */

const berkas = process.argv[2] || 'server.js';
let s = readFileSync(berkas, 'utf8');

if (s.includes('function nilaiDariTick')) {
  console.log('jalur tick sudah terpasang — tidak ada yang diubah.');
  process.exit(0);
}

const JANGKAR = 'setInterval(nilaiAman, NILAI_JEDA_MS).unref();';
const n = s.split(JANGKAR).length - 1;
if (n !== 1) {
  console.error('GAGAL: jangkar setInterval nilaiAman ditemukan ' + n + ' kali.');
  process.exit(1);
}

const SISIP = JANGKAR + `

/* ── JALUR CEPAT: nilai dari tick hidup ─────────────────────────────────
   Tick yang dipakai adalah relai harga broker yang sama dengan yang
   mengeksekusi stop sungguhan — jadi "kena menurut tick" dan "kena
   menurut broker" adalah satu kejadian, bukan dua taksiran. SL didahulukan
   saat keduanya terlampaui di satu tick, sama dengan sikap telusuri().

   Sisi harganya sisi yang benar-benar dipakai broker: posisi BUY ditutup
   di BID (SL & TP), posisi SELL ditutup di ASK. Ask 0 berarti EA lama
   yang belum mengirimnya — bid dipakai sebagai pendekatan, lebih baik
   sedikit kasar daripada buta. */
function tickUntuk(pasangan, uidAnalis) {
  const dasar = String(pasangan || '').replace(/^MT5:/i, '').toUpperCase();
  const cocok = (laci) => {
    if (!laci) return null;
    for (const lg of Object.keys(laci)) {
      for (const sim of Object.keys(laci[lg] || {})) {
        if (sim === dasar || sim.startsWith(dasar)) {
          const t = laci[lg][sim];
          if (t && Date.now() - t.waktu < 90_000) return t;
        }
      }
    }
    return null;
  };
  /* Laci analisnya sendiri dulu, feed lain belakangan — aturan yang sama
     dengan penilai lilin: menilai sinyal orang dengan harga broker lain
     bisa membalik menang jadi kalah pada stop yang sempit. */
  if (uidAnalis && MT5_TICK[uidAnalis]) {
    const t = cocok(MT5_TICK[uidAnalis]);
    if (t) return t;
  }
  for (const uid of Object.keys(MT5_TICK)) {
    const t = cocok(MT5_TICK[uid]);
    if (t) return t;
  }
  return null;
}

function nilaiDariTick() {
  const d = analisaBaca();
  const perubahan = [];
  for (const a of d.daftar) {
    if (a.hasil) continue;
    if (/^[A-Z0-9]+USDT$/.test(a.pasangan || '')) continue;   // kripto dinilai dari klines Binance
    const { entry, sl, tp } = a.isi || {};
    if (!entry || !sl) continue;
    if (Date.now() - a.dibuat > NILAI_MAKS_HARI * 86400000) continue;

    const t = tickUntuk(a.pasangan, a.uid);
    if (!t) continue;
    const bid = t.bid;
    const ask = t.ask > 0 ? t.ask : t.bid;
    const buy = a.arah === 'BUY';
    const waktu = t.tb || Date.now();

    /* TERISI dari tick — jenis ordernya menentukan sisi sentuhannya.
       Limit menunggu harga TURUN ke entry (BUY) / NAIK ke entry (SELL);
       Stop kebalikannya; Market terisi sejak awal. jenisEntry ditulis
       penilai lilin sekali dan tidak pernah diubah, jadi aman dibaca. */
    let terisi = a.terisi === true;
    if (!terisi) {
      const je = String(a.jenisEntry || '');
      if (/market/i.test(je)) terisi = true;
      else if (/limit/i.test(je)) terisi = buy ? ask <= entry : bid >= entry;
      else if (/stop/i.test(je)) terisi = buy ? ask >= entry : bid <= entry;
      /* jenisEntry belum ditulis (penilai lilin belum pernah menyentuhnya):
         jangan menebak — biarkan penilai lilin yang menentukan. */
      if (terisi && !a.terisi) perubahan.push({ id: a.id, terisi: true, waktuIsi: waktu });
    }
    if (!terisi) continue;

    const kenaSl = buy ? bid <= sl : ask >= sl;
    const kenaTp = tp > 0 && (buy ? bid >= tp : ask <= tp);
    if (!kenaSl && !kenaTp) continue;
    const hasil = kenaSl ? 'sl' : 'tp';
    perubahan.push({
      id: a.id, terisi: true, waktuIsi: a.waktuIsi || waktu,
      hasil, waktuHasil: waktu,
      rr: Math.abs((tp || entry) - entry) / Math.abs(entry - sl) || 0,
    });
    console.log('[analisa-tick] ' + a.pasangan + ' ' + a.arah + ' -> kena ' + hasil.toUpperCase() + ' (tick hidup)');
  }
  if (!perubahan.length) return;

  /* Baca ulang tepat sebelum menulis — aturan yang sama dengan penilai
     lilin: snapshot yang berumur beberapa detik tidak boleh menimpa
     analisa yang baru diposting orang di sela-selanya. */
  const segar = analisaBaca();
  const peta = new Map(perubahan.map((p) => [p.id, p]));
  for (const a of segar.daftar) {
    const p = peta.get(a.id);
    if (!p || a.hasil) continue;
    if (p.terisi && !a.terisi) { a.terisi = true; a.waktuIsi = p.waktuIsi; }
    if (p.hasil) { a.hasil = p.hasil; a.waktuHasil = p.waktuHasil; a.rr = p.rr; }
  }
  analisaTulis(segar);
}
const tickAman = () => { try { nilaiDariTick(); } catch (e) { console.error('[analisa-tick] gagal:', e && e.message); } };
setInterval(tickAman, 3000).unref();`;

s = s.replace(JANGKAR, SISIP);
writeFileSync(berkas, s);
console.log('jalur tick terpasang — penilai kini melihat harga hidup tiap 3 detik.');
