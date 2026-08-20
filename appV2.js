console.log("APP JS LOADED");
/* =========================================================
   THRIVE360 APP V2
   Full replacement JS
   - Navigation
   - Scoring
   - Results/report updates
   - Processing Speed interactive tests
   - Cognition interactive tests when matching HTML IDs exist
========================================================= */

const state = {
  mobility: 62,
  driving: 80,
  processing: 80,
  cognition: 78,
  nutrition: 70,
  home: 55,
  mental: 82,
};

/* =========================================================
   BASIC HELPERS
========================================================= */

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value);
}

function average(values) {
  const clean = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function getEl(id) {
  return document.getElementById(id);
}

function getValue(id, fallback = "") {
  const el = getEl(id);
  if (!el) return fallback;
  return String(el.value ?? el.textContent ?? fallback).trim();
}

function getNumber(id, fallback = 0) {
  const el = getEl(id);
  if (!el) return fallback;
  const raw = el.value ?? el.textContent ?? "";
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function setText(id, value) {
  const el = getEl(id);
  if (el) el.textContent = value;
}

function setHTML(id, value) {
  const el = getEl(id);
  if (el) el.innerHTML = value;
}

function setInputValue(id, value) {
  const el = getEl(id);
  if (el) el.value = value;
}

function setDisplay(id, displayValue) {
  const el = getEl(id);
  if (el) el.style.display = displayValue;
}

function toggleHidden(id, isHidden) {
  const el = getEl(id);
  if (el) el.classList.toggle("hidden", isHidden);
}

function sumSelectValues(selector) {
  let total = 0;
  document.querySelectorAll(selector).forEach((el) => {
    total += parseInt(el.value || 0, 10);
  });
  return total;
}

function getScoreBand(score) {
  if (score >= 85) return { label: "Strong Profile", className: "green" };
  if (score >= 70) return { label: "Mild Risk", className: "yellow" };
  if (score >= 50) return { label: "Moderate Risk", className: "orange" };
  return { label: "High Risk", className: "red" };
}

function getBarClass(value) {
  if (value >= 85) return "green";
  if (value >= 70) return "yellow";
  if (value >= 50) return "orange";
  return "red";
}

/* =========================================================
   NAVIGATION
========================================================= */

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  const nextScreen = getEl(id);
  if (nextScreen) {
    nextScreen.classList.add("active");
  } else {
    console.warn("Screen not found:", id);
  }

  document.querySelectorAll(".step").forEach((step) => {
    step.classList.remove("current");
    if (step.getAttribute("data-target") === id) {
      step.classList.add("current");
    }
  });

  if (typeof syncDomainWizard === "function") syncDomainWizard(id);

  if (id === "results") refreshAllScores();

  window.scrollTo({ top: 0, behavior: "auto" });
}

function bindNavigation() {
  document.addEventListener("click", (event) => {
    const targetButton = event.target.closest("[data-target]");
    if (!targetButton) return;

    event.preventDefault();
    const target = targetButton.getAttribute("data-target");
    if (!target) return;

    const activeId = document.querySelector(".screen.active")?.id || "";
    const intakeOrder = ["new", "intakeHealth", "intakeMobilitySafety", "intakeCognitiveNutrition", "intakeMental", "intakeClinicalNotes"];
    const fromIndex = intakeOrder.indexOf(activeId);
    const toIndex = intakeOrder.indexOf(target);
    if (fromIndex >= 0 && (toIndex > fromIndex || target === "mobility") && !validateIntakeScreen(activeId)) return;

    showScreen(target);
    if (target === "review") updateReviewScreen();
  });
}

/* =========================================================
   OVERALL SCORE
========================================================= */

function calculateScore() {
  const weighted = [
    ["mobility", state.mobility, 0.30],
    ["cognition", state.cognition, 0.20],
    ["nutrition", state.nutrition, 0.15],
    ["homeSafety", state.home, 0.15],
    ["driving", state.driving, 0.10],
    ["processing", state.processing, 0.05],
    ["mental", state.mental, 0.05],
  ].filter(([domainId]) => !isDomainNotAssessed(domainId));

  const weightTotal = weighted.reduce((sum, item) => sum + item[2], 0);
  if (!weightTotal) return 0;
  return round(weighted.reduce((sum, item) => sum + item[1] * item[2], 0) / weightTotal);
}

/* =========================================================
   MOBILITY SCORING
========================================================= */
function getGaitSpeedRiskLevel(speed) {
  if (speed < 0.4) {
    return {
      label: "Household ambulator",
      risk: "high",
      points: 30
    };
  }

  if (speed < 0.7) {
    return {
      label: "Household / limited community ambulator with increased adverse-event risk",
      risk: "high",
      points: 45
    };
  }

  if (speed <= 0.8) {
    return {
      label: "Limited community ambulator",
      risk: "moderate",
      points: 65
    };
  }

  return {
    label: "Community ambulator",
    risk: "low",
    points: 90
  };
}
function updateGaitSpeed() {
  const walkTime = getNumber("walkTime", 0);
  const gaitSpeedEl = getEl("gaitSpeed");
  const gaitInterpretationEl = getEl("gaitSpeedInterpretation");

  if (!gaitSpeedEl) return;

  if (walkTime > 0) {
    const gaitSpeed = 10 / walkTime;
    const gaitRisk = getGaitSpeedRiskLevel(gaitSpeed);

    gaitSpeedEl.value = gaitSpeed.toFixed(2);

    if (gaitInterpretationEl) {
      gaitInterpretationEl.value = gaitRisk.label;
    }
  } else {
    gaitSpeedEl.value = "";
    if (gaitInterpretationEl) gaitInterpretationEl.value = "";
  }
}
function score10MWT() {
  const seconds = getNumber("walkTime", 0);
  if (seconds <= 0) return 0;

  const gaitSpeed = 10 / seconds;
  const gaitRisk = getGaitSpeedRiskLevel(gaitSpeed);

  return gaitRisk.points;
}
function scoreTUG() {
  const seconds = getNumber("tugTime", 0);
  if (seconds <= 0) return 0;

  if (seconds < 12) return 100;
  if (seconds <= 20) return 65;
  return 30;
}

function scoreChairStand() {
  const reps = getNumber("chairStandReps", 0);
  if (reps > 12) return 100;
  if (reps >= 8) return 65;
  return 35;
}

function score4StageBalance() {
  const stage = getValue("balanceStage", "");

  switch (stage) {
    case "Single-leg":
      return 100;
    case "Tandem":
      return 85;
    case "Semi-tandem":
      return 65;
    case "Side-by-side":
      return 45;
    case "Unable":
      return 25;
    default:
      return 50;
  }
}

function scoreFSST() {
  const seconds = getNumber("fsstTime", 0);
  if (seconds <= 0) return 0;

  if (seconds < 15) return 100;
  if (seconds <= 24) return 65;
  return 30;
}

function calculateMobilityScore() {
  return round(average([score10MWT(), scoreTUG(), scoreChairStand(), score4StageBalance(), scoreFSST()]));
}

/* =========================================================
   DRIVING / COMMUNITY MOBILITY SCORING
========================================================= */





function calculateDrivingScore() {
  let score = 100;
  const currentDriving = getValue("currentDrivingStatus", "yes");

  const yesPenalty = (id, points) => {
    const value = getValue(id, "No").toLowerCase();
    if (value === "yes") score -= points;
  };

  // Driving-specific concerns apply only when the client currently drives.
  if (currentDriving !== "no") {
    yesPenalty("drivingNearMiss", 25);
    yesPenalty("familyDrivingConcern", 25);
    yesPenalty("nightDriving", 10);
    yesPenalty("navigationDifficulty", 25);
    yesPenalty("blindSpotDifficulty", 15);
  }

  // Community transportation participation remains relevant for everyone.
  score -= getNumber("drivesIndependently", 0) * 10;
  score -= getNumber("transportReliance", 0) * 8;
  score -= getNumber("communityRestriction", 0) * 8;
  score -= getNumber("transportMissedActivities", 0) * 10;

  return clamp(round(score));
}
/* =========================================================
   PROCESSING SPEED INTERACTIVE TESTS
========================================================= */

function bindProcessingTesting() {
  bindSimpleReactionTest();
  bindChoiceReactionTest();
  bindGoNoGoTest();
}

function bindSimpleReactionTest() {
  const startBtn = getEl("simpleRtStart");
  const pad = getEl("simpleRtPad");
  if (!startBtn || !pad) return;

  let trials = [];
  let misses = 0;
  let active = false;
  let startTime = 0;
  let trialCount = 0;
  let delayTimer = null;

  startBtn.addEventListener("click", () => {
    clearTimeout(delayTimer);
    trials = [];
    misses = 0;
    active = false;
    trialCount = 0;

    setInputValue("simpleRtAvg", 0);
    setInputValue("simpleRtBest", 0);
    setInputValue("simpleRtMisses", 0);

    startBtn.disabled = true;
    runSimpleTrial();
  });

  pad.addEventListener("click", () => {
    if (!startBtn.disabled) return;

    if (!active) {
      misses++;
      setInputValue("simpleRtMisses", misses);
      pad.className = "reaction-pad ready";
      pad.textContent = "Too early — wait for green";
      return;
    }

    const rt = Math.round(performance.now() - startTime);
    trials.push(rt);
    active = false;
    trialCount++;

    pad.className = "reaction-pad";
    pad.textContent = `Trial ${trialCount}: ${rt} ms`;

    if (trialCount >= 5) {
      const avg = Math.round(average(trials));
      const best = Math.min(...trials);

      setInputValue("simpleRtAvg", avg);
      setInputValue("simpleRtBest", best);
      setInputValue("simpleRtMisses", misses);

      startBtn.disabled = false;
      pad.textContent = "Complete";
      refreshAllScores();
      return;
    }

    setTimeout(runSimpleTrial, 900);
  });

  function runSimpleTrial() {
    pad.className = "reaction-pad ready";
    pad.textContent = "Wait...";
    active = false;

    const delay = 1200 + Math.random() * 2200;

    delayTimer = setTimeout(() => {
      active = true;
      startTime = performance.now();
      pad.className = "reaction-pad go";
      pad.textContent = "TAP NOW";
    }, delay);
  }
}

function bindChoiceReactionTest() {
  const startBtn = getEl("choiceRtStart");
  const cue = getEl("choiceRtCue");
  const leftBtn = getEl("choiceLeft");
  const rightBtn = getEl("choiceRight");
  if (!startBtn || !cue || !leftBtn || !rightBtn) return;

  let trials = [];
  let errors = 0;
  let misses = 0;
  let expected = "";
  let active = false;
  let startTime = 0;
  let trialCount = 0;
  let timer = null;

  startBtn.addEventListener("click", () => {
    clearTimeout(timer);
    trials = [];
    errors = 0;
    misses = 0;
    expected = "";
    active = false;
    trialCount = 0;
    startBtn.disabled = true;

    setInputValue("choiceRtAvg", 0);
    setInputValue("choiceRtErrors", 0);
    setInputValue("choiceRtMisses", 0);

    runChoiceTrial();
  });

  leftBtn.addEventListener("click", () => handleChoice("left"));
  rightBtn.addEventListener("click", () => handleChoice("right"));

  function runChoiceTrial() {
    cue.className = "reaction-pad ready";
    cue.textContent = "Wait...";
    active = false;

    const delay = 1000 + Math.random() * 2000;

    timer = setTimeout(() => {
      expected = Math.random() > 0.5 ? "left" : "right";
      active = true;
      startTime = performance.now();
      cue.className = "reaction-pad go";
      cue.textContent = expected === "left" ? "←" : "→";

      timer = setTimeout(() => {
        if (active) {
          misses++;
          active = false;
          trialCount++;
          cue.className = "reaction-pad";
          cue.textContent = "Missed";
          continueChoice();
        }
      }, 2500);
    }, delay);
  }

  function handleChoice(choice) {
    if (!startBtn.disabled || !active) return;

    clearTimeout(timer);

    const rt = Math.round(performance.now() - startTime);
    trials.push(rt);

    if (choice !== expected) errors++;

    active = false;
    trialCount++;

    cue.className = "reaction-pad";
    cue.textContent = choice === expected ? `${rt} ms` : `Incorrect — ${rt} ms`;

    continueChoice();
  }

  function continueChoice() {
    if (trialCount >= 6) {
      const avg = trials.length ? Math.round(average(trials)) : 0;

      setInputValue("choiceRtAvg", avg);
      setInputValue("choiceRtErrors", errors);
      setInputValue("choiceRtMisses", misses);

      startBtn.disabled = false;
      cue.textContent = "Complete";
      refreshAllScores();
      return;
    }

    setTimeout(runChoiceTrial, 900);
  }
}

function bindGoNoGoTest() {
  const startBtn = getEl("goNoGoStart");
  const cue = getEl("goNoGoCue");
  const tapBtn = getEl("goNoGoTap");
  if (!startBtn || !cue || !tapBtn) return;

  let trialCount = 0;
  let falseTaps = 0;
  let misses = 0;
  let active = false;
  let isGo = false;
  let tapped = false;

  startBtn.addEventListener("click", () => {
    trialCount = 0;
    falseTaps = 0;
    misses = 0;
    active = false;
    tapped = false;

    setInputValue("goNoGoFalseTaps", 0);
    setInputValue("goNoGoMisses", 0);

    startBtn.disabled = true;
    runGoNoGoTrial();
  });

  tapBtn.addEventListener("click", () => {
    if (!startBtn.disabled || !active) return;

    tapped = true;

    if (!isGo) {
      falseTaps++;
      setInputValue("goNoGoFalseTaps", falseTaps);
    }

    active = false;
  });

  function runGoNoGoTrial() {
    cue.className = "reaction-pad ready";
    cue.textContent = "Wait...";
    active = false;
    tapped = false;

    const delay = 1000 + Math.random() * 1800;

    setTimeout(() => {
      isGo = Math.random() > 0.35;
      active = true;
      cue.className = isGo ? "reaction-pad go" : "reaction-pad nogo";
      cue.textContent = isGo ? "GO — TAP" : "NO-GO — DO NOT TAP";

      setTimeout(() => {
        if (isGo && !tapped) {
          misses++;
          setInputValue("goNoGoMisses", misses);
        }

        active = false;
        trialCount++;

        if (trialCount >= 8) {
          cue.className = "reaction-pad";
          cue.textContent = "Complete";
          startBtn.disabled = false;
          refreshAllScores();
          return;
        }

        runGoNoGoTrial();
      }, 1400);
    }, delay);
  }
}

function calculateProcessingScore() {
  const simpleAvg = getNumber("simpleRtAvg", 0);
  const simpleMisses = getNumber("simpleRtMisses", 0);
  const choiceAvg = getNumber("choiceRtAvg", 0);
  const choiceErrors = getNumber("choiceRtErrors", 0);
  const choiceMisses = getNumber("choiceRtMisses", 0);
  const falseTaps = getNumber("goNoGoFalseTaps", 0);
  const goMisses = getNumber("goNoGoMisses", 0);

  const scores = [];

if (simpleAvg > 0) {
  let score = 100;
  if (simpleAvg >= 450 && simpleAvg <= 650) score = 75;
  if (simpleAvg > 650) score = 50;
  score -= simpleMisses * 5;
  scores.push(clamp(score));
}

if (choiceAvg > 0) {
  let score = 100;
  if (choiceAvg >= 700 && choiceAvg <= 950) score = 75;
  if (choiceAvg > 950) score = 50;
  score -= choiceErrors * 5;
  score -= choiceMisses * 8;
  scores.push(clamp(score));
}

  let inhibitionScore = 100;
inhibitionScore -= falseTaps * 8;
inhibitionScore -= goMisses * 8;
scores.push(clamp(inhibitionScore));
  return scores.length ? round(average(scores)) : 80;
}
/* =========================================================
  /* =========================================================
   COGNITION INTERACTIVE TESTS
========================================================= */

function bindCognitiveTesting() {
  bindMiniCogHelper();
  bindClockDrawingCanvas();
  bindTrailMakingADigital();
  bindTrailMakingDigital();
  bindDigitSpanDigital();
}

function bindMiniCogHelper() {
  const startBtn = getEl("miniCogStart");
  const wordsEl = getEl("miniCogWordsPad");
  const hideBtn = getEl("miniCogHideWords");
  const checklist = getEl("miniCogRecallChecklist");

  const wordBank = [
    ["Apple", "Penny", "Table"],
    ["Banana", "Sunrise", "Chair"],
    ["River", "Garden", "Nickel"],
    ["Lemon", "Window", "Key"],
  ];

  let currentWords = [];

  function renderChecklist(words) {
    if (!checklist) return;

    checklist.innerHTML = "";

    words.forEach((word) => {
      const label = document.createElement("label");
      label.className = "check-item";

      label.innerHTML = `
        <input type="checkbox" class="mini-recall-word" value="${word}" />
        ${word}
      `;

      checklist.appendChild(label);
    });

    checklist.querySelectorAll(".mini-recall-word").forEach((el) => {
      el.addEventListener("change", () => {
        const checked =
          checklist.querySelectorAll(".mini-recall-word:checked").length;

        setInputValue("miniCogRecall", checked);
        refreshAllScores();
      });
    });
  }

  if (startBtn && wordsEl) {
    startBtn.addEventListener("click", () => {
      currentWords =
        wordBank[Math.floor(Math.random() * wordBank.length)];

      wordsEl.textContent = currentWords.join("  •  ");

      renderChecklist(currentWords);

      setInputValue("miniCogRecall", 0);
    });
  }

  if (hideBtn && wordsEl) {
    hideBtn.addEventListener("click", () => {
      wordsEl.textContent =
        "Words hidden — complete clock draw, then ask for recall.";
    });
  }
}

function bindClockDrawingCanvas() {
  const canvas = getEl("clockDrawCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let drawing = false;
  let strokes = [];
  let currentStroke = [];

  function getPos(event) {
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";

    strokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      stroke.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });
  }

  function start(event) {
    event.preventDefault();
    drawing = true;
    currentStroke = [getPos(event)];
  }

  function move(event) {
    if (!drawing) return;
    event.preventDefault();

    currentStroke.push(getPos(event));
    redraw();

    ctx.beginPath();
    ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
    currentStroke.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  }

  function end(event) {
    if (!drawing) return;
    event.preventDefault();

    drawing = false;
    if (currentStroke.length) strokes.push(currentStroke);
    currentStroke = [];
    redraw();
  }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end, { passive: false });

  const clearBtn = getEl("clockClear");
  const undoBtn = getEl("clockUndo");

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      strokes = [];
      currentStroke = [];
      redraw();
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      strokes.pop();
      redraw();
    });
  }

  document.querySelectorAll(".clock-score-item").forEach((box) => {
    box.addEventListener("change", updateClockScoreFromChecklist);
  });
}

