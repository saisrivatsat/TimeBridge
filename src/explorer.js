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
  { name: "New York", zone: "America/New_York", detail: "Eastern Time", aliases: ["est", "edt", "et"], latitude: 40.71, longitude: -74.01 },
  { name: "Chicago", zone: "America/Chicago", detail: "Central Time", aliases: ["cst", "cdt", "ct"], latitude: 41.88, longitude: -87.63 },
  { name: "Denver", zone: "America/Denver", detail: "Mountain Time", aliases: ["mst", "mdt", "mt"], latitude: 39.74, longitude: -104.99 },
  { name: "Los Angeles", zone: "America/Los_Angeles", detail: "Pacific Time", aliases: ["san francisco", "seattle", "pst", "pdt", "pt"], latitude: 34.05, longitude: -118.24 },
  { name: "Phoenix", zone: "America/Phoenix", detail: "Mountain Standard Time", aliases: ["arizona"], latitude: 33.45, longitude: -112.07 },
  { name: "Toronto", zone: "America/Toronto", detail: "Eastern Time", aliases: [], latitude: 43.65, longitude: -79.38 },
  { name: "Vancouver", zone: "America/Vancouver", detail: "Pacific Time", aliases: [], latitude: 49.28, longitude: -123.12 },
  { name: "Mexico City", zone: "America/Mexico_City", detail: "Central Mexico", aliases: [], latitude: 19.43, longitude: -99.13 },
  { name: "São Paulo", zone: "America/Sao_Paulo", detail: "Brazil", aliases: ["sao paulo"], latitude: -23.55, longitude: -46.63 },
  { name: "London", zone: "Europe/London", detail: "United Kingdom", aliases: ["gmt", "bst"], latitude: 51.51, longitude: -0.13 },
  { name: "Paris", zone: "Europe/Paris", detail: "Central Europe", aliases: ["berlin", "rome", "madrid", "cet", "cest"], latitude: 48.86, longitude: 2.35 },
  { name: "Hyderabad", zone: "Asia/Kolkata", detail: "India Standard Time", aliases: ["india", "kolkata", "mumbai", "delhi", "bengaluru", "bangalore", "ist"], latitude: 17.39, longitude: 78.49 },
  { name: "Dubai", zone: "Asia/Dubai", detail: "Gulf Standard Time", aliases: ["gst"], latitude: 25.20, longitude: 55.27 },
  { name: "Singapore", zone: "Asia/Singapore", detail: "Singapore Time", aliases: ["sgt"], latitude: 1.35, longitude: 103.82 },
  { name: "Tokyo", zone: "Asia/Tokyo", detail: "Japan Standard Time", aliases: ["jst"], latitude: 35.68, longitude: 139.69 },
  { name: "Shanghai", zone: "Asia/Shanghai", detail: "China Standard Time", aliases: ["beijing"], latitude: 31.23, longitude: 121.47 },
  { name: "Sydney", zone: "Australia/Sydney", detail: "Eastern Australia", aliases: [], latitude: -33.87, longitude: 151.21 },
  { name: "Auckland", zone: "Pacific/Auckland", detail: "New Zealand", aliases: [], latitude: -36.85, longitude: 174.76 },
  { name: "UTC", zone: "UTC", detail: "Universal reference", aliases: ["universal time", "zulu"] },
];

const INTERESTING_ZONES = [
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Europe/London",
  "Asia/Dubai",
  "America/Sao_Paulo",
];

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
  homeClockHour: document.querySelector("#home-clock-hour"),
  homeClockPeriod: document.querySelector("#home-clock-period"),
  homePlace: document.querySelector("#home-place"),
  homeZoneLabel: document.querySelector("#home-zone-label"),
  homeDate: document.querySelector("#home-date"),
  homePhase: document.querySelector("#home-phase"),
  homeNowMarker: document.querySelector("#home-now-marker"),
  dayTrack: document.querySelector("#day-track"),
  interestingPlace: document.querySelector("#interesting-place"),
  interestingClockTime: document.querySelector("#interesting-clock-time"),
  interestingClockPeriod: document.querySelector("#interesting-clock-period"),
  interestingZoneLabel: document.querySelector("#interesting-zone-label"),
  interestingDate: document.querySelector("#interesting-date"),
  interestingInsight: document.querySelector("#interesting-insight"),
  anotherPlace: document.querySelector("#another-place"),
  useLocation: document.querySelector("#use-location"),
  chooseLocation: document.querySelector("#choose-location"),
  manualLocation: document.querySelector("#manual-location"),
  homeCity: document.querySelector("#home-city"),
  locationStatus: document.querySelector("#location-status"),
  worldZone: document.querySelector("#world-zone"),
  addWorldClock: document.querySelector("#add-world-clock"),
  worldClockGrid: document.querySelector("#world-clock-grid"),
  liveChart: document.querySelector("#live-chart"),
  toast: document.querySelector("#toast"),
};

