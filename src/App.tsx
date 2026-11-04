import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';
import { supabase, supabaseConfigured } from './lib/supabase';
import { SYNCED_AT } from './lib/cards';
import { Spinner } from './components/bits';
import { CardsPage } from './pages/CardsPage';
import { CollectionPage } from './pages/CollectionPage';
import { DecksPage } from './pages/DecksPage';
import { DeckEditorPage } from './pages/DeckEditorPage';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (!supabaseConfigured) return <SetupPage />;
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-ink-700 text-gold-300' : 'text-slate-300 hover:text-white'}`;

export function App() {
  const { session } = useAuth();
  const qc = useQueryClient();

  return (
    // Fixed-height shell: the header stays put, and each page scrolls inside <main>.
    // Card-grid pages fill <main> and scroll only their grid (see CardGrid).
    <div className="flex flex-col" style={{ height: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))' }}>
      <header className="z-40 shrink-0 border-b border-ink-700 bg-ink-900">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-2 px-4 py-2.5">
          <NavLink to="/" className="mr-2 flex items-center gap-2">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="heading hidden text-lg sm:inline">Rift Unbound</span>
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLink}>Cards</NavLink>
            <NavLink to="/collection" className={navLink}>Collection</NavLink>
            <NavLink to="/decks" className={navLink}>Decks</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {session ? (
              <>
                <span className="hidden max-w-[16ch] truncate text-slate-400 md:inline" title={session.user.email}>{session.user.email}</span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    qc.clear();
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              supabaseConfigured && <NavLink to="/login" className="btn-primary whitespace-nowrap">Sign in</NavLink>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col overflow-y-auto px-4 pt-4">
        <Routes>
          <Route path="/" element={<CardsPage />} />
          <Route path="/login" element={supabaseConfigured ? <LoginPage /> : <SetupPage />} />
          <Route path="/collection" element={<RequireAuth><CollectionPage /></RequireAuth>} />
          <Route path="/decks" element={<RequireAuth><DecksPage /></RequireAuth>} />
          <Route path="/decks/:deckId" element={<RequireAuth><DeckEditorPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="shrink-0 truncate border-t border-ink-800 px-4 py-1.5 text-center text-[11px] text-slate-500" title={`Card data synced ${new Date(SYNCED_AT).toLocaleDateString()}`}>
        Unofficial fan-made tool, not endorsed by Riot Games. Riftbound card names, text and art © Riot Games.
      </footer>
    </div>
  );
}
