//+------------------------------------------------------------------+
//|  JadiTraderSync.mq5                                              |
//|  Menyambungkan akun MT5 ke Jurnal Jadi Trader Tools (BACA-SAJA)  |
//+------------------------------------------------------------------+
//  EA ini TIDAK PERNAH membuka, menutup, atau mengubah order apa pun.
//  Yang dilakukannya cuma satu: membaca saldo, posisi terbuka, dan riwayat
//  trade, lalu mengirimkannya ke server jurnalmu. Tidak ada satu pun fungsi
//  perdagangan (OrderSend dan sejenisnya) di dalam berkas ini - silakan
//  dicari sendiri kalau ragu.
//
//  CARA PASANG
//  1. Salin berkas ini ke folder  MQL5/Experts  (buka lewat File -> Open
//     Data Folder di MetaTrader 5), lalu tekan Compile di MetaEditor.
//  2. Di MT5: Tools -> Options -> Expert Advisors -> centang
//     "Allow WebRequest for listed URL", lalu tambahkan alamat server yang
//     tertulis di halaman jurnalmu.
//  3. Seret EA ini ke chart mana saja (chart apa pun, tidak berpengaruh).
//  4. Isi KodePasangan dengan kode yang muncul di halaman jurnalmu.
//
//  Selama chart-nya terbuka, jurnalmu terisi sendiri. Kalau MT5 ditutup,
//  pengiriman berhenti dan lanjut lagi begitu dibuka.
//+------------------------------------------------------------------+
#property copyright "Jadi Trader Tools"
#property version   "1.00"
#property strict
#property description "Sinkronisasi akun MT5 ke Jurnal Jadi Trader Tools. BACA-SAJA - tidak mengirim order apa pun."

input string KodePasangan     = "";                                  // Kode Pasangan dari halaman jurnal
input string AlamatServer     = "https://103-253-145-38.sslip.io";   // Alamat server (tanpa garis miring di akhir)
input int    IntervalDetik    = 20;                                  // Jeda antar pengiriman (detik)
input int    HariRiwayat      = 60;                                  // Cadangan kalau tanggal di bawah kosong (hari)
input string MulaiDariTanggal = "2026.08.04";                        // Riwayat diambil mulai tanggal ini (YYYY.MM.DD)

#define VERSI_EA "1.02"
#define PFX      "JTS_"        // awalan nama objek dasbor

int      gGagalBerturut   = 0;
string   gStatus          = "Menyiapkan...";
string   gPesan           = "";
color    gWarnaStatus     = clrGoldenrod;
datetime gTerkirim        = 0;
int      gDetikJalan      = 0;   // pencacah untuk hitung mundur
int      gJeda            = 20;
int      gPosisiTerkirim  = 0;
int      gRiwayatTerkirim = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   gJeda = IntervalDetik;
   if(gJeda < 5)   gJeda = 5;     // jangan membanjiri server
   if(gJeda > 300) gJeda = 300;

   // Timer 1 detik supaya hitung mundur di dasbor benar-benar bergerak. Itu
   // satu-satunya cara pengguna bisa MELIHAT bahwa EA-nya hidup, bukan diam.
   EventSetTimer(1);
   BuatDasbor();

   // PENTING: JANGAN pernah mengembalikan INIT_PARAMETERS_INCORRECT di sini.
   // Nilai itu membuat MT5 MELEPAS EA dari chart - dan begitu terlepas, tidak
   // ada apa pun untuk diklik kanan, jadi kolom Inputs mustahil dibuka lagi.
   // Yang terlihat pengguna cuma kotak Alert berulang tanpa jalan keluar.
   // Sekarang EA tetap menempel dan MENUNGGU, dengan petunjuk di dasbor.
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
   Kirim();                      // kirim sekali langsung, jangan tunggu timer
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
   if(StringLen(KodePasangan) >= 8 && gDetikJalan >= gJeda)
   {
      gDetikJalan = 0;
      Kirim();
   }
   GambarDasbor();               // hitung mundur bergerak tiap detik
}

