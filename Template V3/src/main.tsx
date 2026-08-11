import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/* Dijalankan setelah render, bukan sebelumnya: memeriksa versi tidak boleh
   menunda tampilnya halaman. Kalau ternyata usang, muat ulang terjadi dalam
   sepersekian detik berikutnya. */
void import('@/lib/versi').then((m) => m.periksaVersi());
