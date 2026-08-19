"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const pricingTiers = [
  {
    title: "Starter",
    monthlyPrice: 0,
    buttonText: "Start free",
    popular: false,
    inverse: false,
    features: [
      "Up to 5 team members",
      "Unlimited content projects",
      "2GB storage",
      "Basic integrations",
      "Community support",
    ],
  },
  {
    title: "Pro",
    monthlyPrice: 9,
    buttonText: "Upgrade now",
    popular: true,
    inverse: true,
    features: [
      "Up to 50 team members",
      "Unlimited AI-generated content",
      "50GB storage",
      "All integrations",
      "Priority support",
      "Content export",
      "Keyword analytics",
    ],
  },
  {
    title: "Business",
    monthlyPrice: 19,
    buttonText: "Contact sales",
    popular: false,
    inverse: false,
    features: [
      "Unlimited team members",
      "200GB storage",
      "Dedicated AI workflows",
      "Custom branding",
      "Dedicated support manager",
      "API access",
      "Enterprise-grade security",
    ],
  },
];

export default function Pricing_05() {
  return (
    <section className="py-24 bg-white dark:bg-background">
      {/* `container` diganti pembungkus yang sama dengan bagian-bagian lain
          halaman ini. Dua sebab, keduanya terukur:

          1. Di Tailwind v4 `container` HANYA memasang max-width bertingkat —
             tidak ada margin-inline:auto, tidak ada padding. (Di v3 dulu bisa
             dinyalakan lewat `center: true` di konfigurasi; v4 tidak punya
             berkas konfigurasi itu.) Jadi di layar lebih lebar dari 1280px
             kotaknya menempel KIRI dengan ruang kosong menganga di kanan.
          2. Tanpa padding, di layar 1280px ke bawah isinya menyentuh tepi
             jendela — sementara FeaturesGrid tepat di atasnya berjarak 59px.
             Dua bagian bersebelahan dengan garis tepi berbeda terbaca sebagai
             salah pasang, bukan sebagai variasi.

          max-w-6xl px-6 md:px-8 persis sama dengan FeaturesGrid dan footer,
          jadi ketiganya berbagi satu garis tepi. */}
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple pricing for every team
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Whether you're starting small or scaling fast, Ruixen UI grows with your content needs.
          </p>
        </div>

        {/* lg:items-end — bawaan bloknya, dikembalikan.

            Sempat saya ganti items-stretch karena puncak kartunya bergerigi
            dan terbaca seperti salah pasang. Itu keliru: ketidaksejajaran itu
            memang rancangannya, dan yang membuat halaman terlihat miring
            waktu itu adalah `container` yang tidak memusat (sudah diperbaiki
            di baris pembungkus di atas), bukan kartunya.

            items-stretch juga membawa akibatnya sendiri: semua kartu dipaksa
            setinggi yang terpanjang, jadi Starter yang isinya lima baris
            berakhir dengan ruang kosong menganga di bawah daftarnya. Rata
            bawah membuat tiap kartu setinggi isinya sendiri, dan garis dasar
            yang sama itulah yang mengikat ketiganya. */}
        <div className="flex flex-col gap-6 items-center mt-12 lg:flex-row lg:items-end lg:justify-center">
          {pricingTiers.map(({ title, monthlyPrice, buttonText, popular, features, inverse }) => (
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
                  <span className="text-4xl font-bold tracking-tighter leading-none">${monthlyPrice}</span>
                  <span className={`tracking-tight font-semibold ${inverse ? "text-white/60" : "text-muted-foreground"}`}>
                    /month
                  </span>
                </div>
                <Button
                  variant={inverse ? "secondary" : "default"}
                  className="w-full mt-6"
                >
                  {buttonText}
                </Button>
                <ul className="flex flex-col gap-4 mt-6 text-sm">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      {/* You can add a check icon here if needed */}
                      <span>{feature}</span>
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
