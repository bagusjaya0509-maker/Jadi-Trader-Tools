//+------------------------------------------------------------------+
//|  JadiTraderSyncV2.mq5                                            |
//|  TRADE-FI SYNC v2 — jurnal + eksekusi perintah + chart ke web    |
//+------------------------------------------------------------------+
//  Versi 2 BUKAN lagi baca-saja, dan itu dikatakan terang-terangan:
//
//    1. JURNAL   (sama dengan v1)  : saldo, posisi, riwayat -> server.
//    2. PERINTAH (baru)            : mengambil antrean perintah dari
//       halaman web-mu — buka posisi, ubah SL/TP, tutup — lalu
//       MENGEKSEKUSINYA di akun ini dan melaporkan hasilnya balik.
//    3. CHART    (baru)            : mengirim OHLC simbol chart (mis.
//       XAUUSD) ke server, supaya halaman Chart & Backtest web bisa
//       menampilkan dan menguji data MT5 — berlabel "Trade-Fi".
//
//  PAGAR PENGAMAN
//    · IzinkanTrading = false MEMATIKAN seluruh jalur eksekusi; EA
//      kembali berperilaku persis seperti v1.
//    · LotMaks membatasi lot per perintah DI SISI EA — di atasnya
//      ditolak walau servernya meloloskan.
//    · Perintah yang berumur > 5 menit dibuang server sebelum sampai:
//      order yang tertunda lama bukan lagi keinginan pembuatnya.
//    · Perintah hanya bisa dibuat dari akun web yang login DAN memegang
//      Kode Pasangan ini — dua kunci, bukan satu.
//
//  CARA PASANG
//    1. Salin ke MQL5/Experts, Compile di MetaEditor (F7).
//    2. Isi input AlamatServer dengan alamat backend MILIKMU SENDIRI.
//       Bawaannya sengaja kosong: EA ini disebar, dan alamat bawaan
//       berarti akun pembelinya mengirim data ke mesin orang lain.
//    3. Tools -> Options -> Expert Advisors -> izinkan WebRequest ke
//       alamat itu, DAN centang "Allow Algo Trading".
//    3. Seret ke chart XAUUSD (chart yang dipakai menentukan simbol
//       yang dikirim ke web kalau SimbolChart dikosongkan).
//    4. Isi KodePasangan dari halaman Integrations situsmu, dan pastikan
//       tombol AutoTrading (Algo Trading) di toolbar MT5 menyala.
//+------------------------------------------------------------------+
#property copyright "Jadi Trader Tools"
#property version   "2.04"
#property strict
#property description "Trade-Fi Sync v2: jurnal + eksekusi perintah web + kirim chart MT5. Baca pagar pengamannya di kepala berkas."

#include <Trade\Trade.mqh>

input string KodePasangan     = "";                                  // Kode Pasangan dari halaman jurnal
input string AlamatServer     = "";                                  // Alamat server backend-mu, mis. https://server-anda.com (tanpa / di akhir)
input int    IntervalDetik    = 20;                                  // Jeda antar laporan jurnal (detik)
input int    HariRiwayat      = 60;                                  // Cadangan kalau tanggal di bawah kosong (hari)
input string MulaiDariTanggal = "2026.08.04";                        // Riwayat diambil mulai tanggal ini (YYYY.MM.DD)
input bool   IzinkanTrading   = true;                                // Eksekusi perintah dari web (false = baca-saja)
input double LotMaks          = 1.0;                                 // Lot maksimum per perintah
input string SimbolChart      = "";                                  // Simbol yang dikirim ke chart web (kosong = simbol chart ini)
input int    KirimChartMenit  = 5;                                   // Jeda kirim OHLC ke web (menit)
input bool   KirimTick        = true;                                // Kirim harga tiap detik (harga web = MT5)

#define VERSI_EA "2.04"
#define PFX      "JTS_"

CTrade   gTrade;

int      gGagalBerturut   = 0;
string   gStatus          = "Menyiapkan...";
string   gPesan           = "";
color    gWarnaStatus     = clrGoldenrod;
datetime gTerkirim        = 0;
int      gDetikJalan      = 0;
int      gDetikPerintah   = 0;
int      gDetikChart      = 0;
int      gJeda            = 20;
int      gPosisiTerkirim  = 0;
int      gRiwayatTerkirim = 0;
int      gPerintahSukses  = 0;
int      gPerintahGagal   = 0;
string   gPerintahAkhir   = "";
datetime gChartTerkirim   = 0;
string   gSimbolChart     = "";

//+------------------------------------------------------------------+
int OnInit()
{
   gJeda = IntervalDetik;
   if(gJeda < 5)   gJeda = 5;
   if(gJeda > 300) gJeda = 300;

   gSimbolChart = SimbolChart;
   StringTrimLeft(gSimbolChart);
   StringTrimRight(gSimbolChart);
   if(StringLen(gSimbolChart) == 0) gSimbolChart = _Symbol;

   gTrade.SetDeviationInPoints(30);
   gTrade.SetTypeFillingBySymbol(_Symbol);

   EventSetTimer(1);
   BuatDasbor();

   /* Alamat server SENGAJA kosong dari pabrik.
      ─────────────────────────────────────────────────────────────────
      EA ini dijual dan disebar; menaruh alamat server penjualnya sebagai
      bawaan berarti tiap pembeli diam-diam mengirim saldo, posisi, dan
      riwayat akunnya ke mesin orang lain. Alamatnya harus diisi sendiri
      oleh pemakainya — dan kalau kosong, EA berhenti terang-terangan
      alih-alih menyambung ke mana pun. */
   string alamatCek = AlamatServer;
   StringTrimLeft(alamatCek);
   StringTrimRight(alamatCek);
   if(StringLen(alamatCek) < 8)
   {
      gStatus = "MENUNGGU ALAMAT SERVER";
      gWarnaStatus = clrOrangeRed;
      gPesan = "Isi input AlamatServer dengan alamat backend-mu sendiri,\n"
             + "mis. https://server-anda.com (tanpa garis miring di akhir).\n"
             + "Lalu izinkan alamat itu di Tools > Options > Expert Advisors.";
      GambarDasbor();
      return(INIT_SUCCEEDED);
   }

   if(StringLen(KodePasangan) < 8)
   {
      gStatus = "MENUNGGU KODE PASANGAN";
      gWarnaStatus = clrGoldenrod;
      gPesan = "Klik kanan chart > Expert List > Properties > Inputs,\nlalu tempel Kode Pasangan dari halaman jurnalmu.";
      GambarDasbor();
      return(INIT_SUCCEEDED);
   }

   gStatus = "Menyiapkan...";
   GambarDasbor();
   Kirim();
   KirimChartSemua();            // chart langsung terisi, tidak menunggu 5 menit
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   ObjectsDeleteAll(0, PFX);
   Comment("");
}

