// Supabase Edge Function: create an account from just a username + password.
//
// Supabase Auth needs an email for password sign-in, so the account gets a private
// placeholder address (never shown, never emailed). The player can connect a real
// email later in Account settings.
//
// Deploy: Supabase dashboard -> Edge Functions -> Deploy a new function -> Via Editor,
// name it "create-username-account", paste this file, and turn OFF "Verify JWT"
// (people calling it aren't signed in yet). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// are provided to the function automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

// Reserved by RFC 2606: mail to example.com is never delivered.
const PLACEHOLDER_DOMAIN = 'example.com';
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD = 8;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = String(body.username ?? '').trim().toLowerCase();
    password = String(body.password ?? '');
  } catch {
    return reply(400, { error: 'Invalid request.' });
  }

  if (!USERNAME_RE.test(username))
    return reply(400, { error: 'Usernames are 3–20 characters: letters, numbers and underscores.' });
  if (password.length < MIN_PASSWORD) return reply(400, { error: `Passwords need at least ${MIN_PASSWORD} characters.` });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) return reply(409, { error: 'That username is taken.' });

  const { data, error } = await admin.auth.admin.createUser({
    email: `${crypto.randomUUID()}@${PLACEHOLDER_DOMAIN}`,
    password,
    email_confirm: true, // nothing is ever sent to the placeholder address
    user_metadata: { username },
  });
  if (error || !data.user) return reply(400, { error: error?.message ?? 'Could not create the account.' });

  // The on_auth_user_created trigger sets the username. If someone grabbed the same
  // name in the same instant, the trigger leaves it empty: undo and report.
  const { data: profile } = await admin.from('profiles').select('username').eq('id', data.user.id).maybeSingle();
  if (profile?.username !== username) {
    await admin.auth.admin.deleteUser(data.user.id);
    return reply(409, { error: 'That username is taken.' });
  }

  return reply(200, { ok: true });
});
