import test from "node:test";
import assert from "node:assert/strict";

import {
  addCalendarDays,
  buildTimeline,
  findSharedWindows,
  getZonedParts,
  isHourAvailable,
  isValidTimeZone,
  rankMeetingCandidates,
  zonedDateTimeToUtc,
} from "../src/time.js";

test("validates IANA time zones", () => {
  assert.equal(isValidTimeZone("America/Chicago"), true);
  assert.equal(isValidTimeZone("Not/A_Real_Zone"), false);
});

test("supports daytime and overnight availability", () => {
  assert.equal(isHourAvailable(9, 8, 17), true);
  assert.equal(isHourAvailable(17, 8, 17), false);
  assert.equal(isHourAvailable(23, 22, 6), true);
  assert.equal(isHourAvailable(4, 22, 6), true);
  assert.equal(isHourAvailable(12, 22, 6), false);
  assert.equal(isHourAvailable(12, 0, 0), true);
});

test("converts a zoned local midnight across daylight-saving time", () => {
  const chicagoMidnight = zonedDateTimeToUtc(
    "2026-03-10",
    "America/Chicago",
  );
  assert.equal(chicagoMidnight.toISOString(), "2026-03-10T05:00:00.000Z");
  assert.equal(addCalendarDays("2026-02-28", 1), "2026-03-01");
});

test("builds a timeline anchored to the first location's calendar day", () => {
  const timeline = buildTimeline("2026-09-02", "America/Chicago");
  assert.equal(timeline.length, 48);
  assert.equal(getZonedParts(timeline[0], "America/Chicago").hour, 0);
  assert.equal(getZonedParts(timeline[47], "America/Chicago").hour, 23);
  assert.equal(getZonedParts(timeline[47], "America/Chicago").minute, 30);
});

test("uses 23 or 25 hours on daylight-saving transition days", () => {
  assert.equal(buildTimeline("2026-03-08", "America/Chicago").length, 46);
  assert.equal(buildTimeline("2026-11-01", "America/Chicago").length, 50);
});

test("finds the shared Chicago and Hyderabad calling window", () => {
  const timeline = buildTimeline("2026-09-02", "America/Chicago");
  const locations = [
    {
      timeZone: "America/Chicago",
      startHour: 8,
      endHour: 22,
    },
    {
      timeZone: "Asia/Kolkata",
      startHour: 8,
      endHour: 22,
    },
  ];
  const windows = findSharedWindows(timeline, locations);

  assert.equal(windows.length, 2);
  assert.equal(windows[0].hours, 3.5);
  assert.equal(getZonedParts(windows[0].start, "America/Chicago").hour, 8);
  assert.equal(getZonedParts(windows[0].start, "Asia/Kolkata").hour, 18);
  assert.equal(windows[1].hours, 0.5);
});

test("ranks times by the smallest availability buffer", () => {
  const locations = [
    {
      timeZone: "America/Chicago",
      startHour: 8,
      endHour: 12,
    },
  ];
  const candidates = rankMeetingCandidates({
    dateString: "2026-09-02",
    anchorTimeZone: "America/Chicago",
    locations,
    durationMinutes: 60,
  });
  const bestStart = getZonedParts(candidates[0].start, "America/Chicago");

  assert.equal(bestStart.hour, 9);
  assert.equal(bestStart.minute, 30);
  assert.equal(candidates[0].minimumBufferMinutes, 90);
  assert.equal(candidates.at(-1).minimumBufferMinutes, 0);
});

test("finds fair one-hour options across Chicago and Hyderabad", () => {
  const locations = [
    {
      timeZone: "America/Chicago",
      startHour: 8,
      endHour: 22,
    },
    {
      timeZone: "Asia/Kolkata",
      startHour: 8,
      endHour: 22,
    },
  ];
  const candidates = rankMeetingCandidates({
    dateString: "2026-09-02",
    anchorTimeZone: "America/Chicago",
    locations,
    durationMinutes: 60,
    searchDays: 7,
  });

  assert.ok(candidates.length > 7);
  assert.equal(candidates[0].minimumBufferMinutes, 60);
  assert.equal(candidates.every(({ durationMinutes }) => durationMinutes === 60), true);
});
