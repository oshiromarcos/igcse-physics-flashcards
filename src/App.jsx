import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import "./App.css";
import rawCards from "./data/all-cards.json";

const TOPIC_ORDER = [
  "T1.1", "T1.2", "T1.3", "T1.4", "T1.5", "T1.6", "T1.7", "T1.8", "T1.9",
  "T2.1", "T2.2", "T2.3",
  "T3.1", "T3.2", "T3.3", "T3.4",
  "T4.1", "T4.2", "T4.3", "T4.4",
  "T5.1", "T5.2",
  "T6.1", "T6.2",
];

const THEME_LABELS = {
  T1: "Topic 1 — Motion, Forces and Energy",
  T2: "Topic 2 — Thermal Physics",
  T3: "Topic 3 — Waves",
  T4: "Topic 4 — Electricity and Magnetism",
  T5: "Topic 5 — Nuclear Physics",
  T6: "Topic 6 — Space Physics",
};

const COURSE_MODES = [
  { value: "IGCSE", label: "IGCSE" },
  { value: "EXTENDED", label: "Extended IGCSE" },
];

const LANGUAGE_MODES = [
  { value: "en", label: "English only" },
  { value: "zh", label: "Chinese only", needsTranslations: true },
  { value: "both", label: "English + Chinese", needsTranslations: true },
];

const STORAGE_KEY = "igcse-physics-flashcards:study-progress:v1";
const LEGACY_REVIEW_IDS_KEY = "igcse-physics-review-ids";
const GITHUB_ISSUE_URL = "https://github.com/oshiromarcos/igcse-physics-flashcards/issues/new";
const TRANSLATION_NOTICE = "中文翻译用于辅助学习，英文原文为准。";
const DEFAULT_PROGRESS = {
  levelMode: "IGCSE",
  languageMode: "en",
  selectedSubtopic: "All topics",
  currentCardIndex: 0,
  reviewIds: [],
  knownIds: [],
  studyMode: "all",
  shuffleOn: false,
  darkMode: false,
};

function isExtendedTierCard(card) {
  return /Extended Tier Only/i.test(`${card.front || ""}\n${card.back || ""}`);
}

function cardTierLabel(card) {
  return isExtendedTierCard(card) ? "Extended IGCSE" : "IGCSE";
}

function hasReviewedChinese(card) {
  return Boolean(
    card?.frontZh &&
    card?.backZh &&
    ["student_ready", "student_ready_patch"].includes(card.reviewStatus)
  );
}

const cards = rawCards.map((card, index) => ({
  ...card,
  id: card.id || `card-${index + 1}`,
  levels: isExtendedTierCard(card) ? ["EXTENDED"] : ["IGCSE", "EXTENDED"],
  frontImages: card.frontImages || (card.frontImage ? [card.frontImage] : []),
  backImages: card.backImages || (card.backImage ? [card.backImage] : []),
  bookletFormulas: card.bookletFormulas || [],
}));

const cardIds = new Set(cards.map((card) => card.id));
const topicCodes = new Set(cards.flatMap((card) => [card.topicCode, topicGroup(card.topicCode)]));
const reviewedChineseCount = cards.filter(hasReviewedChinese).length;
const translatedChineseCount = cards.filter((card) => card.frontZh || card.backZh).length;
const hasChineseTranslations = translatedChineseCount > 0;

const REVIEW_THEME = {
  accent: "#7c2d12",
  accentSoft: "#fed7aa",
  pageStart: "#fff7ed",
  pageEnd: "#fae8ff",
  cardFront: "#fffaf0",
  cardBack: "#ffedd5",
  glow: "rgba(251, 146, 60, 0.28)",
};

const SWIPE_ACTIVATION_PX = 3;
const SWIPE_MIN_DISTANCE_PX = 12;
const SWIPE_DISTANCE_RATIO = 0.035;
const SWIPE_VELOCITY_PX_PER_MS = 0.08;
const SWIPE_EXIT_MS = 150;
const SWIPE_ENTER_MS = 210;
const TEXT_SELECTION_HOLD_MS = 420;

