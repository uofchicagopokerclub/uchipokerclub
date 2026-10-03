import Head from 'next/head';
import { club } from '../content/club';

// Title format: "Page | UChicago Poker Club". The home page uses its own full title.
export default function Seo({ title, description, path = '/', noindex = false }) {
  const fullTitle = title ? `${title} | ${club.name}` : `${club.name} | Weekly strategy, live play, and the ledger`;
  const url = `${club.siteUrl}${path === '/' ? '' : path}`;
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={club.name} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${club.siteUrl}/og.jpg`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="UChicago Undergraduate Poker Club, 2026-2027, with the club's playing-card logo" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={club.x.handle} />
    </Head>
  );
}
