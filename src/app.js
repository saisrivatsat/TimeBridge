import {
  buildFairRotation,
  buildTimeline,
  findSharedWindows,
  formatDay,
  formatHour,
  formatOffset,
  formatTime,
  getZonedParts,
  isLocationAvailable,
  isValidTimeZone,
  rankMeetingCandidates,
} from "./time.js";

const VALID_DURATIONS = [30, 60, 90, 120];
const VALID_SEARCH_DAYS = [1, 7, 14];
const VALID_OCCURRENCES = [4, 8, 12];

const DEFAULT_LOCATIONS = [
  {
    id: crypto.randomUUID(),
    name: "Chicago",
    timeZone: "America/Chicago",
    startHour: 8,
    endHour: 22,
  },
  {
    id: crypto.randomUUID(),
    name: "Hyderabad",
    timeZone: "Asia/Kolkata",
    startHour: 8,
    endHour: 22,
  },
];

const elements = {
  date: document.querySelector("#date"),
  duration: document.querySelector("#duration"),
  searchDays: document.querySelector("#search-days"),
  occurrences: document.querySelector("#occurrences"),
  locationList: document.querySelector("#location-list"),
  addLocation: document.querySelector("#add-location"),
  currentTimes: document.querySelector("#current-times"),
  timeline: document.querySelector("#timeline"),
  suggestions: document.querySelector("#suggestions"),
  recommendations: document.querySelector("#recommendations"),
  rotationList: document.querySelector("#rotation-list"),
  rotationSummary: document.querySelector("#rotation-summary"),
  copyRotation: document.querySelector("#copy-rotation"),
  resultSummary: document.querySelector("#result-summary"),
  share: document.querySelector("#share"),
  reset: document.querySelector("#reset"),
  toast: document.querySelector("#toast"),
  timezoneOptions: document.querySelector("#timezone-options"),
};

let locations = loadLocationsFromUrl();
let toastTimer;
let latestRotation;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadLocationsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const parsed = params.getAll("place").flatMap((value) => {
    const [name, timeZone, startHour, endHour] = value.split("|");
    if (!name || !isValidTimeZone(timeZone)) return [];
    return [{
      id: crypto.randomUUID(),
      name: name.slice(0, 40),
      timeZone,
      startHour: Number.isInteger(Number(startHour)) ? Number(startHour) : 8,
      endHour: Number.isInteger(Number(endHour)) ? Number(endHour) : 22,
    }];
  });

  return parsed.length ? parsed.slice(0, 6) : structuredClone(DEFAULT_LOCATIONS);
}

function populateTimeZones() {
  const timeZones = Intl.supportedValuesOf?.("timeZone") ?? [
    "America/Chicago",
    "America/Los_Angeles",
    "America/New_York",
    "Asia/Kolkata",
    "Europe/London",
  ];

  const fragment = document.createDocumentFragment();
  timeZones.forEach((timeZone) => {
    const option = document.createElement("option");
    option.value = timeZone;
    fragment.append(option);
  });
  elements.timezoneOptions.replaceChildren(fragment);
}

function createHourSelect(value, label) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  for (let hour = 0; hour < 24; hour += 1) {
    const option = document.createElement("option");
    option.value = String(hour);
    option.textContent = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h12",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2020, 0, 1, hour)));
    option.selected = hour === Number(value);
    select.append(option);
  }
  return select;
}

