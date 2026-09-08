import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    period: z.string(),
    summary: z.string(),
    order: z.number(),
    cover: z.string().optional(),
  }),
});

const home = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/home" }),
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = { projects, home };