function updateClockScoreFromChecklist() {
  const checked = document.querySelectorAll(".clock-score-item:checked").length;

  setInputValue("clockChecklistScore", checked);

  let rating = 0;
  if (checked >= 4) rating = 2;
  else if (checked >= 2) rating = 1;

  setInputValue("miniCogClock", rating);
  refreshAllScores();
}

function bindTrailMakingADigital() {
  const startBtn = getEl("trailAStart");
  const resetBtn = getEl("trailAReset");
  const board = getEl("trailACanvas");

  if (!startBtn || !board) return;

  const sequence = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  let index = 0;
  let errors = 0;
  let started = false;
  let startTime = 0;
  let timer = null;

  function buildTrailA() {
    board.innerHTML = "";
    index = 0;
    errors = 0;
    started = false;

    setText("trailANext", "1");
    setText("trailATimer", "0.0");
    setText("trailAErrorsDisplay", "0");
    setInputValue("trailATime", 0);
    setInputValue("trailAErrors", "None");

    sequence.forEach((label) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "trail-node";
      node.textContent = label;
      node.dataset.value = label;
      node.style.left = `${8 + Math.random() * 80}%`;
      node.style.top = `${8 + Math.random() * 78}%`;
      board.appendChild(node);
    });
  }

  function updateTimer() {
    if (!started) return;
    const seconds = ((performance.now() - startTime) / 1000).toFixed(1);
    setText("trailATimer", seconds);
    setInputValue("trailATime", seconds);
  }

  startBtn.addEventListener("click", () => {
    clearInterval(timer);
    buildTrailA();
    started = true;
    startTime = performance.now();
    timer = setInterval(updateTimer, 100);
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      clearInterval(timer);
      buildTrailA();
    });
  }

  board.addEventListener("click", (event) => {
    const node = event.target.closest(".trail-node");
    if (!node || !started) return;

    const expected = sequence[index];

    if (node.dataset.value === expected) {
      node.classList.add("correct");
      node.disabled = true;
      index++;

      setText("trailANext", sequence[index] || "Complete");

      if (index >= sequence.length) {
        clearInterval(timer);
        started = false;
        updateTimer();
        refreshAllScores();
      }
    } else {
      errors++;
      node.classList.add("error");
      setTimeout(() => node.classList.remove("error"), 350);

      setText("trailAErrorsDisplay", errors);

      if (errors <= 2) setInputValue("trailAErrors", "1–2 errors");
      else setInputValue("trailAErrors", "Multiple errors");
    }
  });

  buildTrailA();
}

function bindTrailMakingDigital() {
  const startBtn = getEl("trailStart");
  const resetBtn = getEl("trailReset");
  const board = getEl("trailCanvas");

  if (!startBtn || !board) return;

  const sequence = ["1", "A", "2", "B", "3", "C", "4", "D", "5", "E", "6", "F"];
  let index = 0;
  let errors = 0;
  let started = false;
  let startTime = 0;
  let timer = null;

  function buildTrail() {
    board.innerHTML = "";
    index = 0;
    errors = 0;
    started = false;

    setText("trailNext", "1");
    setText("trailTimer", "0.0");
    setText("trailErrorsDisplay", "0");
    setInputValue("trailBTime", 0);
    setInputValue("trailBErrors", "None");

    sequence.forEach((label) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "trail-node";
      node.textContent = label;
      node.dataset.value = label;
      node.style.left = `${8 + Math.random() * 80}%`;
      node.style.top = `${8 + Math.random() * 78}%`;
      board.appendChild(node);
    });
  }

  function updateTimer() {
    if (!started) return;
    const seconds = ((performance.now() - startTime) / 1000).toFixed(1);
    setText("trailTimer", seconds);
    setInputValue("trailBTime", seconds);
  }

  startBtn.addEventListener("click", () => {
    clearInterval(timer);
    buildTrail();
    started = true;
    startTime = performance.now();
    timer = setInterval(updateTimer, 100);
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      clearInterval(timer);
      buildTrail();
    });
  }

  board.addEventListener("click", (event) => {
    const node = event.target.closest(".trail-node");
    if (!node || !started) return;

    const expected = sequence[index];

    if (node.dataset.value === expected) {
      node.classList.add("correct");
      node.disabled = true;
      index++;

      setText("trailNext", sequence[index] || "Complete");

      if (index >= sequence.length) {
        clearInterval(timer);
        started = false;
        updateTimer();
        refreshAllScores();
      }
    } else {
      errors++;
      node.classList.add("error");
      setTimeout(() => node.classList.remove("error"), 350);

      setText("trailErrorsDisplay", errors);

      if (errors <= 2) setInputValue("trailBErrors", "1–2 errors");
      else setInputValue("trailBErrors", "Multiple errors");
    }
  });

  buildTrail();
}

function bindDigitSpanDigital() {
  const startBtn = getEl("digitSpanStart");
  const passBtn = getEl("digitSpanPass");
  const failBtn = getEl("digitSpanFail");
  const resetBtn = getEl("digitSpanReset");
  const display = getEl("digitSpanSequence");

  if (!startBtn || !display) return;

  let length = 3;
  let best = 0;

  function makeSequence(size) {
    return Array.from({ length: size }, () => Math.floor(Math.random() * 10)).join(" ");
  }

  function updateLabels() {
    setText("digitSpanLength", length);
    setText("digitSpanBest", best);
    setInputValue("digitSpanScore", best);
  }

  function showSequence() {
    const sequence = makeSequence(length);
    display.textContent = sequence;

    setTimeout(() => {
      if (display.textContent === sequence) {
        display.textContent = "Ask client to repeat the sequence.";
      }
    }, 2500);
  }

  startBtn.addEventListener("click", () => {
    length = 3;
    best = 0;
    updateLabels();
    showSequence();
  });

  if (passBtn) {
    passBtn.addEventListener("click", () => {
      best = Math.max(best, length);
      length++;
      updateLabels();
      refreshAllScores();
      showSequence();
    });
  }

  if (failBtn) {
    failBtn.addEventListener("click", () => {
      updateLabels();
      display.textContent = `Complete. Max span: ${best}`;
      refreshAllScores();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      length = 3;
      best = 0;
      display.textContent = "Press Start";
      updateLabels();
      refreshAllScores();
    });
  }
} 
/* =========================================================
   COGNITION SCORING
========================================================= */

