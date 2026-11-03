#!/usr/bin/env bash
# Atualiza a cópia do esquema usada nos testes de SQL (supabase/test/schema.sql)
# a partir de PRODUÇÃO. Só estrutura: nenhum dado de aluno sai do banco.
# Rodar depois de aplicar uma migration nova em produção.
set -euo pipefail
cd "$(dirname "$0")/.."
# Número da ÚLTIMA migration já aplicada em produção (ex.: 073). As mais
# novas que ele são aplicadas por cima nos testes (test-db-setup.mjs).
APPLIED="${1:-}"
if ! [[ "$APPLIED" =~ ^[0-9]{3}$ ]]; then
  echo "uso: npm run test:db:snapshot -- <última migration aplicada em produção, ex.: 073>" >&2
  exit 1
fi
set -a; . ./.env.local; set +a
CONN="host=$SUPABASE_DB_HOST port=$SUPABASE_DB_PORT user=$SUPABASE_DB_USER dbname=postgres sslmode=require"
TMP=$(mktemp)
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump "$CONN" --schema-only --schema=public --no-owner --no-privileges --no-comments -f "$TMP"
grep -v -E '^\\(un)?restrict |^CREATE SCHEMA public;$|^SET transaction_timeout' "$TMP" > supabase/test/schema.sql
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump "$CONN" --data-only --table=public.achievements --no-owner --inserts \
  | grep -E '^INSERT' > supabase/test/seed-achievements.sql
# biblioteca global de exercícios (catálogo, sem dado de aluno; sem vínculo de equipamento)
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CONN" -At -c "
  select format('insert into public.exercises (id, gym_id, name, category, muscles, photo_url, tips, aliases) values (%L, null, %L, %L, %L, %L, %L, %L) on conflict do nothing;',
    id, name, category, muscles, photo_url, tips, aliases)
  from public.exercises where gym_id is null order by name" > supabase/test/seed-exercises.sql
rm -f "$TMP"
echo "$APPLIED" > supabase/test/SNAPSHOT_MIGRATION
echo "✓ esquema atualizado até a migration $(cat supabase/test/SNAPSHOT_MIGRATION)"