function renderLocationEditor() {
  const fragment = document.createDocumentFragment();

  locations.forEach((location, index) => {
    const row = document.createElement("div");
    row.className = "location-row";

    const marker = document.createElement("span");
    marker.className = `location-marker marker-${index % 6}`;
    marker.setAttribute("aria-hidden", "true");

    const identity = document.createElement("div");
    identity.className = "location-identity";

    const name = document.createElement("input");
    name.value = location.name;
    name.maxLength = 40;
    name.setAttribute("aria-label", `Location ${index + 1} name`);
    name.placeholder = "City name";
    name.addEventListener("input", () => {
      location.name = name.value || "Untitled";
      renderOutput();
    });

    const timeZone = document.createElement("input");
    timeZone.value = location.timeZone;
    timeZone.setAttribute("list", "timezone-options");
    timeZone.setAttribute("aria-label", `Location ${index + 1} time zone`);
    timeZone.placeholder = "Area/City";
    timeZone.addEventListener("change", () => {
      if (isValidTimeZone(timeZone.value)) {
        location.timeZone = timeZone.value;
        timeZone.removeAttribute("aria-invalid");
        renderOutput();
      } else {
        timeZone.setAttribute("aria-invalid", "true");
        showToast("Choose a valid IANA time zone.");
      }
    });

    identity.append(name, timeZone);

    const hours = document.createElement("div");
    hours.className = "hours-range";
    const start = createHourSelect(location.startHour, `${location.name} available from`);
    const separator = document.createElement("span");
    separator.textContent = "to";
    const end = createHourSelect(location.endHour, `${location.name} available until`);

    start.addEventListener("change", () => {
      location.startHour = Number(start.value);
      renderOutput();
    });
    end.addEventListener("change", () => {
      location.endHour = Number(end.value);
      renderOutput();
    });
    hours.append(start, separator, end);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.setAttribute("aria-label", `Remove ${location.name}`);
    remove.textContent = "×";
    remove.disabled = locations.length <= 1;
    remove.addEventListener("click", () => {
      locations = locations.filter(({ id }) => id !== location.id);
      renderLocationEditor();
      renderOutput();
    });

    row.append(marker, identity, hours, remove);
    fragment.append(row);
  });

  elements.locationList.replaceChildren(fragment);
  elements.addLocation.disabled = locations.length >= 6;
}

function renderCurrentTimes() {
  const now = new Date();
  const fragment = document.createDocumentFragment();

  locations.forEach((location, index) => {
    const card = document.createElement("article");
    card.className = "time-card";
    const heading = document.createElement("div");
    heading.className = "time-card-heading";
    const marker = document.createElement("span");
    marker.className = `location-marker marker-${index % 6}`;
    const name = document.createElement("strong");
    name.textContent = location.name;
    heading.append(marker, name);

    const time = document.createElement("p");
    time.className = "current-time";
    time.textContent = formatTime(now, location.timeZone);
    const meta = document.createElement("p");
    meta.className = "time-meta";
    meta.textContent = `${formatDay(now, location.timeZone)} · ${formatOffset(now, location.timeZone)}`;
    card.append(heading, time, meta);
    fragment.append(card);
  });

  elements.currentTimes.replaceChildren(fragment);
}

function renderTimeline(instants) {
  const shared = instants.map((instant) =>
    locations.every((location) => isLocationAvailable(instant, location)),
  );
  const grid = document.createElement("div");
  grid.className = "timeline-grid";
  grid.style.setProperty("--columns", String(instants.length));

  locations.forEach((location, rowIndex) => {
    const label = document.createElement("div");
    label.className = "timeline-label";
    label.textContent = location.name;
    grid.append(label);

    const slots = document.createElement("div");
    slots.className = "timeline-slots";
    slots.style.setProperty("--columns", String(instants.length));

    instants.forEach((instant, index) => {
      const slot = document.createElement("div");
      const available = isLocationAvailable(instant, location);
      slot.className = `timeline-slot ${available ? "is-available" : ""} ${shared[index] ? "is-shared" : ""}`;
      slot.textContent = formatHour(instant, location.timeZone);
      slot.title = `${location.name}: ${formatDay(instant, location.timeZone)} at ${formatTime(instant, location.timeZone)}${available ? " — available" : " — outside preferred hours"}`;
      slot.setAttribute("aria-label", slot.title);
      if (rowIndex === 0 && index === getCurrentSlotIndex(instants)) {
        slot.classList.add("is-now");
      }
      slots.append(slot);
    });

    grid.append(slots);
  });

  elements.timeline.replaceChildren(grid);
}

