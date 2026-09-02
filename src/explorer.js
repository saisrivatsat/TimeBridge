import {
  formatDay,
  formatFullDate,
  formatHour,
  formatOffset,
  formatTime,
  formatZoneAbbreviation,
  getUtcOffsetMinutes,
  getZonedParts,
  isValidTimeZone,
  zonedLocalDateTimeToUtc,
} from "./time.js";

const LOCATIONS = [
  { name: "New York", zone: "America/New_York", detail: "Eastern Time", aliases: ["est", "edt", "et"] },
  { name: "Chicago", zone: "America/Chicago", detail: "Central Time", aliases: ["cst", "cdt", "ct"] },
  { name: "Denver", zone: "America/Denver", detail: "Mountain Time", aliases: ["mst", "mdt", "mt"] },
  { name: "Los Angeles", zone: "America/Los_Angeles", detail: "Pacific Time", aliases: ["san francisco", "seattle", "pst", "pdt", "pt"] },
  { name: "Phoenix", zone: "America/Phoenix", detail: "Mountain Standard Time", aliases: ["arizona"] },
  { name: "Toronto", zone: "America/Toronto", detail: "Eastern Time", aliases: [] },
  { name: "Vancouver", zone: "America/Vancouver", detail: "Pacific Time", aliases: [] },
  { name: "Mexico City", zone: "America/Mexico_City", detail: "Central Mexico", aliases: [] },
  { name: "São Paulo", zone: "America/Sao_Paulo", detail: "Brazil", aliases: ["sao paulo"] },
  { name: "London", zone: "Europe/London", detail: "United Kingdom", aliases: ["gmt", "bst"] },
  { name: "Paris", zone: "Europe/Paris", detail: "Central Europe", aliases: ["berlin", "rome", "madrid", "cet", "cest"] },
  { name: "Hyderabad", zone: "Asia/Kolkata", detail: "India Standard Time", aliases: ["india", "kolkata", "mumbai", "delhi", "bengaluru", "bangalore", "ist"] },
  { name: "Dubai", zone: "Asia/Dubai", detail: "Gulf Standard Time", aliases: ["gst"] },
  { name: "Singapore", zone: "Asia/Singapore", detail: "Singapore Time", aliases: ["sgt"] },
  { name: "Tokyo", zone: "Asia/Tokyo", detail: "Japan Standard Time", aliases: ["jst"] },
  { name: "Shanghai", zone: "Asia/Shanghai", detail: "China Standard Time", aliases: ["beijing"] },
  { name: "Sydney", zone: "Australia/Sydney", detail: "Eastern Australia", aliases: [] },
  { name: "Auckland", zone: "Pacific/Auckland", detail: "New Zealand", aliases: [] },
  { name: "UTC", zone: "UTC", detail: "Universal reference", aliases: ["universal time", "zulu"] },
];

const US_ZONES = LOCATIONS.slice(0, 4);
const elements = {
  navItems: [...document.querySelectorAll("[data-route]")],
  pages: [...document.querySelectorAll("[data-page]")],
  friendlyTimeZones: document.querySelector("#friendly-timezones"),
  quickFrom: document.querySelector("#quick-from-zone"),
  quickTo: document.querySelector("#quick-to-zone"),
  quickDateTime: document.querySelector("#quick-datetime"),
  quickResult: document.querySelector("#quick-result"),
  convert: document.querySelector("#convert-time"),
  swap: document.querySelector("#swap-quick-zones"),
  usClockStrip: document.querySelector("#us-clock-strip"),
  worldZone: document.querySelector("#world-zone"),
  addWorldClock: document.querySelector("#add-world-clock"),
  worldClockGrid: document.querySelector("#world-clock-grid"),
  liveChart: document.querySelector("#live-chart"),
  toast: document.querySelector("#toast"),
};

const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
let worldZones = [...new Set([
  detectedZone,
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Kolkata",
  "Asia/Tokyo",
])];
let explorerToastTimer;