void OnTimer()
{
   gDetikJalan++;
   gDetikPerintah++;
   gDetikChart++;
   if(StringLen(KodePasangan) >= 8)
   {
      // Perintah dicek TIAP 5 DETIK, bukan tiap interval jurnal: orang yang
      // menekan Kirim di web sedang menunggu, dan 20 detik terasa seabad.
      if(gDetikPerintah >= 5)
      {
         gDetikPerintah = 0;
         if(IzinkanTrading) AmbilPerintah();
      }
      if(gDetikJalan >= gJeda)
      {
         gDetikJalan = 0;
         Kirim();
      }
      // Tick tiap detik: payload ~90 byte — inilah yang membuat harga di
      // web menempel ke MT5; kiriman OHLC penuh hanya tiap 5 menit.
      if(KirimTick) KirimTickSekarang();
      int jedaChart = KirimChartMenit;
      if(jedaChart < 1) jedaChart = 1;
      if(gDetikChart >= jedaChart * 60)
      {
         gDetikChart = 0;
         KirimChartSemua();
      }
   }
   GambarDasbor();
}

//+------------------------------------------------------------------+
//| DASBOR                                                            |
//+------------------------------------------------------------------+
void Lbl(string nama, int x, int y, string teks, color warna, int ukuran)
{
   string n = PFX + nama;
   if(ObjectFind(0, n) < 0)
   {
      ObjectCreate(0, n, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, n, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, n, OBJPROP_HIDDEN, true);
      ObjectSetString(0, n, OBJPROP_FONT, "Consolas");
   }
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, n, OBJPROP_FONTSIZE, ukuran);
   ObjectSetInteger(0, n, OBJPROP_COLOR, warna);
   ObjectSetString(0, n, OBJPROP_TEXT, (StringLen(teks) == 0 ? " " : teks));
}

void BuatDasbor()
{
   string n = PFX + "BG";
   if(ObjectFind(0, n) < 0)
   {
      ObjectCreate(0, n, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, n, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, n, OBJPROP_XDISTANCE, 8);
      ObjectSetInteger(0, n, OBJPROP_YDISTANCE, 18);
      ObjectSetInteger(0, n, OBJPROP_XSIZE, 400);
      ObjectSetInteger(0, n, OBJPROP_YSIZE, 344);
      /* Dasbor TEMBUS PANDANG: latar penuh menutupi lilin di baliknya, dan
         panel yang menyembunyikan harga adalah panel yang akhirnya
         dipindahkan atau dimatikan orangnya. clrNONE membuat isinya
         mengambang di atas chart; bingkainya saja yang menandai batas. */
      ObjectSetInteger(0, n, OBJPROP_BGCOLOR, clrNONE);
      ObjectSetInteger(0, n, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, n, OBJPROP_COLOR, C'60,64,72');
      ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, n, OBJPROP_HIDDEN, true);
   }
}

void PecahTiga(string s, string &a, string &b, string &c)
{
   a = ""; b = ""; c = "";
   string bagian[];
   int n = StringSplit(s, '\n', bagian);
   if(n > 0) a = bagian[0];
   if(n > 1) b = bagian[1];
   if(n > 2) c = bagian[2];
}

