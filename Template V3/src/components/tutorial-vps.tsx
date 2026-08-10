import { useState } from 'react';
import { Copy, Check, ChevronDown, TriangleAlert, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   TUTORIAL PEMASANGAN — API Binance → VPS → order pertama
   ════════════════════════════════════════════════════════════════════════
   Perintahnya BUKAN contoh karangan. Nama env, nama header, dan rute yang
   dipakai di sini diambil dari server.js yang sesungguhnya:
   APP_TOKEN, BINANCE_API_KEY, BINANCE_API_SECRET, BINANCE_BASE_URL,
   header X-App-Token, dan rute /api/health serta /api/account.
   Tutorial yang perintahnya "kira-kira begini" lebih buruk daripada tidak
   ada tutorial — orang menyalinnya, gagal, lalu berhenti percaya.

   "Contoh tampilan" digambar sebagai SVG, bukan tangkapan layar asli. Dua
   alasan: tangkapan layar Binance basi tiap kali mereka mengubah tata letak,
   dan tangkapan layar terminal milik sendiri hampir selalu tanpa sengaja
   memuat sesuatu yang tidak boleh dilihat orang.
   ════════════════════════════════════════════════════════════════════════ */

function Kode({ teks, bahasa = 'bash' }: { teks: string; bahasa?: string }) {
  const [salin, setSalin] = useState(false);
  return (
    <div className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-600">{bahasa}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(teks).catch(() => {});
            setSalin(true);
            setTimeout(() => setSalin(false), 1600);
          }}
          className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          {salin ? <><Check className="size-3 text-emerald-500" /> Tersalin</> : <><Copy className="size-3" /> Salin</>}
        </button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-zinc-300">{teks}</pre>
    </div>
  );
}

function Catatan({ jenis = 'tip', children }: { jenis?: 'tip' | 'awas'; children: React.ReactNode }) {
  const awas = jenis === 'awas';
  const Ikon = awas ? TriangleAlert : Lightbulb;
  return (
    <div className={cn(
      'flex gap-2.5 rounded-lg border p-3',
      awas ? 'border-amber-500/25 bg-amber-500/[0.06]' : 'border-zinc-800 bg-zinc-900/40'
    )}>
      <Ikon className={cn('mt-0.5 size-3.5 shrink-0', awas ? 'text-amber-400' : 'text-zinc-500')} strokeWidth={2} />
      <div className={cn('text-[12.5px] leading-relaxed', awas ? 'text-zinc-300' : 'text-zinc-400')}>{children}</div>
    </div>
  );
}

function Layar({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-1.5 border-b border-zinc-800/80 px-3 py-2">
        <span className="size-2 rounded-full bg-zinc-700" />
        <span className="size-2 rounded-full bg-zinc-700" />
        <span className="size-2 rounded-full bg-zinc-700" />
        <span className="ml-2 truncate font-mono text-[10.5px] text-zinc-600">{judul}</span>
      </div>
      {children}
    </div>
  );
}

