export function validateCatalogName(name: string, slug: string, max: number): string | null {
  if (!name.trim() || name.trim().length > max)
    return `Nazwa musi mieć od 1 do ${max} znaków.`;
  if (slug.length > max || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return `Slug musi mieć od 1 do ${max} znaków: małe litery, cyfry i pojedyncze myślniki między słowami.`;
  return null;
}

export function validateProduct(draft: {
  name: string; slug: string; price: string; stock_quantity: number;
  category_id: number; image_url: string;
}, categoryIds: number[]): string | null {
  const nameError = validateCatalogName(draft.name, draft.slug, 300);
  if (nameError) return nameError;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(draft.price.trim()) || Number(draft.price) <= 0)
    return "Cena musi być dodatnia, mieć maksymalnie 10 cyfr przed kropką i 2 po kropce.";
  if (!Number.isInteger(draft.stock_quantity) || draft.stock_quantity < 0 || draft.stock_quantity > 2147483647)
    return "Stan magazynowy musi być liczbą całkowitą od 0 do 2147483647.";
  if (!categoryIds.includes(draft.category_id)) return "Wybierz istniejącą kategorię.";
  if (draft.image_url.trim()) {
    if (draft.image_url.trim().length > 2048)
      return "Adres zdjęcia może mieć maksymalnie 2048 znaków.";
    try {
      const url = new URL(draft.image_url.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return "Podaj poprawny adres zdjęcia zaczynający się od http:// lub https://.";
    }
  }
  return null;
}
