import { Link } from 'react-router';

/** Shown for sign-in and account pages when this copy of the app has no Supabase project connected. */
export function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-8">
      <h1 className="heading text-2xl">Accounts aren't set up on this copy</h1>
      <p className="text-slate-300">
        You don't need one: the card browser, your <Link to="/collection" className="text-gold-300 underline">collection</Link> and your{' '}
        <Link to="/decks" className="text-gold-300 underline">decks</Link> all work, saved in this browser. Use <b>Import / Export</b> on the
        Collection page to back your collection up.
      </p>
      <p className="text-slate-300">To add accounts that sync across devices, connect a free Supabase project:</p>
      <ol className="list-decimal space-y-2 pl-6 text-slate-300">
        <li>
          Create a project at <span className="text-gold-300">supabase.com</span>.
        </li>
        <li>
          Open <b>SQL Editor</b> and run <code className="text-gold-300">supabase/migrations/0001_init.sql</code>, then{' '}
          <code className="text-gold-300">0002_accounts.sql</code>.
        </li>
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in your Project URL and <b>publishable</b> key (<code>sb_publishable_…</code>) from{' '}
          <b>Project Settings → API Keys</b>. Never use the secret key here.
        </li>
        <li>Restart <code>npm run dev</code>. The README has the full steps.</li>
      </ol>
    </div>
  );
}
