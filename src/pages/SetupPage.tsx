export function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-8">
      <h1 className="heading text-2xl">Connect Supabase to save your collection</h1>
      <p className="text-slate-300">
        Browsing cards works without an account. To track your collection and decks, connect a free Supabase project:
      </p>
      <ol className="list-decimal space-y-2 pl-6 text-slate-300">
        <li>
          Create a project at <span className="text-gold-300">supabase.com</span>.
        </li>
        <li>
          Open <b>SQL Editor</b>, paste the contents of <code className="text-gold-300">supabase/migrations/0001_init.sql</code>, and run it.
        </li>
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in the Project URL and anon key from <b>Settings → API</b>.
        </li>
        <li>Restart <code>npm run dev</code>.</li>
      </ol>
    </div>
  );
}