function getCurrentSlotIndex(instants) {
  const now = Date.now();
  const stepMilliseconds = instants.length > 1
    ? instants[1].getTime() - instants[0].getTime()
    : 30 * 60 * 1000;
  return instants.findIndex(
    (instant) => now >= instant.getTime() && now < instant.getTime() + stepMilliseconds,
  );
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function getComfortLabel(bufferMinutes) {
  if (bufferMinutes >= 120) return "Very comfortable";
  if (bufferMinutes >= 60) return "Comfortable";
  if (bufferMinutes >= 30) return "Reasonable";
  return "Tight fit";
}

function meetingSummary(candidate) {
  const heading = `${formatDuration(candidate.durationMinutes)} meeting`;
  const lines = locations.map((location) =>
    `${location.name}: ${formatDay(candidate.start, location.timeZone)}, ${formatTime(candidate.start, location.timeZone)}–${formatTime(candidate.end, location.timeZone)}`,
  );
  return [heading, ...lines, "Planned with TimeBridge Link"].join("\n");
}

async function copyMeeting(candidate) {
  const summary = meetingSummary(candidate);
  try {
    await navigator.clipboard.writeText(summary);
    showToast("Meeting time copied.");
  } catch {
    window.prompt("Copy this meeting time:", summary);
  }
}

function renderRecommendations(candidates) {
  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const heading = document.createElement("strong");
    heading.textContent = "No meeting-length fit found.";
    const guidance = document.createElement("span");
    guidance.textContent = "Try a shorter meeting, a longer search, or wider availability.";
    empty.append(heading, guidance);
    elements.recommendations.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  candidates.slice(0, 4).forEach((candidate, index) => {
    const card = document.createElement("article");
    card.className = `recommendation-card ${index === 0 ? "is-best" : ""}`;

    const header = document.createElement("div");
    header.className = "recommendation-header";
    const rank = document.createElement("span");
    rank.className = "rank-badge";
    rank.textContent = index === 0 ? "Most fair" : `Option ${index + 1}`;
    const comfort = document.createElement("span");
    comfort.className = "comfort-label";
    comfort.textContent = getComfortLabel(candidate.minimumBufferMinutes);
    header.append(rank, comfort);

    const title = document.createElement("h3");
    title.textContent = `${formatDay(candidate.start, locations[0].timeZone)} · ${formatTime(candidate.start, locations[0].timeZone)}`;
    const explanation = document.createElement("p");
    explanation.className = "fairness-explanation";
    explanation.textContent = candidate.minimumBufferMinutes
      ? `Everyone gets at least a ${candidate.minimumBufferMinutes}-minute buffer.`
      : "This meeting fits exactly against someone’s availability boundary.";
    card.append(header, title, explanation);

    const times = document.createElement("div");
    times.className = "recommendation-times";
    locations.forEach((location) => {
      const line = document.createElement("p");
      const name = document.createElement("strong");
      name.textContent = location.name;
      const value = document.createElement("span");
      value.textContent = `${formatDay(candidate.start, location.timeZone)}, ${formatTime(candidate.start, location.timeZone)}–${formatTime(candidate.end, location.timeZone)}`;
      line.append(name, value);
      times.append(line);
    });
    card.append(times);

    const copy = document.createElement("button");
    copy.className = "copy-time-button";
    copy.type = "button";
    copy.textContent = "Copy this time";
    copy.addEventListener("click", () => copyMeeting(candidate));
    card.append(copy);
    fragment.append(card);
  });

  elements.recommendations.replaceChildren(fragment);
}

function renderRotation(rotation) {
  latestRotation = rotation;
  const { meetings, participantBurdenTotals, unavailableDates } = rotation;
  const highestBurden = participantBurdenTotals.length
    ? Math.max(...participantBurdenTotals)
    : 0;
  const lowestBurden = participantBurdenTotals.length
    ? Math.min(...participantBurdenTotals)
    : 0;
  const burdenGap = Math.round(highestBurden - lowestBurden);
  elements.rotationSummary.textContent = `${meetings.length} scheduled · ${burdenGap}-min burden gap`;

  if (!meetings.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const heading = document.createElement("strong");
    heading.textContent = "No weekly rotation fits these schedules.";
    const guidance = document.createElement("span");
    guidance.textContent = "Shorten the meeting or widen at least one availability window.";
    empty.append(heading, guidance);
    elements.rotationList.replaceChildren(empty);
    elements.copyRotation.disabled = true;
    return;
  }

  const fragment = document.createDocumentFragment();
  meetings.forEach((meeting) => {
    const row = document.createElement("article");
    row.className = "rotation-row";

    const badge = document.createElement("span");
    badge.className = "week-badge";
    badge.textContent = `Week ${meeting.occurrence}`;

    const primary = document.createElement("div");
    primary.className = "rotation-primary";
    const title = document.createElement("strong");
    title.textContent = formatDay(meeting.start, locations[0].timeZone);
    const time = document.createElement("span");
    time.textContent = `${formatTime(meeting.start, locations[0].timeZone)}–${formatTime(meeting.end, locations[0].timeZone)} ${locations[0].name}`;
    primary.append(title, time);

    const localTimes = document.createElement("div");
    localTimes.className = "rotation-local-times";
    locations.slice(1).forEach((location) => {
      const value = document.createElement("span");
      value.textContent = `${formatTime(meeting.start, location.timeZone)} ${location.name}`;
      localTimes.append(value);
    });

    row.append(badge, primary, localTimes);
    fragment.append(row);
  });

  if (unavailableDates.length) {
    const warning = document.createElement("p");
    warning.className = "rotation-warning";
    warning.textContent = `${unavailableDates.length} week${unavailableDates.length === 1 ? "" : "s"} could not be scheduled.`;
    fragment.append(warning);
  }

  elements.rotationList.replaceChildren(fragment);
  elements.copyRotation.disabled = false;
}

async function copyWeeklyRotation() {
  if (!latestRotation?.meetings.length) return;

  const lines = [
    `TimeBridge Link weekly rotation · ${formatDuration(Number(elements.duration.value))} each`,
    "",
  ];
  latestRotation.meetings.forEach((meeting) => {
    lines.push(`Week ${meeting.occurrence}`);
    locations.forEach((location) => {
      lines.push(
        `${location.name}: ${formatDay(meeting.start, location.timeZone)}, ${formatTime(meeting.start, location.timeZone)}–${formatTime(meeting.end, location.timeZone)}`,
      );
    });
    lines.push("");
  });

  try {
    await navigator.clipboard.writeText(lines.join("\n").trim());
    showToast("Weekly rotation copied.");
  } catch {
    window.prompt("Copy this weekly rotation:", lines.join("\n").trim());
  }
}

function renderSuggestions(windows) {
  if (!windows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>No shared window on this date.</strong><span>Try extending someone’s available hours or choosing another date.</span>";
    elements.suggestions.replaceChildren(empty);
    elements.resultSummary.textContent = "No shared time found";
    return;
  }

  const fragment = document.createDocumentFragment();
  windows.forEach((window, index) => {
    const card = document.createElement("article");
    card.className = "suggestion-card";

    const badge = document.createElement("span");
    badge.className = "recommendation-badge";
    badge.textContent = index === 0 ? "Best window" : `${window.hours} hours`;
    const heading = document.createElement("h3");
    heading.textContent = `${window.hours}-hour overlap`;
    card.append(badge, heading);

    locations.forEach((location) => {
      const line = document.createElement("p");
      const name = document.createElement("strong");
      name.textContent = location.name;
      const value = document.createElement("span");
      value.textContent = `${formatDay(window.start, location.timeZone)}, ${formatTime(window.start, location.timeZone)}–${formatTime(window.end, location.timeZone)}`;
      line.append(name, value);
      card.append(line);
    });
    fragment.append(card);
  });

  elements.suggestions.replaceChildren(fragment);
  const totalHours = windows.reduce((sum, window) => sum + window.hours, 0);
  elements.resultSummary.textContent = `${totalHours} shared hour${totalHours === 1 ? "" : "s"} found`;
}

function renderOutput() {
  const anchor = locations[0]?.timeZone ?? "UTC";
  const instants = buildTimeline(elements.date.value, anchor);
  const windows = findSharedWindows(instants, locations).sort(
    (first, second) => second.hours - first.hours,
  );
  const candidates = rankMeetingCandidates({
    dateString: elements.date.value,
    anchorTimeZone: anchor,
    locations,
    durationMinutes: Number(elements.duration.value),
    searchDays: Number(elements.searchDays.value),
  });
  const rotation = buildFairRotation({
    dateString: elements.date.value,
    anchorTimeZone: anchor,
    locations,
    durationMinutes: Number(elements.duration.value),
    occurrences: Number(elements.occurrences.value),
  });
  renderCurrentTimes();
  renderTimeline(instants);
  renderRecommendations(candidates);
  renderRotation(rotation);
  renderSuggestions(windows);
}

function syncUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("date", elements.date.value);
  url.searchParams.set("duration", elements.duration.value);
  url.searchParams.set("range", elements.searchDays.value);
  url.searchParams.set("occurrences", elements.occurrences.value);
  locations.forEach((location) => {
    url.searchParams.append(
      "place",
      [location.name, location.timeZone, location.startHour, location.endHour].join("|"),
    );
  });
  window.history.replaceState({}, "", url);
  return url.href;
}