const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
let homeZone = detectedZone;
let homePlaceName = friendlyName(detectedZone);
let interestingIndex = 0;
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
    ? "TimeBridge Link — understand time anywhere"
    : `${elements.navItems.find(({ dataset }) => dataset.route === validRoute)?.textContent} · TimeBridge Link`;
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

function clockParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    time: `${value("hour")}:${value("minute")}`,
    period: value("dayPeriod"),
  };
}

function phaseForHour(hour) {
  if (hour < 5 || hour >= 22) return { name: "Night", className: "night" };
  if (hour < 12) return { name: "Morning", className: "morning" };
  if (hour < 17) return { name: "Afternoon", className: "work" };
  return { name: "Evening", className: "evening" };
}

function describeMoment(hour) {
  if (hour < 5) return "Most of the city is winding down there.";
  if (hour < 9) return "The day is getting started there.";
  if (hour < 12) return "The morning is well underway there.";
  if (hour < 14) return "It is around lunchtime there.";
  if (hour < 18) return "The afternoon is moving there.";
  if (hour < 22) return "Evening has arrived there.";
  return "The city is settling into night.";
}

function dayNumber(date) {
  return Math.floor(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ) / (24 * 60 * 60 * 1000));
}

function getInterestingLocation(date) {
  const sourceOffset = getUtcOffsetMinutes(date, homeZone);
  const candidates = INTERESTING_ZONES
    .filter((zone) => zone !== homeZone)
    .map((zone) => {
      const rawDifference = Math.abs(getUtcOffsetMinutes(date, zone) - sourceOffset);
      return {
        location: findLocationForZone(zone),
        difference: Math.min(rawDifference, 24 * 60 - rawDifference),
      };
    })
    .sort((first, second) => second.difference - first.difference)
    .slice(0, 5);

  return candidates[(dayNumber(date) + interestingIndex) % candidates.length]?.location
    ?? findLocationForZone("UTC");
}

function renderHomeExperience() {
  const now = new Date();
  const localParts = clockParts(now, homeZone);
  const localZonedParts = getZonedParts(now, homeZone);
  const localPhase = phaseForHour(localZonedParts.hour);
  const localMinute = localZonedParts.hour * 60 + localZonedParts.minute;
  const markerPosition = Math.max(2.5, Math.min(97.5, (localMinute / (24 * 60)) * 100));

  elements.homeClockHour.textContent = localParts.time;
  elements.homeClockPeriod.textContent = localParts.period;
  elements.homePlace.textContent = homePlaceName;
  elements.homeZoneLabel.textContent = formatZoneAbbreviation(now, homeZone);
  elements.homeDate.textContent = formatFullDate(now, homeZone);
  elements.homePhase.textContent = localPhase.name;
  elements.homeNowMarker.style.left = `${markerPosition}%`;
  elements.dayTrack.setAttribute(
    "aria-label",
    `A 24-hour guide. It is ${formatTime(now, homeZone)} in ${homePlaceName}.`,
  );

  const interesting = getInterestingLocation(now);
  const comparisonParts = clockParts(now, interesting.zone);
  const comparisonZonedParts = getZonedParts(now, interesting.zone);
  elements.interestingPlace.textContent = interesting.name;
  elements.interestingClockTime.textContent = comparisonParts.time;
  elements.interestingClockPeriod.textContent = comparisonParts.period;
  elements.interestingZoneLabel.textContent = formatZoneAbbreviation(now, interesting.zone);
  elements.interestingDate.textContent = describeDateRelation(now, homeZone, interesting.zone);
  elements.interestingInsight.textContent = describeMoment(comparisonZonedParts.hour);
}

