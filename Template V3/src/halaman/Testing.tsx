"use client";
import React from "react";
import { LinkPreview } from "@/components/ui/link-preview";

/* ════════════════════════════════════════════════════════════════════════
   HALAMAN TESTING — SATU ARTIKEL SUNGGUHAN, DITULIS SATU PER SATU
   ════════════════════════════════════════════════════════════════════════
   Isinya artikel "Akun Sen di MT5 Bisa Membuat Jurnalmu Terlihat 100× Lebih
   Untung" (skrip/artikel-isi.py), kata demi kata seperti aslinya.

   ── KENAPA ARTIKEL INI YANG DIPILIH ─────────────────────────────────────
   Dari lima artikel yang ada, cuma ini yang isinya MURNI paragraf dan
   subjudul — tanpa daftar berpoin, tanpa kotak catatan. Empat lainnya
   punya <ul>, <ol>, atau kotak .catatan, dan tidak satu pun dari bentuk
   itu ada di demo yang sudah disetujui. Menambahkannya berarti mengarang
   kelas baru, dan mengarang kelas baru persis yang merusak halaman ini
   waktu percobaan pertama.

   Jadi artikelnya yang dipilih supaya cocok dengan bentuk yang sudah ada,
   bukan bentuknya yang dipaksa mengikuti artikel.

   ── ATURAN YANG DIPEGANG ────────────────────────────────────────────────
   Tidak ada ukuran, warna, atau jarak baru. Seluruh halaman ini cuma
   memakai dua bentuk, dan keduanya disusun dari kelas yang MEMANG SUDAH
   ADA di berkas ini sebelumnya:

     • paragraf  → string kelas demo, huruf per huruf, termasuk spasi
                   gandanya sesudah `max-w-3xl`
     • subjudul  → string yang sama, dikurangi kelas warnanya, ditambah
                   `font-bold` (sudah dipakai LinkPreview di sini). Tanpa
                   kelas warna ia mewarisi `text-white` dari pembungkus
                   rute — jadi putih tebal di atas badan teks abu-abu.
                   Susunan yang sama persis dengan halaman artikel
                   sungguhan: judul putih, badan teks redup.

   Ukurannya sengaja TIDAK dibedakan antara subjudul dan paragraf.
   Demo aslinya cuma punya satu tangga ukuran (`text-xl md:text-3xl`);
   menambah tangga kedua berarti mengarang tipografi baru.

   ── DUA HAL YANG BERUBAH DARI DEMO, DAN ALASANNYA ───────────────────────
   1. `h-[40rem]` → `min-h-[40rem]`. Tinggi mati 640px pas untuk dua
      paragraf; dengan tiga belas blok isinya meluber keluar kotak, dan
      `justify-center` mendorongnya ke ATAS layar sampai paragraf pertama
      hilang di balik tepi jendela. `min-h` menjaga tampilan demo waktu
      isinya pendek, dan membiarkannya tumbuh waktu panjang.
   2. Ditambah `py-24`. Tanpa itu baris pertama menempel di tepi atas
      jendela. Jarak, bukan huruf — tidak ada ukuran teks yang tersentuh.

   ── TAUTANNYA ───────────────────────────────────────────────────────────
   Demo aslinya punya tiga LinkPreview. Di sini dua, dan keduanya menempel
   pada kata yang MEMANG ADA di artikelnya — tidak satu kata pun ditambah
   supaya ada tempat menaruh tautan. Dua ragam demo tetap terwakili: satu
   bergradien ungu→merah muda, satu `font-bold` biasa.
   ════════════════════════════════════════════════════════════════════════ */