function themeForTopic(topicCode, studyMode) {
  if (studyMode === "review") return REVIEW_THEME;

  const themes = {
    T1: {
      accent: "#334155",
      accentSoft: "#e2e8f0",
      pageStart: "#f8fafc",
      pageEnd: "#eef2ff",
      cardFront: "#ffffff",
      cardBack: "#f8fafc",
      glow: "rgba(51, 65, 85, 0.18)",
    },
    T2: {
      accent: "#6d28d9",
      accentSoft: "#ede9fe",
      pageStart: "#f5f3ff",
      pageEnd: "#eef2ff",
      cardFront: "#ffffff",
      cardBack: "#f5f3ff",
      glow: "rgba(109, 40, 217, 0.18)",
    },
    T3: {
      accent: "#4f46e5",
      accentSoft: "#e0e7ff",
      pageStart: "#eef2ff",
      pageEnd: "#fdf2f8",
      cardFront: "#ffffff",
      cardBack: "#f5f3ff",
      glow: "rgba(79, 70, 229, 0.2)",
    },
    T4: {
      accent: "#0f766e",
      accentSoft: "#ccfbf1",
      pageStart: "#ecfdf5",
      pageEnd: "#fff7ed",
      cardFront: "#fffdf7",
      cardBack: "#ecfeff",
      glow: "rgba(15, 118, 110, 0.2)",
    },
    T5: {
      accent: "#be123c",
      accentSoft: "#ffe4e6",
      pageStart: "#fff1f2",
      pageEnd: "#eff6ff",
      cardFront: "#ffffff",
      cardBack: "#fff1f2",
      glow: "rgba(190, 18, 60, 0.18)",
    },
    T6: {
      accent: "#0369a1",
      accentSoft: "#e0f2fe",
      pageStart: "#f0f9ff",
      pageEnd: "#ecfeff",
      cardFront: "#ffffff",
      cardBack: "#f0f9ff",
      glow: "rgba(3, 105, 161, 0.18)",
    },
  };

  const code = String(topicCode);
  return themes[code.split(".")[0]] || themes.T1;
}

function topicGroup(topicCode) {
  const code = String(topicCode);
  return code.split(".")[0];
}

function imageSrc(path) {
  if (!path) return "";
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}

function renderRichMathToHtml(text, displayModeDefault = false) {
  const raw = String(text || "");
  const parts = raw.split(/(\\\(.+?\\\)|\\\[.+?\\\])/gs);

  return parts
    .map((part) => {
      const isInlineMath = part.startsWith("\\(") && part.endsWith("\\)");
      const isDisplayMath = part.startsWith("\\[") && part.endsWith("\\]");
      if (isInlineMath || isDisplayMath) {
        const tex = part.slice(2, -2);
        return katex.renderToString(tex, {
          throwOnError: false,
          displayMode: isDisplayMath || displayModeDefault,
        });
      }
      return part;
    })
    .join("");
}

function RichText({ text }) {
  return (
    <div
      className="mathText"
      dangerouslySetInnerHTML={{ __html: renderRichMathToHtml(text) }}
    />
  );
}

function cardTextSections(card, side, languageMode) {
  const isFront = side === "front";
  const english = isFront ? card.front : card.back;
  const chinese = isFront ? card.frontZh : card.backZh;

  if (languageMode === "zh") {
    return [{ language: chinese ? "zh" : "en", text: chinese || english }];
  }

  if (languageMode === "both" && chinese) {
    return [
      { language: "en", text: english },
      { language: "zh", text: chinese },
    ];
  }

  return [{ language: "en", text: english }];
}

function FormulaList({ formulas }) {
  if (!formulas?.length) return null;

  const hasUseful = formulas.some(
    (formula) => formula.source && !/data booklet/i.test(formula.source)
  );

  const hasBooklet = formulas.some(
    (formula) => !formula.source || /data booklet/i.test(formula.source)
  );

  const title = hasUseful && hasBooklet
    ? "Formula reminders"
    : hasUseful
      ? "Useful formula reminder"
      : "Data booklet formula";

  return (
    <section className="formulaBox" onClick={(event) => event.stopPropagation()}>
      <div className="formulaTitle">{title}</div>
      {formulas.map((formula, index) => (
        <div className="formulaItem" key={`${formula.label}-${index}`}>
          <span className="formulaLabel">{formula.label}</span>
          <span
            className="formulaMath"
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(formula.tex, {
                throwOnError: false,
                displayMode: true,
              }),
            }}
          />
          {formula.source && !/data booklet/i.test(formula.source) && (
            <span className="formulaSource">{formula.source}</span>
          )}
        </div>
      ))}
    </section>
  );
}


function cardReportCode(card) {
  const raw = String(card?.id || "unknown-card");
  return raw;
}

function githubIssueUrlForCard(card) {
  const cardCode = cardReportCode(card);
  const params = new URLSearchParams({
    title: `[Card issue] ${cardCode}`,
    body: [
      "Card code:",
      cardCode,
      "",
      "Problem type (to select):",
      "- Translation",
      "- Formula",
      "- Typo",
      "- Physics explanation",
      "- UI issue",
      "- Other",
      "",
      "Description:",
      "(write here)",
    ].join("\n"),
  });

  return `${GITHUB_ISSUE_URL}?${params.toString()}`;
}

function openIssueForCard(card) {
  window.open(githubIssueUrlForCard(card), "_blank", "noopener,noreferrer");
}

