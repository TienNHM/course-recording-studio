import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./config";
import { DICTIONARIES, type Namespace } from "./dictionaries";
import { formatNumber } from "./format";
import {
  isPlural,
  type MessageTree,
  type MessageVars,
  type Plural,
} from "./types";

const lookup = (tree: MessageTree, key: string) => {
  let node: MessageTree[string] | undefined = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || isPlural(node)) {
      return undefined;
    }
    node = node[part];
  }
  return node;
};

const pluralRules = new Map<Locale, Intl.PluralRules>();
const selectPlural = (message: Plural, locale: Locale, count: number) => {
  if (count === 0 && message.zero !== undefined) {
    return message.zero;
  }
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(INTL_LOCALE[locale]);
    pluralRules.set(locale, rules);
  }
  const form = rules.select(count) as Exclude<keyof Plural, "__plural">;
  return message[form] ?? message.other;
};

/** Replaces `{name}` with vars.name; numbers are formatted for the locale. */
export const interpolate = (
  template: string,
  vars: MessageVars | undefined,
  locale: Locale,
) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars?.[name];
    if (value === undefined || value === null) {
      return match;
    }
    return typeof value === "number" ? formatNumber(value, locale) : value;
  });

const warned = new Set<string>();

/**
 * Framework-free translation. Falls back to Vietnamese, then to the key itself
 * (with a console warning) so a missing string never crashes the UI.
 */
export const translate = (
  locale: Locale,
  namespace: Namespace,
  key: string,
  vars?: MessageVars,
): string => {
  const message =
    lookup(DICTIONARIES[locale][namespace], key) ??
    lookup(DICTIONARIES[DEFAULT_LOCALE][namespace], key);

  if (typeof message === "string") {
    return interpolate(message, vars, locale);
  }
  if (isPlural(message)) {
    const count = Number(vars?.count ?? 0);
    return interpolate(selectPlural(message, locale, count), vars, locale);
  }

  const id = `${namespace}:${key}`;
  if (!warned.has(id)) {
    warned.add(id);
    console.warn(`[i18n] Missing message "${id}"`);
  }
  return key;
};
