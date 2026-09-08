// One-off Notion HTML export -> Astro content collection converter.
import fs from "node:fs";
import path from "node:path";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const ROOT = "X:/Projects/Portfolio";
const NOTION_DIR = path.join(
  ROOT,
  "Notion/Private & Shared/Портфолио Варганов Арсений/Проекты"
);
const OUT_CONTENT = path.join(ROOT, "src/content/projects");
const OUT_PUBLIC = path.join(ROOT, "public/projects");

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
turndown.use(gfm);

const projects = [
  { file: "Game-ops платформа и веб-редактор уровней 3d448ea7ae7e816e8c14e8f913c0ba34.html", slug: "gameops-platform", emoji: "🔧", period: "2026", order: 1,
    summary: "Разработан engine-agnostic формат игровых данных и MVP веб-редактора уровней для автоматизации создания и проверки уровней в тайм-менеджмент играх." },
  { file: "Argonauts Agency The World on His Shoulders 3d448ea7ae7e8145bdc8dcb8efc7b825.html", slug: "argonauts-agency", emoji: "🪨", period: "2026", order: 2,
    summary: "Очередная игра в тайм-менеджмент франшизе. Делал дизайн уровней, добавил новый игровой объект, интегрировал ассеты." },
  { file: "VR-опыт «Бункер Трибуца» 3d448ea7ae7e812a804ce5ce26860cac.html", slug: "bunker-tributsa-vr", emoji: "🚢", period: "2024", order: 3,
    summary: "Музейный интерактивный проект на Unity для Quest 2, реализованный полностью в VR. Делал гейм-дизайн, всю техническую реализацию, представлял на выставках." },
  { file: "Intersectio 3d448ea7ae7e81d88febfca56ea11b23.html", slug: "intersectio", emoji: "🎃", period: "2025", order: 4,
    summary: "Тактическая головоломка в мрачном фэнтези. Делал геймдизайн, нарративный дизайн и техническую реализацию на Godot. Релиз на Itch и в Steam." },
  { file: "Game jams 3d448ea7ae7e81088760e9c292640dfa.html", slug: "game-jams", emoji: "🍑", period: "2020-∞", order: 5,
    summary: "Участвовал в более чем 15 игровых джемах в роли геймдизайнера и программиста, добившись лучших результатов с игрой Goops, заняв 40-е место в Ludum Dare 56 и попав в топ-20 категорий fun, mood, art и theme." },
  { file: "Wellbeing Garden 3d448ea7ae7e812d9589e310f48854c0.html", slug: "wellbeing-garden", emoji: "🧑‍🌾", period: "2026", order: 6,
    summary: "Дипломный проект как режиссёра цифровых медиа. Симулятор садовника с элементами визуальной новеллы. Делал геймдизайн, нарративный дизайн, код." },
  { file: "Forest of the Debt 3d448ea7ae7e81f5b4c3d4b007b8bd2e.html", slug: "forest-of-the-debt", emoji: "🌲", period: "2024", order: 7,
    summary: "Пошаговый тактический roguelike, прототип прошел в финал акселератора «Начни игру». Делал геймдизайн, нарратив, код." },
  { file: "Roads of Da Vinci In Search of Origins 3d448ea7ae7e815da591fbbd0e122c5d.html", slug: "roads-of-da-vinci", emoji: "🏺", period: "2026", order: 8,
    summary: "Тайм-менеджер, первая игра франшизы. Делал технический геймдизайн, настройку уровней, исправление багов, тестирование." },
  { file: "Restaurant Tycoon 3d448ea7ae7e81b69f5fff35f5ad7a62.html", slug: "restaurant-tycoon", emoji: "🍝", period: "2025", order: 9,
    summary: "Мобильный тайкун, проект был заморожен. Делал дизайн core геймплея." },
];

fs.mkdirSync(OUT_CONTENT, { recursive: true });

function extractTitle(html) {
  const m = html.match(/<h1 class="page-title"[^>]*>([\s\S]*?)<\/h1>/);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function extractBody(html) {
  const m = html.match(/<div class="page-body">([\s\S]*)<\/div><\/article>/);
  return m ? m[1] : "";
}

function yamlEscape(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

for (const p of projects) {
  const srcPath = path.join(NOTION_DIR, p.file);
  const html = fs.readFileSync(srcPath, "utf-8");
  const title = extractTitle(html) || p.slug;
  let body = extractBody(html);

  // Copy local images (relative paths, not http/https) into public/projects/<slug>/
  const imgDirOut = path.join(OUT_PUBLIC, p.slug);
  const imgRefs = [...body.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of imgRefs) {
    if (/^https?:\/\//.test(ref)) continue;
    const decoded = decodeURIComponent(ref);
    const srcImgPath = path.join(NOTION_DIR, decoded);
    if (!fs.existsSync(srcImgPath)) continue;
    fs.mkdirSync(imgDirOut, { recursive: true });
    const baseName = path
      .basename(decoded)
      .replace(/\s+/g, "-")
      .toLowerCase();
    fs.copyFileSync(srcImgPath, path.join(imgDirOut, baseName));
    const newRef = `/projects/${p.slug}/${baseName}`;
    body = body.split(`src="${ref}"`).join(`src="${newRef}"`);
    body = body.split(`href="${ref}"`).join(`href="${newRef}"`);
  }

  const markdown = turndown.turndown(body).trim();

  const frontmatter = `---
title: "${yamlEscape(title)}"
slug: "${p.slug}"
emoji: "${p.emoji}"
period: "${p.period}"
summary: "${yamlEscape(p.summary)}"
order: ${p.order}
---

`;

  fs.writeFileSync(
    path.join(OUT_CONTENT, `${p.slug}.md`),
    frontmatter + markdown + "\n"
  );
  console.log(`wrote ${p.slug}.md (${markdown.length} chars markdown)`);
}
