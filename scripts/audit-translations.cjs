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
    reviewNotes: 0,
    reviewedChinese: 0,
    highRisk: 0,
    needsHumanReview: 0,
    missingFrontZh: 0,
    missingBackZh: 0,
  };

  current.total += 1;
  if (isExtendedTier(card)) current.extended += 1;
  if (card.translationNotes) current.reviewNotes += 1;
  if (card.reviewStatus === "student_ready" || card.reviewStatus === "student_ready_patch") {
    current.reviewedChinese += 1;
  }
  if (card.reviewStatus === "high_risk") current.highRisk += 1;
  if (card.reviewStatus === "needs_human_review") current.needsHumanReview += 1;
  if (!card.frontZh) current.missingFrontZh += 1;
  if (!card.backZh) current.missingBackZh += 1;
  byTopic.set(topic, current);
}

const totals = [...byTopic.values()].reduce(
  (sum, topic) => ({
    total: sum.total + topic.total,
    extended: sum.extended + topic.extended,
    reviewNotes: sum.reviewNotes + topic.reviewNotes,
    reviewedChinese: sum.reviewedChinese + topic.reviewedChinese,
    highRisk: sum.highRisk + topic.highRisk,
    needsHumanReview: sum.needsHumanReview + topic.needsHumanReview,
    missingFrontZh: sum.missingFrontZh + topic.missingFrontZh,
    missingBackZh: sum.missingBackZh + topic.missingBackZh,
  }),
  {
    total: 0,
    extended: 0,
    reviewNotes: 0,
    reviewedChinese: 0,
    highRisk: 0,
    needsHumanReview: 0,
    missingFrontZh: 0,
    missingBackZh: 0,
  }
);

console.log(`Cards: ${totals.total}`);
console.log(`Extended-tier cards: ${totals.extended}`);
console.log(`Cards flagged for translation review: ${totals.reviewNotes}`);
console.log(`Reviewed Chinese cards: ${totals.reviewedChinese}`);
console.log(`High-risk draft translations: ${totals.highRisk}`);
console.log(`Needs human review: ${totals.needsHumanReview}`);
console.log(`Missing frontZh: ${totals.missingFrontZh}`);
console.log(`Missing backZh: ${totals.missingBackZh}`);

for (const [topic, stats] of [...byTopic.entries()].sort()) {
  console.log(
    `${topic}: ${stats.total} cards, ${stats.extended} extended, ` +
    `${stats.reviewedChinese} reviewed Chinese, ${stats.highRisk} high-risk, ` +
    `${stats.needsHumanReview} needs human review, ${stats.reviewNotes} review notes, ` +
    `${stats.missingFrontZh} missing frontZh, ${stats.missingBackZh} missing backZh`
  );
}