void GambarDasbor()
{
   int x = 20, y = 28;
   Lbl("judul", x, y, "TRADE-FI SYNC  v" + VERSI_EA, C'201,162,75', 9); y += 20;
   Lbl("status", x, y, gStatus, gWarnaStatus, 10); y += 20;

   string akun = IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN))
               + "  " + AccountInfoString(ACCOUNT_CURRENCY)
               + "  " + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2);
   Lbl("akun",   x, y, "Akun     : " + akun, C'200,200,205', 9); y += 16;
   Lbl("broker", x, y, "Broker   : " + AccountInfoString(ACCOUNT_COMPANY), C'150,152,160', 9); y += 16;

   string kodeTampil = (StringLen(KodePasangan) < 8) ? "(kosong)" : KodePasangan;
   Lbl("kode", x, y, "Kode     : " + kodeTampil,
       (StringLen(KodePasangan) < 8 ? clrOrangeRed : C'150,152,160'), 9); y += 16;

   Lbl("posisi", x, y, "Posisi   : " + IntegerToString(PositionsTotal())
       + " terbuka  |  terkirim " + IntegerToString(gPosisiTerkirim), C'150,152,160', 9); y += 16;
   Lbl("riwayat", x, y, "Riwayat  : " + IntegerToString(gRiwayatTerkirim)
       + " trade sejak " + TimeToString(AwalRiwayat(), TIME_DATE), C'150,152,160', 9); y += 16;

   // Baris v2: keadaan jalur eksekusi & chart harus TERLIHAT — fitur yang
   // menggerakkan uang tidak boleh berjalan diam-diam.
   Lbl("trading", x, y, "Trading  : " + (IzinkanTrading ? "AKTIF" : "MATI (baca-saja)")
       + "  |  sukses " + IntegerToString(gPerintahSukses)
       + "  gagal " + IntegerToString(gPerintahGagal),
       (IzinkanTrading ? clrMediumSeaGreen : C'150,152,160'), 9); y += 16;
   Lbl("perintah", x, y, "Terakhir : " + (StringLen(gPerintahAkhir) == 0 ? "(belum ada perintah)" : gPerintahAkhir),
       C'150,152,160', 8); y += 16;
   Lbl("chartw", x, y, "Chart    : " + gSimbolChart + " -> web (5 TF)"
       + (gChartTerkirim == 0 ? "  belum terkirim" : "  " + TimeToString(gChartTerkirim, TIME_MINUTES | TIME_SECONDS)),
       C'150,152,160', 9); y += 16;

   string kirim = (gTerkirim == 0) ? "belum pernah" : TimeToString(gTerkirim, TIME_MINUTES | TIME_SECONDS);
   int sisa = gJeda - gDetikJalan;
   if(sisa < 0) sisa = 0;
   Lbl("kirim", x, y, "Terkirim : " + kirim
       + (StringLen(KodePasangan) < 8 ? "" : "   (berikutnya " + IntegerToString(sisa) + "s)"),
       C'150,152,160', 9); y += 18;

   string p1 = "", p2 = "", p3 = "";
   PecahTiga(gPesan, p1, p2, p3);
   Lbl("p1", x, y, p1, gWarnaStatus, 8); y += 14;
   Lbl("p2", x, y, p2, gWarnaStatus, 8); y += 14;
   Lbl("p3", x, y, p3, gWarnaStatus, 8); y += 20;

   Lbl("rjudul", x, y, "-- MASUK KE JURNAL (per hari / pair / arah) --", C'201,162,75', 8); y += 16;

   int tampil = gGrupN; if(tampil > 5) tampil = 5;
   for(int i = 0; i < 5; i++)
   {
      string baris = "";
      color  w = C'150,152,160';
      if(i < tampil)
      {
         baris = gGrupTgl[i] + "  " + gGrupSimbol[i] + "  " + gGrupArah[i]
               + "  " + DoubleToString(gGrupLot[i], 2) + " lot"
               + "  " + (gGrupPl[i] >= 0 ? "+" : "") + DoubleToString(gGrupPl[i], 2)
               + "  (" + IntegerToString(gGrupJml[i]) + "x)";
         w = (gGrupPl[i] >= 0) ? clrMediumSeaGreen : clrIndianRed;
      }
      Lbl("r" + IntegerToString(i), x, y, baris, w, 8);
      y += 14;
   }
   Lbl("rsisa", x, y, (gGrupN > 5 ? "... dan " + IntegerToString(gGrupN - 5) + " baris lagi"
                                  : (gGrupN == 0 ? "(belum ada trade tertutup hari ini)" : "")),
       C'110,112,120', 8);

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| JSON kecil                                                        |
//+------------------------------------------------------------------+
string JsonTeks(string s)
{
   string keluar = "";
   int n = StringLen(s);
   for(int i = 0; i < n; i++)
   {
      ushort c = StringGetCharacter(s, i);
      if(c == '"')       keluar += "\\\"";
      else if(c == '\\') keluar += "\\\\";
      else if(c == '\n') keluar += "\\n";
      else if(c == '\r') keluar += "\\r";
      else if(c == '\t') keluar += "\\t";
      else if(c < 32)    keluar += " ";
      else               keluar += ShortToString(c);
   }
   return keluar;
}

string JsonAngka(double v, int digit)
{
   return DoubleToString(v, digit);
}

//+------------------------------------------------------------------+
//| HTTP bantu                                                        |
//+------------------------------------------------------------------+
string UrlDasar()
{
   string url = AlamatServer;
   while(StringLen(url) > 0 && StringGetCharacter(url, StringLen(url) - 1) == '/')
      url = StringSubstr(url, 0, StringLen(url) - 1);
   return url;
}

