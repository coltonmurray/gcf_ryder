const EVENT_YEAR = 2026;
const DEFAULT_NAME_ID = "copley-invitational";
const SCORE_MIN = 68;
const SCORE_MAX = 125;

const nameOptions = [
  {
    id: "copley-invitational",
    name: "The Copley Cup",
    detail: "Clean, timeless, and closest to the Ryder Cup style format."
  },
  {
    id: "summit-cup",
    name: "The Summit Cup",
    detail: "A polished Northeast Ohio name with a little more prestige."
  },
  {
    id: "330-classic",
    name: "The 330 Classic",
    detail: "Local, memorable, and still formal enough for the classic look."
  },
  {
    id: "crosstown-invitational",
    name: "The Crosstown Invitational",
    detail: "A subtle nod to the Copley and neighboring-school mix."
  },
  {
    id: "portage-path-classic",
    name: "The Portage Path Classic",
    detail: "Old Akron/Summit County character with a traditional golf feel."
  }
];

const availabilityCopy = {
  unavailable: "Out",
  available: "Available",
  preferred: "Preferred"
};

const availabilityOrder = ["unavailable", "available", "preferred"];

const state = {
  eventNameId: DEFAULT_NAME_ID,
  scoreLow: 86,
  scoreHigh: 96,
  availability: {},
  submitting: false
};

const els = {
  eventTitle: document.querySelector("#eventTitle"),
  testingPanel: document.querySelector("#testingPanel"),
  nameSelect: document.querySelector("#nameSelect"),
  nameDetail: document.querySelector("#nameDetail"),
  registrationForm: document.querySelector("#registrationForm"),
  playerName: document.querySelector("#playerName"),
  playerEmail: document.querySelector("#playerEmail"),
  planningSuggestion: document.querySelector("#planningSuggestion"),
  scoreLow: document.querySelector("#scoreLow"),
  scoreHigh: document.querySelector("#scoreHigh"),
  scoreLowLabel: document.querySelector("#scoreLowLabel"),
  scoreHighLabel: document.querySelector("#scoreHighLabel"),
  scoreSummary: document.querySelector("#scoreSummary"),
  availabilityYear: document.querySelector("#availabilityYear"),
  availabilityStats: document.querySelector("#availabilityStats"),
  weekendGrid: document.querySelector("#weekendGrid"),
  readinessTitle: document.querySelector("#readinessTitle"),
  readinessDetail: document.querySelector("#readinessDetail"),
  submitButton: document.querySelector("#submitButton"),
  submitMessage: document.querySelector("#submitMessage")
};