function scoreMiniCog() {
  const recall = getNumber("miniCogRecall", 0);
  const clockRaw = getValue("miniCogClock", "0");
  const clock = Number.isFinite(parseInt(clockRaw, 10)) ? parseInt(clockRaw, 10) : clockRaw === "Normal" ? 2 : 0;

  if (recall >= 3) return 100;
  if (recall === 0) return 25;
  if (recall >= 1 && recall <= 2 && clock === 2) return 80;
  if (recall >= 1 && recall <= 2 && clock === 1) return 55;
  return 30;
}

function scoreTrailB() {
  const seconds = getNumber("trailBTime", 0);
  const errorLabel = getValue("trailBErrors", "None");

  if (seconds <= 0) return 80;

  let base = 100;

  if (seconds < 120) base = 100;
  else if (seconds < 180) base = 75;
  else if (seconds < 240) base = 50;
  else base = 25;

  if (errorLabel === "1–2 errors") base -= 5;
  if (errorLabel === "Multiple errors") base -= 15;

  return clamp(base);
}

function scoreDigitSpan() {
  const digits = getNumber("digitSpanScore", 0);
  const testType = getValue("digitSpanType", "Forward");

  if (digits <= 0) return 80;

  let base = 100;

  if (digits >= 5) base = 100;
  else if (digits === 4) base = 75;
  else if (digits === 3) base = 50;
  else base = 25;

  if (testType === "Backward") base += 5;

  return clamp(base);
}

function scoreTrailA() {
  const seconds = getNumber("trailATime", 0);
  const errorLabel = getValue("trailAErrors", "None");

  if (seconds <= 0) return 80;

  let base = 100;

  if (seconds < 60) base = 100;
  else if (seconds < 90) base = 75;
  else if (seconds < 150) base = 50;
  else base = 25;

  if (errorLabel === "1–2 errors") base -= 5;
  if (errorLabel === "Multiple errors") base -= 15;

  return clamp(base);
}
function calculateCognitionScore() {
  const scores = [
    scoreMiniCog(),
    scoreTrailA(),
    scoreTrailB(),
    scoreDigitSpan()
  ];

  const lowScores = scores.filter((score) => score < 60).length;
  const averageScore = round(average(scores));

  if (lowScores >= 2) return averageScore;
  if (lowScores === 1) return clamp(averageScore + 8);

  return clamp(averageScore + 5);
}
/* =========================================================
   NUTRITION SCORING
========================================================= */

function scoreMNA() {
  const hasMNAInputs = document.querySelectorAll(".mna-input").length > 0;
  const total = hasMNAInputs ? sumSelectValues(".mna-input") : getNumber("mnaScore", 0);

  if (total >= 12) return 100;
  if (total >= 8) return 65;
  return 30;
}

function scoreProtein() {
  const value = getValue("proteinIntake", "Moderate");
  if (value === "High") return 100;
  if (value === "Moderate") return 70;
  return 35;
}

function scoreFruitVeg() {
  const value = getValue("fruitVegIntake", "Moderate");
  if (value === "High") return 100;
  if (value === "Moderate") return 70;
  return 40;
}

function scoreMeals() {
  const value = getValue("mealFrequency", "3 meals/day");
  if (value === "3+ meals/day") return 100;
  if (value === "3 meals/day") return 80;
  return 40;
}

function scoreAppetite() {
  const value = getValue("appetiteLevel", "Fair");
  if (value === "Good") return 100;
  if (value === "Fair") return 70;
  return 35;
}

function scoreHydration() {
  const value = getValue("fluidIntake", "4–6 cups");
  const concern = getValue("nutritionHydrationConcern", "No");

  let base = 0;
  if (value === "> 8 cups" || value === "6–8 cups" || value === "6–8+ cups/day") base = 100;
  else if (value === "4–6 cups" || value === "4–6 cups/day") base = 65;
  else base = 30;

  if (concern === "Yes") base -= 15;
  return clamp(base);
}

function scoreWeightChange() {
  const weightLoss = getValue("recentWeightLoss", "No");
  const intakeChange = getValue("intakeChange", "No change");

  let base = 100;
  if (weightLoss === "1–5 lbs") base -= 10;
  if (weightLoss === "5–10 lbs") base -= 30;
  if (weightLoss === "> 10 lbs") base -= 45;
  if (intakeChange === "Moderate decrease") base -= 20;
  if (intakeChange === "Severe decrease") base -= 40;

  return clamp(base);
}

function calculateNutritionScore() {
  return round(average([scoreMNA(), scoreProtein(), scoreFruitVeg(), scoreMeals(), scoreAppetite(), scoreHydration(), scoreWeightChange()]));
}

function bindMNAScoring() {
  const updateMNA = () => {
    const total = sumSelectValues(".mna-input");
    setText("mnaTotal", total);
    refreshAllScores();
  };

  document.querySelectorAll(".mna-input").forEach((el) => {
    el.addEventListener("change", updateMNA);
  });

  if (document.querySelectorAll(".mna-input").length) updateMNA();
}

/* =========================================================
   HOME SAFETY SCORING
========================================================= */

function calculateHomeSafetyScore() {
  const section = getEl("homeSafety");
  if (!section) return state.home;

  const selects = Array.from(section.querySelectorAll("select"));
  if (!selects.length) return state.home;

  const values = selects.map((el) => String(el.value).trim().toLowerCase()).filter((value) => value === "yes" || value === "no");
  if (!values.length) return state.home;

  const yesCount = values.filter((value) => value === "yes").length;
  return round((yesCount / values.length) * 100);
}

/* =========================================================
   MENTAL WELLBEING SCORING
========================================================= */

function updatePHQ2() {
  const total = sumSelectValues(".phq2-input");
  setText("phq2Total", total);
  toggleHidden("phq9Followup", total < 3);
  updatePHQ9();
}

function updatePHQ9() {
  const total = sumSelectValues(".phq9-input");
  setText("phq9Total", total);
}

function updateGAD2() {
  const total = sumSelectValues(".gad2-input");
  setText("gad2Total", total);
  toggleHidden("gad7Followup", total < 3);
  updateGAD7();
}

function updateGAD7() {
  const total = sumSelectValues(".gad7-input");
  setText("gad7Total", total);
}

function calculateMentalScore() {
  const phq2 = sumSelectValues(".phq2-input");
  const gad2 = sumSelectValues(".gad2-input");

  const phq9Visible = !getEl("phq9Followup")?.classList.contains("hidden");
  const gad7Visible = !getEl("gad7Followup")?.classList.contains("hidden");

  const phq9 = sumSelectValues(".phq9-input");
  const gad7 = sumSelectValues(".gad7-input");

  let depressionScore = 100;
  let anxietyScore = 100;

  if (phq9Visible) {
    if (phq9 <= 4) depressionScore = 100;
    else if (phq9 <= 9) depressionScore = 75;
    else if (phq9 <= 14) depressionScore = 55;
    else if (phq9 <= 19) depressionScore = 35;
    else depressionScore = 20;
  } else {
    depressionScore = phq2 >= 3 ? 55 : 95;
  }

  if (gad7Visible) {
    if (gad7 <= 4) anxietyScore = 100;
    else if (gad7 <= 9) anxietyScore = 75;
    else if (gad7 <= 14) anxietyScore = 50;
    else anxietyScore = 25;
  } else {
    anxietyScore = gad2 >= 3 ? 55 : 95;
  }

  return round(average([depressionScore, anxietyScore]));
}

function bindMentalHealthScoring() {
  document.querySelectorAll(".phq2-input").forEach((el) => el.addEventListener("change", () => { updatePHQ2(); refreshAllScores(); }));
  document.querySelectorAll(".phq9-input").forEach((el) => el.addEventListener("change", () => { updatePHQ9(); refreshAllScores(); }));
  document.querySelectorAll(".gad2-input").forEach((el) => el.addEventListener("change", () => { updateGAD2(); refreshAllScores(); }));
  document.querySelectorAll(".gad7-input").forEach((el) => el.addEventListener("change", () => { updateGAD7(); refreshAllScores(); }));

  updatePHQ2();
  updateGAD2();
}

/* =========================================================
   RESULTS + REPORT HELPERS
========================================================= */

function getLowestDomains() {
  return [
    { key: "mobility", label: "Mobility", score: state.mobility },
    { key: "driving", label: "Driving / Community Mobility", score: state.driving },
    { key: "processing", label: "Processing Speed / Reaction", score: state.processing },
    { key: "cognition", label: "Cognition", score: state.cognition },
    { key: "nutrition", label: "Nutrition", score: state.nutrition },
    { key: "home", label: "Home Safety", score: state.home },
    { key: "mental", label: "Mental Wellbeing", score: state.mental },
  ].sort((a, b) => a.score - b.score);
}

function getTopDriversText() {
  return getLowestDomains().slice(0, 3).map((domain) => domain.label);
}

function getClientName() {
  return getValue("clientName", "Client");
}

function getAssessmentDate() {
  return getValue("assessmentDate", "");
}

function formatDisplayDate(rawDate) {
  if (!rawDate) return "Not provided";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return rawDate;
  return date.toLocaleDateString();
}

function getDomainStatus(score) {
  if (score >= 85) return "Good";
  if (score >= 70) return "Watch";
  return "Needs attention";
}

function getDomainSummary(domainKey, score) {
  const summaries = {
    mobility: ["Walking, transfers, and balance need improvement.", "Some mobility concerns are present and should be monitored.", "Walking, transfers, and balance are generally strong."],
    driving: ["Driving-related screening suggests further review may be appropriate.", "Some driving or community mobility concerns are present and should be monitored.", "Driving and community mobility screening was generally reassuring."],
    processing: ["Processing speed or response control findings suggest closer follow-up.", "Mild slowing or response concerns may be present.", "Processing speed and reaction screening was generally reassuring."],
    cognition: ["Cognitive screening suggests a need for closer follow-up.", "No major red flags, but ongoing monitoring is reasonable.", "Thinking and memory screening was generally reassuring."],
    nutrition: ["Nutrition results suggest elevated risk and likely benefit from intervention.", "Nutrition habits could be improved to support strength and resilience.", "Nutrition screening is generally reassuring."],
    home: ["Home safety setup may increase fall or transfer risk.", "Some environmental concerns are present and should be addressed.", "Home setup appears generally supportive and safe."],
    mental: ["Mental wellbeing screening suggests a need for closer follow-up.", "Some mild emotional wellbeing concerns may be present.", "No major emotional wellbeing concerns were identified on screening."],
  };

  const group = summaries[domainKey];
  if (!group) return "Domain interpretation unavailable.";
  if (score >= 85) return group[2];
  if (score >= 70) return group[1];
  return group[0];
}

function refreshAllScores() {
  updateGaitSpeed();

  state.mobility = calculateMobilityScore();
  state.driving = calculateDrivingScore();
  state.processing = calculateProcessingScore();
  state.cognition = calculateCognitionScore();
  state.nutrition = calculateNutritionScore();
  state.home = calculateHomeSafetyScore();
  state.mental = calculateMentalScore();

  updateResultsUI();
  updatePrintReports();
}

function updateMetric(key) {
  const value = state[key];
  const bar = getEl(`bar-${key}`);
  const stat = getEl(`stat-${key}`);

  if (bar) {
    bar.style.width = `${value}%`;
    bar.className = getBarClass(value);
  }

  if (stat) stat.textContent = value;
}

function getTopRiskDriversData() {
  const drivers = [];

  if (state.mobility < 70) drivers.push({ title: "Mobility decline", text: "Walking speed, balance, transfers, or lower-body strength are contributing to current risk.", score: state.mobility });
  if (state.driving < 70) drivers.push({ title: "Driving / community mobility concern", text: "Driving-related screening suggests possible concern with dual-task mobility, navigation, family concern, or safety awareness.", score: state.driving });
  if (state.processing < 70) drivers.push({ title: "Processing speed / reaction concern", text: "Reaction time, response selection, or inhibition findings may affect community mobility and safety.", score: state.processing });
  if (state.cognition < 70) drivers.push({ title: "Cognitive screening concern", text: "Screening suggests possible difficulty with memory, executive function, or working memory.", score: state.cognition });
  if (state.nutrition < 70) drivers.push({ title: "Nutrition risk", text: "Nutrition screening suggests reduced resilience, intake quality, hydration, or weight stability may be concerns.", score: state.nutrition });
  if (state.home < 70) drivers.push({ title: "Home safety risk", text: "Environmental hazards or lack of supports may increase fall and transfer risk.", score: state.home });
  if (state.mental < 70) drivers.push({ title: "Mental wellbeing concern", text: "Mood or anxiety screening suggests emotional wellbeing may be affecting function and follow-through.", score: state.mental });

  if (!drivers.length) drivers.push({ title: "No major driver identified", text: "No single domain is showing a strong red flag at this time.", score: 100 });

  return drivers.sort((a, b) => a.score - b.score).slice(0, 3);
}