export function LinkPreviewDemoSecond() {
  return (
    <div className="flex justify-center items-start min-h-[40rem] flex-col px-4 py-24">
      <p className="text-xl md:text-3xl max-w-3xl  text-left mb-10 font-bold">
        Akun Sen di MT5 Bisa Membuat Jurnalmu Terlihat 100× Lebih Untung
      </p>

      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left mb-10">
        Akun sen memakai satuan yang seratus kali lebih kecil dari akun biasa.
        Kalau angkanya masuk jurnal apa adanya, seluruh riwayatmu terbaca
        seratus kali lebih untung dari kenyataan — dan yang berbahaya bukan
        angkanya, melainkan keputusan yang kamu ambil dari angka itu.
      </p>

      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left mb-10">
        Akun sen dideteksi dari mata uang akun MT5, lalu dibagi 100 sebelum{" "}
        <LinkPreview
          url="/artikel/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis/"
          imageSrc="/artikel/gambar/cara-menghubungkan-mt5-ke-jurnal-trading-otomatis.webp"
          isStatic
          className="font-bold bg-clip-text text-transparent bg-gradient-to-br from-purple-500 to-pink-500"
        >
          masuk jurnal
        </LinkPreview>
        .
      </p>

      <p className="text-xl md:text-3xl max-w-3xl  text-left mb-10 font-bold">
        Saldo dihitung dari transaksi yang sudah selesai
      </p>

      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left mb-10">
        Saldo di Dashboard dan Journal berasal dari satu sumber: saldo awal
        ditambah seluruh P/L yang sudah direalisasi. Posisi yang masih terbuka
        tidak ikut — ia tampil terpisah sebagai floating.
      </p>

      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left mb-10">
        Alasannya sederhana: mencampur keduanya membuat kurva ekuitas berubah
        tiap detik tanpa ada satu pun transaksi yang benar-benar terjadi. Kurva
        yang bergerak sendiri tidak bisa dipakai menilai apa pun.
      </p>

      <p className="text-xl md:text-3xl max-w-3xl  text-left mb-10 font-bold">
        Swap dan komisi masuk ke dalam P/L
      </p>

      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left mb-10">
        Keduanya dihitung ke dalam P/L tiap transaksi, bukan dijadikan baris
        sendiri. Jadi angka yang kamu lihat adalah yang benar-benar masuk atau
        keluar dari akun, bukan angka kotor sebelum biaya.
      </p>

      <p className="text-xl md:text-3xl max-w-3xl  text-left mb-10 font-bold">
        Winrate gabungan memakai jumlah transaksi
      </p>

      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left mb-10">
        Forex dan{" "}
        <LinkPreview
          url="/artikel/cara-membuat-api-key-binance-yang-aman/"
          imageSrc="/artikel/gambar/cara-membuat-api-key-binance-yang-aman.webp"
          isStatic
          className="font-bold"
        >
          kripto
        </LinkPreview>{" "}
        disimpan terpisah lalu digabung saat ditampilkan. Winrate gabungannya
        dihitung dari jumlah transaksi,{" "}
        <b className="font-bold text-white">bukan</b> rata-rata dua winrate.
      </p>

      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left mb-10">
        Bedanya besar: 9 dari 10 trade forex menang dan 1 dari 90 trade kripto
        menang bukan berarti winrate-mu 50%. Rata-rata dua persentase
        menyembunyikan bahwa hampir semua transaksimu ada di sisi yang kalah.
      </p>

      <p className="text-xl md:text-3xl max-w-3xl  text-left mb-10 font-bold">
        Kolom emosi tidak memengaruhi angka
      </p>

      <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left ">
        Kolom emosi dan alasan entry diisi manual, dan sengaja tidak dipakai
        menghitung apa pun. Gunanya muncul belakangan — saat pola "entry karena
        FOMO" sudah cukup banyak untuk dijumlahkan.
      </p>
    </div>
  );
}

/* Pembungkus rute. Demo aslinya tidak punya latar sendiri — di halaman
   terang ia tidak terbaca, karena kelas warnanya `dark:text-neutral-400`.
   Pembungkus ini yang memberi latar gelap, dan ia BUKAN bagian dari
   demo-nya.

   Ditulis `React.FC` dengan sengaja: `import React from "react"` ada di
   baris kedua berkas ini karena ia bagian dari demo yang ditempel apa
   adanya, dan `noUnusedLocals` menolak impor yang menganggur. Yang dibuat
   memakainya kode SAYA, bukan kode kiriman pemilik. */
const Testing: React.FC = () => (
  <div className="dark min-h-screen bg-black text-white">
    <LinkPreviewDemoSecond />
  </div>
);

export default Testing;