function findLocationForZone(timeZone) {
  return LOCATIONS.find(({ zone }) => zone === timeZone);
}

function friendlyName(timeZone) {
  return findLocationForZone(timeZone)?.name
    ?? timeZone.split("/").at(-1).replaceAll("_", " ");
}

function resolveTimeZone(input) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (isValidTimeZone(input.trim())) return input.trim();

  const match = LOCATIONS.find(({ name, zone, aliases }) =>
    name.toLowerCase() === normalized
    || zone.toLowerCase() === normalized
    || aliases.includes(normalized),
  );
  return match?.zone ?? null;
}

function showExplorerToast(message) {
  window.clearTimeout(explorerToastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  explorerToastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function populateFriendlyTimeZones() {
  const fragment = document.createDocumentFragment();
  LOCATIONS.forEach(({ name, zone, detail }) => {
    const option = document.createElement("option");
    option.value = name;
    option.label = `${zone} · ${detail}`;
    fragment.append(option);
  });

  (Intl.supportedValuesOf?.("timeZone") ?? []).forEach((timeZone) => {
    if (LOCATIONS.some(({ zone }) => zone === timeZone)) return;
    const option = document.createElement("option");
    option.value = timeZone;
    fragment.append(option);
  });
  elements.friendlyTimeZones.replaceChildren(fragment);
}

function setActivePage(route) {
  const validRoute = elements.pages.some(({ dataset }) => dataset.page === route)
    ? route
    : "home";

  elements.pages.forEach((page) => {
    page.hidden = page.dataset.page !== validRoute;
  });
  elements.navItems.forEach((item) => {
    const selected = item.dataset.route === validRoute;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  document.title = validRoute === "home"
    ? "TimeBridge — understand time anywhere"
    : `${elements.navItems.find(({ dataset }) => dataset.route === validRoute)?.textContent} · TimeBridge`;
}

function initializeNavigation() {
  const requested = window.location.hash.slice(1);
  const hasSharedPlan = new URLSearchParams(window.location.search).has("place");
  const initial = requested || (hasSharedPlan ? "calculator" : "home");
  setActivePage(initial);

  elements.navItems.forEach((item) => {
    item.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const index = elements.navItems.indexOf(item);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = elements.navItems[
        (index + direction + elements.navItems.length) % elements.navItems.length
      ];
      next.focus();
      next.click();
    });
  });
  window.addEventListener("hashchange", () => setActivePage(window.location.hash.slice(1)));
}

function toLocalInputValue(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function dateKey(date, timeZone) {
  const { year, month, day } = getZonedParts(date, timeZone);
  return Date.UTC(year, month - 1, day);
}

function describeDateRelation(date, fromZone, toZone) {
  const difference = Math.round(
    (dateKey(date, toZone) - dateKey(date, fromZone)) / (24 * 60 * 60 * 1000),
  );
  if (difference === 0) return "Same calendar day";
  if (difference === 1) return "Next calendar day";
  if (difference === -1) return "Previous calendar day";
  return `${Math.abs(difference)} days ${difference > 0 ? "later" : "earlier"}`;
}

function describeOffsetDifference(date, fromZone, toZone) {
  const difference = getUtcOffsetMinutes(date, toZone) - getUtcOffsetMinutes(date, fromZone);
  if (difference === 0) return "Both locations use the same UTC offset";
  const hours = Math.floor(Math.abs(difference) / 60);
  const minutes = Math.abs(difference) % 60;
  const amount = [
    hours ? `${hours} hour${hours === 1 ? "" : "s"}` : "",
    minutes ? `${minutes} minutes` : "",
  ].filter(Boolean).join(" ");
  return `${amount} ${difference > 0 ? "ahead" : "behind"}`;
}

function buildConversionCard(label, date, timeZone) {
  const card = document.createElement("article");
  card.className = "conversion-card";
  const caption = document.createElement("span");
  caption.textContent = label;
  const heading = document.createElement("strong");
  heading.textContent = friendlyName(timeZone);
  const time = document.createElement("p");
  time.textContent = formatTime(date, timeZone);
  const meta = document.createElement("small");
  meta.textContent = `${formatFullDate(date, timeZone)} · ${formatZoneAbbreviation(date, timeZone)} · ${formatOffset(date, timeZone)}`;
  card.append(caption, heading, time, meta);
  return card;
}

function convertQuickTime() {
  const fromZone = resolveTimeZone(elements.quickFrom.value);
  const toZone = resolveTimeZone(elements.quickTo.value);
  if (!fromZone || !toZone) {
    elements.quickResult.classList.add("has-error");
    elements.quickResult.textContent = "Choose a recognized city or IANA time zone for both locations.";
    return;
  }
  if (!elements.quickDateTime.value) {
    elements.quickResult.classList.add("has-error");
    elements.quickResult.textContent = "Choose a date and time to convert.";
    return;
  }

  const instant = zonedLocalDateTimeToUtc(elements.quickDateTime.value, fromZone);
  const cards = document.createElement("div");
  cards.className = "conversion-cards";
  cards.append(
    buildConversionCard("Your input", instant, fromZone),
    buildConversionCard("Converted time", instant, toZone),
  );

  const insight = document.createElement("p");
  insight.className = "conversion-insight";
  insight.textContent = `${friendlyName(toZone)} is ${describeOffsetDifference(instant, fromZone, toZone)} of ${friendlyName(fromZone)} · ${describeDateRelation(instant, fromZone, toZone)}.`;
  elements.quickResult.classList.remove("has-error");
  elements.quickResult.replaceChildren(cards, insight);
}

function timeWithSeconds(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function phaseForHour(hour) {
  if (hour < 5 || hour >= 22) return { name: "Night", className: "night" };
  if (hour < 12) return { name: "Morning", className: "morning" };
  if (hour < 17) return { name: "Afternoon", className: "work" };
  return { name: "Evening", className: "evening" };
}

function renderUsClocks() {
  const now = new Date();
  const fragment = document.createDocumentFragment();
  US_ZONES.forEach(({ name, zone, detail }) => {
    const card = document.createElement("article");
    card.className = "us-clock-card";
    const label = document.createElement("span");
    label.textContent = detail;
    const abbreviation = document.createElement("strong");
    abbreviation.textContent = formatZoneAbbreviation(now, zone);
    const time = document.createElement("p");
    time.textContent = timeWithSeconds(now, zone);
    const meta = document.createElement("small");
    meta.textContent = `${name} · ${formatOffset(now, zone)}`;
    card.append(label, abbreviation, time, meta);
    fragment.append(card);
  });
  elements.usClockStrip.replaceChildren(fragment);
}

function renderWorldClocks() {
  const now = new Date();
  const fragment = document.createDocumentFragment();
  worldZones.forEach((timeZone) => {
    const { hour } = getZonedParts(now, timeZone);
    const phase = phaseForHour(hour);
    const card = document.createElement("article");
    card.className = `world-clock-card ${phase.className}`;

    const remove = document.createElement("button");
    remove.className = "clock-remove";
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${friendlyName(timeZone)} clock`);
    remove.textContent = "×";
    remove.disabled = worldZones.length === 1;
    remove.addEventListener("click", () => {
      worldZones = worldZones.filter((zone) => zone !== timeZone);
      renderWorldClocks();
      renderLiveChart();
    });

    const top = document.createElement("div");
    top.className = "world-clock-top";
    const name = document.createElement("h2");
    name.textContent = friendlyName(timeZone);
    const abbreviation = document.createElement("span");
    abbreviation.textContent = formatZoneAbbreviation(now, timeZone);
    top.append(name, abbreviation);

    const time = document.createElement("p");
    time.className = "world-time";
    time.textContent = timeWithSeconds(now, timeZone);
    const day = document.createElement("p");
    day.className = "world-date";
    day.textContent = `${formatDay(now, timeZone)} · ${formatOffset(now, timeZone)} · ${phase.name}`;
    card.append(remove, top, time, day);
    fragment.append(card);
  });
  elements.worldClockGrid.replaceChildren(fragment);
}

function addWorldClock() {
  const timeZone = resolveTimeZone(elements.worldZone.value);
  if (!timeZone) {
    showExplorerToast("Choose a recognized city or IANA time zone.");
    return;
  }
  if (worldZones.includes(timeZone)) {
    showExplorerToast("That clock is already visible.");
    return;
  }
  if (worldZones.length >= 8) {
    showExplorerToast("Remove a clock before adding another.");
    return;
  }
  worldZones.push(timeZone);
  elements.worldZone.value = "";
  renderWorldClocks();
  renderLiveChart();
}

function chartClassForHour(hour) {
  if (hour < 6 || hour >= 22) return "night";
  if (hour >= 9 && hour < 17) return "work";
  return "morning";
}

function renderLiveChart() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  const instants = Array.from(
    { length: 24 },
    (_, index) => new Date(start.getTime() + index * 60 * 60 * 1000),
  );
  const grid = document.createElement("div");
  grid.className = "live-chart-grid";

  const corner = document.createElement("div");
  corner.className = "chart-corner";
  corner.textContent = "Local hour";
  grid.append(corner);
  const header = document.createElement("div");
  header.className = "chart-hours";
  instants.forEach((_, index) => {
    const label = document.createElement("span");
    label.textContent = index === 0 ? "Now" : `+${index}h`;
    header.append(label);
  });
  grid.append(header);

  worldZones.forEach((timeZone) => {
    const label = document.createElement("div");
    label.className = "live-chart-label";
    const name = document.createElement("strong");
    name.textContent = friendlyName(timeZone);
    const abbreviation = document.createElement("span");
    abbreviation.textContent = formatZoneAbbreviation(now, timeZone);
    label.append(name, abbreviation);

    const slots = document.createElement("div");
    slots.className = "live-chart-slots";
    instants.forEach((instant, index) => {
      const { hour } = getZonedParts(instant, timeZone);
      const slot = document.createElement("div");
      slot.className = `live-chart-slot ${chartClassForHour(hour)} ${index === 0 ? "is-now" : ""}`;
      slot.textContent = formatHour(instant, timeZone);
      slot.title = `${friendlyName(timeZone)}: ${formatDay(instant, timeZone)} at ${formatTime(instant, timeZone)} ${formatZoneAbbreviation(instant, timeZone)}`;
      slot.setAttribute("aria-label", slot.title);
      slots.append(slot);
    });
    grid.append(label, slots);
  });

  elements.liveChart.replaceChildren(grid);
}

function initializeQuickConverter() {
  elements.quickFrom.value = friendlyName(detectedZone);
  elements.quickTo.value = detectedZone === "Asia/Kolkata" ? "Chicago" : "Hyderabad";
  elements.quickDateTime.value = toLocalInputValue(new Date(), detectedZone);
  elements.convert.addEventListener("click", convertQuickTime);
  elements.swap.addEventListener("click", () => {
    const previousFrom = elements.quickFrom.value;
    elements.quickFrom.value = elements.quickTo.value;
    elements.quickTo.value = previousFrom;
    const newSourceZone = resolveTimeZone(elements.quickFrom.value);
    if (newSourceZone) {
      elements.quickDateTime.value = toLocalInputValue(new Date(), newSourceZone);
    }
    convertQuickTime();
  });
  [elements.quickFrom, elements.quickTo, elements.quickDateTime].forEach((input) => {
    input.addEventListener("change", convertQuickTime);
  });
  convertQuickTime();
}

function initialize() {
  populateFriendlyTimeZones();
  initializeNavigation();
  initializeQuickConverter();
  elements.addWorldClock.addEventListener("click", addWorldClock);
  elements.worldZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addWorldClock();
  });
  renderUsClocks();
  renderWorldClocks();
  renderLiveChart();
  window.setInterval(() => {
    renderUsClocks();
    renderWorldClocks();
  }, 1000);
  window.setInterval(renderLiveChart, 60 * 1000);
}

initialize();
