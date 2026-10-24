import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as authApi from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

function toNull(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}

export function ProfileDataPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [shipName, setShipName] = useState("");
  const [shipLine1, setShipLine1] = useState("");
  const [shipLine2, setShipLine2] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipPostal, setShipPostal] = useState("");
  const [shipCountry, setShipCountry] = useState("");

  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profilePending, setProfilePending] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name ?? "");
    setShipName(user.shipping_full_name ?? "");
    setShipLine1(user.shipping_address_line1 ?? "");
    setShipLine2(user.shipping_address_line2 ?? "");
    setShipCity(user.shipping_city ?? "");
    setShipPostal(user.shipping_postal_code ?? "");
    setShipCountry(user.shipping_country ?? "");
  }, [user]);

  async function onProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setProfilePending(true);
    try {
      await authApi.patchProfile({
        full_name: toNull(fullName),
        shipping_full_name: toNull(shipName),
        shipping_address_line1: toNull(shipLine1),
        shipping_address_line2: toNull(shipLine2),
        shipping_city: toNull(shipCity),
        shipping_postal_code: toNull(shipPostal),
        shipping_country: toNull(shipCountry),
      });
      setProfileSuccess("Zapisano dane profilu.");
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiError) setProfileError(err.message);
      else setProfileError("Nie udało się zapisać danych.");
    } finally {
      setProfilePending(false);
    }
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("Nowe hasła nie są takie same.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Nowe hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    setPasswordPending(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      logout("password_changed");
      navigate("/login", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401)
          setPasswordError("Aktualne hasło jest nieprawidłowe.");
        else setPasswordError(err.message);
      } else setPasswordError("Nie udało się zmienić hasła.");
    } finally {
      setPasswordPending(false);
    }
  }

  if (!user) return null;

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink">Moje dane</h2>
      <p className="mt-1 max-w-2xl text-sm text-subtle">
        Konto, opcjonalny adres wysyłki (do podpowiedzi przy zamówieniu) oraz
        zmiana hasła.
      </p>

      <form
        className="mt-8 flex max-w-2xl flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8"
        onSubmit={(e) => void onProfileSubmit(e)}
      >
        {profileError ? <Alert tone="error">{profileError}</Alert> : null}
        {profileSuccess ? <Alert tone="success">{profileSuccess}</Alert> : null}

        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
            E-mail
          </p>
          <p className="mt-2 text-[0.9375rem] font-medium text-ink">
            {user.email}
          </p>
          <p className="mt-1 text-xs text-subtle">
            Nie można zmienić z tego poziomu.
          </p>
        </div>

        <Input
          label="Imię i nazwisko"
          name="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <div className="border-t border-line pt-6">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
            Adres wysyłki
          </p>
          <p className="mt-1 text-sm text-subtle">
            Opcjonalnie — zapisany adres można później wykorzystać przy
            składaniu zamówienia.
          </p>
        </div>

        <Input
          label="Imię i nazwisko na przesyłce"
          name="shipName"
          autoComplete="shipping name"
          value={shipName}
          onChange={(e) => setShipName(e.target.value)}
        />
        <Input
          label="Ulica i numer"
          name="shipLine1"
          autoComplete="address-line1"
          value={shipLine1}
          onChange={(e) => setShipLine1(e.target.value)}
        />
        <Input
          label="Dopisek (np. mieszkanie)"
          name="shipLine2"
          autoComplete="address-line2"
          value={shipLine2}
          onChange={(e) => setShipLine2(e.target.value)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Kod pocztowy"
            name="shipPostal"
            autoComplete="postal-code"
            value={shipPostal}
            onChange={(e) => setShipPostal(e.target.value)}
          />
          <Input
            label="Miasto"
            name="shipCity"
            autoComplete="address-level2"
            value={shipCity}
            onChange={(e) => setShipCity(e.target.value)}
          />
        </div>
        <Input
          label="Kraj"
          name="shipCountry"
          autoComplete="country-name"
          value={shipCountry}
          onChange={(e) => setShipCountry(e.target.value)}
        />

        <Button
          type="submit"
          disabled={profilePending}
          className="mt-2 w-full sm:w-auto"
        >
          {profilePending ? "Zapisywanie…" : "Zapisz dane"}
        </Button>
      </form>

      <section className="mt-14 max-w-md border-t border-line pt-12">
        <h3 className="font-display text-lg font-semibold text-ink">
          Zmiana hasła
        </h3>
        <p className="mt-1 text-sm text-subtle">
          Podaj aktualne hasło i wybierz nowe (min. 8 znaków).
        </p>

        {passwordError ? (
          <div className="mt-6">
            <Alert tone="error">{passwordError}</Alert>
          </div>
        ) : null}
        {passwordSuccess ? (
          <div className="mt-6">
            <Alert tone="success">{passwordSuccess}</Alert>
          </div>
        ) : null}

        <form
          className="mt-6 flex flex-col gap-5"
          onSubmit={(e) => void onPasswordSubmit(e)}
        >
          <Input
            label="Aktualne hasło"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="Nowe hasło"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Powtórz nowe hasło"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button
            type="submit"
            disabled={passwordPending}
            className="mt-2 w-full sm:w-auto"
          >
            {passwordPending ? "Zapisywanie…" : "Zmień hasło"}
          </Button>
        </form>
      </section>
    </div>
  );
}
