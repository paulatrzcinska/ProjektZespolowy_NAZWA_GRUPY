#!/bin/sh
# Z RUN_MIGRATIONS=true kontener najpierw aktualizuje schemat bazy (konto migracyjne),
# a dopiero potem startuje API. Błąd migracji zatrzymuje kontener, więc ECS nie
# przełączy ruchu na nową wersję.
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    alembic -c /app/db/alembic.ini upgrade head
fi

exec "$@"
