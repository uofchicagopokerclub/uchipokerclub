// Libre Franklin, self-hosted at build time by next/font: no request to Google from visitors,
// no render-blocking stylesheet, and fallback metrics that keep the layout from shifting.
// It is the free cousin of the Franklin Gothic used in the club's decks.
import { Libre_Franklin } from 'next/font/google';

export const franklin = Libre_Franklin({
  subsets: ['latin'],
  // Variable font: one file covers every weight from 100 to 900.
  display: 'swap',
  variable: '--ff-sans',
  fallback: ['Franklin Gothic Medium', 'Arial', 'sans-serif'],
});