function dateFromUtc(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getNthSaturday(year, monthIndex, nth) {
  const firstOfMonth = dateFromUtc(year, monthIndex, 1);
  const dayOfWeek = firstOfMonth.getUTCDay();
  const firstSaturdayOffset = (6 - dayOfWeek + 7) % 7;
  return dateFromUtc(year, monthIndex, 1 + firstSaturdayOffset + 7 * (nth - 1));
}

function getFirstSaturday(year, monthIndex) {
  return getNthSaturday(year, monthIndex, 1);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
}

function formatMonthDay(date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
}

function formatRange(start, end) {
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${formatMonth(start)} ${start.getUTCDate()}–${end.getUTCDate()}`;
  }

  return `${formatMonthDay(start)}–${formatMonthDay(end)}`;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildWeekends(year) {
  const start = getNthSaturday(year, 6, 2);
  const end = getFirstSaturday(year, 8);
  const weekends = [];

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 7)) {
    const sunday = addDays(cursor, 1);
    weekends.push({
      id: isoDate(cursor),
      label: formatRange(cursor, sunday),
      detail: `${formatWeekday(cursor)} ${formatMonthDay(cursor)} / ${formatWeekday(sunday)} ${formatMonthDay(sunday)}`,
      startLabel: formatMonthDay(cursor),
      endLabel: formatMonthDay(sunday)
    });
  }

  return weekends;
}

const weekends = buildWeekends(EVENT_YEAR);

function selectedName() {
  return nameOptions.find((option) => option.id === state.eventNameId) || nameOptions[0];
}

function estimateHandicap(score) {
  return Math.max(0, Math.round(score - 72));
}

function validEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function applyEventName(nameId) {
  state.eventNameId = nameOptions.some((option) => option.id === nameId) ? nameId : DEFAULT_NAME_ID;
  const option = selectedName();
  els.eventTitle.textContent = option.name;
  els.nameSelect.value = option.id;
  els.nameDetail.textContent = option.detail;
  window.localStorage.setItem("golf-name-id", option.id);
}

function renderNameOptions() {
  els.nameSelect.innerHTML = nameOptions
    .map((option) => `<option value="${option.id}">${option.name}</option>`)
    .join("");
}

function renderDateRange() {
  els.availabilityYear.textContent = `${EVENT_YEAR} summer weekends`;
}

function renderScores() {
  els.scoreLow.value = state.scoreLow;
  els.scoreHigh.value = state.scoreHigh;
  els.scoreLowLabel.textContent = state.scoreLow;
  els.scoreHighLabel.textContent = state.scoreHigh;
  els.scoreSummary.textContent = `${state.scoreLow}–${state.scoreHigh}`;
}

function setScoreLow(value) {
  const next = Math.max(SCORE_MIN, Math.min(Number(value), state.scoreHigh));
  state.scoreLow = next;
  renderScores();
}

function setScoreHigh(value) {
  const next = Math.min(SCORE_MAX, Math.max(Number(value), state.scoreLow));
  state.scoreHigh = next;
  renderScores();
}

function setWeekendStatus(weekendId, status) {
  state.availability[weekendId] = status;
  renderWeekends();
  renderAvailabilityStats();
}

function applyStatusToAll(status) {
  state.availability = {};

  if (status !== "clear") {
    weekends.forEach((weekend) => {
      state.availability[weekend.id] = status;
    });
  }

  renderWeekends();
  renderAvailabilityStats();
}

function renderWeekends() {
  els.weekendGrid.innerHTML = weekends
    .map((weekend, index) => {
      const selected = state.availability[weekend.id] || "none";
      const buttons = availabilityOrder
        .map((status) => {
          const isSelected = selected === status;
          return `<button type="button" data-weekend="${weekend.id}" data-status="${status}" class="${isSelected ? "is-selected" : ""}" aria-pressed="${isSelected}">${availabilityCopy[status]}</button>`;
        })
        .join("");

      return `
        <article class="weekend-card" data-selected="${selected}">
          <div class="weekend-date">
            <span>Weekend ${index + 1}</span>
            <strong>${weekend.label}</strong>
            <small>${weekend.detail}</small>
          </div>
          <div class="status-toggle" role="group" aria-label="${weekend.label} availability">
            ${buttons}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAvailabilityStats() {
  const completed = weekends.filter((weekend) => state.availability[weekend.id]).length;
  const preferred = weekends.filter((weekend) => state.availability[weekend.id] === "preferred").length;
  const available = weekends.filter((weekend) => state.availability[weekend.id] === "available").length;
  const open = preferred + available;
  const allMarked = completed === weekends.length;

  els.availabilityStats.textContent = `${completed}/${weekends.length} marked · ${preferred} preferred · ${available} available`;
  els.readinessTitle.textContent = allMarked ? "Ready to submit" : "Finish marking weekends";
  els.readinessDetail.textContent = open > 0
    ? `${open} weekend${open === 1 ? "" : "s"} open for you.`
    : "At least one weekend needs to be available or preferred.";
}

function getFormStatus() {
  const name = els.playerName.value.trim();
  const email = els.playerEmail.value.trim();
  const completed = weekends.filter((weekend) => state.availability[weekend.id]).length;
  const open = weekends.filter((weekend) => ["available", "preferred"].includes(state.availability[weekend.id])).length;

  return {
    name,
    email,
    allMarked: completed === weekends.length,
    hasOpenWeekend: open > 0,
    ready: name.length > 1 && validEmail(email) && completed === weekends.length && open > 0
  };
}

function showMessage(type, message) {
  els.submitMessage.hidden = false;
  els.submitMessage.className = `submit-message ${type}`;
  els.submitMessage.textContent = message;
}

function clearMessage() {
  els.submitMessage.hidden = true;
  els.submitMessage.textContent = "";
  els.submitMessage.className = "submit-message";
}

async function submitForm(event) {
  event.preventDefault();
  clearMessage();

  const status = getFormStatus();

  if (!status.ready) {
    showMessage("error", "Add your name, a valid email, mark every weekend, and leave at least one weekend available.");
    return;
  }

  state.submitting = true;
  els.submitButton.disabled = true;
  els.submitButton.textContent = "Saving…";

  const option = selectedName();
  const payload = {
    eventName: option.name,
    eventNameId: option.id,
    themeSeen: "classic",
    name: status.name,
    email: status.email,
    planningSuggestion: els.planningSuggestion.value.trim(),
    scoreRange: {
      low: state.scoreLow,
      high: state.scoreHigh,
      handicapEstimateLow: estimateHandicap(state.scoreLow),
      handicapEstimateHigh: estimateHandicap(state.scoreHigh)
    },
    availability: weekends.map((weekend) => ({
      id: weekend.id,
      label: weekend.label,
      detail: weekend.detail,
      status: state.availability[weekend.id]
    }))
  };

  try {
    const response = await fetch("/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Could not save your response. Please try again.");
    }

    showMessage("success", "You're in.");
  } catch (error) {
    showMessage("error", error.message || "Could not save your response. Please try again.");
  } finally {
    state.submitting = false;
    els.submitButton.disabled = false;
    els.submitButton.textContent = "Submit availability";
  }
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const requestedName = params.get("name");
  const storedName = window.localStorage.getItem("golf-name-id");
  const testingMode = params.get("test") === "1" || params.get("testing") === "1" || params.get("preview") === "1";

  renderNameOptions();
  renderDateRange();
  renderScores();
  renderWeekends();
  renderAvailabilityStats();

  applyEventName(requestedName || storedName || DEFAULT_NAME_ID);

  if (testingMode) {
    els.testingPanel.hidden = false;
  }

  els.nameSelect.addEventListener("change", (event) => applyEventName(event.target.value));
  els.scoreLow.addEventListener("input", (event) => setScoreLow(event.target.value));
  els.scoreHigh.addEventListener("input", (event) => setScoreHigh(event.target.value));
  els.weekendGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-weekend][data-status]");
    if (!button) return;
    setWeekendStatus(button.dataset.weekend, button.dataset.status);
  });
  document.querySelectorAll("[data-bulk]").forEach((button) => {
    button.addEventListener("click", () => applyStatusToAll(button.dataset.bulk));
  });
  els.registrationForm.addEventListener("submit", submitForm);
}

init();