function getReferralData() {
  const referrals = [];

  if (state.mobility < 70) referrals.push({ title: "Physical therapy", text: "Consider PT for gait, balance, lower-body strength, transfers, and fall prevention." });
  if (state.driving < 70) referrals.push({ title: "Driving / community mobility follow-up", text: "Consider referral for formal driving evaluation or community mobility assessment if concerns persist." });
  if (state.processing < 70) referrals.push({ title: "Processing speed / cognitive-motor follow-up", text: "Consider additional review of reaction time, response selection, and inhibition if these affect safety or independence." });
  if (state.home < 70) referrals.push({ title: "Occupational therapy / home safety consult", text: "Consider OT for bathroom setup, environmental modification, and daily activity safety." });
  if (state.nutrition < 70) referrals.push({ title: "Nutrition support", text: "Consider dietary counseling or medical nutrition follow-up if intake, weight, or hydration are concerns." });
  if (state.cognition < 70) referrals.push({ title: "Cognitive follow-up", text: "Consider expanded cognitive assessment or PCP discussion if concerns persist or worsen." });
  if (state.mental < 70) referrals.push({ title: "Behavioral health / PCP follow-up", text: "Consider further mood or anxiety evaluation if screening remains positive or symptoms interfere with function." });

  if (!referrals.length) referrals.push({ title: "Monitor only", text: "No immediate referral need identified from current screening." });
  return referrals;
}

function getPriorityFlagsData() {
  const flags = [];

  if (state.mobility < 65 && state.home < 65) flags.push({ title: "High fall risk", text: "Mobility limitations combined with home safety concerns increase fall exposure." });
  if (state.driving < 60) flags.push({ title: "Driving-related concern", text: "Multiple screening indicators suggest further driving or community mobility review may be appropriate." });
  if (state.processing < 60) flags.push({ title: "Processing speed concern", text: "Reaction time or inhibition findings suggest closer monitoring for safety-related tasks." });
  if (state.nutrition < 60) flags.push({ title: "Nutrition risk", text: "Current screening suggests closer attention to intake, weight trend, and resilience is needed." });
  if (state.cognition < 60) flags.push({ title: "Cognitive concern", text: "Screening findings suggest closer monitoring and possible follow-up evaluation." });
  if (state.mental < 60) flags.push({ title: "Mental wellbeing concern", text: "Mood or anxiety findings may warrant additional follow-up if symptoms persist." });

  if (!flags.length) flags.push({ title: "No major priority flags", text: "No urgent red flags identified from current screening profile." });
  return flags;
}

function getImmediatePrioritiesData() {
  const items = [];

  if (state.mobility < 70) items.push("Address walking and balance");
  if (state.driving < 70) items.push("Review driving/community mobility safety");
  if (state.processing < 70) items.push("Review processing speed and reaction safety");
  if (state.home < 70) items.push("Improve home safety setup");
  if (state.nutrition < 70) items.push("Review nutrition intake");
  if (state.cognition < 70) items.push("Monitor cognition");
  if (state.mental < 70) items.push("Monitor mood/anxiety");

  items.push("Follow up in 8–12 weeks");
  return [...new Set(items)];
}

function renderPriorityList(containerId, items) {
  const el = getEl(containerId);
  if (!el) return;

  el.innerHTML = items.map((item) => `
    <div class="priority">
      <strong>${item.title}</strong>
      <div class="small">${item.text}</div>
    </div>
  `).join("");
}

function renderChoiceGroup(containerId, items) {
  const el = getEl(containerId);
  if (!el) return;
  el.innerHTML = items.map((item) => `<div class="choice">${item}</div>`).join("");
}
function getOverallRiskPhrase(score, audience = "senior") {
  if (audience === "clinical") {
    if (score >= 85) return "strong independence profile with lower current risk";
    if (score >= 70) return "mild risk for loss of independence";
    if (score >= 50) return "moderate risk for loss of independence";
    return "high risk for loss of independence";
  }

  if (score >= 85) return "a strong independence profile with lower current risk";
  if (score >= 70) return "mild risk for loss of independence";
  if (score >= 50) return "moderate risk for loss of independence";
  return "high risk for loss of independence";
}
function updateResultsUI() {
  const score = calculateScore();
  const scoreBand = getScoreBand(score);
  const lowest = getLowestDomains();

  const overallScore = getEl("overallScore");
  const scorePill = getEl("scorePill");
  const resultsSummary = getEl("resultsSummary");
  const resultsAlerts = getEl("resultsAlerts");
  const clinicalSummaryBlock = getEl("clinicalSummaryBlock");

  if (overallScore) overallScore.textContent = score;

  if (scorePill) {
    scorePill.textContent = scoreBand.label;
    scorePill.className = `score-pill ${scoreBand.className}`;
  }

  ["mobility", "driving", "processing", "cognition", "nutrition", "home", "mental"].forEach(updateMetric);

  if (resultsSummary) {
    const top1 = lowest[0]?.label || "function";
    const top2 = lowest[1]?.label || "safety";
  resultsSummary.textContent = `Your current profile shows ${getOverallRiskPhrase(score, "senior")}, driven mainly by ${top1} and ${top2} concerns.`;
  }

  if (resultsAlerts) {
    const alerts = [];
    if (state.mobility < 65 && state.home < 65) alerts.push('<div class="alert alert-warn">High fall risk: mobility + home safety interaction.</div>');
    if (state.driving < 60) alerts.push('<div class="alert alert-warn">Driving/community mobility concern detected.</div>');
    if (state.processing < 60) alerts.push('<div class="alert alert-warn">Processing speed/reaction concern detected.</div>');
    if (state.nutrition < 60) alerts.push('<div class="alert alert-warn">Nutrition risk detected.</div>');
    if (state.mental < 60) alerts.push('<div class="alert alert-warn">Mental wellbeing concern detected.</div>');
    if (state.cognition < 60) alerts.push('<div class="alert alert-warn">Cognitive screening concern detected.</div>');

    if (!alerts.length) alerts.push('<div class="alert alert-info">No major risk flags detected.</div>');
    else alerts.push('<div class="alert alert-info">Reassessment recommended in 8–12 weeks after intervention.</div>');

    resultsAlerts.innerHTML = alerts.join("");
  }

  renderPriorityList("topRiskDrivers", getTopRiskDriversData());
  renderPriorityList("recommendedReferrals", getReferralData());
  renderPriorityList("priorityFlags", getPriorityFlagsData());
  renderChoiceGroup("immediateClinicalPriorities", getImmediatePrioritiesData());

  if (clinicalSummaryBlock) {
    const first = lowest[0]?.label || "function";
    const second = lowest[1]?.label || "safety";
   clinicalSummaryBlock.textContent = `Client demonstrates ${getOverallRiskPhrase(score, "clinical")} with greatest relative concerns in ${first} and ${second}. Targeted intervention should focus first on these domains, with reassessment recommended after intervention to track change over time.`;
  }
}

/* =========================================================
   PRINT REPORTS
========================================================= */

function setFriendlyPill(id, score) {
  const el = getEl(id);
  if (!el) return;

  const status = getDomainStatus(score);
  el.textContent = status;
  el.className = "friendly-pill";

  if (status === "Good") el.classList.add("good");
  else if (status === "Watch") el.classList.add("watch");
  else el.classList.add("needs");
}

function getSeniorTalkItems() {
  const items = [];

  if (state.mobility < 70) {
    items.push("If falls continue or balance worsens");
    items.push("If walking becomes less safe");
  }
  if (state.driving < 70) items.push("If driving, transportation, or community outings become concerning");
  if (state.processing < 70) items.push("If reaction time, attention, or response speed affects safety");
  if (state.nutrition < 70) items.push("If appetite or weight loss becomes a concern");
  if (state.cognition < 70) items.push("If memory or thinking problems begin to affect daily life");
  if (state.mental < 70) items.push("If mood or anxiety symptoms become more frequent or harder to manage");

  if (!items.length) items.push("If there is a major change in walking, eating, mood, thinking, or daily function");
  return [...new Set(items)];
}

function getSeniorFollowupText() {
  const overall = calculateScore();
  if (overall < 60) return "Repeat this assessment in 2–4 weeks, or sooner if there is a fall, illness, or sudden change in function.";
  if (overall < 80) return "Repeat this assessment in 8–12 weeks after changes are started, or sooner if there is a new fall, illness, or significant change in function.";
  return "Repeat this assessment in 3–6 months to monitor progress and maintain gains, or sooner if there is a meaningful change in function.";
}
function getResultOrNotCompleted(value, suffix = "") {
  if (value === null || value === undefined || value === "" || value === 0) {
    return "Not completed";
  }

  return `${value}${suffix}`;
}

function getYesNoLabel(id) {
  return getNumber(id, 0) === 1 ? "Yes" : "No";
}

