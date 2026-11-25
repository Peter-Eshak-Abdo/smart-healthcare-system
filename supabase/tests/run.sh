#!/usr/bin/env bash
set -euo pipefail

DB="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/smarthealth_test}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

echo "==> Resetting schema and applying migrations + reference seed"
psql "$DB" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public, app, ref, audit, biometric, private, auth, extensions CASCADE;"
psql "$DB" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA public;"

psql "$DB" -v ON_ERROR_STOP=1 -f "$DIR/00_supabase_stub.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "  -> $f"
  psql "$DB" -v ON_ERROR_STOP=1 -f "$f"
done

psql "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed/01_reference.sql"

echo "==> Running T01-T15 tests"
psql "$DB" -v ON_ERROR_STOP=1 -f "$DIR/01_setup.sql"
psql "$DB" -v ON_ERROR_STOP=1 -f "$DIR/02_patient_doctor_pharmacy.sql"
psql "$DB" -v ON_ERROR_STOP=1 -f "$DIR/03_race_partial.sql"

echo "==> Running T16 concurrent race test (2 pharmacies vs last 30 tablets)"
LOG_A="$(mktemp)"
LOG_B="$(mktemp)"
trap 'rm -f "$LOG_A" "$LOG_B"' EXIT

set +e
psql "$DB" -v who='c0000000-0000-4000-8000-000000000001' -v pharmacy='00000000-0000-4000-8000-00000000f003' -f "$DIR/03_race_one.sql" >"$LOG_A" 2>&1 &
PID_A=$!
psql "$DB" -v who='c0000000-0000-4000-8000-000000000002' -v pharmacy='00000000-0000-4000-8000-00000000f004' -f "$DIR/03_race_one.sql" >"$LOG_B" 2>&1 &
PID_B=$!
wait "$PID_A"; RC_A=$?
wait "$PID_B"; RC_B=$?
set -e

SUCCESS_COUNT=0
[ "$RC_A" -eq 0 ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
[ "$RC_B" -eq 0 ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1))

if [ "$SUCCESS_COUNT" -ne 1 ]; then
  echo "T16 FAILED: expected exactly 1 concurrent winner, got $SUCCESS_COUNT (rcA=$RC_A rcB=$RC_B)"
  cat "$LOG_A"
  cat "$LOG_B"
  exit 1
fi

psql "$DB" -v ON_ERROR_STOP=1 -c "
do \$\$
declare
  v_qty numeric;
  v_status app.rx_status;
begin
  select quantity_dispensed into v_qty from app.prescription_items where id='11111111-0000-4000-8000-000000000002';
  select status into v_status from app.prescriptions where id='99999999-0000-4000-8000-000000000001';
  if v_qty <> 30 or v_status <> 'dispensed' then
    raise exception 'T16 FAILED: quantity_dispensed=% status=%', v_qty, v_status;
  end if;
end \$\$;
"

echo "==> Running T17-T25 emergency, biometric & audit chain tests"
psql "$DB" -v ON_ERROR_STOP=1 -f "$DIR/04_emergency_biometric_audit.sql"

echo "==> ALL DB TESTS T01-T25 PASSED"
