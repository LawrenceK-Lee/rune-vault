-- Rune Vault schema. Paste into Supabase -> SQL Editor and run once.
-- The card catalog is NOT stored here; card_id values match Card.id in src/data/cards.json.

-- ---------------------------------------------------------------- collection
create table if not exists public.collection_items (
  user_id    uuid not null references auth.users on delete cascade default auth.uid(),
  card_id    text not null,
  quantity   int  not null check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- ---------------------------------------------------------------- decks
create table if not exists public.decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade default auth.uid(),
  name        text not null default 'New deck',
  legend_id   text,
  champion_id text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists decks_user_idx on public.decks (user_id, updated_at desc);

create table if not exists public.deck_cards (
  deck_id  uuid not null references public.decks on delete cascade,
  card_id  text not null,
  zone     text not null check (zone in ('main', 'rune', 'battlefield', 'sideboard')),
  quantity int  not null check (quantity > 0),
  primary key (deck_id, card_id, zone)
);

-- Bump decks.updated_at whenever the deck or its cards change.
create or replace function public.touch_deck() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'decks' then
    new.updated_at = now();
    return new;
  end if;
  update public.decks set updated_at = now() where id = coalesce(new.deck_id, old.deck_id);
  return coalesce(new, old);
end $$;

drop trigger if exists decks_touch on public.decks;
create trigger decks_touch before update on public.decks
  for each row execute function public.touch_deck();

drop trigger if exists deck_cards_touch on public.deck_cards;
create trigger deck_cards_touch after insert or update or delete on public.deck_cards
  for each row execute function public.touch_deck();

-- ---------------------------------------------------------------- row level security
alter table public.collection_items enable row level security;
alter table public.decks            enable row level security;
alter table public.deck_cards       enable row level security;

drop policy if exists "own collection" on public.collection_items;
create policy "own collection" on public.collection_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own decks" on public.decks;
create policy "own decks" on public.decks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own deck cards" on public.deck_cards;
create policy "own deck cards" on public.deck_cards
  for all
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));