function CardFace({ card, side, studyMode, isSaved, languageMode }) {
  const isFront = side === "front";
  const images = isFront ? card.frontImages : card.backImages;
  const textSections = cardTextSections(card, side, languageMode);
  const hasImages = images.some(Boolean);
  const hasImageOcclusion = images.some((image) => String(image).includes("/occlusion/"));
  const levelLabel = cardTierLabel(card);

  return (
    <div className={`cardFace ${isFront ? "cardFront" : "cardBack"} ${hasImages ? "hasImages" : ""} ${hasImageOcclusion ? "imageOcclusionFace" : ""}`}>
      {isSaved && <div className="savedBadge">Saved</div>}

      <div className="cardTop swipeZone">
        <div className="cardMeta">
          <span>{levelLabel}</span>
          <span>{card.topicCode}</span>
          <span>{isFront ? "Question" : "Answer"}</span>
          <button
            type="button"
            className="cardCodeBadge"
            title="Copy card code"
            aria-label={`Copy card code ${cardReportCode(card)}`}
            onClick={(event) => {
              event.stopPropagation();
              navigator.clipboard?.writeText(cardReportCode(card));
            }}
          >
            Copy code: {cardReportCode(card)}
          </button>
          {studyMode === "review" && <span>Review sprint</span>}
          {hasReviewedChinese(card) && <span>Reviewed Chinese</span>}
        </div>
        <div className="subtopicTitle">{card.subtopicFull || card.topic}</div>
      </div>

      <div className="cardContent">
        <div className={`translationStack ${textSections.length > 1 ? "hasTranslations" : ""}`}>
          {textSections.map((section) => (
            <section
              className={`translationBlock ${section.language === "zh" ? "translationZh" : "translationEn"}`}
              lang={section.language === "zh" ? "zh-CN" : "en"}
              key={section.language}
            >
              {textSections.length > 1 && (
                <div className="translationLabel">
                  {section.language === "zh" ? "中文" : "English"}
                </div>
              )}
              <RichText text={section.text} />
            </section>
          ))}
        </div>

        {images.filter(Boolean).map((image, index) => (
          <img
            key={`${image}-${index}`}
            className="cardImage"
            src={imageSrc(image)}
            alt=""
          />
        ))}

        {!isFront && <FormulaList formulas={card.bookletFormulas} />}
      </div>

      <div className="cardFooter swipeZone">
        <div className="tapHint">Tap to flip or swipe for another card</div>
        <button
          type="button"
          className="reportIssueButton"
          onClick={(event) => {
            event.stopPropagation();
            openIssueForCard(card);
          }}
        >
          Report issue
        </button>
      </div>
    </div>
  );
}

function randomIndex(length, currentIndex = -1) {
  if (length <= 1) return 0;
  let next = currentIndex;
  while (next === currentIndex) {
    next = Math.floor(Math.random() * length);
  }
  return next;
}

function uniqueValidCardIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => cardIds.has(id)))];
}

function loadLegacyReviewIds() {
  try {
    return uniqueValidCardIds(JSON.parse(localStorage.getItem(LEGACY_REVIEW_IDS_KEY) || "[]"));
  } catch {
    return [];
  }
}

function loadStudyProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const reviewIds = uniqueValidCardIds(stored?.reviewIds || loadLegacyReviewIds());
    const knownIds = uniqueValidCardIds(stored?.knownIds);
    const selectedSubtopic = stored?.selectedSubtopic === "All topics" || topicCodes.has(stored?.selectedSubtopic)
      ? stored.selectedSubtopic
      : DEFAULT_PROGRESS.selectedSubtopic;
    const studyMode = stored?.studyMode === "review" && reviewIds.length
      ? "review"
      : DEFAULT_PROGRESS.studyMode;

    return {
      ...DEFAULT_PROGRESS,
      levelMode: COURSE_MODES.some((mode) => mode.value === stored?.levelMode)
        ? stored.levelMode
        : DEFAULT_PROGRESS.levelMode,
      languageMode: LANGUAGE_MODES.some((mode) => mode.value === stored?.languageMode) && (
        stored?.languageMode === "en" || hasChineseTranslations
      )
        ? stored.languageMode
        : DEFAULT_PROGRESS.languageMode,
      selectedSubtopic,
      currentCardIndex: Number.isInteger(stored?.currentCardIndex) && stored.currentCardIndex >= 0
        ? stored.currentCardIndex
        : DEFAULT_PROGRESS.currentCardIndex,
      reviewIds,
      knownIds,
      studyMode,
      shuffleOn: typeof stored?.shuffleOn === "boolean" ? stored.shuffleOn : DEFAULT_PROGRESS.shuffleOn,
      darkMode: typeof stored?.darkMode === "boolean" ? stored.darkMode : DEFAULT_PROGRESS.darkMode,
    };
  } catch {
    return {
      ...DEFAULT_PROGRESS,
      reviewIds: loadLegacyReviewIds(),
    };
  }
}

