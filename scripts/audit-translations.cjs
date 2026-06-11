const fs = require("fs");

const cards = JSON.parse(fs.readFileSync("src/data/all-cards.json", "utf8"));
const byTopic = new Map();

function isExtendedTier(card) {
  return /Extended Tier Only/i.test(`${card.front || ""}\n${card.back || ""}`);
}

for (const card of cards) {
  const topic = String(card.topicCode || "Unknown").split(".")[0];
  const current = byTopic.get(topic) || {
    total: 0,
    extended: 0,
    missingFrontZh: 0,
    missingBackZh: 0,
  };

  current.total += 1;
  if (isExtendedTier(card)) current.extended += 1;
  if (!card.frontZh) current.missingFrontZh += 1;
  if (!card.backZh) current.missingBackZh += 1;
  byTopic.set(topic, current);
}

const totals = [...byTopic.values()].reduce(
  (sum, topic) => ({
    total: sum.total + topic.total,
    extended: sum.extended + topic.extended,
    missingFrontZh: sum.missingFrontZh + topic.missingFrontZh,
    missingBackZh: sum.missingBackZh + topic.missingBackZh,
  }),
  { total: 0, extended: 0, missingFrontZh: 0, missingBackZh: 0 }
);

console.log(`Cards: ${totals.total}`);
console.log(`Extended-tier cards: ${totals.extended}`);
console.log(`Missing frontZh: ${totals.missingFrontZh}`);
console.log(`Missing backZh: ${totals.missingBackZh}`);

for (const [topic, stats] of [...byTopic.entries()].sort()) {
  console.log(
    `${topic}: ${stats.total} cards, ${stats.extended} extended, ` +
    `${stats.missingFrontZh} missing frontZh, ${stats.missingBackZh} missing backZh`
  );
}