/** Contoh tampilan halaman API Management Binance saat izinnya sudah benar. */
function MockApi() {
  const izin: [string, boolean][] = [
    ['Enable Reading', true],
    ['Enable Futures', true],
    ['Enable Spot & Margin Trading', false],
    ['Enable Withdrawals', false],
  ];
  return (
    <Layar judul="binance.com › API Management">
      <svg viewBox="0 0 420 196" className="block w-full" style={{ height: 196 }} aria-hidden>
        <text x="16" y="24" fill="#e4e4e7" fontSize="11" fontFamily="IBM Plex Sans" fontWeight="600">jaditrader-vps</text>
        <rect x="16" y="32" width="388" height="26" rx="4" fill="#18181b" />
        <text x="24" y="49" fill="#71717a" fontSize="8.5" fontFamily="IBM Plex Mono">API Key</text>
        <text x="86" y="49" fill="#a1a1aa" fontSize="8.5" fontFamily="IBM Plex Mono">7hK2••••••••••••••••••••••••••••••4pQ</text>

        <text x="16" y="78" fill="#71717a" fontSize="9" fontFamily="IBM Plex Sans">API restrictions</text>

        {izin.map(([nama, on], i) => (
          <g key={nama} transform={`translate(16, ${88 + i * 22})`}>
            <rect x="0" y="0" width="12" height="12" rx="3"
                  fill={on ? '#10b981' : 'none'} stroke={on ? '#10b981' : '#52525b'} strokeWidth="1.2" />
            {on && <path d="M3 6 L5.2 8.4 L9 3.6" stroke="#09090b" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
            <text x="20" y="10" fill={on ? '#e4e4e7' : '#71717a'} fontSize="9.5" fontFamily="IBM Plex Sans">{nama}</text>
            {nama === 'Enable Withdrawals' && (
              <>
                <rect x="150" y="-2" width="122" height="16" rx="4" fill="#ef4444" opacity=".14" />
                <text x="158" y="10" fill="#f87171" fontSize="8.5" fontFamily="IBM Plex Mono">jangan pernah dicentang</text>
              </>
            )}
          </g>
        ))}

        <rect x="16" y="176" width="388" height="1" fill="#27272a" />
        <text x="16" y="192" fill="#10b981" fontSize="8.5" fontFamily="IBM Plex Mono">
          ● Restrict access to trusted IPs only — 103.253.145.38
        </text>
      </svg>
    </Layar>
  );
}

/** Contoh keluaran pm2 setelah backend berjalan. */
function MockPm2() {
  const baris: [string, string][] = [
    ['$ pm2 start server.js --name jt-backend', '#a1a1aa'],
    ['[PM2] Starting /root/jaditrader/server.js in fork_mode', '#71717a'],
    ['[PM2] Done.', '#71717a'],
    ['', '#71717a'],
    ['  id  name         mode   status   cpu    memory', '#71717a'],
    ['  0   jt-backend   fork   online   0%     58.4mb', '#10b981'],
    ['', '#71717a'],
    ['$ pm2 logs jt-backend --lines 3', '#a1a1aa'],
    ['Server jalan di port 4000', '#e4e4e7'],
    ['Base URL: https://testnet.binancefuture.com', '#ffcd75'],
  ];
  return (
    <Layar judul="root@vps:~/jaditrader">
      <svg viewBox="0 0 420 168" className="block w-full" style={{ height: 168 }} aria-hidden>
        {baris.map(([t, w], i) => (
          <text key={i} x="14" y={20 + i * 15} fill={w} fontSize="9" fontFamily="IBM Plex Mono">{t}</text>
        ))}
        <rect className="peraga-kursor" x="14" y={20 + baris.length * 15 - 8} width="6" height="10" fill="#fafafa" />
      </svg>
    </Layar>
  );
}

/** Contoh jawaban /api/health saat semuanya sudah benar. */
function MockSehat() {
  return (
    <Layar judul="https://103-253-145-38.sslip.io/api/health">
      <svg viewBox="0 0 420 92" className="block w-full" style={{ height: 92 }} aria-hidden>
        <rect x="14" y="14" width="72" height="18" rx="4" fill="#10b981" opacity=".14" />
        <text x="24" y="27" fill="#10b981" fontSize="9" fontFamily="IBM Plex Mono">200 OK</text>
        <text x="96" y="27" fill="#71717a" fontSize="9" fontFamily="IBM Plex Mono">gembok HTTPS hijau</text>
        <text x="14" y="54" fill="#e4e4e7" fontSize="10.5" fontFamily="IBM Plex Mono">{'{'}</text>
        <text x="30" y="70" fill="#e4e4e7" fontSize="10.5" fontFamily="IBM Plex Mono">
          <tspan fill="#7dd3fc">"ok"</tspan>: <tspan fill="#10b981">true</tspan>,
          <tspan fill="#7dd3fc"> "baseUrl"</tspan>: <tspan fill="#ffcd75">"https://testnet.binancefuture.com"</tspan>
        </text>
        <text x="14" y="86" fill="#e4e4e7" fontSize="10.5" fontFamily="IBM Plex Mono">{'}'}</text>
      </svg>
    </Layar>
  );
}

interface Langkah {
  judul: string;
  ringkas: string;
  isi: React.ReactNode;
}

const LANGKAH: Langkah[] = [
  {
    judul: 'Buat API key di Binance',
    ringkas: 'Reading + Futures dicentang, Withdrawals tidak. Kunci ke IP VPS.',
    isi: (
      <>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Masuk ke Binance → menu akun → <span className="text-zinc-200">API Management</span> →
          <span className="text-zinc-200"> Create API</span> → pilih <span className="text-zinc-200">System generated</span>.
          Beri nama yang menjelaskan tempatnya dipakai, misalnya <span className="text-zinc-200">jaditrader-vps</span>,
          supaya kalau suatu saat harus dicabut kamu tahu mana yang mati.
        </p>
        <MockApi />
        <Catatan jenis="awas">
          <span className="font-medium text-amber-300">Enable Withdrawals jangan pernah dicentang.</span> Backend
          ini tidak punya satu pun rute penarikan dana, jadi mencentangnya tidak menambah kemampuan apa pun —
          hanya menambah kerugian kalau key-nya bocor. Isi juga <span className="text-zinc-200">Restrict access
          to trusted IPs</span> dengan IP VPS-mu.
        </Catatan>
        <Catatan>
          Secret hanya ditampilkan <span className="text-zinc-200">sekali</span>. Simpan langsung ke pengelola
          kata sandi; kalau terlewat, key-nya harus dihapus dan dibuat ulang.
        </Catatan>
      </>
    ),
  },
  {
    judul: 'Sewa VPS',
    ringkas: 'Ubuntu 22.04, 1 vCPU / 1 GB sudah cukup. Region Singapura.',
    isi: (
      <>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Backend ini kecil — di VPS 1 GB ia berjalan di sekitar 60 MB. Yang lebih menentukan bukan
          spesifikasi melainkan <span className="text-zinc-200">lokasinya</span>: matchmaking engine
          Binance Futures ada di Tokyo, jadi Singapura memberi latensi 60–100 ms sementara Jakarta bisa
          dua kali lipat. Penyedia mana pun boleh — Contabo, Hetzner, Vultr, DigitalOcean.
        </p>
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          {[
            ['Sistem operasi', 'Ubuntu 22.04 atau 24.04 LTS'],
            ['CPU / RAM', '1 vCPU · 1 GB (2 GB kalau juga menjalankan Caddy + log)'],
            ['Region', 'Singapura — terdekat ke endpoint Binance'],
            ['Port yang dibuka', '22 (SSH), 80 dan 443 (HTTPS)'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3 border-b border-zinc-800/60 px-3.5 py-2.5 last:border-0">
              <span className="w-[110px] shrink-0 text-[12px] text-zinc-500">{k}</span>
              <span className="text-[12.5px] text-zinc-300">{v}</span>
            </div>
          ))}
        </div>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Masuk lewat SSH, lalu buka firewall-nya:
        </p>
        <Kode teks={`ssh root@IP_VPS_KAMU

sudo ufw allow 22/tcp
sudo ufw allow 80,443/tcp
sudo ufw --force enable`} />
      </>
    ),
  },
  {
    judul: 'Pasang Node.js 20',
    ringkas: 'Node bawaan apt terlalu tua untuk backend ini.',
    isi: (
      <>
        <Kode teks={`sudo apt update && sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v      # harus v20.x
npm -v`} />
        <Catatan>
          <K>apt install nodejs</K> tanpa baris NodeSource memasang v12 di Ubuntu 22.04.
          Backend ini memakai <K>fetch</K> bawaan dan optional chaining — keduanya belum ada di v12,
          dan errornya (<K>SyntaxError: Unexpected token '?'</K>) tidak menyebut versi sama sekali.
        </Catatan>
      </>
    ),
  },
  {
    judul: 'Taruh backend & pasang dependensi',
    ringkas: 'Salin folder binance-trading-backend ke VPS, lalu npm install.',
    isi: (
      <>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Dari komputermu sendiri, kirim foldernya ke VPS:
        </p>
        <Kode teks={`# jalankan di komputer kamu, bukan di VPS
scp -r binance-trading-backend root@IP_VPS_KAMU:~/jaditrader`} />
        <p className="text-[13px] leading-relaxed text-zinc-400">Lalu di VPS:</p>
        <Kode teks={`cd ~/jaditrader
npm install --omit=dev`} />
      </>
    ),
  },
  {
    judul: 'Buat APP_TOKEN acak',
    ringkas: 'Kata sandi antara peramban dan VPS. Bukan API key Binance.',
    isi: (
      <>
        <Kode teks={`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`} />
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Keluarannya 64 karakter heksadesimal. Salin — nilai yang sama dipakai dua kali: di
          <K>.env</K> pada langkah berikutnya, dan di kolom <span className="text-zinc-200">App Token</span> di
          halaman ini.
        </p>
        <Catatan jenis="awas">
          Jangan memakai kata sandi buatan sendiri. Token ini adalah satu-satunya yang berdiri antara
          internet terbuka dan tombol kirim order di akun Binance-mu.
        </Catatan>
      </>
    ),
  },
  {
    judul: 'Isi berkas .env',
    ringkas: 'Empat baris. Mulai dari testnet, pindah ke live belakangan.',
    isi: (
      <>
        <Kode bahasa="ini" teks={`# ~/jaditrader/.env
BINANCE_API_KEY=tempel_api_key_dari_langkah_1
BINANCE_API_SECRET=tempel_secret_dari_langkah_1
APP_TOKEN=tempel_64_karakter_dari_langkah_5
PORT=4000

# Uang sungguhan baru dipakai setelah baris ini diubah:
# BINANCE_BASE_URL=https://fapi.binance.com`} />
        <Catatan jenis="awas">
          Tanpa <K>BINANCE_BASE_URL</K>, backend memakai <span className="text-zinc-200">testnet</span> —
          itu bawaannya, dan disengaja. Uji seluruh alurnya di testnet dulu: kirim order, pasang SL/TP,
          tutup posisi. Baru setelah semuanya benar, buka komentar baris terakhir dan
          <K>pm2 restart jt-backend</K>. API key testnet dan live berbeda; keduanya harus ikut diganti.
        </Catatan>
        <Kode teks={`chmod 600 ~/jaditrader/.env    # hanya root yang boleh membacanya`} />
      </>
    ),
  },
  {
    judul: 'Jalankan dengan pm2',
    ringkas: 'Supaya backend hidup lagi setelah VPS di-reboot.',
    isi: (
      <>
        <Kode teks={`sudo npm install -g pm2
cd ~/jaditrader
pm2 start server.js --name jt-backend
pm2 save
pm2 startup        # salin perintah yang muncul, lalu jalankan
pm2 logs jt-backend --lines 20`} />
        <MockPm2 />
        <Catatan>
          <K>pm2 startup</K> mencetak satu perintah <K>sudo env PATH=...</K> yang harus kamu salin
          dan jalankan. Melewatinya membuat backend mati diam-diam setelah reboot pertama —
          dan itu baru ketahuan saat order ditolak.
        </Catatan>
      </>
    ),
  },
  {
    judul: 'Pasang HTTPS dengan Caddy',
    ringkas: 'sslip.io memberi nama domain dari IP, jadi tidak perlu beli domain.',
    isi: (
      <>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Peramban menolak memanggil <K>http://</K> dari halaman <K>https://</K>. Backend harus punya
          sertifikat, dan sertifikat butuh nama domain. <span className="text-zinc-200">sslip.io</span> menyelesaikan
          keduanya tanpa biaya: <K>103-253-145-38.sslip.io</K> otomatis mengarah ke <K>103.253.145.38</K>.
        </p>
        <Kode teks={`sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \\
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \\
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy`} />
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Ganti isi <K>/etc/caddy/Caddyfile</K> — tulis IP VPS-mu dengan tanda hubung:
        </p>
        <Kode bahasa="caddyfile" teks={`103-253-145-38.sslip.io {
    reverse_proxy localhost:4000
}`} />
        <Kode teks={`sudo systemctl reload caddy
sudo systemctl status caddy --no-pager`} />
        <Catatan>
          Sertifikat Let's Encrypt terbit sendiri dalam beberapa detik dan diperbarui otomatis.
          Kalau gagal, hampir selalu karena port 80 masih tertutup — Let's Encrypt memverifikasi lewat
          port itu, bukan 443.
        </Catatan>
      </>
    ),
  },
  {
    judul: 'Uji sambungannya',
    ringkas: 'Dua permintaan: satu tanpa token, satu dengan token.',
    isi: (
      <>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          <K>/api/health</K> terbuka untuk umum — ia hanya membuktikan servernya hidup:
        </p>
        <Kode teks={`curl -s https://103-253-145-38.sslip.io/api/health`} />
        <MockSehat />
        <p className="text-[13px] leading-relaxed text-zinc-400">
          <K>/api/account</K> butuh token. Kalau baris ini mengembalikan saldo, seluruh rantainya sudah benar
          — peramban, Caddy, backend, sampai Binance:
        </p>
        <Kode teks={`curl -s https://103-253-145-38.sslip.io/api/account \\
  -H "X-App-Token: TOKEN_64_KARAKTER_KAMU"`} />
        <Catatan jenis="awas">
          Jawaban <K>401 Token tidak valid</K> berarti token di perintah ini berbeda dengan
          <K>APP_TOKEN</K> di <K>.env</K>. Setelah mengubah <K>.env</K>, wajib
          <K>pm2 restart jt-backend</K> — proses lama masih memegang nilai lama, dan inilah penyebab
          401 yang paling sering.
        </Catatan>
      </>
    ),
  },
  {
    judul: 'Isikan di halaman ini',
    ringkas: 'Backend URL + App Token, lalu Open Real Order terbuka.',
    isi: (
      <>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Kembali ke kartu <span className="text-zinc-200">Binance Futures</span> di atas. Isi
          <span className="text-zinc-200"> Backend URL</span> dengan alamat sslip.io lengkap beserta
          <K>https://</K>, dan <span className="text-zinc-200">App Token</span> dengan 64 karakter dari
          langkah 5. Tekan <span className="text-zinc-200">Simpan &amp; Uji</span>.
        </p>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Setelah tersimpan, tombol <span className="text-zinc-200">Open Real Order</span> di Area Entry
          berhenti menolak dan siap mengirim order.
        </p>
        <Catatan>
          Keduanya disimpan di localStorage peramban ini saja. Berganti peramban atau perangkat berarti
          mengisinya lagi — itu konsekuensi dari tidak pernah menitipkan token akun Binance-mu ke server
          orang lain, termasuk server kami.
        </Catatan>
      </>
    ),
  },
];

function K({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[11.5px] text-zinc-200">{children}</code>;
}

export function TutorialVps() {
  const [buka, setBuka] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {LANGKAH.map((l, i) => {
        const aktif = buka === i;
        return (
          <div key={l.judul} className={cn(
            'overflow-hidden rounded-lg border transition-colors',
            aktif ? 'border-zinc-700 bg-zinc-900/40' : 'border-zinc-800/70'
          )}>
            <button
              onClick={() => setBuka(aktif ? null : i)}
              aria-expanded={aktif}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-900/60"
            >
              <span className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
                aktif ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-700 bg-zinc-900 text-zinc-400'
              )}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-zinc-100">{l.judul}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-zinc-500">{l.ringkas}</span>
              </span>
              <ChevronDown className={cn(
                'size-4 shrink-0 text-zinc-500 transition-transform duration-200',
                aktif && 'rotate-180'
              )} />
            </button>

            {aktif && (
              <div className="space-y-3 border-t border-zinc-800/70 px-4 py-4 sm:px-[52px]">
                {l.isi}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