async function sharePlan() {
  const url = syncUrl();
  try {
    await navigator.clipboard.writeText(url);
    showToast("Shareable link copied.");
  } catch {
    window.prompt("Copy this shareable link:", url);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function resetPlanner() {
  locations = structuredClone(DEFAULT_LOCATIONS).map((location) => ({
    ...location,
    id: crypto.randomUUID(),
  }));
  elements.date.value = localDateString();
  elements.duration.value = "60";
  elements.searchDays.value = "7";
  elements.occurrences.value = "4";
  window.history.replaceState({}, "", window.location.pathname);
  renderLocationEditor();
  renderOutput();
  showToast("Planner reset.");
}

function initialize() {
  populateTimeZones();
  const params = new URLSearchParams(window.location.search);
  elements.date.value = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date"))
    ? params.get("date")
    : localDateString();
  const requestedDuration = Number(params.get("duration"));
  const requestedSearchDays = Number(params.get("range"));
  const requestedOccurrences = Number(params.get("occurrences"));
  elements.duration.value = String(
    VALID_DURATIONS.includes(requestedDuration) ? requestedDuration : 60,
  );
  elements.searchDays.value = String(
    VALID_SEARCH_DAYS.includes(requestedSearchDays) ? requestedSearchDays : 7,
  );
  elements.occurrences.value = String(
    VALID_OCCURRENCES.includes(requestedOccurrences) ? requestedOccurrences : 4,
  );

  elements.date.addEventListener("change", renderOutput);
  elements.duration.addEventListener("change", renderOutput);
  elements.searchDays.addEventListener("change", renderOutput);
  elements.occurrences.addEventListener("change", renderOutput);
  elements.addLocation.addEventListener("click", () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    locations.push({
      id: crypto.randomUUID(),
      name: "New location",
      timeZone: detected,
      startHour: 8,
      endHour: 22,
    });
    renderLocationEditor();
    renderOutput();
  });
  elements.share.addEventListener("click", sharePlan);
  elements.copyRotation.addEventListener("click", copyWeeklyRotation);
  elements.reset.addEventListener("click", resetPlanner);

  renderLocationEditor();
  renderOutput();
  window.setInterval(renderCurrentTimes, 60 * 1000);
}

initialize();
