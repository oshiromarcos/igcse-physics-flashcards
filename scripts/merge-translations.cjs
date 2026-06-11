const fs = require("fs");
const path = require("path");

const allowTextMismatch = process.argv.includes("--allow-text-mismatch");
const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const sourcePath = positionalArgs[0];
const targetPath = positionalArgs[1] || "src/data/all-cards.json";

if (!sourcePath) {
  console.error("Usage: npm run merge:translations -- path/to/translated-cards.json");
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const target = JSON.parse(fs.readFileSync(targetPath, "utf8"));
const bySourceCard = new Map();
const errors = [];

function sourceKey(card) {
  const file = card.source?.file || card.sourceFile || "";
  const cardNumber = card.source?.cardNumber || card.cardNumber || "";
  return `${file}#${cardNumber}`;
}

for (const card of source) {
  const key = sourceKey(card);
  if (!key || key === "#") {
    errors.push(`${card.id || "unknown"}: missing source file/card number`);
    continue;
  }
  if (bySourceCard.has(key)) errors.push(`${card.id || key}: duplicate source key ${key}`);
  bySourceCard.set(key, card);
}

let merged = 0;
let missing = 0;
let empty = 0;
let textMismatch = 0;

for (const card of target) {
  const match = bySourceCard.get(sourceKey(card));
  if (!match) {
    missing += 1;
    continue;
  }

  if ((card.front || "").trim() !== (match.front || "").trim() || (card.back || "").trim() !== (match.back || "").trim()) {
    textMismatch += 1;
    if (!allowTextMismatch) {
      errors.push(`${card.id}: English text mismatch for ${sourceKey(card)}`);
      continue;
    }
  }

  if (!match.frontZh || !match.backZh) {
    empty += 1;
    continue;
  }

  card.frontZh = match.frontZh;
  card.backZh = match.backZh;
  card.translationStatus = match.translationStatus || "imported";
  card.translationNotes = match.translationNotes || "";
  merged += 1;
}

console.log(`Source cards: ${source.length}`);
console.log(`Target cards: ${target.length}`);
console.log(`Merged translations: ${merged}`);
console.log(`Missing source matches: ${missing}`);
console.log(`Source matches with empty translations: ${empty}`);
console.log(`Text mismatches: ${textMismatch}`);

if (errors.length) {
  console.error(`Errors: ${errors.length}`);
  for (const error of errors.slice(0, 50)) console.error(`- ${error}`);
  if (errors.length > 50) console.error(`... ${errors.length - 50} more`);
  process.exit(1);
}

if (merged === 0) {
  console.error("No translations were merged.");
  process.exit(1);
}

const backupPath = `${targetPath}.${Date.now()}.bak`;
fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, JSON.stringify(target, null, 2) + "\n");
console.log(`Updated ${targetPath}`);
console.log(`Backup written to ${path.relative(process.cwd(), backupPath)}`);
