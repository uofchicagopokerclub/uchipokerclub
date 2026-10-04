import Head from 'next/head';
import '../styles/globals.css';
import { franklin } from '../lib/fonts';
import Layout from '../components/Layout';

export default function App({ Component, pageProps }) {
  return (
    <div className={franklin.variable}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </div>
  );
}
