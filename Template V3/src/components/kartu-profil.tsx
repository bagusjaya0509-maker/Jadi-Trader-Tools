import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Image as IkonGambar, Loader2, LogOut, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePaket, LABEL_PAKET } from '@/lib/paket';
import { useHargaPaket, hargaPaket, satuanPaket, usd, rupiah } from '@/lib/harga-akses';
import {
  useProfilPengguna, simpanGambarProfil, hapusGambarProfil, type JenisGambar,
} from '@/lib/profil-pengguna';
import { AvatarAnalis } from '@/components/avatar-analis';
import { cn, sisaTerbaca } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   KARTU PROFIL — isi menu yang terbuka saat foto profil diklik
   ════════════════════════════════════════════════════════════════════════
   Menggantikan tiga baris teks yang sebelumnya ada di sana. Yang lama
   menjawab "siapa saya" dan "boleh masuk atau tidak"; pertanyaan yang tidak
   terjawab justru yang paling sering ditanyakan orang yang membayar:
   paketnya yang mana, sisanya berapa lama, dan berapa yang dibayar.

   ── TIGA SUMBER, DAN SENGAJA TIDAK DICAMPUR ─────────────────────────────
   Durasi datang dari useAuth().langganan, nama paket dari usePaket(), dan
   harga dari useHargaPaket(). Ketiganya tempat berbeda, dan pernah
   berselisih sampai pembeli berbayar dibaca sebagai pengguna gratis oleh
   pagar fiturnya sementara layar tetap menulis "Aktif". Menyatukannya di
   sini akan menyembunyikan perselisihan berikutnya; membiarkannya terpisah
   membuat kartu ini yang memperlihatkannya lebih dulu.

   Yang WAJIB sepasang: nama paket dan harganya sama-sama dari paket yang
   sama, dan sisa hari sama-sama dari langganan. Jadi kalaupun dua sumber
   itu berselisih, tidak ada satu baris pun yang isinya bertentangan
   dengan dirinya sendiri.

   ── PEMILIK SELALU DIDAHULUKAN ──────────────────────────────────────────
   Pemilik dihitung dari uid dan sama sekali tidak menyentuh dokumen
   langganan, jadi ia bisa berstatus "habis" sekaligus punya akses yang
   tidak bisa dicabut. Setiap baris di bawah memeriksa `pemilik` lebih dulu
   — kalau tidak, kartunya menulis "Habis" untuk orang yang memiliki
   aplikasinya.

   ── DIRENDER HANYA SAAT MENUNYA TERBUKA ─────────────────────────────────
   usePaket(), useHargaPaket(), dan useProfilPengguna() semuanya menembak
   jaringan. Sebelumnya usePaket() hidup di MenuPengguna dan menembak
   /api/paket di setiap pemuatan halaman, untuk menu yang mungkin tidak
   pernah dibuka. Sekarang ketiganya ikut hidup dan mati bersama kartunya.
   ════════════════════════════════════════════════════════════════════════ */

const kartu = {
  awal: { opacity: 0, y: -8, scale: 0.97 },
  masuk: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: 'easeOut' as const } },
};

/** Satu angka besar + keterangan kecil, dipisah garis tipis. */
function Angka({ nilai, label, warna }: { nilai: string; label: string; warna?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center px-1.5 text-center">
      <span className={cn('angka w-full truncate text-[13px] font-semibold', warna ?? 'text-zinc-100')}
            title={nilai}>
        {nilai}
      </span>
      <span className="mt-0.5 text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}

function Garis() {
  return <span className="h-7 w-px shrink-0 bg-zinc-800" aria-hidden />;
}

/** Tombol ganti gambar. Berlabel teks, BUKAN ikon telanjang.
 *
 *  Ikon kamera di pojok avatar memang lebih rapi, tapi ia cuma ditemukan
 *  orang yang sudah tahu ia ada — dan permintaannya justru supaya
 *  pengaturannya kelihatan. Ikonnya tetap ada di sebelah kiri teks sebagai
 *  penanda cepat, bukan sebagai satu-satunya petunjuk. */
function TombolGambar({ jenis, label, ikon: Ikon, ada, sibuk, pilih, hapus }: {
  jenis: JenisGambar;
  label: string;
  ikon: typeof UserRound;
  ada: boolean;
  sibuk: JenisGambar | null;
  pilih: (jenis: JenisGambar, berkas: File) => void;
  hapus: (jenis: JenisGambar) => void;
}) {
  const masukan = useRef<HTMLInputElement>(null);
  const jalan = sibuk === jenis;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <button
        type="button"
        onClick={() => masukan.current?.click()}
        disabled={sibuk !== null}
        title={ada ? `Ganti ${label.toLowerCase()}` : `Pasang ${label.toLowerCase()}`}
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/50',
          'px-2 py-1.5 text-[11.5px] text-zinc-300 transition-colors',
          'hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100',
          'disabled:cursor-default disabled:opacity-50',
        )}
      >
        {jalan ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <Ikon className="size-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </button>
      {/* Tombol hapus muncul HANYA kalau ada yang bisa dihapus. Tombol mati
          yang selalu terpampang cuma menambah satu hal untuk diabaikan. */}
      {ada && (
        <button
          type="button"
          onClick={() => hapus(jenis)}
          disabled={sibuk !== null}
          aria-label={`Hapus ${label.toLowerCase()}`}
          title={`Hapus ${label.toLowerCase()}`}
          className="shrink-0 cursor-pointer rounded-md border border-zinc-800 p-1.5 text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:cursor-default disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
      <input
        ref={masukan}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          /* Nilainya dikosongkan supaya memilih BERKAS YANG SAMA dua kali
             tetap memicu onChange. Tanpa ini, orang yang memangkas fotonya
             lalu memilih nama berkas yang sama tidak melihat apa pun
             terjadi. */
          e.target.value = '';
          if (f) pilih(jenis, f);
        }}
      />
    </div>
  );
}