function getDetailedTestResultsHTML() {
  const simpleAvg = getNumber("simpleRtAvg", 0);
  const choiceAvg = getNumber("choiceRtAvg", 0);
  const goNoGoErrors =
    getNumber("goNoGoFalseTaps", 0) + getNumber("goNoGoMisses", 0);

  const gaitSpeed = getNumber("gaitSpeed", 0);

  const rows = [
    {
      group: "Mobility",
      test: "10-Meter Walk Test",
      result:
        getNumber("walkTime", 0) > 0
          ? `${getNumber("walkTime", 0)} sec / ${gaitSpeed.toFixed(2)} m/s`
          : "Not completed",
      interpretation: getValue("gaitSpeedInterpretation", "Not calculated"),
    },
    {
      group: "Mobility",
      test: "Timed Up and Go",
      result: getResultOrNotCompleted(getNumber("tugTime", 0), " sec"),
      interpretation:
        scoreTUG() >= 85
          ? "Lower fall risk"
          : scoreTUG() >= 60
          ? "Moderate fall risk"
          : "Higher fall risk",
    },
    {
      group: "Mobility",
      test: "30-Second Chair Stand",
      result: getResultOrNotCompleted(getNumber("chairStandReps", 0), " reps"),
      interpretation:
        scoreChairStand() >= 85
          ? "Good lower-extremity strength"
          : scoreChairStand() >= 60
          ? "Mild strength impairment"
          : "Higher weakness concern",
    },
    {
      group: "Mobility",
      test: "4-Stage Balance",
      result: getValue("balanceStage", "Not completed"),
      interpretation:
        score4StageBalance() >= 85
          ? "Lower balance concern"
          : score4StageBalance() >= 60
          ? "Moderate balance concern"
          : "Higher fall risk",
    },
    {
      group: "Mobility",
      test: "4-Square Step Test",
      result: getResultOrNotCompleted(getNumber("fsstTime", 0), " sec"),
      interpretation:
        scoreFSST() >= 85
          ? "Lower dynamic balance concern"
          : scoreFSST() >= 60
          ? "Moderate stepping impairment"
          : "Higher fall risk",
    },

    {
      group: "Driving / Community Mobility",
      test: "Recent crashes or near misses",
      result: getYesNoLabel("drivingNearMiss"),
      interpretation:
        getNumber("drivingNearMiss", 0) === 1
          ? "Driving safety concern reported"
          : "No recent crash / near miss reported",
    },
    {
      group: "Driving / Community Mobility",
      test: "Family concern about driving",
      result: getYesNoLabel("familyDrivingConcern"),
      interpretation:
        getNumber("familyDrivingConcern", 0) === 1
          ? "Family concern present"
          : "No family concern reported",
    },
    {
      group: "Driving / Community Mobility",
      test: "Transportation Independence",
      result: `Driving: ${getValue("drivesIndependently", "Not completed")}; Reliance: ${getValue("transportReliance", "Not completed")}`,
      interpretation: getDomainSummary("driving", state.driving),
    },

    {
      group: "Processing Speed / Reaction",
      test: "Simple Visual Reaction Time",
      result:
        simpleAvg > 0
          ? `${simpleAvg} ms avg; ${getNumber("simpleRtMisses", 0)} missed/early taps`
          : "Not completed",
      interpretation:
        simpleAvg <= 0
          ? "Not completed"
          : simpleAvg > 650
          ? "Slowed reaction time"
          : simpleAvg >= 450
          ? "Mild processing variability"
          : "Typical response speed",
    },
    {
      group: "Processing Speed / Reaction",
      test: "Choice Reaction Time",
      result:
        choiceAvg > 0
          ? `${choiceAvg} ms avg; ${getNumber("choiceRtErrors", 0)} errors; ${getNumber("choiceRtMisses", 0)} misses`
          : "Not completed",
      interpretation:
        choiceAvg <= 0
          ? "Not completed"
          : choiceAvg > 950
          ? "Slowed response selection"
          : choiceAvg >= 700
          ? "Mild response selection variability"
          : "Typical response selection",
    },
    {
      group: "Processing Speed / Reaction",
      test: "Go / No-Go",
      result: `${getNumber("goNoGoFalseTaps", 0)} false taps; ${getNumber("goNoGoMisses", 0)} missed GO responses`,
      interpretation:
        goNoGoErrors >= 4
          ? "Executive control concern"
          : goNoGoErrors >= 2
          ? "Monitor inhibition"
          : "Lower inhibition concern",
    },

    {
      group: "Cognition",
      test: "Mini-Cog Recall",
      result: `${getNumber("miniCogRecall", 0)}/3 words recalled`,
      interpretation:
        scoreMiniCog() >= 80
          ? "Lower cognitive screening concern"
          : "Positive screen / follow-up may be appropriate",
    },
    {
      group: "Cognition",
      test: "Clock Drawing",
      result: getValue("miniCogClock", "Not completed"),
      interpretation:
        getNumber("miniCogClock", 0) >= 2
          ? "Functionally adequate clock"
          : getNumber("miniCogClock", 0) === 1
          ? "Mild clock drawing concern"
          : "Abnormal clock drawing screen",
    },
    {
      group: "Cognition",
      test: "Trail Making A",
      result: getResultOrNotCompleted(getNumber("trailATime", 0), " sec"),
      interpretation:
        scoreTrailA() >= 85
          ? "Typical older adult processing speed"
          : scoreTrailA() >= 60
          ? "Mild slowing may be present"
          : "Further screening may be appropriate",
    },
    {
      group: "Cognition",
      test: "Trail Making B",
      result: getResultOrNotCompleted(getNumber("trailBTime", 0), " sec"),
      interpretation:
        scoreTrailB() >= 85
          ? "Typical executive sequencing performance"
          : scoreTrailB() >= 60
          ? "Mild executive slowing"
          : "Executive inefficiency may be present",
    },
    {
      group: "Cognition",
      test: "Digit Span",
      result: getResultOrNotCompleted(getNumber("digitSpanScore", 0), " digits"),
      interpretation:
        scoreDigitSpan() >= 85
          ? "Typical attention / working memory"
          : scoreDigitSpan() >= 60
          ? "Mild working memory variability"
          : "Further screening may be appropriate",
    },

    {
      group: "Nutrition",
      test: "MNA-SF",
      result: `${sumSelectValues(".mna-input")}/14`,
      interpretation:
        scoreMNA() >= 85
          ? "Normal nutrition screen"
          : scoreMNA() >= 60
          ? "At risk for malnutrition"
          : "Malnutrition risk",
    },
    {
      group: "Nutrition",
      test: "Protein Intake",
      result: getValue("proteinIntake", "Not completed"),
      interpretation:
        scoreProtein() >= 85
          ? "Adequate protein intake"
          : scoreProtein() >= 60
          ? "Moderate protein intake"
          : "Low protein intake",
    },
    {
      group: "Nutrition",
      test: "Hydration",
      result: getValue("fluidIntake", "Not completed"),
      interpretation:
        scoreHydration() >= 85
          ? "Adequate hydration"
          : scoreHydration() >= 60
          ? "Monitor hydration"
          : "Hydration concern",
    },

    {
      group: "Mental Wellbeing",
      test: "PHQ-2",
      result: `${sumSelectValues(".phq2-input")}`,
      interpretation:
        sumSelectValues(".phq2-input") >= 3
          ? "Positive depression screen"
          : "Negative depression screen",
    },
    {
      group: "Mental Wellbeing",
      test: "GAD-2",
      result: `${sumSelectValues(".gad2-input")}`,
      interpretation:
        sumSelectValues(".gad2-input") >= 3
          ? "Positive anxiety screen"
          : "Negative anxiety screen",
    },
  ];

  let currentGroup = "";

  return `
    <table class="report-table detailed-results-table">
      <thead>
        <tr>
          <th>Domain</th>
          <th>Test / Measure</th>
          <th>Result</th>
          <th>Clinical Interpretation</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const showGroup = row.group !== currentGroup;
            currentGroup = row.group;

            return `
              <tr>
                <td>${showGroup ? `<strong>${row.group}</strong>` : ""}</td>
                <td>${row.test}</td>
                <td>${row.result}</td>
                <td>${row.interpretation}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}
function getReportDomainData() {
  return [
    ["Mobility", state.mobility, getDomainSummary("mobility", state.mobility)],
    ["Driving", state.driving, getDomainSummary("driving", state.driving)],
    ["Processing", state.processing, getDomainSummary("processing", state.processing)],
    ["Cognition", state.cognition, getDomainSummary("cognition", state.cognition)],
    ["Nutrition", state.nutrition, getDomainSummary("nutrition", state.nutrition)],
    ["Home Safety", state.home, getDomainSummary("home", state.home)],
    ["Mental Wellbeing", state.mental, getDomainSummary("mental", state.mental)],
  ];
}

function getDomainClass(score) {
  if (score >= 80) return "good";
  if (score >= 60) return "mid";
  return "high";
}

function getDomainRiskLabel(score) {
  if (score >= 80) return "Lower Risk";
  if (score >= 60) return "Mild / Moderate Risk";
  return "Higher Risk";
}

function getClinicalDomainCardsHTML() {
  return getReportDomainData()
    .map(([label, score]) => {
      const band = getDomainClass(score);

      return `
        <div class="domain-card domain-${band}">
          <div class="domain-card-title">${label}</div>
          <div class="domain-card-score">${score}</div>
          <div class="domain-card-label">${getDomainRiskLabel(score)}</div>
        </div>
      `;
    })
    .join("");
}

function getClinicalDomainBarsHTML() {
  return getReportDomainData()
    .map(([label, score]) => {
      let color = "#16a34a";

      if (score < 80 && score >= 60) color = "#f59e0b";
      if (score < 60) color = "#dc2626";

      const barWidth = Math.max(4, score * 2.2);

      return `
        <div style="
          display:grid;
          grid-template-columns:150px 1fr 45px;
          align-items:center;
          gap:12px;
          margin:10px 0;
        ">
          <div style="font-weight:800;">${label}</div>

          <svg width="100%" height="14" viewBox="0 0 220 14" preserveAspectRatio="none">
            <rect x="0" y="2" width="220" height="10" rx="5" fill="#e5edf7"></rect>
            <rect x="0" y="2" width="${barWidth}" height="10" rx="5" fill="${color}"></rect>
          </svg>

          <div style="font-weight:900;text-align:right;">${score}</div>
        </div>
      `;
    })
    .join("");
}
function getClinicalRecommendationsHTML() {
  const items = [];

  if (state.mobility < 80) {
    items.push("Continue or initiate balance, gait, and lower-extremity strengthening interventions.");
  }

  if (state.driving < 80) {
    items.push("Review transportation safety, route planning, family concerns, and community mobility supports.");
  }

  if (state.processing < 80) {
    items.push("Use caution with tasks requiring rapid reaction time, divided attention, or quick decision-making.");
  }

  if (state.cognition < 80) {
    items.push("Monitor cognition over time and consider provider follow-up if concerns persist or worsen.");
  }

  if (state.nutrition < 80) {
    items.push("Support hydration, protein intake, meal consistency, and nutrition follow-up as indicated.");
  }

  if (state.home < 80) {
    items.push("Address modifiable home safety risks including lighting, bathroom safety, rugs, clutter, and emergency access.");
  }

  if (state.mental < 80) {
    items.push("Consider further mood/anxiety screening and emotional wellbeing support planning.");
  }

  if (!items.length) {
    items.push("Continue current wellness routines and repeat screening at the recommended follow-up interval.");
  }

  return items.map((item) => `<li>${item}</li>`).join("");
}
function getSeniorDomainCardsHTML() {
  const domains = [
    ["Mobility", state.mobility],
    ["Driving", state.driving],
    ["Processing", state.processing],
    ["Thinking / Memory", state.cognition],
    ["Nutrition", state.nutrition],
    ["Home Safety", state.home],
    ["Emotional Wellbeing", state.mental]
  ];

  return domains.map(([name, score]) => {

    let cls = "senior-domain-good";
    let label = "Strong";

    if (score < 80 && score >= 60) {
      cls = "senior-domain-mid";
      label = "Monitor";
    }

    if (score < 60) {
      cls = "senior-domain-high";
      label = "Needs Attention";
    }

    return `
      <div class="senior-domain-card ${cls}">
        <div class="senior-domain-title">${name}</div>
        <div class="senior-domain-score">${score}</div>
        <div class="senior-domain-status">${label}</div>
      </div>
    `;
  }).join("");
}
function getSeniorTopFocusHTML() {

  const domains = [
    {
      name: "Mobility",
      score: state.mobility,
      text: "Continue strength, walking, and balance activities."
    },
    {
      name: "Driving / Community Mobility",
      score: state.driving,
      text: "Review transportation options and community participation."
    },
    {
      name: "Processing Speed",
      score: state.processing,
      text: "Use extra caution with tasks requiring quick responses."
    },
    {
      name: "Thinking / Memory",
      score: state.cognition,
      text: "Monitor memory and thinking changes over time."
    },
    {
      name: "Nutrition",
      score: state.nutrition,
      text: "Focus on hydration, protein intake, and consistent meals."
    },
    {
      name: "Home Safety",
      score: state.home,
      text: "Address home hazards and improve environmental safety."
    },
    {
      name: "Emotional Wellbeing",
      score: state.mental,
      text: "Monitor mood, stress, and emotional health."
    }
  ];

  const lowest = [...domains]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return lowest.map((item, index) => `
    <div class="focus-item">
      <div class="focus-number">${index + 1}</div>

      <div class="focus-text">
        <strong>${item.name}</strong><br>
        ${item.text}
      </div>
    </div>
  `).join("");
}
function updatePrintReports() {
  const overall = calculateScore();
  const risk = getScoreBand(overall);
  const name = getClientName();
  const date = formatDisplayDate(getAssessmentDate());

  const topDrivers = getTopDriversText();
  const driver1 = topDrivers[0] || "mobility";
  const driver2 = topDrivers[1] || "home safety";
  const driver3 = topDrivers[2] || "nutrition";

  setText("reportClientName", name);
  setText("reportAssessmentDate", date);
  setText("reportOverallScore", overall);
  setText("reportOverallRisk", risk.label);

  setText("clinicalClientName", name);
  setText("clinicalAssessmentDate", date);
  setText("clinicalOverallScore", overall);
  setText("clinicalOverallRisk", risk.label);

 setText(
  "seniorSummaryText",
  `Your results show ${getOverallRiskPhrase(overall, "senior")}. The biggest areas affecting your score were ${driver1} and ${driver2}.`
);

setText(
  "clinicalSummaryText",
  `Composite profile indicates ${getOverallRiskPhrase(overall, "clinical")}, with the greatest relative concerns in ${driver1} and ${driver2}.`
);
  setFriendlyPill("seniorMobilityStatus", state.mobility);
  setFriendlyPill("seniorCognitionStatus", state.cognition);
  setFriendlyPill("seniorNutritionStatus", state.nutrition);
  setFriendlyPill("seniorHomeStatus", state.home);
  setFriendlyPill("seniorMentalStatus", state.mental);

  setText("seniorMobilityText", getDomainSummary("mobility", state.mobility));
  setText("seniorCognitionText", getDomainSummary("cognition", state.cognition));
  setText("seniorNutritionText", getDomainSummary("nutrition", state.nutrition));
  setText("seniorHomeText", getDomainSummary("home", state.home));
  setText("seniorMentalText", getDomainSummary("mental", state.mental));

  setText("clinicalMobilityScore", state.mobility);
  setText("clinicalDrivingScore", state.driving);
  setText("clinicalProcessingScore", state.processing);
  setText("clinicalCognitionScore", state.cognition);
  setText("clinicalNutritionScore", state.nutrition);
  setText("clinicalHomeScore", state.home);
  setText("clinicalMentalScore", state.mental);

  setText("clinicalMobilityInterpretation", getDomainSummary("mobility", state.mobility));
  setText("clinicalDrivingInterpretation", getDomainSummary("driving", state.driving));
  setText("clinicalProcessingInterpretation", getDomainSummary("processing", state.processing));
  setText("clinicalCognitionInterpretation", getDomainSummary("cognition", state.cognition));
  setText("clinicalNutritionInterpretation", getDomainSummary("nutrition", state.nutrition));
  setText("clinicalHomeInterpretation", getDomainSummary("home", state.home));
  setText("clinicalMentalInterpretation", getDomainSummary("mental", state.mental));

  const seniorStrengths = [];
  const seniorNeeds = [];
  const actions = [];

  Object.entries(state).forEach(([key, score]) => {
    if (score >= 70) seniorStrengths.push(getDomainSummary(key, score));
    if (score < 70) seniorNeeds.push(getDomainSummary(key, score));
  });

  if (state.mobility < 70) actions.push("Begin a balance and lower-body strengthening program.");
  if (state.driving < 70) actions.push("Discuss driving or community mobility concerns with the healthcare team.");
  if (state.processing < 70) actions.push("Use extra caution with tasks requiring quick responses or divided attention.");
  if (state.home < 70) actions.push("Add grab bars, improve lighting, and remove loose rugs or clutter.");
  if (state.nutrition < 70) actions.push("Support regular meals, protein intake, and hydration.");
  if (state.cognition < 70) actions.push("Monitor thinking and memory changes and follow up if needed.");
  if (state.mental < 70) actions.push("Consider further mood or anxiety screening and provider follow-up.");

  if (!seniorStrengths.length) seniorStrengths.push("This screening shows several areas that can improve with the right support plan.");
  if (!seniorNeeds.length) seniorNeeds.push("No major areas of concern were identified on this screening.");
  if (!actions.length) actions.push("Continue healthy routines and repeat screening at the recommended follow-up interval.");

  setHTML("seniorStrengthsList", [...new Set(seniorStrengths)].map((item) => `<li>${item}</li>`).join(""));
  setHTML("seniorNeedsList", [...new Set(seniorNeeds)].map((item) => `<li>${item}</li>`).join(""));
  setHTML("seniorActionsList", actions.map((item, index) => `
    <div class="step-card">
      <div class="step-number">${index + 1}</div>
      <div><p>${item}</p></div>
    </div>
  `).join(""));

  setHTML("seniorTalkList", getSeniorTalkItems().map((item) => `<li>${item}</li>`).join(""));
  setText("seniorFollowupText", getSeniorFollowupText());

  const referralItems = getReferralData().map((item) => `<li><strong>${item.title}:</strong> ${item.text}</li>`);
  const interventionItems = [];

  if (state.mobility < 70) interventionItems.push("<li>Progressive lower-extremity strengthening and structured balance program.</li>");
  if (state.driving < 70) interventionItems.push("<li>Review transportation safety, route planning, family concerns, and community mobility supports.</li>");
  if (state.processing < 70) interventionItems.push("<li>Reduce divided-attention demands and reinforce safety strategies for fast-response activities.</li>");
  if (state.home < 70) interventionItems.push("<li>Bathroom grab bars, non-slip surfaces, improved nighttime lighting, and clutter reduction.</li>");
  if (state.nutrition < 70) interventionItems.push("<li>Protein intake optimization, hydration planning, and meal consistency support.</li>");
  if (state.cognition < 70) interventionItems.push("<li>Monitor cognitive function, medication review, and caregiver observation of changes.</li>");
  if (state.mental < 70) interventionItems.push("<li>Further depression/anxiety screening and emotional wellbeing support planning.</li>");
  if (!interventionItems.length) interventionItems.push("<li>Continue current wellness maintenance and preventive monitoring.</li>");

  const reassessmentItems = [];
  if (overall < 60) reassessmentItems.push("<li><strong>2–4 weeks:</strong> rapid reassessment recommended due to higher current risk.</li>");
  else if (overall < 80) reassessmentItems.push("<li><strong>8–12 weeks:</strong> standard reassessment after intervention implementation.</li>");
  else reassessmentItems.push("<li><strong>3–6 months:</strong> maintenance follow-up appropriate if status remains stable.</li>");
  reassessmentItems.push("<li>Repeat sooner if fall, hospitalization, acute illness, or functional decline occurs.</li>");

  const driverItems = [
    `<li>${driver1} is a major contributor to current risk.</li>`,
    `<li>${driver2} is a major contributor to current risk.</li>`,
    `<li>${driver3} is a secondary contributor to current risk.</li>`,
  ];

  const documentationSummary = `Client demonstrates ${getOverallRiskPhrase(overall, "clinical")} with primary relative concerns in ${driver1} and ${driver2}. Current screening supports targeted intervention planning focused on functional preservation, fall prevention, community mobility, and reduction of avoidable decline. Reassessment timing should reflect intervention response and any acute status changes.`;
  setHTML("clinicalDriverList", driverItems.join(""));
  setHTML("clinicalDetailedTestResults", getDetailedTestResultsHTML());
  setHTML("clinicalReferralList", referralItems.join(""));
  setHTML("clinicalInterventionsList", interventionItems.join(""));
  setHTML("clinicalReassessmentList", reassessmentItems.join(""));
  setText("clinicalDocumentationSummary", documentationSummary);
setHTML("clinicalDomainCards", getClinicalDomainCardsHTML());
setHTML("clinicalDomainBars", getClinicalDomainBarsHTML());
setHTML("clinicalRecommendationsList", getClinicalRecommendationsHTML());
setHTML("clinicalDetailedTestResults", getDetailedTestResultsHTML());
setHTML("seniorDomainCards", getSeniorDomainCardsHTML());
setHTML("seniorTopFocusList", getSeniorTopFocusHTML());
}

