import Seo from '../../components/Seo';
import RecordResults from '../../components/RecordResults';
import { ledger } from '../../content/club';

// Board only. Not linked anywhere, kept out of search engines, and useless without the board
// password, which the Apps Script checks on every request.
export default function Record() {
  return (
    <>
      <Seo title="Record results" description="Board tool for recording weekly ledger results." path="/ledger/record" noindex />
      <section className="page-head">
        <div className="wrap">
          <div className="ruled">
            <p className="eyebrow">Board &middot; {ledger.term}</p>
            <h1 className="page-title">Record results</h1>
          </div>
          <RecordResults />
        </div>
      </section>
    </>
  );
}
