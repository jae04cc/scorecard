// One-time script to generate PNG icons from icon.svg
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "../public/icon.svg");
const svg = readFileSync(svgPath);

const sizes = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of sizes) {
  const out = join(__dirname, "../public", file);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log(`Generated ${file} (${size}x${size})`);
}