/* =========================================================
   GUIDED DOMAIN WIZARDS — CLINICAL WORKFLOW ENHANCEMENTS
   - One focused activity at a time
   - Required-test validation with exception states
   - Overall + within-domain progress
   - Driving and home-safety branching
   - Domain summaries with notable findings
   - Review completion states
   - Prototype local autosave / restore
========================================================= */

const domainWizardConfig = {
  mobility: { label: "Mobility", stateKey: "mobility", prev: "intakeClinicalNotes", next: "driving" },
  driving: { label: "Driving & Community Mobility", stateKey: "driving", prev: "mobility", next: "processing" },
  processing: { label: "Processing Speed", stateKey: "processing", prev: "driving", next: "cognition" },
  cognition: { label: "Cognition", stateKey: "cognition", prev: "processing", next: "nutrition" },
  nutrition: { label: "Nutrition", stateKey: "nutrition", prev: "cognition", next: "homeSafety" },
  homeSafety: { label: "Home Safety", stateKey: "home", prev: "nutrition", next: "mental" },
  mental: { label: "Mental Wellbeing", stateKey: "mental", prev: "homeSafety", next: "review" },
};

const assessmentDomainOrder = ["mobility", "driving", "processing", "cognition", "nutrition", "homeSafety", "mental"];
const domainWizardState = {};
const DRAFT_KEY = "thrive360.clinicalDraft.v1";
let autosaveTimer = null;

function activityTitle(card) {
  return card?.querySelector(".test-title")?.textContent?.trim() || "Activity";
}

function isInformationalCard(card) {
  const title = activityTitle(card).toLowerCase();
  return title.includes("clinician setup") || title.includes("testing setup") ||
    title.includes("screening notes") || title === "clinical interpretation" ||
    title === "driving & community mobility screening";
}

function isDomainNotAssessed(domainId) {
  if (domainId === "homeSafety") return getValue("homeSafetyContext", "") === "not-assessed";
  const wizard = domainWizardState[domainId];
  if (!wizard) return false;
  const taskCards = wizard.cards.filter(c => c.dataset.domainSummary !== "true" && !isInformationalCard(c));
  return taskCards.length > 0 && taskCards.every(c => getCardDisposition(c) === "na");
}

function getCardDisposition(card) {
  return card?.querySelector("[data-activity-disposition]")?.value || "";
}

function addDispositionControl(card) {
  if (!card || card.dataset.domainSummary === "true" || isInformationalCard(card) || card.querySelector("[data-activity-disposition]")) return;
  const wrap = document.createElement("div");
  wrap.className = "activity-disposition";
  wrap.innerHTML = `
    <div>
      <div class="activity-disposition-title">Unable to complete this activity?</div>
      <div class="small">Record an exception instead of leaving the test blank.</div>
    </div>
    <select data-activity-disposition aria-label="Activity completion exception">
      <option value="">Complete activity normally</option>
      <option value="unable">Unable to complete</option>
      <option value="na">Not applicable</option>
      <option value="declined">Client declined</option>
    </select>`;
  card.appendChild(wrap);
  wrap.querySelector("select").addEventListener("change", () => {
    clearValidationMessage(card);
    scheduleAutosave();
    updateReviewScreen();
  });
}

function addDrivingBranch() {
  const wizard = domainWizardState.driving;
  if (!wizard) return;
  const intro = wizard.cards.find(c => activityTitle(c) === "Driving & Community Mobility Screening");
  if (!intro || getEl("currentDrivingStatus")) return;
  const field = document.createElement("div");
  field.className = "branch-question";
  field.innerHTML = `
    <div class="field">
      <label for="currentDrivingStatus">Does the client currently drive?</label>
      <select id="currentDrivingStatus">
        <option value="">Select an option</option>
        <option value="yes">Yes — currently drives</option>
        <option value="no">No — does not currently drive</option>
      </select>
    </div>
    <p class="small">If No, driving-risk questions are skipped and the assessment continues with community transportation participation.</p>`;
  intro.appendChild(field);
  getEl("currentDrivingStatus").addEventListener("change", () => {
    if (getValue("currentDrivingStatus") === "no") setInputValue("drivesIndependently", "2");
    applyDomainBranching();
    refreshAllScores();
    scheduleAutosave();
  });
}

function addHomeSafetyContext() {
  const wizard = domainWizardState.homeSafety;
  if (!wizard) return;
  const first = wizard.cards.find(c => c.dataset.domainSummary !== "true");
  if (!first || getEl("homeSafetyContext")) return;
  const field = document.createElement("div");
  field.className = "branch-question";
  field.innerHTML = `
    <div class="field">
      <label for="homeSafetyContext">How is home safety being assessed?</label>
      <select id="homeSafetyContext">
        <option value="">Select an option</option>
        <option value="in-person">In-person home observation</option>
        <option value="reported">Client / caregiver report</option>
        <option value="not-assessed">Not assessed today</option>
      </select>
    </div>
    <p class="small">Choose Not assessed when the environment cannot be meaningfully evaluated during this encounter.</p>`;
  first.insertAdjacentElement("afterbegin", field);
  getEl("homeSafetyContext").addEventListener("change", () => {
    applyDomainBranching();
    refreshAllScores();
    scheduleAutosave();
  });
}

function applyDomainBranching() {
  const driving = domainWizardState.driving;
  if (driving) {
    const concerns = driving.cards.find(c => activityTitle(c) === "Self-Reported Driving Concerns");
    if (concerns) concerns.classList.toggle("branch-hidden", getValue("currentDrivingStatus", "") === "no");
  }

  const home = domainWizardState.homeSafety;
  if (home) {
    const notAssessed = getValue("homeSafetyContext", "") === "not-assessed";
    home.cards.forEach((card, index) => {
      if (card.dataset.domainSummary === "true" || index === 0) return;
      card.classList.toggle("branch-hidden", notAssessed);
    });
  }
}

function bindInteractiveCompletionTracking() {
  const mappings = [
    ["simpleRtPad", "processing"], ["choiceRtCue", "processing"], ["goNoGoCue", "processing"],
    ["trailACanvas", "cognition"], ["trailCanvas", "cognition"], ["digitSpanSequence", "cognition"],
  ];
  mappings.forEach(([id]) => {
    const el = getEl(id);
    if (!el) return;
    const card = el.closest(".domain-wizard-card");
    const observer = new MutationObserver(() => {
      const text = el.textContent.toLowerCase();
      if (text.includes("complete") || text.includes("max span")) {
        card.dataset.testRun = "true";
        scheduleAutosave();
      }
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
  });

  ["miniCogStart", "trailAStart", "trailStart", "digitSpanStart", "simpleRtStart", "choiceRtStart", "goNoGoStart"].forEach(id => {
    const btn = getEl(id);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const card = btn.closest(".domain-wizard-card");
      if (card) card.dataset.testStarted = "true";
      scheduleAutosave();
    });
  });

  const clockCard = getEl("clockDrawCanvas")?.closest(".domain-wizard-card");
  if (clockCard) {
    getEl("clockDrawCanvas").addEventListener("pointerdown", () => { clockCard.dataset.testStarted = "true"; scheduleAutosave(); });
    clockCard.querySelectorAll(".clock-score-item").forEach(el => el.addEventListener("change", () => { clockCard.dataset.testStarted = "true"; scheduleAutosave(); }));
  }
}

