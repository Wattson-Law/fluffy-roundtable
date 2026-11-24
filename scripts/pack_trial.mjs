// Pack the same React tree as /trial, not a scripted imitation. Works from file:// with no server.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { strToU8, zipSync } from "fflate";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = (p) => path.join(root, p);
const built = await build({
  absWorkingDir: root,
  bundle: true,
  minify: true,
  write: false,
  metafile: true,
  target: "es2022",
  charset: "utf8",
  legalComments: "eof",
  define: { "process.env.NODE_ENV": '"production"' },
  stdin: {
    contents:
      'import {createRoot} from "react-dom/client"; import {createElement} from "react"; import {ReaderTrial} from "@/components/trial/ReaderTrial"; createRoot(document.getElementById("seat")).render(createElement(ReaderTrial));',
    resolveDir: root,
  },
  plugins: [
    {
      name: "inline-approved-art",
      setup(builder) {
        builder.onLoad({ filter: /\.(webp|png)$/ }, async ({ path: p }) => ({
          contents: `export default {src:"data:image/${path.extname(p).slice(1)};base64,${(await readFile(p)).toString("base64")}"}`,
          loader: "js",
        }));
      },
    },
  ],
});
const inputs = Object.keys(built.metafile.inputs);
if (inputs.some((p) => /(?:^|\/)src\/(?:app\/api\/|lib\/storage\.ts$)/.test(p))) {
  throw new Error("The portable trial must not import the app's storage or API handlers.");
}
const sheet = (
  await Promise.all(
    ["globals.css", "reading-room.css", "trial/trial.css"].map((p) =>
      readFile(target("src/app/" + p), "utf8"),
    ),
  )
).join("\n");
const { css } = await postcss([tailwindcss(target("tailwind.config.ts")), autoprefixer]).process(
  sheet,
  { from: target("src/app/globals.css") },
);
const script = built.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const hash = createHash("sha256").update(script).digest("base64");
// Retain the distributed libraries' notices inside the single file, including when shared on its own.
const packages = new Set(["node_modules/tailwindcss"]);
for (const input of inputs) {
  const pkg = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//)?.[1];
  if (pkg) packages.add(pkg);
}
const notices = [];
for (const pkg of [...packages].sort()) {
  const files = (await readdir(target(pkg))).filter((f) =>
    /^(license|copying|notice|copyrightnotice)(\..*)?$/i.test(f),
  );
  for (const f of files.sort())
    notices.push(
      pkg.split("node_modules/").at(-1) + "\n" + (await readFile(target(pkg + "/" + f), "utf8")),
    );
}
const credits = notices
  .join("\n\n")
  .replace(/\r\n/g, "\n")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;");
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>窗边试聊 · 毛茸茸圆桌</title><style>${css}</style></head><body class="font-sans antialiased"><div id="seat"></div><noscript>请用启用了 JavaScript 的浏览器打开这封窗边来信。</noscript><template id="third-party-notices"><pre>${credits}</pre></template><script>${script}</script></body></html>`;
await mkdir(target("dist/reader-trial"), { recursive: true });
await writeFile(target("dist/reader-trial/window-seat.html"), html);
const zip = zipSync(
  { "window-seat.html": strToU8(html) },
  { mtime: new Date(2020, 0, 1), level: 9 },
);
await writeFile(target("docs/reader-trial/window-seat.zip"), zip);
console.log(`Packed window-seat.zip (${(zip.length / 1048576).toFixed(1)} MiB), one offline page.`);
