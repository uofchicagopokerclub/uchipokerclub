import '../styles/globals.css';
import { franklin } from '../lib/fonts';
import Layout from '../components/Layout';

export default function App({ Component, pageProps }) {
  return (
    <div className={franklin.variable}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </div>
  );
}
