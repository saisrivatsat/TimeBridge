import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTimeline,
  findSharedWindows,
  getZonedParts,
  isHourAvailable,
  isValidTimeZone,
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
});

test("builds a timeline anchored to the first location's calendar day", () => {
  const timeline = buildTimeline("2026-09-02", "America/Chicago");
  assert.equal(timeline.length, 48);
  assert.equal(getZonedParts(timeline[0], "America/Chicago").hour, 0);
  assert.equal(getZonedParts(timeline[47], "America/Chicago").hour, 23);
  assert.equal(getZonedParts(timeline[47], "America/Chicago").minute, 30);
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
