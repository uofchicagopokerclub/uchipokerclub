import Head from 'next/head';
import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <Head>
        <title>Page not found | UChicago Poker Club</title>
        <meta name="robots" content="noindex" />
      </Head>
      <section className="notfound">
        <div className="wrap">
          <p className="eyebrow">404</p>
          <h1 className="page-title">This page does not exist.</h1>
          <p className="lead" style={{ marginTop: 18 }}>It may have moved when the site was rebuilt.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/">Go to the home page</Link>
            <Link className="btn btn-secondary" href="/ledger">View the ledger</Link>
          </div>
        </div>
      </section>
    </>
  );
}