export default function App() {
  const [initialProgress] = useState(loadStudyProgress);
  const [levelMode, setLevelMode] = useState(initialProgress.levelMode);
  const [languageMode, setLanguageMode] = useState(initialProgress.languageMode);
  const [selectedSubtopic, setSelectedSubtopic] = useState(initialProgress.selectedSubtopic);
  const [index, setIndex] = useState(initialProgress.currentCardIndex);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [flipped, setFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState(initialProgress.knownIds);
  const [reviewIds, setReviewIds] = useState(initialProgress.reviewIds);
  const [studyMode, setStudyMode] = useState(initialProgress.studyMode);
  const [shuffleOn, setShuffleOn] = useState(initialProgress.shuffleOn);
  const [darkMode, setDarkMode] = useState(initialProgress.darkMode);
  const [focusMode, setFocusMode] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeMotion, setSwipeMotion] = useState("");
  const appShellRef = useRef(null);
  const pointerStartRef = useRef(null);
  const touchStartRef = useRef(null);
  const swipeTimerRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        levelMode,
        languageMode,
        selectedSubtopic,
        currentCardIndex: index,
        reviewIds,
        knownIds,
        studyMode,
        shuffleOn,
        darkMode,
      }));
    } catch {
      // Ignore storage failures so private browsing or full storage does not break study mode.
    }
  }, [darkMode, index, knownIds, languageMode, levelMode, reviewIds, selectedSubtopic, shuffleOn, studyMode]);

  useEffect(() => () => {
    window.clearTimeout(swipeTimerRef.current);
  }, []);

  useEffect(() => {
    function syncFocusWithFullscreen() {
      if (!document.fullscreenElement) {
        setFocusMode(false);
      }
    }

    document.addEventListener("fullscreenchange", syncFocusWithFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFocusWithFullscreen);
  }, []);

  const availableCards = useMemo(
    () => cards.filter((card) => card.levels.includes(levelMode)),
    [levelMode]
  );

  const topicOptions = useMemo(() => {
    const unique = new Map();
    availableCards.forEach((card) => {
      const label = card.subtopicFull || `${card.topicCode} — ${card.topic}`;
      unique.set(card.topicCode, { code: card.topicCode, label, group: topicGroup(card.topicCode) });
    });

    const sorted = [...unique.values()].sort((a, b) => {
      const ai = TOPIC_ORDER.indexOf(a.code);
      const bi = TOPIC_ORDER.indexOf(b.code);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.label.localeCompare(b.label);
    });

    const grouped = { T1: [], T2: [], T3: [], T4: [], T5: [], T6: [] };
    sorted.forEach((item) => {
      const group = grouped[item.group] ? item.group : "common";
      grouped[group].push(item);
    });
    return grouped;
  }, [availableCards]);

  const filteredCards = useMemo(() => {
    if (studyMode === "review") {
      return cards.filter((card) => reviewIds.includes(card.id));
    }

    if (selectedSubtopic === "All topics") return availableCards;

    if (/^T\d+$/.test(selectedSubtopic)) {
      return availableCards.filter((card) => topicGroup(card.topicCode) === selectedSubtopic);
    }

    return availableCards.filter((card) => card.topicCode === selectedSubtopic);
  }, [availableCards, reviewIds, selectedSubtopic, studyMode]);

  const safeIndex = Math.min(index, Math.max(filteredCards.length - 1, 0));
  const card = filteredCards[safeIndex] || filteredCards[0];
  const theme = themeForTopic(card?.topicCode || "T1", studyMode);
  const isSaved = card ? reviewIds.includes(card.id) : false;
  const knownCount = knownIds.length;
  const cardHasImages = Boolean(
    card && [...card.frontImages, ...card.backImages].some(Boolean)
  );
  const cardHasImageOcclusion = Boolean(
    card && [...card.frontImages, ...card.backImages].some((image) => String(image).includes("/occlusion/"))
  );
  const selectedLevelLabel = COURSE_MODES.find((mode) => mode.value === levelMode)?.label || "IGCSE";

  const displayTheme = darkMode
    ? {
        ...theme,
        accentSoft: "rgba(148, 163, 184, 0.18)",
        pageStart: "#020617",
        pageEnd: "#111827",
        cardFront: "#111827",
        cardBack: "#0f172a",
        glow: "rgba(15, 23, 42, 0.58)",
      }
    : theme;

  function goToNext() {
    if (filteredCards.length === 0) return;
    setFlipped(false);

    if (future.length > 0) {
      const nextFromFuture = Math.min(future[0], filteredCards.length - 1);
      setHistory((items) => [...items, safeIndex].slice(-300));
      setFuture((items) => items.slice(1));
      setIndex(nextFromFuture);
      return;
    }

    const nextIndex = shuffleOn
      ? randomIndex(filteredCards.length, safeIndex)
      : (safeIndex + 1) % filteredCards.length;

    setHistory((items) => [...items, safeIndex].slice(-300));
    setFuture([]);
    setIndex(nextIndex);
  }

  function previousCard() {
    if (filteredCards.length === 0) return;
    setFlipped(false);

    if (history.length > 0) {
      const previous = Math.min(history[history.length - 1], filteredCards.length - 1);
      setHistory((items) => items.slice(0, -1));
      setFuture((items) => [safeIndex, ...items].slice(0, 300));
      setIndex(previous);
      return;
    }

    const previous = (safeIndex - 1 + filteredCards.length) % filteredCards.length;
    setFuture((items) => [safeIndex, ...items].slice(0, 300));
    setIndex(previous);
  }

  function resetPosition() {
    setIndex(0);
    setHistory([]);
    setFuture([]);
    setFlipped(false);
  }

  function changeSubtopic(event) {
    setSelectedSubtopic(event.target.value);
    setStudyMode("all");
    resetPosition();
  }

  function changeLevel(event) {
    setLevelMode(event.target.value);
    setStudyMode("all");
    setSelectedSubtopic("All topics");
    resetPosition();
  }

  function saveForReviewLater() {
    if (!card) return;

    setReviewIds((current) => {
      if (current.includes(card.id)) return current;
      return [...current, card.id];
    });
    // Intentionally do not jump to the next card: the saved mark appears on this card.
  }

  function markKnown() {
    if (!card) return;

    setKnownIds((current) => {
      if (current.includes(card.id)) return current;
      return [...current, card.id];
    });

    if (studyMode === "review") {
      const currentCardId = card.id;
      const remaining = filteredCards.filter((item) => item.id !== currentCardId);
      setReviewIds((current) => current.filter((id) => id !== currentCardId));

      if (remaining.length === 0) {
        setStudyMode("all");
        setSelectedSubtopic("All topics");
        resetPosition();
        return;
      }

      setFlipped(false);
      setHistory([]);
      setFuture([]);
      setIndex((current) => {
        if (shuffleOn) return randomIndex(remaining.length, -1);
        return Math.min(current, remaining.length - 1);
      });
      return;
    }

    goToNext();
  }

  function startReviewQuiz() {
    if (reviewIds.length === 0) return;

    setStudyMode("review");
    setSelectedSubtopic("All topics");
    setHistory([]);
    setFuture([]);
    setIndex(shuffleOn ? randomIndex(reviewIds.length, -1) : 0);
    setFlipped(false);
  }

  function clearReviewList() {
    setReviewIds([]);
    setStudyMode("all");
    setSelectedSubtopic("All topics");
    resetPosition();
  }

  function resetProgress() {
    if (!window.confirm("Reset all saved review cards and study progress on this device?")) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_REVIEW_IDS_KEY);
    } catch {
      // Ignore storage failures; resetting in-memory state still gives the user a clean session.
    }

    setLevelMode(DEFAULT_PROGRESS.levelMode);
    setLanguageMode(DEFAULT_PROGRESS.languageMode);
    setSelectedSubtopic(DEFAULT_PROGRESS.selectedSubtopic);
    setKnownIds(DEFAULT_PROGRESS.knownIds);
    setReviewIds(DEFAULT_PROGRESS.reviewIds);
    setStudyMode(DEFAULT_PROGRESS.studyMode);
    setShuffleOn(DEFAULT_PROGRESS.shuffleOn);
    setDarkMode(DEFAULT_PROGRESS.darkMode);
    resetPosition();
  }

  function enterFocusMode() {
    setFocusMode(true);

    const requestFullscreen = appShellRef.current?.requestFullscreen;
    if (requestFullscreen) {
      requestFullscreen.call(appShellRef.current).catch(() => {
        // CSS focus mode remains available when browser fullscreen is blocked or unsupported.
      });
    }
  }

  function exitFocusMode() {
    setFocusMode(false);

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {
        // Leaving CSS focus mode is enough if the browser rejects the fullscreen exit request.
      });
    }
  }

  function isInteractiveTarget(target) {
    return Boolean(target.closest("button, select, option, input, textarea, a"));
  }

  function isTextSelectionTarget(target) {
    if (target.closest(".swipeZone")) return false;

    return Boolean(target.closest(".mathText, .cardContent, .cardMeta, .subtopicTitle"));
  }

  function isSwipeZoneTarget(target) {
    return Boolean(target.closest(".swipeZone"));
  }

  function scrollableCardContent(target) {
    const content = target.closest(".cardContent");
    if (!content) return null;

    return content.scrollHeight > content.clientHeight + 2 ? content : null;
  }

  function hasSelectedText() {
    return Boolean(window.getSelection?.().toString().trim());
  }

  function resetSwipeMotion(delay = 0) {
    window.clearTimeout(swipeTimerRef.current);
    if (delay === 0) {
      setSwipeMotion("");
      setSwipeOffset(0);
      return;
    }

    swipeTimerRef.current = window.setTimeout(() => {
      setSwipeMotion("");
      setSwipeOffset(0);
    }, delay);
  }

  function navigateAfterSwipe(direction) {
    window.clearTimeout(swipeTimerRef.current);
    setSwipeMotion("exiting");
    const exitDistance = Math.max(420, window.innerWidth * 0.9);
    setSwipeOffset(direction === "next" ? -exitDistance : exitDistance);

    swipeTimerRef.current = window.setTimeout(() => {
      if (direction === "next") {
        goToNext();
      } else {
        previousCard();
      }
      setSwipeMotion("entering");
      setSwipeOffset(direction === "next" ? exitDistance : -exitDistance);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setSwipeOffset(0);
        });
      });

      swipeTimerRef.current = window.setTimeout(() => {
        setSwipeMotion("");
        setSwipeOffset(0);
      }, SWIPE_ENTER_MS);
    }, SWIPE_EXIT_MS);
  }

  function handleCardPointerDown(event) {
    if (event.pointerType === "touch") {
      pointerStartRef.current = null;
      return;
    }

    if (isInteractiveTarget(event.target)) {
      pointerStartRef.current = null;
      return;
    }

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      time: event.timeStamp,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      swiping: false,
      cancelSwipe: false,
      startedOnSwipeZone: isSwipeZoneTarget(event.target),
      startedOnText: isTextSelectionTarget(event.target),
    };
  }

  function handleCardPointerMove(event) {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== event.pointerId || start.pointerType !== "touch") return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsed = Math.max(1, event.timeStamp - start.time);

    start.lastX = event.clientX;
    start.lastTime = event.timeStamp;

    if (hasSelectedText() || (start.startedOnText && elapsed > TEXT_SELECTION_HOLD_MS && !start.swiping)) {
      start.cancelSwipe = true;
      resetSwipeMotion(0);
      return;
    }

    if (start.cancelSwipe) return;

    if (absX > SWIPE_ACTIVATION_PX && absX > absY * 0.55) {
      start.swiping = true;
      event.preventDefault();
      setSwipeMotion("dragging");
      const maxDrag = Math.max(180, window.innerWidth * 0.5);
      setSwipeOffset(Math.max(-maxDrag, Math.min(maxDrag, deltaX)));
    }
  }

  function handleCardPointerUp(event) {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    if (!start || start.pointerId !== event.pointerId || isInteractiveTarget(event.target)) return;

    if (start.cancelSwipe || hasSelectedText()) {
      resetSwipeMotion(0);
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsed = Math.max(1, event.timeStamp - start.time);
    const velocity = absX / elapsed;
    const cardWidth = event.currentTarget.offsetWidth || window.innerWidth;
    const swipeThreshold = start.pointerType === "touch"
      ? Math.max(SWIPE_MIN_DISTANCE_PX, cardWidth * SWIPE_DISTANCE_RATIO)
      : 58;
    const isMostlyHorizontal = absX > absY * 0.55;
    const isSwipe = isMostlyHorizontal && (
      absX > swipeThreshold ||
      (absX > SWIPE_MIN_DISTANCE_PX && velocity > SWIPE_VELOCITY_PX_PER_MS)
    );
    const isTap = !start.swiping && absX < 10 && absY < 10;

    if (isSwipe) {
      navigateAfterSwipe(deltaX < 0 ? "next" : "previous");
      return;
    }

    resetSwipeMotion(swipeMotion ? 160 : 0);

    if (isTap && !hasSelectedText()) {
      setFlipped((value) => !value);
    }
  }

  function touchPoint(event) {
    return event.changedTouches?.[0] || event.touches?.[0];
  }

  function handleCardTouchStart(event) {
    if (event.touches.length !== 1 || isInteractiveTarget(event.target)) {
      touchStartRef.current = null;
      return;
    }

    const touch = touchPoint(event);
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: event.timeStamp,
      swiping: false,
      cancelSwipe: false,
      startedOnText: isTextSelectionTarget(event.target),
      startedOnSwipeZone: isSwipeZoneTarget(event.target),
    };
  }

  function handleCardTouchMove(event) {
    const start = touchStartRef.current;
    const touch = touchPoint(event);
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsed = Math.max(1, event.timeStamp - start.time);

    if (hasSelectedText() || (!start.startedOnSwipeZone && start.startedOnText && elapsed > TEXT_SELECTION_HOLD_MS && absX < 18)) {
      start.cancelSwipe = true;
      resetSwipeMotion(0);
      return;
    }

    if (start.cancelSwipe) return;

    if (!start.startedOnSwipeZone && scrollableCardContent(event.target) && absY > 8 && absY > absX * 1.12) {
      start.cancelSwipe = true;
      resetSwipeMotion(0);
      return;
    }

    const swipeActivation = start.startedOnSwipeZone ? 8 : SWIPE_ACTIVATION_PX;
    const horizontalBias = start.startedOnSwipeZone ? 0.25 : 0.38;

    if (absX > swipeActivation && absX > absY * horizontalBias) {
      start.swiping = true;
      event.preventDefault();
      setSwipeMotion("dragging");
      const maxDrag = Math.max(220, window.innerWidth * 0.62);
      setSwipeOffset(Math.max(-maxDrag, Math.min(maxDrag, deltaX * 1.08)));
    }
  }

  function handleCardTouchEnd(event) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = touchPoint(event);

    if (!start || !touch || isInteractiveTarget(event.target)) return;

    if (start.cancelSwipe || hasSelectedText()) {
      resetSwipeMotion(0);
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsed = Math.max(1, event.timeStamp - start.time);
    const velocity = absX / elapsed;
    const cardWidth = event.currentTarget.offsetWidth || window.innerWidth;
    const swipeThreshold = Math.max(SWIPE_MIN_DISTANCE_PX, cardWidth * SWIPE_DISTANCE_RATIO);
    const isMostlyHorizontal = start.startedOnSwipeZone
      ? absX > absY * 0.25
      : absX > absY * 0.38;
    const isSwipe = isMostlyHorizontal && (
      absX > swipeThreshold ||
      (absX > 8 && velocity > SWIPE_VELOCITY_PX_PER_MS)
    );
    const isTap = !start.swiping && absX < 12 && absY < 12 && elapsed < TEXT_SELECTION_HOLD_MS;

    if (isSwipe) {
      navigateAfterSwipe(deltaX < 0 ? "next" : "previous");
      return;
    }

    resetSwipeMotion(swipeMotion ? 140 : 0);

    if (isTap && !hasSelectedText()) {
      setFlipped((value) => !value);
    }
  }

  function handleCardTouchCancel() {
    touchStartRef.current = null;
    resetSwipeMotion(swipeMotion ? 140 : 0);
  }

  function handleCardKeyDown(event) {
    if (isInteractiveTarget(event.target)) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setFlipped((value) => !value);
    }

    if (event.key === "ArrowLeft") {
      previousCard();
    }

    if (event.key === "ArrowRight") {
      goToNext();
    }
  }

  if (!card) {
    return (
      <main
        className="appShell"
        style={{
          "--accent": REVIEW_THEME.accent,
          "--accent-soft": REVIEW_THEME.accentSoft,
          "--page-start": REVIEW_THEME.pageStart,
          "--page-end": REVIEW_THEME.pageEnd,
          "--card-front": REVIEW_THEME.cardFront,
          "--card-back": REVIEW_THEME.cardBack,
          "--glow": REVIEW_THEME.glow,
        }}
      >
        <section className="emptyState">
          <h1>No saved review cards yet</h1>
          <p>Use “Save to review later” on cards your students need to practise again.</p>
          <button onClick={() => setStudyMode("all")}>Back to all cards</button>
        </section>
      </main>
    );
  }

  return (
    <main
      ref={appShellRef}
      className={`appShell ${studyMode === "review" ? "reviewShell" : ""} ${darkMode ? "darkShell" : ""} ${focusMode ? "focusShell" : ""}`}
      style={{
        "--accent": displayTheme.accent,
        "--accent-soft": displayTheme.accentSoft,
        "--page-start": displayTheme.pageStart,
        "--page-end": displayTheme.pageEnd,
        "--card-front": displayTheme.cardFront,
        "--card-back": displayTheme.cardBack,
        "--glow": displayTheme.glow,
      }}
    >
      <section className="app">
        {!focusMode && <section className="header">
          <div>
            <h1>IGCSE Physics Flashcards</h1>
            <p>
              {studyMode === "review"
                ? `Reviewing ${filteredCards.length} saved card(s)`
                : `${selectedLevelLabel} · ${availableCards.length} available cards`}
            </p>
            {hasChineseTranslations && (
              <p className="translationNotice">{TRANSLATION_NOTICE}</p>
            )}
          </div>

          <div className="stats">
            <span className="statPill">Known: {knownCount}</span>
            <span className="statPill">Saved review: {reviewIds.length}</span>
            <button
              type="button"
              className={`statPill darkModeToggle ${darkMode ? "activeButton" : ""}`}
              aria-pressed={darkMode}
              onClick={() => setDarkMode((value) => !value)}
            >
              {darkMode ? "Dark: On" : "Dark: Off"}
            </button>
          </div>
        </section>}

        {!focusMode && <section className="controls">
          <label>
            Course
            <select value={levelMode} onChange={changeLevel} disabled={studyMode === "review"}>
              {COURSE_MODES.map((mode) => (
                <option value={mode.value} key={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Topic
            <select value={selectedSubtopic} onChange={changeSubtopic} disabled={studyMode === "review"}>
              <option value="All topics">All topics</option>
              {Object.entries(topicOptions).map(([group, items]) =>
                items.length ? (
                  <optgroup label={THEME_LABELS[group] || group} key={group}>
                    <option value={group}>{`All ${THEME_LABELS[group] || group}`}</option>
                    {items.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label.startsWith(item.code)
                          ? item.label
                          : `${item.code} — ${item.label}`}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              )}
            </select>
          </label>

          <fieldset className="languageToggle" aria-label="Card language">
            <legend>Language</legend>
            <div className="languageOptions">
              {LANGUAGE_MODES.map((mode) => {
                const isDisabled = mode.needsTranslations && !hasChineseTranslations;
                return (
                  <button
                    type="button"
                    key={mode.value}
                    className={languageMode === mode.value ? "activeLanguage" : ""}
                    aria-pressed={languageMode === mode.value}
                    disabled={isDisabled}
                    title={isDisabled ? "Chinese translations are not imported yet" : mode.label}
                    onClick={() => {
                      if (!isDisabled) setLanguageMode(mode.value);
                    }}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <span className="cardCounter">
            Card {safeIndex + 1} / {filteredCards.length}
            {hasChineseTranslations ? ` · ${translatedChineseCount} Chinese` : ""}
            {reviewedChineseCount ? ` · ${reviewedChineseCount} reviewed` : ""}
          </span>
        </section>}

        <section className="cardArea">
          <button
            type="button"
            className="sideNav sideNavPrevious"
            aria-label="Previous card"
            onClick={previousCard}
          >
            ‹
          </button>

          <div className={`flipScene ${cardHasImages ? "imageCardScene" : ""} ${cardHasImageOcclusion ? "imageOcclusionScene" : ""}`}>
            <div
              role="button"
              tabIndex={0}
              aria-label={flipped ? "Flashcard answer. Tap to show question." : "Flashcard question. Tap to show answer."}
              className={`flashcard ${flipped ? "isFlipped" : ""} ${swipeMotion ? `swipe-${swipeMotion}` : ""}`}
              style={{ "--swipe-x": `${swipeOffset}px` }}
              onPointerDown={handleCardPointerDown}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerUp}
              onPointerCancel={() => {
                pointerStartRef.current = null;
                resetSwipeMotion(swipeMotion ? 160 : 0);
              }}
              onTouchStart={handleCardTouchStart}
              onTouchMove={handleCardTouchMove}
              onTouchEnd={handleCardTouchEnd}
              onTouchCancel={handleCardTouchCancel}
              onKeyDown={handleCardKeyDown}
            >
              <CardFace
                card={card}
                side="front"
                studyMode={studyMode}
                isSaved={isSaved}
                languageMode={languageMode}
              />
              <CardFace
                card={card}
                side="back"
                studyMode={studyMode}
                isSaved={isSaved}
                languageMode={languageMode}
              />
            </div>
          </div>

          <button
            type="button"
            className="sideNav sideNavNext"
            aria-label="Next card"
            onClick={goToNext}
          >
            ›
          </button>

          {focusMode && (
            <button
              type="button"
              className="focusExitButton"
              onClick={exitFocusMode}
            >
              Exit focus mode
            </button>
          )}
        </section>

        {!focusMode && (
          <section className="focusModeControls">
            <button
              className={`focusModeButton ${shuffleOn ? "activeButton" : ""}`}
              onClick={() => setShuffleOn((value) => !value)}
            >
              Shuffle: {shuffleOn ? "On" : "Off"}
            </button>
            <button className="focusModeButton" onClick={enterFocusMode}>
              Focus mode
            </button>
          </section>
        )}

        {!focusMode && (
          <>
            <section className="buttons secondary">
              <button onClick={markKnown}>
                {studyMode === "review" ? "I know this — remove" : "I know this"}
              </button>

              <button className={isSaved ? "savedButton" : ""} onClick={saveForReviewLater}>
                {isSaved ? "Saved to review later" : "Save to review later"}
              </button>

              <button onClick={startReviewQuiz} disabled={reviewIds.length === 0}>
                Start review quiz
              </button>

              <button onClick={clearReviewList} disabled={reviewIds.length === 0}>
                Clear review list
              </button>

              <button className="resetProgressButton" onClick={resetProgress}>
                Reset progress
              </button>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
