import Head from 'next/head';
import { Analytics } from '@vercel/analytics/next';
import '../styles/globals.css';
import { franklin } from '../lib/fonts';
import Layout from '../components/Layout';

// Vercel Web Analytics: page views only, no cookies. Its script and beacon are served from this site under
// /_vercel/insights, so the security policy's 'self' already covers them.
export default function App({ Component, pageProps }) {
  return (
    <div className={franklin.variable}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
      <Analytics />
    </div>
  );
}
