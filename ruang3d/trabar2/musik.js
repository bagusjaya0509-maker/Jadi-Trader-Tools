/* ── MUSIK PANGGUNG JOGET ──────────────────────────────────────────────
   Versi asalnya cuma memegang lima lagu bawaan dan mengindeksnya lewat
   nomor GERAKAN. Sejak 23 Sep 2026 lagunya dipilih SENDIRI oleh yang
   menonton, dari daftar terpisah — jadi yang dipegang kelas ini bukan lagi
   indeks, melainkan satu lagu apa adanya: nama berkas + BPM-nya.

   BPM bukan hiasan. joget.js memetakan posisi lagu ke fase langkah lewat
   `currentTime * BPM / 60 * 0.46`; salah BPM berarti kaki robot mendarat
   di antara ketukan, dan itu satu-satunya hal yang dinilai mata saat
   melihat orang menari. */

/* Lima lagu bawaan dari pembuat ruangan — original, pre-rendered. Dipakai
   mode OTOMATIS: tiap gerakan punya pasangannya sendiri. */
export const BAWAAN = [
  { b: 'neon-shuffle', bpm: 128 }, { b: 'disco-profit', bpm: 116 },
  { b: 'stomp-rally', bpm: 132 }, { b: 'pop-lock', bpm: 108 },
  { b: 'wave-groove', bpm: 100 }, { b: 'neon-shuffle', bpm: 128 },
  { b: 'disco-profit', bpm: 116 }, { b: 'pop-lock', bpm: 108 },
  { b: 'stomp-rally', bpm: 132 }, { b: 'wave-groove', bpm: 100 },
];

/* Lagu milik pemilik. BPM-nya ditaksir dari autokorelasi selubung onset
   saat berkasnya disiapkan — bukan diketik tangan, dan bukan tebakan
   seragam. `d` detik, dipakai label daftar supaya lagunya bisa dikenali
   tanpa didengarkan satu per satu. */
export const LAGU = [
  { b: 'lagu-01', bpm: 169, d: 64 },
  { b: 'lagu-02', bpm: 125, d: 27 },
  { b: 'lagu-03', bpm: 89, d: 12 },
  { b: 'lagu-04', bpm: 129, d: 14 },
  { b: 'lagu-05', bpm: 136, d: 247 },
  { b: 'lagu-06', bpm: 112, d: 40 },
  { b: 'lagu-07', bpm: 86, d: 14 },
  { b: 'lagu-08', bpm: 133, d: 18 },
  { b: 'lagu-09', bpm: 126, d: 51 },
  { b: 'lagu-10', bpm: 140, d: 22 },
  { b: 'lagu-11', bpm: 164, d: 245 },
  { b: 'lagu-12', bpm: 123, d: 32 },
  { b: 'lagu-13', bpm: 164, d: 585 },
  { b: 'lagu-14', bpm: 86, d: 18 },
  { b: 'lagu-15', bpm: 140, d: 49 },
  { b: 'lagu-16', bpm: 86, d: 20 },
  { b: 'lagu-17', bpm: 91, d: 30 },
  { b: 'lagu-18', bpm: 88, d: 45 },
  { b: 'lagu-19', bpm: 126, d: 33 },
  { b: 'lagu-20', bpm: 136, d: 21 },
  { b: 'lagu-21', bpm: 167, d: 41 },
  { b: 'lagu-22', bpm: 159, d: 283 },
  { b: 'lagu-23', bpm: 91, d: 190 },
  { b: 'lagu-24', bpm: 91, d: 21 },
  { b: 'lagu-25', bpm: 133, d: 257 },
];

export class Musik {
  constructor() {
    this.el = null; this.nyala = false; this.kini = null;
    this.ada = new Map(); this.volume = 0.48; this.rate = 1;
    this.paused = false; this.request = 0;
  }

  _pemutar() {
    if (!this.el) {
      this.el = new Audio(); this.el.loop = true;
      this.el.preload = 'auto'; this.el.volume = this.volume;
    }
    return this.el;
  }

  /** @param lagu {b,bpm} — lagu apa adanya, bukan indeks. */
  async pasang(lagu) {
    if (!lagu) return;
    const el = this._pemutar();
    if (this.kini && this.kini.b === lagu.b && this.nyala) return;
    const request = ++this.request;
    this.kini = lagu;
    el.src = './musik/' + lagu.b + '.mp3';
    el.playbackRate = this.rate;
    this.nyala = false;
    try {
      await el.play();
      if (request !== this.request) return;
      this.nyala = true; this.ada.set(lagu.b, true);
      if (this.paused) el.pause();
    } catch (e) {
      if (request !== this.request) return;
      /* `NotAllowedError` berarti peramban menahan sampai ada sentuhan —
         berkasnya sendiri baik-baik saja. Dibedakan dari benar-benar
         hilang supaya daftar tidak menandai lagu yang sebenarnya ada. */
      this.ada.set(lagu.b, e.name === 'NotAllowedError' ? null : false);
      this.nyala = false;
    }
  }

  matikan() { this.request++; this.nyala = false; this.kini = null; this.el?.pause(); }
  hilang(nama) { return this.ada.get(nama) === false; }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); if (this.el) this.el.volume = this.volume; }

  transport(paused, rate = 1) {
    this.rate = rate;
    if (this.el) this.el.playbackRate = rate;
    if (this.paused === paused) return;
    this.paused = paused;
    if (!this.nyala || !this.el) return;
    if (paused) this.el.pause();
    else this.el.play().catch(() => { this.nyala = false; });
  }

  /** Jam audio dipetakan sekali ke satuan yang dipakai fungsi pose
   *  (0,46 detik per ketukan). null = lagunya tidak berbunyi, dan di situ
   *  joget.js kembali memakai dt-nya sendiri. */
  waktu() {
    return this.nyala && this.el && !this.el.paused
      ? this.el.currentTime * this.kini.bpm / 60 * 0.46
      : null;
  }
}
