import { TriangleAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

type Props = {
  children: ReactNode;
  /** Zmiana wartości (np. adresu strony) czyści błąd, żeby można było przejść dalej. */
  resetKey?: string;
  /** Pełny ekran, gdy granica obejmuje całą aplikację (bez nagłówka sklepu). */
  fullPage?: boolean;
};

type State = { error: Error | null };

/** Zamiast białej strony po wyjątku w renderowaniu pokazuje przyjazny ekran błędu. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Nieobsłużony błąd interfejsu", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey)
      this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const screen = (
      <div role="alert">
        <EmptyState
          icon={TriangleAlert}
          title="Coś poszło nie tak"
          description="Nie udało się wyświetlić tej strony. Odśwież ją albo wróć do katalogu. Twój koszyk i zamówienia są bezpieczne."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => window.location.reload()}>
                Odśwież stronę
              </Button>
              <a
                href="/"
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface/90 px-5 py-2.5 text-[0.9375rem] font-semibold text-ink no-underline hover:bg-canvas"
              >
                Wróć do katalogu
              </a>
            </div>
          }
        />
      </div>
    );
    return this.props.fullPage ? (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-4">
        <div className="w-full">{screen}</div>
      </div>
    ) : (
      screen
    );
  }
}