function validateDomainCard(domainId, card, silent = false) {
  if (!card || card.dataset.domainSummary === "true" || isInformationalCard(card)) return true;
  if (getCardDisposition(card)) return true;
  const title = activityTitle(card);
  let ok = true;
  let message = "Complete this activity or record Unable to Complete, Not Applicable, or Declined before continuing.";

  if (domainId === "mobility") {
    const requiredByTitle = {
      "10-Meter Walk Test": "walkTime",
      "Timed Up and Go (TUG)": "tugTime",
      "30-Second Chair Stand": "chairStandReps",
      "4-Stage Balance Test": "balanceStage",
      "4-Square Step Test": "fsstTime",
    };
    const id = requiredByTitle[title];
    if (id) ok = getValue(id, "") !== "" && (getEl(id)?.type !== "number" || getNumber(id, 0) > 0 || id === "chairStandReps");
  }

  if (domainId === "driving" && title === "Driving & Community Mobility Screening") {
    ok = !!getValue("currentDrivingStatus", "");
    message = "Select whether the client currently drives before continuing.";
  }

  if (domainId === "processing") {
    if (title === "Simple Visual Reaction Time") ok = getNumber("simpleRtAvg", 0) > 0 || card.dataset.testRun === "true";
    if (title === "Choice Reaction Time") ok = getNumber("choiceRtAvg", 0) > 0 || card.dataset.testRun === "true";
    if (title === "Go / No-Go Inhibition Screen") ok = card.dataset.testRun === "true";
  }

  if (domainId === "cognition") {
    if (title.startsWith("Mini-Cog")) ok = card.dataset.testStarted === "true";
    if (title.startsWith("Clock Drawing")) ok = card.dataset.testStarted === "true" || card.querySelectorAll(".clock-score-item:checked").length > 0;
    if (title.startsWith("Trail Making A")) ok = getNumber("trailATime", 0) > 0;
    if (title.startsWith("Trail Making B")) ok = getNumber("trailBTime", 0) > 0;
    if (title.startsWith("Digit Span")) ok = card.dataset.testStarted === "true" || getNumber("digitSpanScore", 0) > 0;
  }

  if (domainId === "homeSafety" && title === "Entry / Exterior") {
    ok = !!getValue("homeSafetyContext", "");
    message = "Select how home safety is being assessed before continuing.";
  }

  if (!ok && !silent) showValidationMessage(card, message);
  if (ok) clearValidationMessage(card);
  return ok;
}

