-- Run as shop_migrator after applying migrations configured in db/alembic.ini.
\set ON_ERROR_STOP on

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.users, public.categories, public.products,
    public.carts, public.cart_items, public.orders, public.order_items,
    public.payments, public.order_idempotency_keys
TO shop_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shop_app;
GRANT USAGE ON TYPE public.order_status, public.payment_status TO shop_app;

ALTER DEFAULT PRIVILEGES FOR ROLE shop_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shop_app;
ALTER DEFAULT PRIVILEGES FOR ROLE shop_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO shop_app;
ALTER DEFAULT PRIVILEGES FOR ROLE shop_migrator IN SCHEMA public
    GRANT USAGE ON TYPES TO shop_app;

-- Schema migration metadata is owned and maintained by the migration role.
REVOKE ALL ON TABLE public.alembic_version FROM shop_app;
