"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHargaPaket, usd, BATAS } from "@/lib/harga-akses";

/* Isi kartu diisi dari setelan yang hidup di server (lihat lib/harga-akses).
   Rangka, kelas, dan gerakan lencananya tetap seperti blok aslinya. */

export default function Pricing_05() {
  const h = useHargaPaket();

  /* Kartu event gratis TIDAK selalu ada. Ia hilang sendiri kalau salah satu
     dari tiga hal berlaku: pemiliknya mematikannya dari Maintenance,
     pendaftaran ditutup, atau kuota gratisnya habis.

     Yang terakhir yang paling penting dan paling gampang terlewat: kartu
     bertuliskan "gratis, kuota 20 orang" yang masih terpampang setelah
     orang ke-20 mendaftar adalah janji yang sudah tidak bisa ditepati, dan
     orang yang menekannya sampai ke halaman Akses cuma untuk diberi tahu
     bahwa tempatnya habis. */
  const adaEvent = h.eventGratis && h.bukaPermintaan && !h.gratisHabis;

  const pricingTiers = [
    ...(adaEvent
      ? [{
          title: "Event Terbatas",
          price: usd(0),
          strike: 0,
          unit: `/ ${h.hari} hari`,
          note: `Kuota ${h.gratisTotal} orang — sisa ${h.gratisSisa}. Hilang sendiri saat penuh.`,
          buttonText: "Ambil tempat gratis",
          /* Event gratis tidak butuh checkout — pendaftarannya lewat
             halaman Akses, jadi ia selalu tersedia selama kartunya tampil. */
          link: "/akses",
          popular: false,
          inverse: false,
          features: [
            { t: "Chart & jurnal penuh selama masa aktif" },
            { t: `Screener ${BATAS.gratis.screener} kali pakai` },
            { t: `Replay chart ${BATAS.gratis.replay} kali pakai` },
            { t: "Sambungan Binance Futures & MetaTrader 5" },
            { t: "Copy Signal", no: true },
            { t: "Indikator & EA marketplace", no: true },
          ],
        }]
      : []),
    {
      title: "Testing — New Launch",
      price: usd(h.hargaTesting),
      strike: h.hargaTestingCoret,
      unit: `/ ${h.hari} hari`,
      note: "Harga perkenalan selama masa uji coba peluncuran.",
      buttonText: "Ambil sekarang",
      /* Paket bulanan SUDAH bisa dibeli lewat halaman Akses hari ini, jadi
         halaman Akses yang jadi cadangannya kalau tautan khusus belum
         diisi. Dua paket di bawah tidak punya cadangan seperti itu. */
      link: h.linkTesting || "/akses",
      popular: true,
      inverse: true,
      features: [
        { t: "Semua yang ada di paket gratis" },
        { t: `Screener ${BATAS.testing.screener} kali — 5x paket gratis` },
        { t: `Replay chart ${BATAS.testing.replay} kali — 5x paket gratis` },
        { t: "Copy Signal + rekam jejak analis" },
        { t: "Tidak perlu menunggu kuota gratis" },
        { t: "Indikator & EA marketplace", no: true },
      ],
    },
    {
      title: "Premium 3 Bulan",
      price: usd(h.hargaPremium3),
      strike: 0,
      unit: "/ 3 bulan",
      note: "Batas hitungan dibuka. Pakai sepuasnya sampai masa aktif habis.",
      buttonText: "Ambil paket 3 bulan",
      link: h.linkPremium3,
      popular: false,
      inverse: false,
      features: [
        { t: "Screener tanpa batas hitungan" },
        { t: "Replay chart tanpa batas hitungan" },
        { t: "Copy Signal + rekam jejak analis" },
        { t: "Tanpa perpanjangan tiap 30 hari" },
        { t: "Indikator & EA marketplace", no: true },
      ],
    },
    {
      title: "Tahunan",
      price: usd(h.hargaTahunan),
      strike: 0,
      unit: "/ 12 bulan",
      note: "Satu-satunya paket yang membuka isi Marketplace tanpa membeli satuan.",
      buttonText: "Ambil paket tahunan",
      link: h.linkTahunan,
      popular: false,
      inverse: false,
      features: [
        { t: "Semua yang ada di Premium 3 Bulan" },
        { t: "Akses penuh SELURUH indikator & EA di Marketplace" },
        { t: "Termasuk rilis baru selama masa aktif" },
        { t: "Harga terkunci satu tahun penuh" },
      ],
    },
  ];

  return (
    <section className="py-24 bg-white dark:bg-background">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Pilih Akses Sesuai Kebutuhanmu
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Mulai gratis, coba lebih banyak fitur, atau gunakan akses penuh untuk
            kebutuhan trading yang lebih serius.
          </p>
        </div>

        <div className="flex flex-col gap-6 items-center mt-12 lg:flex-row lg:items-end lg:justify-center">
          {pricingTiers.map(({ title, price, strike, unit, note, buttonText, link, popular, features, inverse }) => (
            <Card
              key={title}
              className={`max-w-xs w-full border ${inverse ? "bg-black text-white" : ""}`}
            >
              <CardHeader className="flex justify-between items-start">
                <CardTitle className={`text-lg font-bold ${inverse ? "text-white/70" : "text-muted-foreground"}`}>
                  {title}
                </CardTitle>
                {/* Label "Available soon" menggantikan lencana Popular saat
                    paketnya belum bisa dibeli. Tidak ditumpuk berdua: satu
                    kartu yang sekaligus "paling banyak dipilih" dan "belum
                    tersedia" tidak menyatakan apa pun. */}
                {!link && (
                  <span className="text-sm px-3 py-1 rounded-xl border border-white/15 text-muted-foreground font-medium">
                    Available soon
                  </span>
                )}
                {link && popular && (
                  <motion.div
                    animate={{ backgroundPositionX: "-100%" }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                      repeatType: "loop",
                    }}
                    className="text-sm px-3 py-1 rounded-xl border border-white/20 bg-[linear-gradient(to_right,#DD7DDF,#E1CD86,#BBCB92,#71C2EF,#3BFFFF)] [background-size:200%] text-transparent bg-clip-text font-medium"
                  >
                    Popular
                  </motion.div>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1 mt-2">
                  {/* Harga coret cuma digambar kalau memang ada. Coretan yang
                      nilainya nol atau sama dengan harga jualnya bukan diskon,
                      cuma hiasan yang mengaku diskon. */}
                  {strike > 0 && strike !== Number(price.replace("$", "")) && (
                    <span className={`text-lg font-medium line-through ${inverse ? "text-white/40" : "text-muted-foreground/60"}`}>
                      {usd(strike)}
                    </span>
                  )}
                  <span className="text-4xl font-bold tracking-tighter leading-none">{price}</span>
                  <span className={`tracking-tight font-semibold ${inverse ? "text-white/60" : "text-muted-foreground"}`}>
                    {unit}
                  </span>
                </div>
                <p className={`mt-2 text-xs leading-relaxed ${inverse ? "text-white/50" : "text-muted-foreground"}`}>
                  {note}
                </p>
                {/* Tombol MATI, bukan tombol hidup yang mengantar ke tempat
                    yang tidak menjual paket ini. Tombol yang bisa ditekan
                    tapi tidak mengantar ke mana-mana adalah cara tercepat
                    membuat orang mengira situsnya rusak.

                    Begitu tautannya diisi dari Maintenance, tombolnya hidup
                    sendiri — tidak perlu ganti kode, tidak perlu deploy. */}
                {link ? (
                  <Button
                    variant={inverse ? "secondary" : "default"}
                    className="w-full mt-6"
                    asChild
                  >
                    <a href={link}>{buttonText}</a>
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full mt-6"
                    disabled
                    title="Paket ini belum bisa dibeli — sedang disiapkan"
                  >
                    Available soon
                  </Button>
                )}
                {/* Yang TIDAK didapat ikut ditulis, dan itu bukan kelalaian.
                     Daftar yang cuma memuat yang didapat membuat pembaca
                     menebak sisanya — dan tebakan orang selalu ke arah yang
                     menguntungkan dirinya, sampai ia membayar dan kecewa.
                     Dicoret dan diredupkan supaya bedanya terbaca sekilas,
                     tanpa perlu membandingkan empat kartu baris per baris. */}
                <ul className="flex flex-col gap-3 mt-6 text-sm">
                  {features.map((f) => (
                    <li key={f.t} className="flex items-start gap-2">
                      <span className={`mt-px shrink-0 text-xs ${f.no ? "opacity-40" : "opacity-70"}`}>
                        {f.no ? "\u2715" : "\u2713"}
                      </span>
                      <span className={f.no ? "line-through opacity-40" : undefined}>{f.t}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    </section>
  );
}
