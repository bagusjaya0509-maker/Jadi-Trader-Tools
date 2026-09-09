/* ═══════════════════════════════════════════════════════════════════════
   tulis-xlsx.ts — menulis berkas Excel (.xlsx) tanpa pustaka spreadsheet
   ═══════════════════════════════════════════════════════════════════════
   Diminta pemilik 9 Sep 2026: format Excel untuk menulis komposisi porto,
   yang bisa diunduh sebagai contoh DAN dipakai mengekspor porto yang ada.

   .xlsx cuma zip berisi beberapa XML. Yang dibutuhkan untuk menulisnya
   hanya pengarsip zip, dan `fflate` sudah ada di bundel untuk MEMBACA
   berkas yang sama (impor-porto.ts). Menambah SheetJS 400 KB demi enam
   berkas XML kecil bukan pertukaran yang masuk akal.

   Teksnya ditulis sebagai inline string (`t="inlineStr"`), bukan lewat
   sharedStrings — satu berkas lebih sedikit, dan Excel, LibreOffice, serta
   Google Sheets membacanya sama baiknya. Angka ditulis apa adanya sebagai
   sel numerik supaya bisa dijumlahkan langsung di Excel.
   ═══════════════════════════════════════════════════════════════════════ */
import { zipSync, strToU8 } from 'fflate';
import type { IsiPorto } from '@/lib/porto';

export type SelXlsx = string | number | null | undefined;
export interface LembarXlsx { nama: string; baris: SelXlsx[][]; lebarKolom?: number[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function kolomHuruf(i: number): string {
  let s = ''; i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

function xmlLembar(l: LembarXlsx): string {
  const cols = l.lebarKolom?.length
    ? '<cols>' + l.lebarKolom.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>'
    : '';
  const rows = l.baris.map((r, ri) => {
    const cells = r.map((v, ci) => {
      if (v === null || v === undefined || v === '') return '';
      const ref = kolomHuruf(ci) + (ri + 1);
      /* Baris pertama = kepala: dibedakan lewat gaya 1 (tebal). */
      const s = ri === 0 ? ' s="1"' : '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
      return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + cols + `<sheetData>${rows}</sheetData></worksheet>`;
}

export function buatXlsx(lembar: LembarXlsx[]): Uint8Array {
  const berkas: Record<string, Uint8Array> = {};
  berkas['[Content_Types].xml'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + lembar.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '</Types>');
  berkas['_rels/.rels'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>');
  berkas['xl/workbook.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets>' + lembar.map((l, i) => `<sheet name="${esc(l.nama).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>'
    + '</workbook>');
  berkas['xl/_rels/workbook.xml.rels'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + lembar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${lembar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + '</Relationships>');
  /* Dua gaya: 0 = biasa, 1 = tebal (kepala kolom). Angka memakai format
     #,##0 supaya terbaca sebagai rupiah di Excel tanpa desimal. */
  berkas['xl/styles.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="2"><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
    + '</styleSheet>');
  lembar.forEach((l, i) => { berkas[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(xmlLembar(l)); });
  return zipSync(berkas, { level: 6 });
}

/** Menyodorkan berkas ke peramban untuk diunduh. */
export function unduhXlsx(namaBerkas: string, lembar: LembarXlsx[]) {
  const bita = buatXlsx(lembar);
  const blob = new Blob([bita.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = namaBerkas.endsWith('.xlsx') ? namaBerkas : namaBerkas + '.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ── FORMAT PORTO ──────────────────────────────────────────────────────
   Empat kolom, dan urutannya mengikuti cara pengimpor membaca: nama = sel
   teks pertama, nilai = sel angka TERAKHIR. Jadi "Nilai (Rp)" harus di
   kanan "Kategori", dan "Simbol" boleh di paling kanan karena isinya teks.
   Kewajiban ditulis di lembar yang sama dengan Kategori "Kewajiban" —
   satu lembar lebih gampang diisi daripada dua tab. */
export const KEPALA_PORTO: SelXlsx[] = ['Nama Pos', 'Kategori', 'Nilai (Rp)', 'Simbol (opsional)'];
export const LEBAR_PORTO = [30, 14, 18, 18];

export function lembarContohPorto(): LembarXlsx {
  return {
    nama: 'Portofolio',
    lebarKolom: LEBAR_PORTO,
    baris: [
      KEPALA_PORTO,
      ['Binance Futures', 'Kripto', 8500000, 'USDT'],
      ['Bitcoin di Wallet', 'Kripto', 12000000, 'BTCUSDT'],
      ['Mandiri Sekuritas', 'Sekuritas', 26300000, ''],
      ['Exness MT5', 'Sekuritas', 8460000, ''],
      ['Bank Mandiri', 'Bank', 10100000, ''],
      ['Bank BCA', 'Bank', 5250000, ''],
      ['Emas Antam 10 gr', 'Emas', 15800000, 'XAUUSD'],
      ['GoPay', 'E-Wallet', 340000, ''],
      ['OVO', 'E-Wallet', 112000, ''],
      ['Uang Tunai', 'Tunai', 900000, ''],
      ['Kredit Mandiri', 'Kewajiban', 6853400, ''],
      ['Paylater', 'Kewajiban', 1250000, ''],
      [],
      ['Cara pakai:', '', '', ''],
      ['1. Satu baris satu pos. Ganti contohnya dengan punyamu.', '', '', ''],
      ['2. Kategori: Kripto, Bank, Sekuritas, Emas, E-Wallet, Tunai, atau Kewajiban.', '', '', ''],
      ['3. Nilai dalam rupiah, angka saja. Simbol boleh kosong.', '', '', ''],
      ['4. Simpan, lalu Personal Area → Tambah Pos → Impor.', '', '', ''],
    ],
  };
}

export function lembarEksporPorto(isi: IsiPorto): LembarXlsx {
  const baris: SelXlsx[][] = [KEPALA_PORTO];
  for (const a of isi.aset) baris.push([a.nama, a.kategori, Math.round(a.nilai), a.simbol || '']);
  for (const k of isi.kewajiban) baris.push([k.nama, 'Kewajiban', Math.round(k.nilai), '']);
  return { nama: 'Portofolio', lebarKolom: LEBAR_PORTO, baris };
}