// POST JSON; kembalikan kode HTTP (-1 = WebRequest gagal total).
int PostJson(string jalur, string isi, string &balasan, int timeoutMs = 10000)
{
   char data[], hasil[];
   string kepala;
   int panjang = StringToCharArray(isi, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(panjang > 0) ArrayResize(data, panjang - 1);
   ResetLastError();
   int kode = WebRequest("POST", UrlDasar() + jalur, "Content-Type: application/json\r\n",
                         timeoutMs, data, hasil, kepala);
   balasan = (kode == -1) ? "" : CharArrayToString(hasil, 0, WHOLE_ARRAY, CP_UTF8);
   return kode;
}

//+------------------------------------------------------------------+
//| NILAI LOT & TICK                                                  |
//+------------------------------------------------------------------+
// Dolar per 1 lot per 1.0 pergerakan harga — bahan web menghitung dolar
// SL/TP tiket MT5. Akun sen (USC) dibagi 100 DI SINI, supaya web selalu
// menerima dolar sungguhan tanpa harus menebak mata uang akun.
double NilaiLotSimbol(string simbol)
{
   double tv = SymbolInfoDouble(simbol, SYMBOL_TRADE_TICK_VALUE);
   double ts = SymbolInfoDouble(simbol, SYMBOL_TRADE_TICK_SIZE);
   if(ts <= 0 || tv <= 0) return 0;
   double nilai = tv / ts;
   string mu = AccountInfoString(ACCOUNT_CURRENCY);
   StringToUpper(mu);
   if(StringFind(mu, "USC") >= 0 || StringFind(mu, "CENT") >= 0) nilai /= 100;
   return nilai;
}

// Nama DASAR simbol chart (XAUUSDc -> XAUUSD) — dipakai tick & klines.
string SimbolDasar()
{
   string dasarSimbol = gSimbolChart;
   int q = StringLen(dasarSimbol);
   while(q > 0)
   {
      ushort c = StringGetCharacter(dasarSimbol, q - 1);
      bool hurufBesar = (c >= 'A' && c <= 'Z');
      bool angka = (c >= '0' && c <= '9');
      if(hurufBesar || angka) break;
      q--;
   }
   dasarSimbol = StringSubstr(dasarSimbol, 0, q);
   StringToUpper(dasarSimbol);
   return dasarSimbol;
}

void KirimTickSekarang()
{
   double bid = SymbolInfoDouble(gSimbolChart, SYMBOL_BID);
   if(bid <= 0) return;              // pasar tutup / simbol belum siap
   int digit = (int)SymbolInfoInteger(gSimbolChart, SYMBOL_DIGITS);
   if(digit <= 0) digit = 5;
   // Ask ikut dikirim (v2.02): chart web menggambar garis harga permintaan,
   // karena jarak bid-ask di emas bukan pembulatan — itu biaya masuk posisi.
   double ask = SymbolInfoDouble(gSimbolChart, SYMBOL_ASK);
   // t = jam BROKER (v2.03) — timeline yang SAMA dengan stempel waktu bar
   // OHLC. Tanpa ini server membandingkan jam broker dengan jam aslinya
   // sendiri (selisih 2-3 jam), salah menebak batas lilin, dan lilin
   // terakhir di web meregang lalu melompat tiap kiriman OHLC penuh.
   string isi = "{\"kode\":\"" + JsonTeks(KodePasangan)
              + "\",\"simbol\":\"" + JsonTeks(SimbolDasar())
              + "\",\"bid\":" + DoubleToString(bid, digit)
              + (ask > 0 ? ",\"ask\":" + DoubleToString(ask, digit) : "")
              + ",\"t\":" + IntegerToString((long)TimeCurrent()) + "}";
   string balasan;
   // Timeout pendek: tick berikutnya datang sedetik lagi — menunggu lama
   // untuk angka yang sebentar lagi basi hanya membekukan timer.
   PostJson("/api/mt5/tick", isi, balasan, 3000);
}

int AmbilTeks(string jalur, string &balasan)
{
   char data[], hasil[];
   string kepala;
   ArrayResize(data, 0);
   ResetLastError();
   int kode = WebRequest("GET", UrlDasar() + jalur, "", 10000, data, hasil, kepala);
   balasan = (kode == -1) ? "" : CharArrayToString(hasil, 0, WHOLE_ARRAY, CP_UTF8);
   return kode;
}

//+------------------------------------------------------------------+
//| PERINTAH DARI WEB                                                 |
//+------------------------------------------------------------------+
//  Server membalas text/plain, satu perintah per baris:
//     id|aksi|simbol|arah|lot|sl|tp|tiket
//  Setiap perintah dieksekusi lalu HASILNYA dilaporkan balik — sukses
//  ataupun gagal, dengan pesan yang menyebut sebabnya. Perintah tanpa
//  laporan hasil adalah perintah yang nasibnya tidak diketahui siapa pun.

// Broker sering menambah akhiran nama simbol (XAUUSD -> XAUUSDc). Perintah
// web memakai nama dasar; di sini dicarikan padanannya di terminal.
string CariSimbol(string mau)
{
   if(StringLen(mau) == 0) return "";
   if(SymbolSelect(mau, true)) return mau;
   int total = SymbolsTotal(false);
   for(int i = 0; i < total; i++)
   {
      string s = SymbolName(i, false);
      if(StringFind(s, mau) == 0)
      {
         if(SymbolSelect(s, true)) return s;
      }
   }
   return "";
}

double JepitLot(string simbol, double lot)
{
   double vmin  = SymbolInfoDouble(simbol, SYMBOL_VOLUME_MIN);
   double vmax  = SymbolInfoDouble(simbol, SYMBOL_VOLUME_MAX);
   double vstep = SymbolInfoDouble(simbol, SYMBOL_VOLUME_STEP);
   if(vstep > 0) lot = MathFloor(lot / vstep + 0.5) * vstep;
   if(vmin > 0 && lot < vmin) lot = vmin;
   if(vmax > 0 && lot > vmax) lot = vmax;
   if(lot > LotMaks) lot = LotMaks;
   return lot;
}

double RapikanHarga(string simbol, double h)
{
   int digit = (int)SymbolInfoInteger(simbol, SYMBOL_DIGITS);
   if(digit <= 0) digit = 5;
   return NormalizeDouble(h, digit);
}

void LaporHasil(string id, bool ok, string pesan, string tiket)
{
   string isi = "{";
   isi += "\"kode\":\""  + JsonTeks(KodePasangan) + "\",";
   isi += "\"id\":\""    + JsonTeks(id) + "\",";
   isi += "\"ok\":"      + (ok ? "true" : "false") + ",";
   isi += "\"pesan\":\"" + JsonTeks(pesan) + "\",";
   isi += "\"tiket\":\"" + JsonTeks(tiket) + "\"";
   isi += "}";
   string balasan;
   PostJson("/api/mt5/perintah/hasil", isi, balasan);
}

void JalankanPerintah(string baris)
{
   string b[];
   int n = StringSplit(baris, '|', b);
   if(n < 8) return;
   string id     = b[0];
   string aksi   = b[1];
   string simbol = b[2];
   string arah   = b[3];
   double lot    = StringToDouble(b[4]);
   double sl     = StringToDouble(b[5]);
   double tp     = StringToDouble(b[6]);
   ulong  tiket  = (ulong)StringToInteger(b[7]);

   bool ok = false;
   string pesan = "", tiketHasil = "";

   if(aksi == "BUKA")
   {
      string s = CariSimbol(simbol);
      if(StringLen(s) == 0)
      {
         LaporHasil(id, false, "Simbol " + simbol + " tidak ada di terminal ini", "");
         gPerintahGagal++;
         gPerintahAkhir = "BUKA " + simbol + " GAGAL: simbol tak dikenal";
         return;
      }
      double lotPakai = JepitLot(s, lot);
      double slp = (sl > 0 ? RapikanHarga(s, sl) : 0.0);
      double tpp = (tp > 0 ? RapikanHarga(s, tp) : 0.0);
      gTrade.SetTypeFillingBySymbol(s);

      /* ── JENIS ORDER ────────────────────────────────────────────────
         Kolom ke-9 membawa harga entry yang diminta web. Kalau ia 0 atau
         terlalu dekat dengan harga pasar, ordernya MARKET seperti dulu.
         Kalau tidak, jenisnya ditentukan dari LETAK entry terhadap harga
         sekarang — persis aturan yang dipakai layar:

             BUY  di ATAS pasar  -> Buy Stop   (mengejar tembusan)
             BUY  di BAWAH pasar -> Buy Limit  (menunggu diskon)
             SELL di BAWAH pasar -> Sell Stop
             SELL di ATAS pasar  -> Sell Limit

         Menentukannya DI SINI, bukan di web, disengaja: yang tahu harga
         pasar sebenarnya pada detik eksekusi adalah terminal, bukan
         halaman yang datanya sudah beberapa detik umurnya. Web mengirim
         niatnya (harga entry); EA memilih jenis ordernya. */
      double entryMinta = (n >= 9 ? StringToDouble(b[8]) : 0.0);
      double bid = SymbolInfoDouble(s, SYMBOL_BID);
      double ask = SymbolInfoDouble(s, SYMBOL_ASK);
      double acuan = (arah == "BUY" ? ask : bid);
      int    digit = (int)SymbolInfoInteger(s, SYMBOL_DIGITS);
      double poin  = SymbolInfoDouble(s, SYMBOL_POINT);
      /* Jarak minimum broker (stops level): di bawah itu pending order
         PASTI ditolak, jadi diperlakukan sebagai market saja. */
      double jarakMin = (double)SymbolInfoInteger(s, SYMBOL_TRADE_STOPS_LEVEL) * poin;
      if(jarakMin <= 0) jarakMin = 10 * poin;

      bool pending = (entryMinta > 0 && MathAbs(entryMinta - acuan) > jarakMin);
      double entryP = (entryMinta > 0 ? RapikanHarga(s, entryMinta) : 0.0);

      string jenisTeks = "Market";
      if(pending)
      {
         if(arah == "BUY")
         {
            if(entryP > acuan) { ok = gTrade.BuyStop (lotPakai, entryP, s, slp, tpp, ORDER_TIME_GTC, 0, "TradeFi web"); jenisTeks = "Buy Stop"; }
            else               { ok = gTrade.BuyLimit(lotPakai, entryP, s, slp, tpp, ORDER_TIME_GTC, 0, "TradeFi web"); jenisTeks = "Buy Limit"; }
         }
         else
         {
            if(entryP < acuan) { ok = gTrade.SellStop (lotPakai, entryP, s, slp, tpp, ORDER_TIME_GTC, 0, "TradeFi web"); jenisTeks = "Sell Stop"; }
            else               { ok = gTrade.SellLimit(lotPakai, entryP, s, slp, tpp, ORDER_TIME_GTC, 0, "TradeFi web"); jenisTeks = "Sell Limit"; }
         }
      }
      else
      {
         if(arah == "BUY") ok = gTrade.Buy(lotPakai, s, 0.0, slp, tpp, "TradeFi web");
         else              ok = gTrade.Sell(lotPakai, s, 0.0, slp, tpp, "TradeFi web");
      }

      pesan = "retcode " + IntegerToString((int)gTrade.ResultRetcode()) + " " + gTrade.ResultRetcodeDescription();
      if(ok)
      {
         tiketHasil = IntegerToString((long)gTrade.ResultOrder());
         pesan = jenisTeks + " " + arah + " " + DoubleToString(lotPakai, 2) + " lot " + s + " @ "
               + DoubleToString(pending ? entryP : gTrade.ResultPrice(), digit);
      }
      gPerintahAkhir = "BUKA " + arah + " " + s + " " + (ok ? "OK" : "GAGAL");
   }
   else if(aksi == "UBAH")
   {
      if(!PositionSelectByTicket(tiket))
      {
         LaporHasil(id, false, "Posisi " + IntegerToString((long)tiket) + " tidak ditemukan", "");
         gPerintahGagal++;
         gPerintahAkhir = "UBAH #" + IntegerToString((long)tiket) + " GAGAL: tak ada";
         return;
      }
      string s = PositionGetString(POSITION_SYMBOL);
      // 0 berarti PERTAHANKAN yang sekarang, bukan hapus — menghapus stop
      // lewat kelalaian mengisi kolom adalah kecelakaan, bukan fitur.
      double slp = (sl > 0 ? RapikanHarga(s, sl) : PositionGetDouble(POSITION_SL));
      double tpp = (tp > 0 ? RapikanHarga(s, tp) : PositionGetDouble(POSITION_TP));
      ok = gTrade.PositionModify(tiket, slp, tpp);
      pesan = ok ? ("SL " + DoubleToString(slp, 2) + " TP " + DoubleToString(tpp, 2))
                 : ("retcode " + IntegerToString((int)gTrade.ResultRetcode()) + " " + gTrade.ResultRetcodeDescription());
      tiketHasil = IntegerToString((long)tiket);
      gPerintahAkhir = "UBAH #" + IntegerToString((long)tiket) + " " + (ok ? "OK" : "GAGAL");
   }
   else if(aksi == "TUTUP")
   {
      if(!PositionSelectByTicket(tiket))
      {
         LaporHasil(id, false, "Posisi " + IntegerToString((long)tiket) + " tidak ditemukan", "");
         gPerintahGagal++;
         gPerintahAkhir = "TUTUP #" + IntegerToString((long)tiket) + " GAGAL: tak ada";
         return;
      }
      ok = gTrade.PositionClose(tiket);
      pesan = ok ? "posisi ditutup"
                 : ("retcode " + IntegerToString((int)gTrade.ResultRetcode()) + " " + gTrade.ResultRetcodeDescription());
      tiketHasil = IntegerToString((long)tiket);
      gPerintahAkhir = "TUTUP #" + IntegerToString((long)tiket) + " " + (ok ? "OK" : "GAGAL");
   }
   else
   {
      LaporHasil(id, false, "Aksi tidak dikenal: " + aksi, "");
      return;
   }

   if(ok) gPerintahSukses++; else gPerintahGagal++;
   LaporHasil(id, ok, pesan, tiketHasil);
   // Laporan jurnal menyusul SEGERA — posisi yang baru dibuka dari web harus
   // muncul di webnya juga tanpa menunggu interval.
   gDetikJalan = gJeda;
}

void AmbilPerintah()
{
   string balasan;
   int kode = AmbilTeks("/api/mt5/perintah?kode=" + KodePasangan, balasan);
   if(kode != 200 || StringLen(balasan) == 0) return;
   string baris[];
   int n = StringSplit(balasan, '\n', baris);
   for(int i = 0; i < n; i++)
   {
      string t = baris[i];
      StringTrimLeft(t);
      StringTrimRight(t);
      if(StringLen(t) > 0) JalankanPerintah(t);
   }
}

//+------------------------------------------------------------------+
//| CHART MT5 -> WEB                                                  |
//+------------------------------------------------------------------+
//  Lima timeframe yang sama dengan halaman Chart web. 400 bar per TF —
//  cukup untuk indikator matang plus replay, dan tetap ringan (~25 KB).
void KirimChartSatu(ENUM_TIMEFRAMES tfMt5, string tfWeb)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int n = CopyRates(gSimbolChart, tfMt5, 0, 400, rates);
   if(n < 10) return;                       // pasar tutup / simbol salah — jangan kirim remah

   int digit = (int)SymbolInfoInteger(gSimbolChart, SYMBOL_DIGITS);
   if(digit <= 0) digit = 5;

   string data = "[";
   for(int i = 0; i < n; i++)
   {
      if(i > 0) data += ",";
      data += "[" + IntegerToString((long)rates[i].time * 1000)
            + "," + DoubleToString(rates[i].open, digit)
            + "," + DoubleToString(rates[i].high, digit)
            + "," + DoubleToString(rates[i].low, digit)
            + "," + DoubleToString(rates[i].close, digit) + "]";
   }
   data += "]";

   string isi = "{";
   isi += "\"kode\":\""   + JsonTeks(KodePasangan) + "\",";
   isi += "\"simbol\":\"" + JsonTeks(SimbolDasar()) + "\",";
   isi += "\"tf\":\""     + tfWeb + "\",";
   // Nilai per lot menumpang di sini — web memakainya menghitung dolar SL/TP.
   isi += "\"nilaiLot\":"  + DoubleToString(NilaiLotSimbol(gSimbolChart), 4) + ",";
   isi += "\"data\":"     + data;
   isi += "}";

   string balasan;
   if(PostJson("/api/mt5/klines", isi, balasan) == 200) gChartTerkirim = TimeCurrent();
}

