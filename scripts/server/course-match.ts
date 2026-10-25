// Finding courses, modules and lessons by id or title. Shared by the server
// (inbox watcher, ensure-lesson) and the HTTP client (MCP server, CLI).
import { slugify } from "./course-slug";

// Finds an entry by id, exact title or slug of the title (so creating by
// title is idempotent).
export const matchByTitle = <T>(
  items: T[],
  wanted: string,
  getId: (item: T) => string,
  getTitle: (item: T) => string,
): T | undefined => {
  const trimmed = wanted.trim();
  const wantedSlug = slugify(trimmed);
  return (
    items.find((i) => getId(i) === trimmed) ??
    items.find((i) => getTitle(i).trim() === trimmed) ??
    items.find((i) => wantedSlug !== "" && slugify(getTitle(i)) === wantedSlug)
  );
};
