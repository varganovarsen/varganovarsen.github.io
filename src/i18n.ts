// Russian is the default locale and lives at the site root; English lives under
// /en/. Page text authored in markdown has its own collections per locale; the
// strings below are everything else the templates print.

import { getCollection, getEntry } from "astro:content";

export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";

export const ui = {
  ru: {
    short: "RU",
    name: "Русский",
    htmlLang: "ru",
    ogLocale: "ru_RU",
    author: "Варганов Арсений",
    siteName: "Варганов Арсений — портфолио",
    description: "Геймдизайнер. Unity, Godot, C#, инструменты и пайплайны.",
    portfolio: "Портфолио",
    projects: "Проекты",
    projectDetails: "Описание проекта",
    close: "Закрыть",
    language: "Язык",
  },
  en: {
    short: "EN",
    name: "English",
    htmlLang: "en",
    ogLocale: "en_US",
    author: "Arseniy Varganov",
    siteName: "Arseniy Varganov — portfolio",
    description: "Game designer. Unity, Godot, C#, tools and pipelines.",
    portfolio: "Portfolio",
    projects: "Projects",
    projectDetails: "Project details",
    close: "Close",
    language: "Language",
  },
} satisfies Record<Locale, Record<string, string>>;

/** "/projects/goops/" in the given locale: "/en/projects/goops/" for English. */
export function localizePath(path: string, locale: Locale) {
  return locale === defaultLocale ? path : `/${locale}${path}`;
}

/** The same page with the locale prefix removed. */
export function unlocalizePath(path: string) {
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    if (path === `/${locale}`) return "/";
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
  }
  return path;
}

// --- Content ---

const collections = {
  ru: { home: "home", projects: "projects" },
  en: { home: "homeEn", projects: "projectsEn" },
} as const;

export async function getProjects(locale: Locale) {
  const entries = await getCollection(collections[locale].projects);
  return entries.sort((a, b) => a.data.order - b.data.order);
}

export function getHomeEntry(locale: Locale, id: "intro" | "releases" | "outro") {
  return getEntry(collections[locale].home, id);
}

/** getStaticPaths for a locale's project pages. */
export async function projectPaths(locale: Locale) {
  // A project missing from another locale must not advertise a page there.
  const ids = Object.fromEntries(
    await Promise.all(
      locales.map(async (l) => [l, new Set((await getProjects(l)).map((entry) => entry.id))] as const)
    )
  ) as Record<Locale, Set<string>>;

  return (await getProjects(locale)).map((entry) => ({
    params: { slug: entry.id },
    props: { entry, locale, alternates: locales.filter((l) => ids[l].has(entry.id)) },
  }));
}