//+------------------------------------------------------------------+
//| DASBOR di chart                                                   |
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
   ObjectSetString(0, n, OBJPROP_TEXT, teks);
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
      ObjectSetInteger(0, n, OBJPROP_YSIZE, 306);
      ObjectSetInteger(0, n, OBJPROP_BGCOLOR, C'21,23,28');
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
   Lbl("judul", x, y, "JADI TRADER SYNC  v" + VERSI_EA + "   (BACA-SAJA)", C'201,162,75', 9); y += 20;
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

   string kirim = (gTerkirim == 0) ? "belum pernah" : TimeToString(gTerkirim, TIME_MINUTES | TIME_SECONDS);
   int sisa = gJeda - gDetikJalan;
   if(sisa < 0) sisa = 0;
   Lbl("kirim", x, y, "Terkirim : " + kirim
       + (StringLen(KodePasangan) < 8 ? "" : "   (berikutnya " + IntegerToString(sisa) + "s)"),
       C'150,152,160', 9); y += 18;

   // Pesan dipecah maksimal 3 baris supaya petunjuk panjang tetap terbaca.
   string p1 = "", p2 = "", p3 = "";
   PecahTiga(gPesan, p1, p2, p3);
   Lbl("p1", x, y, p1, gWarnaStatus, 8); y += 14;
   Lbl("p2", x, y, p2, gWarnaStatus, 8); y += 14;
   Lbl("p3", x, y, p3, gWarnaStatus, 8); y += 20;

   /* Ringkasan harian yang PERSIS sama dengan yang masuk ke jurnal. Ditaruh di
      sini supaya kalau angka di jurnal terasa aneh, pembandingnya ada langsung
      di depan mata - tidak perlu menebak apakah masalahnya di EA atau di web. */
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
//| Escape teks supaya aman ditaruh di dalam JSON                     |
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
//| Bagian AKUN                                                       |
//+------------------------------------------------------------------+
//  ACCOUNT_CURRENCY WAJIB ikut dikirim. Akun sen (mis. Exness cent, mata
//  uang "USC") melaporkan saldo dalam SEN - 37954.89 USC itu $379.55. Kalau
//  sisi web menyalin angkanya mentah-mentah, saldo jurnal meleset 100 kali
//  lipat. Konversinya dikerjakan di sisi web, tapi hanya bisa kalau tahu
//  mata uangnya.
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
   // Penting untuk sisi web: akun demo tidak boleh tercampur dengan akun real
   // di jurnal yang sama.
   long jenis = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string jenisTeks = "real";
   if(jenis == ACCOUNT_TRADE_MODE_DEMO)    jenisTeks = "demo";
   if(jenis == ACCOUNT_TRADE_MODE_CONTEST) jenisTeks = "kontes";
   s += "\"jenis\":\"" + jenisTeks + "\"";
   s += "}";
   return s;
}

//+------------------------------------------------------------------+
//| Bagian POSISI TERBUKA                                             |
//+------------------------------------------------------------------+
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

//+------------------------------------------------------------------+
//| Bagian RIWAYAT (deal yang MENUTUP posisi)                         |
//+------------------------------------------------------------------+
//  Hanya deal ber-entry DEAL_ENTRY_OUT / OUT_BY yang diambil: itulah yang
//  benar-benar menutup posisi dan punya angka laba-rugi. Deal masuk (IN)
//  tidak dihitung, kalau ikut diambil satu trade akan tercatat dua kali.
//  MulaiDariTanggal adalah BATAS BAWAH yang keras: trade sebelum tanggal itu
//  tidak pernah ikut terkirim. Gunanya menjaga catatan bulan-bulan sebelumnya
//  yang sudah diisi tangan supaya tidak tersentuh sama sekali oleh data MT5.
//  Kalau dikosongkan, jatuh kembali ke jendela HariRiwayat.
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
      // StringToTime mengembalikan 0 kalau formatnya tidak dikenal - jangan
      // dipakai, karena 0 berarti 1970 dan justru menarik SEMUA riwayat.
      //
      // Kalau tanggalnya sah, ia MENGGANTIKAN jendela HariRiwayat, bukan
      // sekadar memotongnya. Kalau cuma memotong, begitu umur jendela lewat
      // (mis. 60 hari sesudah 1 Agustus) titik awalnya bergeser maju sendiri
      // dan trade Agustus berhenti terkirim - persis hal yang mau dihindari.
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
   // Dari yang TERBARU ke belakang, dibatasi 500 - jurnal tidak butuh lebih,
   // dan payload-nya tetap kecil untuk akun yang sangat aktif.
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

      // Deal penutup ber-DEAL_TYPE_SELL berarti posisi aslinya BUY, dan
      // sebaliknya - arah yang dicatat jurnal harus arah POSISINYA.
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

