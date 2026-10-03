import { Html, Head, Main, NextScript } from 'next/document';
import { franklin } from '../lib/fonts';

export default function Document() {
  return (
    <Html lang="en" className={franklin.variable}>
      <Head>
        <meta name="theme-color" content="#800000" />
        <meta property="og:locale" content="en_US" />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
