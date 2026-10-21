#!/usr/bin/env bash
set -Eeuo pipefail

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=database_name="$POSTGRES_DB" \
    --set=migration_password="$MIGRATION_DATABASE_PASSWORD" \
    --set=app_password="$APP_DATABASE_PASSWORD" <<'SQL'
CREATE ROLE shop_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
    PASSWORD :'migration_password';
CREATE ROLE shop_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
    PASSWORD :'app_password';

ALTER DATABASE :"database_name" OWNER TO shop_migrator;
REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO shop_migrator, shop_app;

ALTER SCHEMA public OWNER TO shop_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO shop_app;
SQL
