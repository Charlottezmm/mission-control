import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Mission Control icon">\n  <defs>\n    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">\n      <stop offset="0%" stop-color="#8b5cf6" />\n      <stop offset="100%" stop-color="#7c3aed" />\n    </linearGradient>\n  </defs>\n  <rect width="512" height="512" rx="120" fill="url(#bg)" />\n  <circle cx="256" cy="256" r="176" fill="#ffffff" fill-opacity="0.18" />\n  <text x="256" y="300" text-anchor="middle" font-size="208" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">🚀</text>\n</svg>\n`;

await fs.mkdir(publicDir, { recursive: true });
await fs.writeFile(path.join(publicDir, "icon.svg"), iconSvg, "utf8");

try {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const svgBuffer = Buffer.from(iconSvg);

  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(publicDir, "icon-192.png"));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(publicDir, "icon-512.png"));

  console.log("Generated: public/icon.svg, public/icon-192.png, public/icon-512.png");
} catch {
  console.log("Generated: public/icon.svg (sharp not available, PNG generation skipped)");
}
