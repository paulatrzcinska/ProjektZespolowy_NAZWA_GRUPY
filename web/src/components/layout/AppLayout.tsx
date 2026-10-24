import { LayoutGrid, Shield, ShoppingBag, UserRound } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { PwaStatus } from "./PwaStatus";
import { useAuth } from "../../auth/AuthContext";
import { useCart } from "../../hooks/useCart";
import { cn } from "../../lib/cn";

export function AppLayout() {
  const { user } = useAuth();
  const { cart } = useCart();
  const count = cart?.items_count ?? 0;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-stone-900/5 text-ink ring-1 ring-line"
        : "text-subtle hover:bg-white/70 hover:text-ink",
    );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/80 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="group flex items-center gap-3 no-underline">
            <span
              className="flex size-9 items-center justify-center rounded-lg bg-stone-900 text-[0.65rem] font-bold uppercase tracking-widest text-white shadow-card ring-1 ring-stone-900/10 transition-transform duration-300 group-hover:scale-[1.02]"
              aria-hidden
            >
              ZDP
            </span>
            <div className="hidden flex-col leading-none sm:flex">
              <span className="font-display text-lg font-semibold tracking-tight text-ink">
                Z Dech Pies
              </span>
              <span className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-subtle">
                since 2026
              </span>
            </div>
          </Link>

          <nav
            className="flex flex-wrap items-center justify-end gap-1 sm:gap-2"
            aria-label="Główne"
          >
            <NavLink to="/" className={navClass} end>
              <LayoutGrid
                className="size-4 opacity-70"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="hidden sm:inline">Katalog</span>
              <span className="sm:hidden">Sklep</span>
            </NavLink>
            <NavLink to="/cart" className={navClass}>
              <span className="relative inline-flex">
                <ShoppingBag
                  className="size-4 opacity-70"
                  strokeWidth={1.75}
                  aria-hidden
                />
                {user && count > 0 ? (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-900 px-1 text-[0.65rem] font-semibold text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              Koszyk
            </NavLink>
            {user?.is_admin ? (
              <NavLink to="/admin" className={navClass}>
                <Shield
                  className="size-4 opacity-70"
                  strokeWidth={1.75}
                  aria-hidden
                />
                Admin
              </NavLink>
            ) : null}
            {user ? (
              <NavLink to="/profil" className={navClass}>
                <UserRound
                  className="size-4 opacity-70"
                  strokeWidth={1.75}
                  aria-hidden
                />
                Profil
              </NavLink>
            ) : (
              <NavLink to="/login" className={navClass}>
                <UserRound
                  className="size-4 opacity-70"
                  strokeWidth={1.75}
                  aria-hidden
                />
                Konto
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <PwaStatus />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-line bg-surface/50 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
          <p className="max-w-md text-sm leading-relaxed text-subtle">
            Akcesoria, które psy kochają, a opiekunowie doceniają.
          </p>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-400">
            Z Dech Pies · 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