function distanceInKilometers(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const radians = (degrees) => degrees * (Math.PI / 180);
  const latitudeDistance = radians(secondLatitude - firstLatitude);
  const longitudeDistance = radians(secondLongitude - firstLongitude);
  const firstLatitudeRadians = radians(firstLatitude);
  const secondLatitudeRadians = radians(secondLatitude);
  const a = Math.sin(latitudeDistance / 2) ** 2
    + Math.cos(firstLatitudeRadians) * Math.cos(secondLatitudeRadians)
    * Math.sin(longitudeDistance / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestSupportedLocation(latitude, longitude) {
  return LOCATIONS
    .filter((location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude))
    .map((location) => ({
      location,
      distance: distanceInKilometers(
        latitude,
        longitude,
        location.latitude,
        location.longitude,
      ),
    }))
    .sort((first, second) => first.distance - second.distance)[0];
}

function setHomeLocation(timeZone, name, status) {
  homeZone = timeZone;
  homePlaceName = name;
  interestingIndex = 0;
  elements.quickFrom.value = name;
  elements.quickDateTime.value = toLocalInputValue(new Date(), timeZone);
  elements.locationStatus.textContent = status;
  renderHomeExperience();
}

function requestApproximateLocation() {
  if (!navigator.geolocation) {
    elements.locationStatus.textContent = "Location access is unavailable here. Choose a city instead.";
    return;
  }

  elements.useLocation.setAttribute("aria-busy", "true");
  elements.useLocation.disabled = true;
  elements.useLocation.textContent = "Finding your place…";
  elements.locationStatus.textContent = "Your browser will ask before sharing an approximate location.";

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const nearest = findNearestSupportedLocation(coords.latitude, coords.longitude);
      const closeEnough = nearest && nearest.distance <= 300;
      const location = closeEnough ? nearest.location : findLocationForZone(detectedZone);
      const timeZone = location?.zone ?? detectedZone;
      const name = closeEnough ? nearest.location.name : friendlyName(timeZone);
      const status = closeEnough
        ? `Approximate location set to ${name}. Your coordinates were used once and not stored.`
        : `Location allowed. Showing ${name} from your device time zone; your coordinates were not stored.`;
      setHomeLocation(timeZone, name, status);
      elements.useLocation.removeAttribute("aria-busy");
      elements.useLocation.disabled = false;
      elements.useLocation.textContent = "Location updated";
    },
    (error) => {
      const message = error.code === error.PERMISSION_DENIED
        ? "Location was not shared. Choose a city instead—everything still works."
        : "We could not read your approximate location. Choose a city instead.";
      elements.locationStatus.textContent = message;
      elements.useLocation.removeAttribute("aria-busy");
      elements.useLocation.disabled = false;
      elements.useLocation.textContent = "Try location again";
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
  );
}

function initializeHomeExperience() {
  elements.locationStatus.textContent = "Showing your device time zone. Exact location has not been requested.";
  elements.useLocation.addEventListener("click", requestApproximateLocation);
  elements.chooseLocation.addEventListener("click", () => {
    const shouldOpen = elements.manualLocation.hidden;
    elements.manualLocation.hidden = !shouldOpen;
    elements.chooseLocation.setAttribute("aria-expanded", String(shouldOpen));
    elements.chooseLocation.textContent = shouldOpen ? "Close city chooser" : "Choose a city";
    if (shouldOpen) elements.homeCity.focus();
  });
  elements.manualLocation.addEventListener("submit", (event) => {
    event.preventDefault();
    const timeZone = resolveTimeZone(elements.homeCity.value);
    if (!timeZone) {
      elements.locationStatus.textContent = "Choose a recognized city or IANA time zone.";
      elements.homeCity.setAttribute("aria-invalid", "true");
      return;
    }
    elements.homeCity.removeAttribute("aria-invalid");
    const name = friendlyName(timeZone);
    setHomeLocation(timeZone, name, `Using ${name} on this page only.`);
    elements.manualLocation.hidden = true;
    elements.chooseLocation.setAttribute("aria-expanded", "false");
    elements.chooseLocation.textContent = "Choose a city";
  });
  elements.anotherPlace.addEventListener("click", () => {
    interestingIndex += 1;
    const next = getInterestingLocation(new Date());
    elements.quickTo.value = next.name;
    renderHomeExperience();
  });
  renderHomeExperience();
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
  const initialComparison = getInterestingLocation(new Date());
  elements.quickFrom.value = homePlaceName;
  elements.quickTo.value = initialComparison.name;
  elements.quickDateTime.value = toLocalInputValue(new Date(), homeZone);
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
}

function initialize() {
  populateFriendlyTimeZones();
  initializeNavigation();
  initializeHomeExperience();
  initializeQuickConverter();
  elements.addWorldClock.addEventListener("click", addWorldClock);
  elements.worldZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addWorldClock();
  });
  renderWorldClocks();
  renderLiveChart();
  window.setInterval(() => {
    renderHomeExperience();
    renderWorldClocks();
  }, 1000);
  window.setInterval(renderLiveChart, 60 * 1000);
}

initialize();
