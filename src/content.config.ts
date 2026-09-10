import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Russian content sits in src/content/<collection>, English in src/content/en/<collection>.

const projectSchema = z.object({
  title: z.string(),
  period: z.string(),
  summary: z.string(),
  order: z.number(),
  cover: z.string().optional(),
});

const homeSchema = z.object({
  title: z.string(),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: projectSchema,
});

const home = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/home" }),
  schema: homeSchema,
});

const projectsEn = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/en/projects" }),
  schema: projectSchema,
});

const homeEn = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/en/home" }),
  schema: homeSchema,
});

export const collections = { projects, home, projectsEn, homeEn };
