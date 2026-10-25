const WINDOWS_RESERVED = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

const MAX_SLUG_LENGTH = 60;

export const slugify = (title: string): string => {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
};

export const uniqueSlug = (
  title: string,
  taken: Iterable<string>,
  fallback: string,
): string => {
  const base = slugify(title) || fallback;
  const used = new Set(taken);
  const isFree = (candidate: string) =>
    !used.has(candidate) && !WINDOWS_RESERVED.has(candidate);

  if (isFree(base)) {
    return base;
  }

  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (isFree(candidate)) {
      return candidate;
    }
  }
};