void KirimChartSemua()
{
   if(StringLen(KodePasangan) < 8) return;
   KirimChartSatu(PERIOD_M5,  "5m");
   KirimChartSatu(PERIOD_M15, "15m");
   KirimChartSatu(PERIOD_H1,  "1h");
   KirimChartSatu(PERIOD_H4,  "4h");
   KirimChartSatu(PERIOD_D1,  "1d");
}

//+------------------------------------------------------------------+
//| BAGIAN LAPORAN JURNAL — sama dengan v1                            |
//+------------------------------------------------------------------+
string BagianAkun()
{
   string s = "{";
   s += "\"login\":\""    + JsonTeks(IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))) + "\",";
   s += "\"nama\":\""     + JsonTeks(AccountInfoString(ACCOUNT_NAME)) + "\",";
   s += "\"broker\":\""   + JsonTeks(AccountInfoString(ACCOUNT_COMPANY)) + "\",";
   s += "\"server\":\""   + JsonTeks(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   s += "\"mataUang\":\"" + JsonTeks(AccountInfoString(ACCOUNT_CURRENCY)) + "\",";
   s += "\"saldo\":"      + JsonAngka(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   s += "\"ekuitas\":"    + JsonAngka(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   s += "\"margin\":"     + JsonAngka(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   s += "\"marginBebas\":"+ JsonAngka(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   s += "\"leverage\":"   + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE)) + ",";
   long jenis = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string jenisTeks = "real";
   if(jenis == ACCOUNT_TRADE_MODE_DEMO)    jenisTeks = "demo";
   if(jenis == ACCOUNT_TRADE_MODE_CONTEST) jenisTeks = "kontes";
   s += "\"jenis\":\"" + jenisTeks + "\"";
   s += "}";
   return s;
}

string BagianPosisi()
{
   string s = "[";
   int total = PositionsTotal();
   bool pertama = true;
   for(int i = 0; i < total; i++)
   {
      ulong tiket = PositionGetTicket(i);
      if(tiket == 0) continue;
      if(!PositionSelectByTicket(tiket)) continue;

      if(!pertama) s += ",";
      pertama = false;

      string simbol = PositionGetString(POSITION_SYMBOL);
      int digit = (int)SymbolInfoInteger(simbol, SYMBOL_DIGITS);
      if(digit <= 0) digit = 5;

      s += "{";
      s += "\"tiket\":\""  + IntegerToString((long)tiket) + "\",";
      s += "\"simbol\":\"" + JsonTeks(simbol) + "\",";
      s += "\"arah\":\""   + (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
      s += "\"lot\":"      + JsonAngka(PositionGetDouble(POSITION_VOLUME), 2) + ",";
      s += "\"hargaBuka\":"+ JsonAngka(PositionGetDouble(POSITION_PRICE_OPEN), digit) + ",";
      s += "\"hargaKini\":"+ JsonAngka(PositionGetDouble(POSITION_PRICE_CURRENT), digit) + ",";
      s += "\"sl\":"       + JsonAngka(PositionGetDouble(POSITION_SL), digit) + ",";
      s += "\"tp\":"       + JsonAngka(PositionGetDouble(POSITION_TP), digit) + ",";
      s += "\"profit\":"   + JsonAngka(PositionGetDouble(POSITION_PROFIT), 2) + ",";
      s += "\"swap\":"     + JsonAngka(PositionGetDouble(POSITION_SWAP), 2) + ",";
      s += "\"waktuBuka\":"+ IntegerToString((long)PositionGetInteger(POSITION_TIME)) + ",";
      s += "\"komentar\":\""+ JsonTeks(PositionGetString(POSITION_COMMENT)) + "\"";
      s += "}";
   }
   s += "]";
   return s;
}

datetime AwalRiwayat()
{
   int hari = HariRiwayat;
   if(hari < 1)   hari = 1;
   if(hari > 3650) hari = 3650;
   datetime dari = TimeCurrent() - (datetime)(hari * 86400);

   string t = MulaiDariTanggal;
   StringTrimLeft(t);
   StringTrimRight(t);
   if(StringLen(t) > 0)
   {
      datetime batas = StringToTime(t);
      if(batas > 0) return batas;
   }
   return dari;
}

string BagianRiwayat()
{
   datetime dari = AwalRiwayat();
   if(!HistorySelect(dari, TimeCurrent())) return "[]";

   string s = "[";
   bool pertama = true;
   int total = HistoryDealsTotal();
   int terkirim = 0;
   for(int i = total - 1; i >= 0 && terkirim < 500; i--)
   {
      ulong tiket = HistoryDealGetTicket(i);
      if(tiket == 0) continue;

      long entry = HistoryDealGetInteger(tiket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY) continue;

      long jenis = HistoryDealGetInteger(tiket, DEAL_TYPE);
      if(jenis != DEAL_TYPE_BUY && jenis != DEAL_TYPE_SELL) continue;

      string simbol = HistoryDealGetString(tiket, DEAL_SYMBOL);
      if(StringLen(simbol) == 0) continue;
      int digit = (int)SymbolInfoInteger(simbol, SYMBOL_DIGITS);
      if(digit <= 0) digit = 5;

      if(!pertama) s += ",";
      pertama = false;
      terkirim++;

      string arah = (jenis == DEAL_TYPE_SELL) ? "BUY" : "SELL";

      double laba = HistoryDealGetDouble(tiket, DEAL_PROFIT)
                  + HistoryDealGetDouble(tiket, DEAL_SWAP)
                  + HistoryDealGetDouble(tiket, DEAL_COMMISSION);

      s += "{";
      s += "\"tiket\":\""   + IntegerToString((long)tiket) + "\",";
      s += "\"posisi\":\""  + IntegerToString(HistoryDealGetInteger(tiket, DEAL_POSITION_ID)) + "\",";
      s += "\"simbol\":\""  + JsonTeks(simbol) + "\",";
      s += "\"arah\":\""    + arah + "\",";
      s += "\"lot\":"       + JsonAngka(HistoryDealGetDouble(tiket, DEAL_VOLUME), 2) + ",";
      s += "\"hargaTutup\":"+ JsonAngka(HistoryDealGetDouble(tiket, DEAL_PRICE), digit) + ",";
      s += "\"labaBersih\":"+ JsonAngka(laba, 2) + ",";
      s += "\"profit\":"    + JsonAngka(HistoryDealGetDouble(tiket, DEAL_PROFIT), 2) + ",";
      s += "\"swap\":"      + JsonAngka(HistoryDealGetDouble(tiket, DEAL_SWAP), 2) + ",";
      s += "\"komisi\":"    + JsonAngka(HistoryDealGetDouble(tiket, DEAL_COMMISSION), 2) + ",";
      s += "\"waktuTutup\":"+ IntegerToString((long)HistoryDealGetInteger(tiket, DEAL_TIME)) + ",";
      s += "\"komentar\":\""+ JsonTeks(HistoryDealGetString(tiket, DEAL_COMMENT)) + "\"";
      s += "}";
   }
   s += "]";
   return s;
}

string   gGrupKunci[];
string   gGrupTgl[];
string   gGrupSimbol[];
string   gGrupArah[];
double   gGrupLot[];
double   gGrupPl[];
int      gGrupJml[];
int      gGrupN = 0;

int CariGrup(string kunci)
{
   for(int i = 0; i < gGrupN; i++) if(gGrupKunci[i] == kunci) return i;
   return -1;
}

void ResetGrup()
{
   gGrupN = 0;
   ArrayResize(gGrupKunci, 0); ArrayResize(gGrupTgl, 0);
   ArrayResize(gGrupSimbol, 0); ArrayResize(gGrupArah, 0);
   ArrayResize(gGrupLot, 0); ArrayResize(gGrupPl, 0); ArrayResize(gGrupJml, 0);
}

void TambahGrup(string tgl, string simbol, string arah, double lot, double pl)
{
   string kunci = tgl + "|" + simbol + "|" + arah;
   int i = CariGrup(kunci);
   if(i < 0)
   {
      i = gGrupN;
      gGrupN++;
      ArrayResize(gGrupKunci, gGrupN); ArrayResize(gGrupTgl, gGrupN);
      ArrayResize(gGrupSimbol, gGrupN); ArrayResize(gGrupArah, gGrupN);
      ArrayResize(gGrupLot, gGrupN); ArrayResize(gGrupPl, gGrupN); ArrayResize(gGrupJml, gGrupN);
      gGrupKunci[i] = kunci; gGrupTgl[i] = tgl; gGrupSimbol[i] = simbol; gGrupArah[i] = arah;
      gGrupLot[i] = 0; gGrupPl[i] = 0; gGrupJml[i] = 0;
   }
   gGrupLot[i] += lot;
   gGrupPl[i]  += pl;
   gGrupJml[i] += 1;
}

void HitungGrup()
{
   ResetGrup();
   datetime dari = AwalRiwayat();
   if(!HistorySelect(dari, TimeCurrent())) return;

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong tiket = HistoryDealGetTicket(i);
      if(tiket == 0) continue;
      long entry = HistoryDealGetInteger(tiket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY) continue;
      long jenis = HistoryDealGetInteger(tiket, DEAL_TYPE);
      if(jenis != DEAL_TYPE_BUY && jenis != DEAL_TYPE_SELL) continue;
      string simbol = HistoryDealGetString(tiket, DEAL_SYMBOL);
      if(StringLen(simbol) == 0) continue;

      datetime wt = (datetime)HistoryDealGetInteger(tiket, DEAL_TIME);
      string tgl = TimeToString(wt, TIME_DATE);
      StringReplace(tgl, ".", "-");

      string arah = (jenis == DEAL_TYPE_SELL) ? "BUY" : "SELL";
      double laba = HistoryDealGetDouble(tiket, DEAL_PROFIT)
                  + HistoryDealGetDouble(tiket, DEAL_SWAP)
                  + HistoryDealGetDouble(tiket, DEAL_COMMISSION);
      TambahGrup(tgl, simbol, arah, HistoryDealGetDouble(tiket, DEAL_VOLUME), laba);
   }
}

string BagianRingkas()
{
   HitungGrup();
   string s = "[";
   for(int i = 0; i < gGrupN; i++)
   {
      if(i > 0) s += ",";
      s += "{";
      s += "\"kunci\":\""  + JsonTeks(gGrupKunci[i]) + "\",";
      s += "\"tanggal\":\"" + JsonTeks(gGrupTgl[i]) + "\",";
      s += "\"simbol\":\"" + JsonTeks(gGrupSimbol[i]) + "\",";
      s += "\"arah\":\""   + gGrupArah[i] + "\",";
      s += "\"lot\":"      + JsonAngka(gGrupLot[i], 2) + ",";
      s += "\"pl\":"       + JsonAngka(gGrupPl[i], 2) + ",";
      s += "\"jumlah\":"   + IntegerToString(gGrupJml[i]);
      s += "}";
   }
   s += "]";
   return s;
}

void Tampilkan(string status, string pesan, color warna)
{
   gStatus = status;
   gPesan = pesan;
   gWarnaStatus = warna;
   GambarDasbor();
}

//+------------------------------------------------------------------+
void Kirim()
{
   string bagianPosisi  = BagianPosisi();
   string bagianRiwayat = BagianRiwayat();
   gPosisiTerkirim  = HitungObjek(bagianPosisi);
   gRiwayatTerkirim = HitungObjek(bagianRiwayat);

   string isi = "{";
   isi += "\"kode\":\""    + JsonTeks(KodePasangan) + "\",";
   isi += "\"versiEa\":\"" + VERSI_EA + "\",";
   isi += "\"akun\":"      + BagianAkun() + ",";
   isi += "\"riwayatDari\":" + IntegerToString((long)AwalRiwayat()) + ",";
   isi += "\"posisi\":"    + bagianPosisi + ",";
   isi += "\"ringkas\":"   + BagianRingkas() + ",";
   isi += "\"riwayat\":"   + bagianRiwayat;
   isi += "}";

   string balasan;
   int kode = PostJson("/api/mt5/lapor", isi, balasan);

   if(kode == -1)
   {
      int err = GetLastError();
      gGagalBerturut++;
      if(err == 4014)
      {
         Tampilkan("URL BELUM DIIZINKAN (4014)",
                   "Tools > Options > Expert Advisors, centang\n"
                   "\"Allow WebRequest for listed URL\", tambahkan:\n" + AlamatServer,
                   clrOrangeRed);
      }
      else
      {
         Tampilkan("GAGAL KIRIM (error " + IntegerToString(err) + ")",
                   "Gagal berturut: " + IntegerToString(gGagalBerturut)
                   + "\nCek koneksi internet terminal ini.", clrOrangeRed);
      }
      return;
   }

   if(kode == 200)
   {
      gGagalBerturut = 0;
      gTerkirim = TimeCurrent();
      Tampilkan("TERSAMBUNG", IzinkanTrading
                ? "Jurnal terkirim. Perintah web dicek tiap 5 detik."
                : "Jurnal terkirim. Mode baca-saja.", clrMediumSeaGreen);
      return;
   }

   gGagalBerturut++;
   if(kode == 403 || kode == 409)
   {
      Tampilkan("DITOLAK SERVER (" + IntegerToString(kode) + ")",
                "Buat Kode Pasangan BARU di halaman jurnalmu,\n"
                "lalu tempel ulang lewat Properties > Inputs.\n"
                + StringSubstr(balasan, 0, 60), clrOrangeRed);
   }
   else
   {
      Tampilkan("SERVER MEMBALAS " + IntegerToString(kode),
                StringSubstr(balasan, 0, 60), clrOrangeRed);
   }
}

int HitungObjek(string json)
{
   int n = 0;
   int panjang = StringLen(json);
   for(int i = 0; i < panjang; i++)
      if(StringGetCharacter(json, i) == '{') n++;
   return n;
}
//+------------------------------------------------------------------+
