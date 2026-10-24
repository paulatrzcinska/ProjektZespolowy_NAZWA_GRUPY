import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { cn } from "../lib/cn";

export function LoginPage() {
  const { login, register, user, sessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requested = (location.state as { from?: string } | null)?.from;
  const from =
    requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, fullName.trim() || undefined);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Coś poszło nie tak.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-line bg-surface/90 p-8 shadow-soft sm:p-10">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
          Konto
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
          {mode === "login" ? "Witaj z powrotem" : "Utwórz konto"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-subtle">
          {mode === "login"
            ? "Zaloguj się, by zapisywać koszyk i składać zamówienia."
            : "Rejestracja zajmie chwilę — użyjesz tego samego konta w sklepie."}
        </p>

        <div className="mt-8 flex rounded-full border border-line bg-canvas/80 p-1">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-full py-2.5 text-sm font-semibold transition-all",
              mode === "login"
                ? "bg-surface text-ink shadow-sm ring-1 ring-black/5"
                : "text-subtle hover:text-ink",
            )}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Logowanie
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-full py-2.5 text-sm font-semibold transition-all",
              mode === "register"
                ? "bg-surface text-ink shadow-sm ring-1 ring-black/5"
                : "text-subtle hover:text-ink",
            )}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Rejestracja
          </button>
        </div>

        {sessionNotice === "password_changed" ? (
          <div className="mt-6">
            <Alert tone="success">Hasło zostało zmienione.</Alert>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        <form
          className="mt-8 flex flex-col gap-5"
          onSubmit={(e) => void onSubmit(e)}
        >
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode === "register" ? (
            <Input
              label="Imię i nazwisko (opcjonalnie)"
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          ) : null}
          <Input
            label="Hasło"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "register" ? 8 : 1}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="mt-2 w-full" disabled={pending}>
            {pending
              ? "Chwila…"
              : mode === "login"
                ? "Zaloguj"
                : "Utwórz konto"}
          </Button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-subtle">
        <Link
          to="/"
          className="font-medium text-ink no-underline hover:underline"
        >
          ← Strona główna
        </Link>
      </p>
    </div>
  );
}
