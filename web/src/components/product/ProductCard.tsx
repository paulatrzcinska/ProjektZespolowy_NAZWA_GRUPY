import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ProductListItem } from "../../api/types";
import { formatPln } from "../../lib/format";
import { cn } from "../../lib/cn";

export function ProductCard({ product }: { product: ProductListItem }) {
  const out = product.stock_quantity === 0;
  const low = product.stock_quantity > 0 && product.stock_quantity <= 3;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-soft",
      )}
    >
      <Link
        to={`/products/${product.id}`}
        className="flex flex-1 flex-col no-underline outline-none ring-inset focus-visible:ring-2 focus-visible:ring-stone-900/15"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-stone-100 to-stone-50">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="h-full w-full bg-gradient-to-br from-stone-200 via-stone-100 to-stone-50"
              aria-hidden
            />
          )}
          <span className="pointer-events-none absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-stone-700 opacity-0 shadow-sm ring-1 ring-black/5 transition-opacity duration-300 group-hover:opacity-100">
            <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          {out ? (
            <span className="absolute bottom-3 left-3 rounded-full bg-stone-900/90 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white">
              Niedostępny
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-2 border-t border-line/80 p-5">
          <h2 className="font-display text-lg font-semibold leading-snug tracking-tight text-ink">
            {product.name}
          </h2>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
            <p className="text-base font-semibold tabular-nums text-ink">
              {formatPln(product.price)}
            </p>
            {low && !out ? (
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-amber-800/90">
                Ostatnie sztuki
              </span>
            ) : null}
            {out ? (
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-danger">
                Brak w magazynie
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
