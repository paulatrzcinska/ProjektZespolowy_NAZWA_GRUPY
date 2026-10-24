import { ChevronRight, ClipboardList, LogOut, UserCircle } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { cn } from "../../lib/cn";

const linkBase =
  "flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-4 py-3.5 text-left text-sm font-medium transition-colors";

export function ProfileLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="w-full">
      <header className="mb-8 border-b border-line pb-8 lg:mb-10">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
          Konto
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Profil
        </h1>
        <p className="mt-2 max-w-xl text-sm text-subtle">
          Zarządzaj danymi, hasłem i przeglądaj zamówienia.
        </p>
      </header>

      <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
        <nav
          className="flex w-full shrink-0 flex-col gap-1 lg:w-64 lg:border-r lg:border-line lg:pr-8"
          aria-label="Menu profilu"
        >
          <NavLink
            to="/profil/dane"
            className={({ isActive }) =>
              cn(
                linkBase,
                isActive
                  ? "border-line bg-surface text-ink shadow-card"
                  : "text-subtle hover:border-line/80 hover:bg-surface/60 hover:text-ink",
              )
            }
          >
            <span className="flex items-center gap-3">
              <UserCircle
                className="size-5 shrink-0 opacity-80"
                strokeWidth={1.75}
                aria-hidden
              />
              Moje dane
            </span>
            <ChevronRight className="size-4 opacity-40" aria-hidden />
          </NavLink>
          <NavLink
            to="/profil/zamowienia"
            className={({ isActive }) =>
              cn(
                linkBase,
                isActive
                  ? "border-line bg-surface text-ink shadow-card"
                  : "text-subtle hover:border-line/80 hover:bg-surface/60 hover:text-ink",
              )
            }
          >
            <span className="flex items-center gap-3">
              <ClipboardList
                className="size-5 shrink-0 opacity-80"
                strokeWidth={1.75}
                aria-hidden
              />
              Historia zamówień
            </span>
            <ChevronRight className="size-4 opacity-40" aria-hidden />
          </NavLink>
          <button
            type="button"
            className={cn(
              linkBase,
              "mt-2 text-danger hover:border-red-200 hover:bg-red-50/80",
            )}
            onClick={() => {
              logout();
              navigate("/", { replace: true });
            }}
          >
            <span className="flex items-center gap-3">
              <LogOut
                className="size-5 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              Wyloguj
            </span>
          </button>
        </nav>

        <div className="min-w-0 flex-1 lg:pt-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
