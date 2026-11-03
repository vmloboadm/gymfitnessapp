#!/usr/bin/env bash
# Atualiza a cópia do esquema usada nos testes de SQL (supabase/test/schema.sql)
# a partir de PRODUÇÃO. Só estrutura: nenhum dado de aluno sai do banco.
# Rodar depois de aplicar uma migration nova em produção.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
CONN="host=$SUPABASE_DB_HOST port=$SUPABASE_DB_PORT user=$SUPABASE_DB_USER dbname=postgres sslmode=require"
TMP=$(mktemp)
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump "$CONN" --schema-only --schema=public --no-owner --no-privileges --no-comments -f "$TMP"
grep -v -E '^\\(un)?restrict |^CREATE SCHEMA public;$|^SET transaction_timeout' "$TMP" > supabase/test/schema.sql
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump "$CONN" --data-only --table=public.achievements --no-owner --inserts \
  | grep -E '^INSERT' > supabase/test/seed-achievements.sql
rm -f "$TMP"
ls supabase/migrations | grep -oE '^[0-9]{3}' | sort | tail -1 > supabase/test/SNAPSHOT_MIGRATION
echo "✓ esquema atualizado até a migration $(cat supabase/test/SNAPSHOT_MIGRATION)"
