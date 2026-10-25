/** A message with plural forms, selected with Intl.PluralRules from `count`. */
export type Plural = {
  readonly __plural: true;
  /** Used when count === 0, if present (any locale). */
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
};

/**
 * Declares a plural message. Vietnamese has no grammatical plural, so `other`
 * is usually enough there; English needs `one` + `other`.
 *
 *   lessons: plural({ one: "{count} lesson", other: "{count} lessons" })
 */
export const plural = (forms: Omit<Plural, "__plural">): Plural => ({
  __plural: true,
  ...forms,
});

export const isPlural = (value: unknown): value is Plural =>
  typeof value === "object" &&
  value !== null &&
  (value as { __plural?: unknown }).__plural === true;

export type MessageTree = {
  readonly [key: string]: string | Plural | MessageTree;
};

/**
 * The shape another locale must implement: same keys, any string values.
 * Vietnamese files are the source of truth; English files are typed with
 * `Messages<typeof vi>` so a missing or extra key is a compile error.
 */
export type Messages<T> = T extends string
  ? string
  : T extends Plural
    ? Plural
    : { readonly [K in keyof T]: Messages<T[K]> };

/** Dotted paths to every leaf message: "actions.save", "lessons", ... */
export type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string | Plural
    ? K
    : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

export type MessageVars = Readonly<
  Record<string, string | number | null | undefined>
>;
