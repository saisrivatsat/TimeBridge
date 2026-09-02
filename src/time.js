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

export function zonedDateTimeToUtc(dateString, timeZone, hour = 0, minute = 0) {
  const [year, month, day] = dateString.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
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

export function zonedLocalDateTimeToUtc(localDateTime, timeZone) {
  const [dateString, timeString = "00:00"] = localDateTime.split("T");
  const [hour, minute] = timeString.split(":").map(Number);
  return zonedDateTimeToUtc(dateString, timeZone, hour, minute);
}

export function addCalendarDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + Number(days)));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function buildTimeline(
  dateString,
  anchorTimeZone,
  length,
  stepMinutes = 30,
) {
  const start = zonedDateTimeToUtc(dateString, anchorTimeZone);
  const end = zonedDateTimeToUtc(
    addCalendarDays(dateString, 1),
    anchorTimeZone,
  );
  const slotCount = length ?? Math.round(
    (end.getTime() - start.getTime()) / (stepMinutes * 60 * 1000),
  );
  return Array.from(
    { length: slotCount },
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

function getAvailabilityMetrics(date, location, durationMinutes) {
  const { hour, minute } = getZonedParts(date, location.timeZone);
  const localMinutes = hour * 60 + minute;
  const startMinutes = Number(location.startHour) * 60;
  const rawDuration = (
    Number(location.endHour) * 60 - startMinutes + 24 * 60
  ) % (24 * 60);
  const scheduleDuration = rawDuration || 24 * 60;
  const elapsed = (localMinutes - startMinutes + 24 * 60) % (24 * 60);

  if (elapsed >= scheduleDuration || elapsed + durationMinutes > scheduleDuration) {
    return null;
  }

  return {
    edgeBufferMinutes: Math.min(
      elapsed,
      scheduleDuration - elapsed - durationMinutes,
    ),
    centerDistanceMinutes: Math.abs(
      elapsed + durationMinutes / 2 - scheduleDuration / 2,
    ),
  };
}

export function rankMeetingCandidates({
  dateString,
  anchorTimeZone,
  locations,
  durationMinutes,
  searchDays = 1,
  stepMinutes = 30,
}) {
  if (!locations.length || durationMinutes <= 0 || searchDays <= 0) return [];

  const candidates = [];
  const stepMilliseconds = stepMinutes * 60 * 1000;
  const durationMilliseconds = durationMinutes * 60 * 1000;

  for (let dayOffset = 0; dayOffset < searchDays; dayOffset += 1) {
    const candidateDate = addCalendarDays(dateString, dayOffset);
    const timeline = buildTimeline(candidateDate, anchorTimeZone, undefined, stepMinutes);
    const windows = findSharedWindows(timeline, locations);

    windows.forEach((window) => {
      const latestStart = window.end.getTime() - durationMilliseconds;
      for (
        let startTime = window.start.getTime();
        startTime <= latestStart;
        startTime += stepMilliseconds
      ) {
        const start = new Date(startTime);
        const metrics = locations.map((location) =>
          getAvailabilityMetrics(start, location, durationMinutes),
        );
        if (metrics.some((metric) => metric === null)) continue;

        candidates.push({
          start,
          end: new Date(startTime + durationMilliseconds),
          durationMinutes,
          participantBurdenMinutes: metrics.map(
            ({ centerDistanceMinutes }) => centerDistanceMinutes,
          ),
          minimumBufferMinutes: Math.min(
            ...metrics.map(({ edgeBufferMinutes }) => edgeBufferMinutes),
          ),
          averageCenterDistanceMinutes: metrics.reduce(
            (sum, { centerDistanceMinutes }) => sum + centerDistanceMinutes,
            0,
          ) / metrics.length,
        });
      }
    });
  }

  return candidates.sort((first, second) =>
    second.minimumBufferMinutes - first.minimumBufferMinutes
    || first.averageCenterDistanceMinutes - second.averageCenterDistanceMinutes
    || first.start.getTime() - second.start.getTime()
  );
}

export function buildFairRotation({
  dateString,
  anchorTimeZone,
  locations,
  durationMinutes,
  occurrences = 4,
}) {
  if (!locations.length || occurrences <= 0) {
    return {
      meetings: [],
      participantBurdenTotals: locations.map(() => 0),
      unavailableDates: [],
    };
  }

  let participantBurdenTotals = locations.map(() => 0);
  const meetings = [];
  const unavailableDates = [];

  for (let index = 0; index < occurrences; index += 1) {
    const occurrenceDate = addCalendarDays(dateString, index * 7);
    const candidates = rankMeetingCandidates({
      dateString: occurrenceDate,
      anchorTimeZone,
      locations,
      durationMinutes,
      searchDays: 1,
    });

    if (!candidates.length) {
      unavailableDates.push(occurrenceDate);
      continue;
    }

    const evaluated = candidates.map((candidate) => {
      const projectedTotals = participantBurdenTotals.map(
        (total, participantIndex) =>
          total + candidate.participantBurdenMinutes[participantIndex],
      );
      const maximum = Math.max(...projectedTotals);
      const minimum = Math.min(...projectedTotals);
      return {
        candidate,
        projectedTotals,
        maximum,
        spread: maximum - minimum,
        sum: projectedTotals.reduce((total, burden) => total + burden, 0),
      };
    });

    evaluated.sort((first, second) =>
      first.maximum - second.maximum
      || first.spread - second.spread
      || first.sum - second.sum
      || second.candidate.minimumBufferMinutes
        - first.candidate.minimumBufferMinutes
      || first.candidate.start.getTime() - second.candidate.start.getTime()
    );

    const selected = evaluated[0];
    participantBurdenTotals = selected.projectedTotals;
    meetings.push({
      ...selected.candidate,
      occurrence: index + 1,
      occurrenceDate,
      cumulativeBurdenMinutes: [...participantBurdenTotals],
    });
  }

  return { meetings, participantBurdenTotals, unavailableDates };
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

export function formatZoneAbbreviation(date, timeZone) {
  return getFormatter(timeZone, { timeZoneName: "short" })
    .formatToParts(date)
    .find(({ type }) => type === "timeZoneName")?.value;
}

export function formatFullDate(date, timeZone) {
  return getFormatter(timeZone, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function getUtcOffsetMinutes(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((representedAsUtc - date.getTime()) / (60 * 1000));
}
