const fs = require("fs");

const cards = JSON.parse(fs.readFileSync("src/data/all-cards.json", "utf8"));
const warnings = [];

function stripMath(text) {
  return String(text || "")
    .replace(/\\\[[\s\S]*?\\\]/g, " ")
    .replace(/\\\([\s\S]*?\\\)/g, " ");
}

function plain(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function snippet(text) {
  const value = plain(text);
  return value.length > 150 ? `${value.slice(0, 147)}...` : value;
}

function warn(card, type, detail, text) {
  warnings.push({
    id: card.id,
    topicCode: card.topicCode || "",
    type,
    detail,
    snippet: snippet(text || `${card.front || ""} ${card.back || ""}`),
  });
}

const rawMathPatterns = [
  /\b(?:kgm|kg m|m s|ms|rad s|C kg|N C|J kg|W m|mol|g mol)\s*\^\s*\{[-+]?\d+\}/i,
  /\bm\s*\^\s*\{[23]\}/i,
  /\bs\s*\^\s*\{-1\}/i,
  /\^[{][-+]?\d+[}]/,
  /(?:Ω|Ω)\s*m/i,
];

const mismatchRules = [
  {
    front: /\b(Wien|black[- ]?body|blackbody|wavelength)\b/i,
    back: /\b(decay|activity|radioactive|half-life)\b/i,
    label: "front appears to be waves/black-body but back mentions decay/activity",
  },
  {
    front: /\b(gas|pressure law|ideal gas|thermal physics)\b/i,
    back: /\b(radioactive|decay|activity|half-life)\b/i,
    label: "front appears thermal/gas but back mentions decay/activity",
  },
  {
    front: /\b(field|electric field|gravitational field)\b/i,
    back: /\b(wavelength|interference|diffraction|standing wave)\b/i,
    label: "front appears fields but back mentions waves",
  },
];

for (const card of cards) {
  const fields = [
    ["front", card.front],
    ["back", card.back],
    ["frontZh", card.frontZh],
    ["backZh", card.backZh],
  ];

  for (const [field, value] of fields) {
    const outsideMath = stripMath(value);
    if (rawMathPatterns.some((pattern) => pattern.test(outsideMath))) {
      warn(card, "raw formula/unit", `${field} may need KaTeX wrapping`, value);
    }
  }

  const english = `${card.front || ""} ${card.back || ""}`;
  const chinese = `${card.frontZh || ""} ${card.backZh || ""}`;
  const englishLower = plain(english).toLowerCase();

  if (
    chinese.includes("电源") &&
    englishLower.includes("power") &&
    !englishLower.includes("power supply") &&
    !englishLower.includes("power source")
  ) {
    warn(card, "Chinese term", "电源 may mean 功率 here", chinese);
  }

  if (
    chinese.includes("音量") &&
    englishLower.includes("volume") &&
    !/\b(sound|audio|loudness|amplitude)\b/.test(englishLower)
  ) {
    warn(card, "Chinese term", "音量 may mean 体积 here", chinese);
  }

  for (const rule of mismatchRules) {
    if (rule.front.test(card.front || "") && rule.back.test(card.back || "")) {
      warn(card, "keyword mismatch", rule.label, `${card.front || ""} ${card.back || ""}`);
    }
  }
}

console.log(`Total cards: ${cards.length}`);

if (warnings.length === 0) {
  console.log("No audit warnings found.");
  process.exit(0);
}

for (const warning of warnings) {
  console.log(
    `[${warning.type}] ${warning.id} ${warning.topicCode}: ${warning.detail}\n  ${warning.snippet}`
  );
}

console.log(`Warnings: ${warnings.length}`);
