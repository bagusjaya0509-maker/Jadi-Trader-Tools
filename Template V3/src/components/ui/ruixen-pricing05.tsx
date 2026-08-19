"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHargaPaket, usd } from "@/lib/harga-akses";

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
          popular: false,
          inverse: false,
          features: [
            "Akses penuh, tanpa potongan fitur",
            "Chart replay + eksekusi order",
            "Screener SMI & SNR",
            "Jurnal otomatis dari broker",
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
      popular: true,
      inverse: true,
      features: [
        "Semua yang ada di paket gratis",
        "Tidak perlu menunggu kuota gratis",
        "Copy Signal + rekam jejak analis",
        "Sambungan Binance Futures & MetaTrader 5",
      ],
    },
    {
      title: "Premium 3 Bulan",
      price: usd(h.hargaPremium3),
      strike: 0,
      unit: "/ 3 bulan",
      note: "Untuk yang sudah cocok dan tidak mau memperpanjang tiap bulan.",
      buttonText: "Ambil paket 3 bulan",
      popular: false,
      inverse: false,
      features: [
        "Isi sama dengan paket bulanan",
        "Tanpa perpanjangan tiap 30 hari",
        "Prioritas jawaban dukungan",
        "Ikut menentukan urutan pengerjaan fitur",
      ],
    },
    {
      title: "Tahunan",
      price: usd(h.hargaTahunan),
      strike: 0,
      unit: "/ 12 bulan",
      note: "Paling murah per bulannya.",
      buttonText: "Ambil paket tahunan",
      popular: false,
      inverse: false,
      features: [
        "Isi sama dengan paket lain",
        "Harga terkunci satu tahun penuh",
        "Prioritas jawaban dukungan",
        "Akses lebih dulu ke fitur yang belum rilis",
      ],
    },
  ];

  return (
    <section className="py-24 bg-white dark:bg-background">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Satu produk, beberapa lama pakai
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Isinya sama di semua paket. Yang berbeda cuma berapa lama berlakunya —
            dan berapa banyak yang bisa masuk.
          </p>
        </div>

        <div className="flex flex-col gap-6 items-center mt-12 lg:flex-row lg:items-end lg:justify-center">
          {pricingTiers.map(({ title, price, strike, unit, note, buttonText, popular, features, inverse }) => (
            <Card
              key={title}
              className={`max-w-xs w-full border ${inverse ? "bg-black text-white" : ""}`}
            >
              <CardHeader className="flex justify-between items-start">
                <CardTitle className={`text-lg font-bold ${inverse ? "text-white/70" : "text-muted-foreground"}`}>
                  {title}
                </CardTitle>
                {popular && (
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
                <Button
                  variant={inverse ? "secondary" : "default"}
                  className="w-full mt-6"
                  asChild
                >
                  {/* Semua menuju /akses, bukan langsung ke checkout: centang
                      persetujuan risiko ada di halaman itu, dan jalan pintas
                      ke pembayaran akan melewatinya. */}
                  <a href="/akses">{buttonText}</a>
                </Button>
                <ul className="flex flex-col gap-4 mt-6 text-sm">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-10 text-center text-xs leading-relaxed text-muted-foreground">
          Jadi Trader Tools adalah perangkat bantu analisa dan pencatatan. Bukan penasihat
          investasi, bukan pengelola dana, dan tidak menjanjikan hasil apa pun.
        </p>
      </div>
    </section>
  );
}