export function KartuProfil({ tutup }: { tutup: () => void }) {
  const { pengguna, langganan, keluar, pemilik } = useAuth();
  const { paket: paketku, memuat: memuatPaket } = usePaket();
  const harga = useHargaPaket();
  const { profil, setProfil } = useProfilPengguna(true);
  const [sibuk, setSibuk] = useState<JenisGambar | null>(null);
  const [galat, setGalat] = useState('');

  if (!pengguna) return null;

  const nama = pengguna.displayName || 'Tanpa nama';
  /* Urutannya disengaja: yang diunggah sendiri MENANG atas foto Google.
     Orang yang repot mengganti fotonya di sini sedang menyatakan foto
     akun Google-nya bukan yang ia mau dipakai. */
  const fotoTampil = profil.foto || pengguna.photoURL || '';

  async function pilihGambar(jenis: JenisGambar, berkas: File) {
    setSibuk(jenis); setGalat('');
    try {
      setProfil(await simpanGambarProfil(jenis, berkas));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan gambar');
    } finally {
      setSibuk(null);
    }
  }

  async function buangGambar(jenis: JenisGambar) {
    setSibuk(jenis); setGalat('');
    try {
      setProfil(await hapusGambarProfil(jenis));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menghapus gambar');
    } finally {
      setSibuk(null);
    }
  }

  /* ── Tiga angka ──────────────────────────────────────────────────────
     Sisa dan tanggal berakhir sama-sama dari `langganan`, jadi keduanya
     tidak mungkin saling bertentangan. Pratinjau diukur JAM sementara
     langganan diukur hari — memakai satu satuan untuk keduanya akan
     menulis "sisa 1 hari" untuk sisa dua menit, dan kebohongan itu baru
     ketahuan saat layarnya mendadak terkunci. */
  const sisa = pemilik ? '∞'
    : langganan.status === 'pratinjau' && langganan.sisaMs !== null ? sisaTerbaca(langganan.sisaMs)
    : langganan.status === 'aktif' && langganan.sisaHari !== null ? `${langganan.sisaHari} hari`
    : langganan.status === 'habis' ? 'habis'
    : '—';

  const berakhir = pemilik ? 'tanpa batas'
    : langganan.berakhir ? langganan.berakhir.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: '2-digit',
      })
    : '—';

  const nilaiHarga = pemilik ? null : hargaPaket(paketku.paket, harga);
  const teksHarga = pemilik ? '—'
    : nilaiHarga !== null ? usd(nilaiHarga)
    : paketku.paket === 'pratinjau' || paketku.paket === 'gratis' ? 'Gratis'
    : '—';

  const labelPaket = pemilik ? 'Pemilik' : LABEL_PAKET[paketku.paket];
  const warnaPaket = pemilik ? 'bg-amber-400/15 text-amber-300'
    : paketku.paket === 'tahunan' ? 'bg-amber-400/15 text-amber-300'
    : paketku.paket === 'premium3' ? 'bg-violet-500/15 text-violet-300'
    : paketku.paket === 'testing' ? 'bg-sky-500/15 text-sky-300'
    : paketku.paket === 'pratinjau' ? 'bg-zinc-700/60 text-zinc-300'
    : 'bg-zinc-800 text-zinc-400';

  return (
    <motion.div
      variants={kartu} initial="awal" animate="masuk"
      className="max-h-[calc(100vh-5rem)] w-[320px] overflow-y-auto overflow-x-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
    >
      {/* ── Banner ──────────────────────────────────────────────────────
          Tanpa gambar ia TIDAK kosong melainkan gradien — kotak abu polos
          setinggi 96 px di puncak kartu terbaca sebagai gambar yang gagal
          dimuat, bukan sebagai tempat yang memang belum diisi. */}
      <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950">
        {profil.banner && (
          <img src={profil.banner} alt="" referrerPolicy="no-referrer"
               className="size-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 to-transparent" />
      </div>

      {/* Avatar menimpa tepi bawah banner, persis seperti acuannya. Cincin
          setebal 4 px berwarna latar kartu yang memisahkannya dari banner —
          tanpa itu foto gelap di atas banner gelap menyatu jadi satu noda. */}
      <div className="relative -mt-8 flex justify-center">
        <AvatarAnalis
          nama={nama} foto={fotoTampil} uid={pengguna.uid}
          className="size-16 ring-4 ring-zinc-950"
          kelasHuruf="text-[20px]"
        />
      </div>

      <div className="px-4 pb-4 pt-3">
        {/* Nama & email di kiri, identitas paket di kanan — menempati slot
            yang di acuannya berisi ikon peralatan. Paketnya memang jawaban
            atas pertanyaan yang sama: dengan apa orang ini bekerja. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-zinc-100" title={nama}>{nama}</div>
            <div className="truncate text-[11.5px] text-zinc-500" title={pengguna.email ?? ''}>
              {pengguna.email}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {memuatPaket && !pemilik ? (
              <span className="h-[19px] w-16 animate-pulse rounded bg-zinc-800" aria-hidden />
            ) : (
              <span className={cn('max-w-[110px] truncate rounded px-1.5 py-0.5 text-[10.5px]', warnaPaket)}
                    title={labelPaket}>
                {labelPaket}
              </span>
            )}
            <span className="text-[10px] text-zinc-600">paket</span>
          </div>
        </div>

        {/* ── Tiga angka ─────────────────────────────────────────────── */}
        <div className="mt-3.5 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-1 py-2.5">
          <Angka nilai={sisa} label="sisa"
                 warna={pemilik ? 'text-amber-300'
                   : langganan.status === 'habis' ? 'text-red-400'
                   : langganan.status === 'aktif' ? 'text-emerald-400' : undefined} />
          <Garis />
          <Angka nilai={berakhir} label="berakhir" />
          <Garis />
          <Angka nilai={teksHarga} label={satuanPaket(paketku.paket, harga) || 'harga'} />
        </div>

        {/* Padanan rupiah di baris sendiri, bukan di dalam kotak: ia
            keterangan atas angka dolar di atasnya, dan menaruh dua angka
            di satu sel membuat keduanya sama-sama sulit dibaca.
            rupiah() memulangkan untai kosong kalau kursnya belum datang
            dari server — barisnya ikut hilang, tidak menyisakan "≈ Rp"
            yang menggantung. */}
        {!pemilik && nilaiHarga !== null && rupiah(nilaiHarga, harga.kursUsd) && (
          <div className="mt-1.5 text-center text-[10.5px] text-zinc-600">
            {rupiah(nilaiHarga, harga.kursUsd)}
          </div>
        )}

        {/* Pemilik tidak punya tagihan dan tidak perlu meminta akses —
            keduanya tautan menuju halaman yang tidak menjawab apa pun
            untuknya. */}
        {!pemilik && (
          <Link to={langganan.status === 'aktif' ? '/billing' : '/akses'} onClick={tutup}
                className="mt-2.5 flex items-center justify-center gap-1 text-[12px] text-zinc-300 transition-colors hover:text-zinc-100">
            {langganan.status === 'aktif' ? 'Kelola tagihan' : 'Minta akses penuh'}
            <ChevronRight className="size-3" />
          </Link>
        )}

        {/* ── Pengaturan gambar ──────────────────────────────────────── */}
        <div className="mt-3.5 border-t border-zinc-800 pt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-600">Tampilan profil</div>
          <div className="flex items-center gap-2">
            <TombolGambar jenis="foto" label="Foto" ikon={UserRound}
                          ada={!!profil.foto} sibuk={sibuk} pilih={pilihGambar} hapus={buangGambar} />
            <TombolGambar jenis="banner" label="Banner" ikon={IkonGambar}
                          ada={!!profil.banner} sibuk={sibuk} pilih={pilihGambar} hapus={buangGambar} />
          </div>
          {/* Galatnya ditulis apa adanya. Pesan server sudah menyebut
              ukuran berkasnya kalau kebesaran; menggantinya dengan "gagal"
              membuang satu-satunya petunjuk yang bisa ditindaklanjuti. */}
          {galat && <p className="mt-1.5 text-[11px] leading-relaxed text-red-400">{galat}</p>}
        </div>

        <button
          onClick={() => { tutup(); void keluar(); }}
          className="mt-3.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-zinc-100 py-2.5 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white"
        >
          <LogOut className="size-3.5" /> Keluar
        </button>
      </div>
    </motion.div>
  );
}
