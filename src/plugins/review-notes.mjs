// Dev-only: serves the annotation layer (src/dev/review-notes.js) and the
// endpoint it posts to. Notes are appended to REVIEW.md in the repo root.
// Never loaded by `astro build`, so nothing of this reaches the deployed site.

import fs from "node:fs";
import path from "node:path";

const FILE = "REVIEW.md";
const HEADER =
  "# Замечания\n\n" +
  "Пишутся из режима разметки в дев-сервере (Alt+A). Разобранные пункты помечай `x`.\n";

function append(note) {
  const stamp = new Date().toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines = [
    `- [ ] **${note.text.replace(/\s+/g, " ").trim()}**`,
    `  - страница: \`${note.page}\``,
  ];

  // A note can be about several elements at once (Shift+click).
  const targets = note.targets ?? [{ selector: note.selector, label: note.label }];
  for (const [index, target] of targets.entries()) {
    const number = targets.length > 1 ? `${index + 1}. ` : "";
    lines.push(`  - элемент: ${number}\`${target.selector}\``);
    if (target.label) lines.push(`    - текст: «${target.label}»`);
  }

  lines.push(`  - ${note.viewport}, ${stamp}`);

  const file = path.resolve(FILE);
  if (!fs.existsSync(file)) fs.writeFileSync(file, HEADER, "utf8");
  fs.appendFileSync(file, `\n${lines.join("\n")}\n`, "utf8");
}

function endpoint() {
  return {
    name: "review-notes-endpoint",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__review-note", (req, res, next) => {
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
          // A note is a few hundred bytes; anything larger is not one.
          if (body.length > 64_000) req.destroy();
        });
        req.on("end", () => {
          try {
            append(JSON.parse(body));
            res.statusCode = 204;
          } catch (error) {
            res.statusCode = 400;
            server.config.logger.error(`[review-notes] ${error.message}`);
          }
          res.end();
        });
      });
    },
  };
}

// The markdown pipeline and this script are read once, at startup. Watching
// them makes the dev server restart itself on an edit, instead of quietly
// serving the old behaviour until someone notices.
function watchPipeline(addWatchFile, logger) {
  if (typeof addWatchFile !== "function") return;

  for (const dir of ["src/plugins", "src/dev"]) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (/\.(mjs|js|ts)$/.test(name)) addWatchFile(path.resolve(dir, name));
    }
  }
  logger.info("правки в src/plugins и src/dev перезапускают дев-сервер");
}

export default function reviewNotes() {
  return {
    name: "review-notes",
    hooks: {
      "astro:config:setup"({ command, injectScript, updateConfig, addWatchFile, logger }) {
        if (command !== "dev") return;
        updateConfig({ vite: { plugins: [endpoint()] } });
        injectScript("page", 'import "/src/dev/review-notes.js";');
        watchPipeline(addWatchFile, logger);
        logger.info("режим разметки: Alt+A, заметки идут в REVIEW.md");
      },
    },
  };
}
