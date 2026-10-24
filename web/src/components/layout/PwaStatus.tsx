import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "../ui/Button";

export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <>
      {!online ? (
        <p
          role="status"
          className="border-b border-line bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
        >
          Brak połączenia. Możesz przeglądać zapisany katalog. Zakupy wymagają
          połączenia.
        </p>
      ) : null}
      {needRefresh ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-center gap-3 border-b border-line bg-surface px-4 py-3 text-sm"
        >
          <span>Dostępna jest nowa wersja sklepu.</span>
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            Odśwież aplikację
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setNeedRefresh(false)}
          >
            Później
          </Button>
        </div>
      ) : null}
    </>
  );
}
