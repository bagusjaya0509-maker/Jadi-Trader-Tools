/* Penerjemah "@/..." untuk uji yang dijalankan langsung oleh Node.
   ────────────────────────────────────────────────────────────────────────
   Vite tahu alias `@` menunjuk src/; Node tidak. Tanpa ini, tiap berkas
   yang mengimpor satu saja modul lewat alias tidak bisa diuji tanpa
   peramban — dan aturan yang tidak bisa diuji tanpa peramban cenderung
   tidak diuji sama sekali.

   Ekstensi ikut ditebak (.ts, .tsx, /index.ts) karena impor di proyek ini
   ditulis tanpa ekstensi, seperti kebiasaan bundler. */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as gabung } from 'node:path';

const SRC = gabung(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const COBA = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];

export function resolve(spec, ctx, next) {
  if (!spec.startsWith('@/')) return next(spec, ctx);
  const dasar = gabung(SRC, spec.slice(2));
  for (const e of COBA) {
    if (existsSync(dasar + e)) return next(pathToFileURL(dasar + e).href, ctx);
  }
  return next(spec, ctx);
}
