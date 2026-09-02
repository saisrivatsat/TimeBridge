const formatterCache = new Map();

function getFormatter(timeZone, options) {
  const key = `${timeZone}:${JSON.stringify(options)}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(
      key,
      new Intl.DateTimeFormat("en-US", { timeZone, ...options }),
    );
  }
  return formatterCache.get(key);
}

export function isValidTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getZonedParts(date, timeZone) {
  const formatter = getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
}

export function zonedDateTimeToUtc(dateString, timeZone, hour = 0) {
  const [year, month, day] = dateString.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, 0, 0);
  let candidate = desired;

  // Two passes account for offsets that differ near daylight-saving boundaries.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = getZonedParts(new Date(candidate), timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    candidate += desired - represented;
  }

  return new Date(candidate);
}

export function buildTimeline(
  dateString,
  anchorTimeZone,
  length = 48,
  stepMinutes = 30,
) {
  const start = zonedDateTimeToUtc(dateString, anchorTimeZone);
  return Array.from(
    { length },
    (_, index) => new Date(start.getTime() + index * stepMinutes * 60 * 1000),
  );
}

export function isHourAvailable(hour, startHour, endHour) {
  return isMinuteAvailable(Number(hour) * 60, startHour, endHour);
}

export function isMinuteAvailable(localMinutes, startHour, endHour) {
  const start = Number(startHour);
  const end = Number(endHour);
  const startMinutes = start * 60;
  const endMinutes = end * 60;

  if (start === end) return true;
  if (start < end) {
    return localMinutes >= startMinutes && localMinutes < endMinutes;
  }
  return localMinutes >= startMinutes || localMinutes < endMinutes;
}

export function isLocationAvailable(date, location) {
  const { hour, minute } = getZonedParts(date, location.timeZone);
  return isMinuteAvailable(
    hour * 60 + minute,
    location.startHour,
    location.endHour,
  );
}

export function findSharedWindows(instants, locations) {
  if (!instants.length || !locations.length) return [];

  const stepMilliseconds = instants.length > 1
    ? instants[1].getTime() - instants[0].getTime()
    : 30 * 60 * 1000;

  const shared = instants.map((instant) =>
    locations.every((location) => isLocationAvailable(instant, location)),
  );
  const windows = [];
  let startIndex = null;

  for (let index = 0; index <= shared.length; index += 1) {
    if (shared[index] && startIndex === null) startIndex = index;
    if ((!shared[index] || index === shared.length) && startIndex !== null) {
      const lastIndex = index - 1;
      windows.push({
        start: instants[startIndex],
        end: new Date(instants[lastIndex].getTime() + stepMilliseconds),
        hours: ((index - startIndex) * stepMilliseconds) / (60 * 60 * 1000),
      });
      startIndex = null;
    }
  }

  return windows;
}

export function formatTime(date, timeZone) {
  return getFormatter(timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatHour(date, timeZone) {
  return getFormatter(timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(":00", "")
    .replace(" AM", "a")
    .replace(" PM", "p");
}

export function formatDay(date, timeZone) {
  return getFormatter(timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatOffset(date, timeZone) {
  return getFormatter(timeZone, { timeZoneName: "shortOffset" })
    .formatToParts(date)
    .find(({ type }) => type === "timeZoneName")?.value;
}
