import { Plus, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as categoriesApi from "../api/categories";
import type {
  CategoryCreatePayload,
  CategoryUpdatePayload,
} from "../api/categories";
import { ApiError } from "../api/client";
import type { Category } from "../api/types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { TextArea } from "../components/ui/TextArea";
import { slugify } from "../lib/format";

type Draft = {
  name: string;
  slug: string;
  description: string;
};

function emptyDraft(): Draft {
  return { name: "", slug: "", description: "" };
}

function fromCategory(c: Category): Draft {
  return { name: c.name, slug: c.slug, description: c.description ?? "" };
}

function validateDraft(draft: Draft): string | null {
  if (!draft.name.trim()) return "Nazwa jest wymagana.";
  if (!draft.slug.trim()) return "Slug jest wymagany.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug))
    return "Slug może zawierać tylko małe litery, cyfry i myślniki (bez myślników na początku/końcu).";
  return null;
}

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function refresh() {
    const list = await categoriesApi.fetchCategories();
    setCategories(list);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await categoriesApi.fetchCategories();
        if (!cancelled) setCategories(list);
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) setError(e.message);
          else setError("Nie udało się wczytać kategorii.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function startNew() {
    setEditingId("new");
    setDraft(emptyDraft());
    setFormError(null);
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setDraft(fromCategory(c));
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setFormError(null);
  }

  async function onSave() {
    if (!draft) return;
    const validationError = validateDraft(draft);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const description = draft.description.trim() || null;
      if (editingId === "new") {
        const payload: CategoryCreatePayload = {
          name: draft.name.trim(),
          slug: draft.slug.trim(),
          description,
        };
        await categoriesApi.createCategory(payload);
      } else if (typeof editingId === "number") {
        const payload: CategoryUpdatePayload = {
          name: draft.name.trim(),
          slug: draft.slug.trim(),
          description,
        };
        await categoriesApi.updateCategory(editingId, payload);
      }
      cancelEdit();
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) setFormError(e.message);
      else setFormError("Zapis nie powiódł się.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number, name: string) {
    if (!window.confirm(`Usunąć kategorię „${name}"?`)) return;
    setError(null);
    try {
      await categoriesApi.deleteCategory(id);
      if (editingId === id) cancelEdit();
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Usuwanie nie powiodło się.");
    }
  }

  return (
    <div className="w-full">
      <div className="mb-10 flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
            Panel
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Kategorie
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-subtle">
            Zarządzaj kategoriami produktów. Kategorii z przypisanymi produktami
            nie można usunąć.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link
            to="/admin"
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-line bg-surface/90 px-4 py-2 text-sm font-semibold text-ink no-underline transition-colors hover:border-stone-300 hover:bg-canvas"
          >
            Produkty
          </Link>
          <Link
            to="/admin/orders"
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-line bg-surface/90 px-4 py-2 text-sm font-semibold text-ink no-underline transition-colors hover:border-stone-300 hover:bg-canvas"
          >
            Zamówienia
          </Link>
          <Button type="button" onClick={startNew} className="gap-2">
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
            Nowa kategoria
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1fr_minmax(300px,380px)] lg:items-start xl:gap-12">
        <div>
          {loading ? (
            <Spinner className="py-16" />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="Brak kategorii"
              description="Dodaj pierwszą kategorię, aby móc tworzyć produkty."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-canvas/50">
                      <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                        Nazwa
                      </th>
                      <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                        Slug
                      </th>
                      <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                        Opis
                      </th>
                      <th className="px-4 py-3.5 text-right text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                        Akcje
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-line/80 transition-colors hover:bg-canvas/30"
                      >
                        <td className="px-4 py-4 font-medium text-ink">
                          {c.name}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-subtle">
                          {c.slug}
                        </td>
                        <td className="max-w-[240px] truncate px-4 py-4 text-subtle">
                          {c.description ?? (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(c)}
                            >
                              Edytuj
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => void onDelete(c.id, c.name)}
                            >
                              Usuń
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {editingId !== null && draft ? (
          <aside className="rounded-2xl border border-line bg-surface p-6 shadow-soft lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <h2 className="font-display text-xl font-semibold text-ink">
              {editingId === "new" ? "Nowa kategoria" : "Edycja kategorii"}
            </h2>

            {formError ? (
              <div className="mt-4">
                <Alert tone="error">{formError}</Alert>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-5">
              <Input
                label="Nazwa"
                name="name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Input
                    label="Slug"
                    name="slug"
                    value={draft.slug}
                    onChange={(e) =>
                      setDraft({ ...draft, slug: e.target.value })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    setDraft({ ...draft, slug: slugify(draft.name) })
                  }
                >
                  Z nazwy
                </Button>
              </div>
              <TextArea
                label="Opis (opcjonalnie)"
                name="description"
                rows={3}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={saving}
                >
                  {saving ? "Zapisywanie…" : "Zapisz"}
                </Button>
                <Button type="button" variant="ghost" onClick={cancelEdit}>
                  Anuluj
                </Button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