function showValidationMessage(card, message) {
  let box = card.querySelector(".wizard-validation");
  if (!box) {
    box = document.createElement("div");
    box.className = "wizard-validation";
    card.appendChild(box);
  }
  box.textContent = message;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function clearValidationMessage(card) { card?.querySelector(".wizard-validation")?.remove(); }

function getEligibleDomainCards(domainId) {
  const wizard = domainWizardState[domainId];
  if (!wizard) return [];
  return wizard.cards.filter(card => card.dataset.domainSummary === "true" || (!card.classList.contains("hidden") && !card.classList.contains("branch-hidden")));
}

function getDomainFindings(domainId) {
  const findings = [];
  if (domainId === "mobility") {
    const walk = getNumber("walkTime", 0); if (walk > 0 && 10 / walk < 0.8) findings.push(`Gait speed ${ (10/walk).toFixed(2) } m/s suggests limited community mobility.`);
    const tug = getNumber("tugTime", 0); if (tug >= 12) findings.push(`TUG ${tug.toFixed(1)} sec is above the lower-risk reference range.`);
    const reps = getNumber("chairStandReps", 0); if (reps > 0 && reps < 8) findings.push(`Chair stand performance (${reps} reps) is reduced.`);
    const bal = getValue("balanceStage", ""); if (bal && !["Single-leg","Tandem"].includes(bal)) findings.push(`Balance stage reached: ${bal}.`);
    const fsst = getNumber("fsstTime", 0); if (fsst >= 15) findings.push(`4-Square Step Test ${fsst.toFixed(1)} sec indicates increased stepping/balance concern.`);
  }
  if (domainId === "driving") {
    if (getValue("currentDrivingStatus", "") === "no") findings.push("Client is not currently driving; driving-specific concern questions were skipped.");
    ["familyDrivingConcern","navigationDifficulty","drivingNearMiss"].forEach(id => { if (getValue(id, "No") === "Yes") findings.push(getEl(id)?.previousElementSibling?.textContent?.trim() || `${id} reported.`); });
    if (getNumber("transportReliance",0) > 0 || getNumber("communityRestriction",0) > 0) findings.push("Transportation reliance or community participation restriction is present.");
  }
  if (domainId === "processing") {
    const s=getNumber("simpleRtAvg",0); if(s>500) findings.push(`Simple reaction time is slowed (${s} ms).`);
    const c=getNumber("choiceRtAvg",0); if(c>700) findings.push(`Choice reaction time is slowed (${c} ms).`);
    const errors=getNumber("choiceRtErrors",0)+getNumber("choiceRtMisses",0)+getNumber("goNoGoFalseTaps",0)+getNumber("goNoGoMisses",0); if(errors>0) findings.push(`${errors} combined errors/misses were recorded across reaction/inhibition tasks.`);
  }
  if (domainId === "cognition") {
    const recall=getNumber("miniCogRecall",0); if(recall<3) findings.push(`3-word recall: ${recall}/3.`);
    if(getNumber("miniCogClock",2)<2) findings.push("Clock drawing was rated below normal.");
    if(getNumber("trailATime",0)>90 || getNumber("trailBTime",0)>180) findings.push("Trail-making speed shows clinically notable slowing.");
    const digits=getNumber("digitSpanScore",0); if(digits>0 && digits<=3) findings.push(`Digit span reached ${digits}, suggesting attention/working-memory concern.`);
  }
  if (domainId === "nutrition") {
    const mna=sumSelectValues(".mna-input"); if(mna && mna<12) findings.push(`MNA-SF total ${mna} indicates nutrition risk or need for monitoring.`);
    if(getValue("nutritionHydrationConcern","No")==="Yes") findings.push("Hydration concern is documented.");
    if(getValue("recentWeightLoss","No")!=="No") findings.push(`Recent weight loss: ${getValue("recentWeightLoss")}.`);
    if(getValue("intakeChange","No change")!=="No change") findings.push(`Food intake change: ${getValue("intakeChange")}.`);
  }
  if (domainId === "homeSafety") {
    if (isDomainNotAssessed(domainId)) findings.push("Home environment was not assessed today.");
    else {
      const noCount=Array.from(getEl("homeSafety")?.querySelectorAll("select")||[]).filter(el=>String(el.value).toLowerCase()==="no").length;
      if(noCount) findings.push(`${noCount} home-safety item${noCount===1?"":"s"} require follow-up.`);
    }
  }
  if (domainId === "mental") {
    const phq2=sumSelectValues(".phq2-input"); const gad2=sumSelectValues(".gad2-input");
    if(phq2>=3) findings.push(`PHQ-2 positive screen (${phq2}); PHQ-9 follow-up shown.`);
    if(gad2>=3) findings.push(`GAD-2 positive screen (${gad2}); GAD-7 follow-up shown.`);
    if(hasMentalSafetyFlag()) findings.push("Safety-sensitive PHQ-9 response requires clinician review before report generation.");
  }
  return findings.slice(0,4);
}

function hasMentalSafetyFlag() {
  const items = Array.from(document.querySelectorAll(".phq9-input"));
  return items.length >= 9 && parseInt(items[8].value || "0", 10) > 0;
}

function ensureMentalSafetyAlert() {
  const card = getEl("phq9Followup");
  if (!card) return;
  let alert = card.querySelector(".mental-safety-alert");
  if (!alert) {
    alert = document.createElement("div");
    alert.className = "mental-safety-alert hidden";
    alert.innerHTML = `<strong>Safety response detected.</strong><br>Pause routine scoring and complete an immediate clinical safety assessment according to your organization’s protocol before continuing.`;
    card.appendChild(alert);
  }
  alert.classList.toggle("hidden", !hasMentalSafetyFlag());
}

function getDomainStatus(domainId) {
  if (domainId === "mental" && hasMentalSafetyFlag()) return { label: "Needs Review", className: "status-review" };
  if (isDomainNotAssessed(domainId)) return { label: "Not Assessed", className: "status-na" };
  const wizard=domainWizardState[domainId];
  if (!wizard) return {label:"Incomplete",className:"status-incomplete"};
  const cards=wizard.cards.filter(c=>c.dataset.domainSummary!=="true" && !isInformationalCard(c) && !c.classList.contains("branch-hidden") && !c.classList.contains("hidden"));
  if (cards.some(c=>!validateDomainCard(domainId,c,true))) return {label:"Incomplete",className:"status-incomplete"};
  if (cards.some(c=>getCardDisposition(c))) return {label:"Complete with Exceptions",className:"status-exception"};
  return {label:"Complete",className:"status-complete"};
}

function updateDomainSummary(domainId, summary) {
  refreshAllScores();
  const wizard=domainWizardState[domainId];
  const score=state[wizard.config.stateKey];
  const notAssessed=isDomainNotAssessed(domainId);
  const band=getScoreBand(score);
  const scoreEl=summary.querySelector("[data-domain-summary-score]");
  const bandEl=summary.querySelector("[data-domain-summary-band]");
  if(scoreEl) scoreEl.textContent=notAssessed?"—":score;
  if(bandEl){
    bandEl.textContent=notAssessed?"Not Assessed":band.label;
    bandEl.className=`score-pill ${notAssessed?"":band.className}`;
  }
  const findings=summary.querySelector("[data-domain-findings]");
  const items=getDomainFindings(domainId);
  if(findings) findings.innerHTML=items.length?items.map(x=>`<li>${x}</li>`).join(""):`<li>No major concerns were highlighted by the recorded responses.</li>`;
  const status=getDomainStatus(domainId);
  const statusEl=summary.querySelector("[data-domain-completion-status]");
  if(statusEl){statusEl.textContent=status.label;statusEl.className=`review-status ${status.className}`;}
}

function bindDomainWizards() {
  Object.entries(domainWizardConfig).forEach(([domainId, config]) => {
    const section=getEl(domainId);
    if(!section || section.dataset.domainWizardBound==="true") return;
    const grid=section.querySelector(".grid"); if(!grid) return;
    const cards=Array.from(section.querySelectorAll(".card.test-card"));
    cards.forEach(card=>{ grid.appendChild(card); card.classList.add("domain-wizard-card"); addDispositionControl(card); });

    const summary=document.createElement("div");
    summary.className="card test-card domain-wizard-card domain-summary-card";
    summary.dataset.domainSummary="true";
    summary.innerHTML=`
      <div class="domain-summary-kicker">${config.label} review</div>
      <h2 class="test-title">${config.label} Summary</h2>
      <div class="domain-summary-status-row"><span class="review-status" data-domain-completion-status>Checking</span></div>
      <div class="domain-summary-score-wrap">
        <div><div class="muted-label">Current Domain Score</div><div class="domain-summary-score" data-domain-summary-score>--</div></div>
        <div class="score-pill" data-domain-summary-band>Calculating</div>
      </div>
      <div class="domain-summary-findings"><h3>Notable Findings</h3><ul data-domain-findings></ul></div>
      <div class="domain-summary-actions"><button class="btn btn-secondary" type="button" data-domain-edit-tests>Edit Tests</button></div>`;
    grid.appendChild(summary);

    const overall=document.createElement("div");
    overall.className="overall-assessment-progress";
    overall.innerHTML=`<div class="overall-progress-row"><span data-overall-progress-label></span><span data-overall-progress-count></span></div><div class="overall-progress-track"><span data-overall-progress-bar></span></div>`;
    const stepper=section.querySelector(".stepper");
    if(stepper) stepper.insertAdjacentElement("afterend",overall); else grid.insertAdjacentElement("beforebegin",overall);

    const progress=document.createElement("div"); progress.className="domain-wizard-progress";
    progress.innerHTML=`<div class="domain-wizard-progress-row"><span data-domain-progress-label>${config.label}</span><span data-domain-progress-count></span></div><div class="domain-wizard-progress-track"><span data-domain-progress-bar></span></div>`;
    overall.insertAdjacentElement("afterend",progress);

    const nav=document.createElement("div"); nav.className="domain-wizard-nav";
    nav.innerHTML=`<button class="btn btn-secondary" type="button" data-domain-back>Back</button><button class="btn btn-primary" type="button" data-domain-next>Next</button>`;
    grid.insertAdjacentElement("afterend",nav);

    domainWizardState[domainId]={section,grid,cards:[...cards,summary],currentCard:cards[0]||summary,config};
    nav.querySelector("[data-domain-back]").addEventListener("click",()=>moveDomainWizard(domainId,-1));
    nav.querySelector("[data-domain-next]").addEventListener("click",()=>moveDomainWizard(domainId,1));
    summary.querySelector("[data-domain-edit-tests]").addEventListener("click",()=>{
      const first=domainWizardState[domainId].cards.find(c=>c.dataset.domainSummary!=="true"&&!isInformationalCard(c)&&!c.classList.contains("branch-hidden"));
      if(first){domainWizardState[domainId].currentCard=first;renderDomainWizard(domainId);window.scrollTo({top:0,behavior:"auto"});}
    });
    section.dataset.domainWizardBound="true"; section.classList.add("domain-wizard-active");
  });
  addDrivingBranch(); addHomeSafetyContext(); applyDomainBranching(); bindInteractiveCompletionTracking();
  Object.keys(domainWizardState).forEach(renderDomainWizard);
}

function syncDomainWizard(domainId){ if(domainWizardState[domainId]) renderDomainWizard(domainId); }

function renderDomainWizard(domainId) {
  const wizard=domainWizardState[domainId]; if(!wizard) return;
  applyDomainBranching();
  const eligible=getEligibleDomainCards(domainId); if(!eligible.length) return;
  if(!eligible.includes(wizard.currentCard)) wizard.currentCard=eligible[0];
  const index=Math.max(0,eligible.indexOf(wizard.currentCard)); const current=eligible[index]; const isSummary=current.dataset.domainSummary==="true";
  wizard.cards.forEach(card=>{card.style.display=card===current?"grid":"none";});
  current.dataset.visited="true";
  if(isSummary) updateDomainSummary(domainId,current);

  const pageTitle=wizard.section.querySelector(".page-title");
  const pageSubtitle=wizard.section.querySelector(".page-subtitle");
  if(pageTitle) pageTitle.textContent=`${wizard.config.label} Assessment`;
  if(pageSubtitle) pageSubtitle.textContent=isSummary?"Review this domain before continuing.":activityTitle(current);

  const domainIndex=assessmentDomainOrder.indexOf(domainId);
  setScopedText(wizard.section,"[data-overall-progress-label]",`Assessment ${domainIndex+1} of ${assessmentDomainOrder.length} · ${wizard.config.label}`);
  setScopedText(wizard.section,"[data-overall-progress-count]",`${domainIndex+1} / ${assessmentDomainOrder.length}`);
  const overallBar=wizard.section.querySelector("[data-overall-progress-bar]"); if(overallBar) overallBar.style.width=`${((domainIndex+1)/assessmentDomainOrder.length)*100}%`;

  setScopedText(wizard.section,"[data-domain-progress-label]",isSummary?`${wizard.config.label} Summary`:activityTitle(current));
  setScopedText(wizard.section,"[data-domain-progress-count]",`${index+1} / ${eligible.length}`);
  const bar=wizard.section.querySelector("[data-domain-progress-bar]"); if(bar) bar.style.width=`${((index+1)/eligible.length)*100}%`;

  const back=wizard.section.querySelector("[data-domain-back]"); const next=wizard.section.querySelector("[data-domain-next]");
  if(back) back.textContent=index===0?"Back to Previous Section":"Back";
  if(next){
    if(index<eligible.length-1) next.textContent="Next";
    else next.textContent=wizard.config.next==="review"?"Continue to Review":`Continue to ${domainWizardConfig[wizard.config.next]?.label||"Next Section"}`;
  }
  ensureMentalSafetyAlert(); scheduleAutosave(); updateReviewScreen();
}
function setScopedText(root,selector,value){const el=root.querySelector(selector);if(el)el.textContent=value;}

function moveDomainWizard(domainId,direction){
  const wizard=domainWizardState[domainId]; if(!wizard) return;
  refreshAllScores(); applyDomainBranching();
  const eligible=getEligibleDomainCards(domainId); let index=eligible.indexOf(wizard.currentCard); if(index<0)index=0;
  if(direction>0 && wizard.currentCard.dataset.domainSummary!=="true" && !validateDomainCard(domainId,wizard.currentCard,false)) return;
  if(direction>0 && domainId==="mental" && hasMentalSafetyFlag()){
    showValidationMessage(wizard.currentCard,"Safety-sensitive PHQ-9 response detected. Complete the required clinical safety review before generating the final report. You may continue to Review, where this domain will remain flagged.");
  }
  const nextIndex=index+direction;
  if(nextIndex>=0&&nextIndex<eligible.length){wizard.currentCard=eligible[nextIndex];renderDomainWizard(domainId);window.scrollTo({top:0,behavior:"auto"});return;}
  if(direction<0){const prev=wizard.config.prev;if(domainWizardState[prev]){const prevEligible=getEligibleDomainCards(prev);domainWizardState[prev].currentCard=prevEligible[prevEligible.length-1];}showScreen(prev);return;}
  const next=wizard.config.next;if(domainWizardState[next])domainWizardState[next].currentCard=getEligibleDomainCards(next)[0];showScreen(next);updateReviewScreen();
}

function validateIntakeScreen(screenId) {
  if(screenId!=="new") return true;
  const missing=[];
  if(!getValue("clientName")) missing.push("Full name");
  const age=getNumber("clientAge",0); if(age<=0||age>120) missing.push("Valid age");
  if(!getValue("assessmentDate")) missing.push("Assessment date");
  if(!missing.length) return true;
  const card=getEl("new")?.querySelector(".intake-card");
  if(card) showValidationMessage(card,`Complete the required intake fields: ${missing.join(", ")}.`);
  return false;
}

function updateReviewScreen(){
  const review=getEl("review"); if(!review||!Object.keys(domainWizardState).length)return;
  const grid=review.querySelector(".grid"); if(!grid)return;
  grid.classList.remove("grid-2"); grid.classList.add("review-domain-grid");
  grid.innerHTML=assessmentDomainOrder.map(domainId=>{
    const cfg=domainWizardConfig[domainId]; const status=getDomainStatus(domainId); const score=isDomainNotAssessed(domainId)?"—":state[cfg.stateKey];
    const findings=getDomainFindings(domainId); const note=findings[0]||"No major concerns highlighted.";
    return `<div class="card review-domain-card"><div><div class="review-domain-heading"><h3>${cfg.label}</h3><span class="review-status ${status.className}">${status.label}</span></div><div class="review-domain-score">Score: <strong>${score}</strong></div><p>${note}</p></div><button class="btn btn-secondary" type="button" data-review-edit="${domainId}">Edit</button></div>`;
  }).join("");
  grid.querySelectorAll("[data-review-edit]").forEach(btn=>btn.addEventListener("click",()=>{
    const id=btn.dataset.reviewEdit; const wizard=domainWizardState[id]; if(wizard){
      const incomplete=wizard.cards.find(c=>c.dataset.domainSummary!=="true"&&!c.classList.contains("branch-hidden")&&!c.classList.contains("hidden")&&!isInformationalCard(c)&&!validateDomainCard(id,c,true));
      wizard.currentCard=incomplete||getEligibleDomainCards(id)[0];
    } showScreen(id);
  }));
  let banner=review.querySelector(".review-readiness");
  if(!banner){banner=document.createElement("div");banner.className="review-readiness";review.querySelector(".stepper")?.insertAdjacentElement("afterend",banner);}
  const statuses=assessmentDomainOrder.map(getDomainStatus); const incomplete=statuses.filter(s=>s.label==="Incomplete").length; const needs=statuses.filter(s=>s.label==="Needs Review").length;
  if(incomplete||needs){banner.className="review-readiness review-readiness-warn";banner.innerHTML=`<strong>Assessment needs attention.</strong> ${incomplete?`${incomplete} domain${incomplete===1?" is":"s are"} incomplete. `:""}${needs?`${needs} domain${needs===1?" requires":"s require"} clinical review.`:""}`;}
  else {banner.className="review-readiness review-readiness-ready";banner.innerHTML="<strong>Ready for report generation.</strong> All assessed domains are complete or have documented exceptions.";}
  const gen=review.querySelector('[data-target="results"]'); if(gen) gen.disabled=incomplete>0||needs>0;
}

function serializeDraft(){
  const values={};
  document.querySelectorAll("input,select,textarea").forEach((el,index)=>{
    if(el.type==="button"||el.type==="submit")return;
    const key=el.id?`id:${el.id}`:el.name?`name:${el.name}:${index}`:`anon:${index}`;
    values[key]=el.type==="checkbox"||el.type==="radio"?el.checked:el.value;
  });
  const dispositions={}; Object.entries(domainWizardState).forEach(([id,w])=>{dispositions[id]=w.cards.map(c=>({title:activityTitle(c),value:getCardDisposition(c),started:c.dataset.testStarted||"",run:c.dataset.testRun||""}));});
  return {savedAt:new Date().toISOString(),values,dispositions};
}
function scheduleAutosave(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(saveDraft,250);}
function saveDraft(){
  try{localStorage.setItem(DRAFT_KEY,JSON.stringify(serializeDraft()));updateDraftIndicator("Draft saved locally");}catch(e){console.warn("Draft save failed",e);updateDraftIndicator("Draft not saved");}
}
function restoreDraft(){
  try{
    const raw=localStorage.getItem(DRAFT_KEY); if(!raw)return false; const draft=JSON.parse(raw); let restored=0;
    document.querySelectorAll("input,select,textarea").forEach((el,index)=>{
      if(el.type==="button"||el.type==="submit")return;
      const key=el.id?`id:${el.id}`:el.name?`name:${el.name}:${index}`:`anon:${index}`;
      if(!(key in draft.values))return; const value=draft.values[key];
      if(el.type==="checkbox"||el.type==="radio")el.checked=!!value;else el.value=value; restored++;
    });
    Object.entries(draft.dispositions||{}).forEach(([id,items])=>{const w=domainWizardState[id];if(!w)return;items.forEach(item=>{const c=w.cards.find(x=>activityTitle(x)===item.title);if(!c)return;const s=c.querySelector("[data-activity-disposition]");if(s)s.value=item.value||"";if(item.started)c.dataset.testStarted=item.started;if(item.run)c.dataset.testRun=item.run;});});
    if(restored){refreshAllScores();applyDomainBranching();Object.keys(domainWizardState).forEach(renderDomainWizard);updateDraftIndicator("Draft restored");return true;}
  }catch(e){console.warn("Draft restore failed",e);} return false;
}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY);updateDraftIndicator("Local draft cleared");}catch(e){}}
function addDraftIndicator(){
  if(getEl("draftStatusIndicator"))return;
  const box=document.createElement("div");box.className="draft-status";box.id="draftStatusIndicator";
  box.innerHTML=`<span data-draft-status>Autosave ready</span><button class="draft-clear" type="button">Clear local draft</button>`;
  document.body.appendChild(box); box.querySelector("button").addEventListener("click",()=>{if(confirm("Clear the locally saved Thrive360 draft?"))clearDraft();});
}
function updateDraftIndicator(text){const el=document.querySelector("[data-draft-status]");if(el)el.textContent=text;}
function bindAutosave(){
  document.addEventListener("input",scheduleAutosave);document.addEventListener("change",()=>{scheduleAutosave();ensureMentalSafetyAlert();updateReviewScreen();});
}

/* =========================================================
   GLOBAL INPUT BINDING
========================================================= */

function bindGlobalScoringRefresh() {
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("change", refreshAllScores);
    el.addEventListener("input", refreshAllScores);
  });
}

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindMentalHealthScoring();
  bindMNAScoring();
  bindGlobalScoringRefresh();
  bindProcessingTesting();
  bindCognitiveTesting();
  bindDomainWizards();
  addDraftIndicator();
  bindAutosave();
  restoreDraft();
  refreshAllScores();
  ensureMentalSafetyAlert();
  updateReviewScreen();
  showScreen("hero");
});
