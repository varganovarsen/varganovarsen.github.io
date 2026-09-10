import { config, fields, collection, singleton } from "@keystatic/core";

// Assets live under public/projects/<slug>/... for existing entries. Keystatic
// derives a file name by slicing publicPath off the stored value, so publicPath
// must be the common prefix of every path already in the content files.
const assetLocation = {
  directory: "public/projects",
  publicPath: "/projects/",
} as const;

const imageUpload = { image: assetLocation } as const;

// Each locale gets the same set of entries; English content sits under
// src/content/en/ and shares the images in public/projects/.
function homeSingletons(dir: string, prefix: string) {
  return {
    intro: singleton({
      label: `${prefix}Главная — до проектов`,
      path: `${dir}/home/intro`,
      format: { contentField: "content" },
      schema: {
        title: fields.text({ label: "Имя", description: "Крупный заголовок страницы" }),
        content: fields.mdx({ label: "Текст", extension: "md", options: imageUpload }),
      },
    }),
    releases: singleton({
      label: `${prefix}Главная — релизы (над проектами)`,
      path: `${dir}/home/releases`,
      format: { contentField: "content" },
      schema: {
        title: fields.text({ label: "Служебное название" }),
        content: fields.mdx({ label: "Текст", extension: "md", options: imageUpload }),
      },
    }),
    outro: singleton({
      label: `${prefix}Главная — после проектов`,
      path: `${dir}/home/outro`,
      format: { contentField: "content" },
      schema: {
        title: fields.text({ label: "Служебное название" }),
        content: fields.mdx({ label: "Текст", extension: "md", options: imageUpload }),
      },
    }),
  };
}

function projectsCollection(dir: string, prefix: string) {
  return collection({
    label: `${prefix}Проекты`,
    // No trailing slash: entries stay flat files, <dir>/projects/<slug>.md
    path: `${dir}/projects/*`,
    slugField: "title",
    format: { contentField: "content" },
    columns: ["title", "period"],
    schema: {
      title: fields.slug({
        name: { label: "Название" },
        slug: {
          label: "Адрес страницы (slug)",
          description: "Должен совпадать у русской и английской версий проекта",
        },
      }),
      period: fields.text({ label: "Период", description: "Например: 2025 или 2020-∞" }),
      summary: fields.text({
        label: "Краткое описание",
        description: "Текст на карточке в сетке проектов",
        multiline: true,
      }),
      order: fields.integer({
        label: "Порядок",
        description: "Чем меньше число, тем выше карточка",
      }),
      cover: fields.image({
        label: "Обложка",
        description: "Картинка карточки в сетке проектов (16:9)",
        ...assetLocation,
      }),
      content: fields.mdx({
        label: "Содержание",
        description:
          "Чип: {Goops|https://…} — прямо в тексте. " +
          "Панель: |Intersectio|https://…|Роль| — отдельной строкой, роль можно не писать.",
        extension: "md",
        options: imageUpload,
      }),
    },
  });
}

const ru = homeSingletons("src/content", "");
const en = homeSingletons("src/content/en", "EN · ");

export default config({
  storage: { kind: "local" },
  ui: {
    brand: { name: "Портфолио" },
  },
  singletons: {
    ...ru,
    introEn: en.intro,
    releasesEn: en.releases,
    outroEn: en.outro,
  },
  collections: {
    projects: projectsCollection("src/content", ""),
    projectsEn: projectsCollection("src/content/en", "EN · "),
  },
});