//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
//| RINGKASAN HARIAN — satu baris per (tanggal + simbol + arah)       |
//+------------------------------------------------------------------+
//  Jurnal tidak butuh 212 baris mentah. Yang berguna: "4 Agustus, XAUUSDc,
//  BUY, total 0,14 lot, +$1,32". Kalau di hari yang sama ada BUY DAN SELL di
//  pair yang sama, keduanya jadi baris terpisah - itu memang dua keputusan
//  trading yang berbeda dan tidak boleh dijumlahkan jadi satu.
//
//  Pengelompokan dikerjakan DI SINI, bukan di sisi web, supaya angkanya di
//  dasbor dan di jurnal dijamin sama - dihitung sekali dari sumber yang sama.
string   gGrupKunci[];      // "YYYY-MM-DD|SIMBOL|ARAH"
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

// Dibangun dari deal yang SAMA dengan BagianRiwayat supaya tidak mungkin beda.
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
      string tgl = TimeToString(wt, TIME_DATE);      // YYYY.MM.DD
      StringReplace(tgl, ".", "-");                   // -> YYYY-MM-DD

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
   // Dihitung dari isi yang BENAR-BENAR dirakit, bukan dari PositionsTotal()
   // lagi - kalau ada posisi yang gagal dipilih, angka di dasbor harus ikut
   // memperlihatkannya, bukan menampilkan jumlah yang seolah-olah utuh.
   gPosisiTerkirim  = HitungObjek(bagianPosisi);
   gRiwayatTerkirim = HitungObjek(bagianRiwayat);

   string isi = "{";
   isi += "\"kode\":\""    + JsonTeks(KodePasangan) + "\",";
   isi += "\"versiEa\":\"" + VERSI_EA + "\",";
   isi += "\"akun\":"      + BagianAkun() + ",";
   // Dikirim juga supaya sisi web bisa mengatakan apa adanya periode mana yang
   // tercakup, bukan membiarkan orang menebak kenapa trade lama tidak muncul.
   isi += "\"riwayatDari\":" + IntegerToString((long)AwalRiwayat()) + ",";
   isi += "\"posisi\":"    + bagianPosisi + ",";
   isi += "\"ringkas\":"   + BagianRingkas() + ",";
   isi += "\"riwayat\":"   + bagianRiwayat;
   isi += "}";

   string url = AlamatServer;
   // Garis miring di akhir alamat membuat URL jadi "//api/..." dan ditolak.
   while(StringLen(url) > 0 && StringGetCharacter(url, StringLen(url) - 1) == '/')
      url = StringSubstr(url, 0, StringLen(url) - 1);
   url += "/api/mt5/lapor";

   char data[], hasil[];
   string kepalaHasil;
   int panjang = StringToCharArray(isi, data, 0, WHOLE_ARRAY, CP_UTF8);
   // StringToCharArray menambahkan penanda akhir teks; kalau ikut terkirim,
   // server menerima JSON dengan satu byte nol di ujungnya lalu gagal parse.
   if(panjang > 0) ArrayResize(data, panjang - 1);

   ResetLastError();
   int kode = WebRequest("POST", url, "Content-Type: application/json\r\n", 10000, data, hasil, kepalaHasil);

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

   string balasan = CharArrayToString(hasil, 0, WHOLE_ARRAY, CP_UTF8);

   if(kode == 200)
   {
      gGagalBerturut = 0;
      gTerkirim = TimeCurrent();
      Tampilkan("TERSAMBUNG", "Data terkirim ke jurnal.", clrMediumSeaGreen);
      return;
   }

   gGagalBerturut++;
   if(kode == 403 || kode == 409)
   {
      // Kode salah / sudah dipakai akun lain - mengulang tidak akan menolong,
      // jadi katakan apa yang harus dilakukan, bukan sekadar nomor errornya.
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

// Menghitung jumlah objek di dalam larik JSON dengan mencacah '{' di tingkat
// atas. Cukup karena isi tiap objek di sini tidak pernah bersarang.
int HitungObjek(string json)
{
   int n = 0;
   int panjang = StringLen(json);
   for(int i = 0; i < panjang; i++)
      if(StringGetCharacter(json, i) == '{') n++;
   return n;
}
//+------------------------------------------------------------------+
