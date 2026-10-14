import assert from "node:assert/strict";
import {
  cappedDate,
  generateMilestones,
  getUpcomingWindow,
  getWindow,
  localDate,
  uniqueFractions,
} from "../milestones.js";

const fractions = uniqueFractions();
assert.equal(fractions.length, 46, "there should be exactly 46 unique reduced fractions");
assert.equal(fractions[0].numerator, 1);
assert.equal(fractions[0].denominator, 12);
assert.equal(fractions.at(-1).numerator, 1);
assert.equal(fractions.at(-1).denominator, 1);
assert.equal(new Set(fractions.map(({ value }) => value)).size, 46);
assert.ok(fractions.every(({ numerator, denominator }) => numerator <= denominator));
assert.ok(fractions.every(({ numerator, denominator }) => denominator <= 12));

assert.equal(cappedDate(2025, 1, 29).toISOString().slice(0, 10), "2025-02-28");
assert.equal(cappedDate(2024, 1, 29).toISOString().slice(0, 10), "2024-02-29");
assert.equal(cappedDate(2025, 1, 31).toISOString().slice(0, 10), "2025-02-28");

const windowRange = getWindow(localDate(2026, 9, 13));
assert.equal(windowRange.start.toISOString().slice(0, 10), "2026-09-01");
assert.equal(windowRange.end.toISOString().slice(0, 10), "2027-12-01");

const upcomingWindow = getUpcomingWindow(localDate(2026, 9, 13));
assert.equal(upcomingWindow.start.toISOString().slice(0, 10), "2026-10-13");
assert.equal(upcomingWindow.end.toISOString().slice(0, 10), "2026-12-13");
assert.equal(getUpcomingWindow(localDate(2027, 11, 31)).end.toISOString().slice(0, 10), "2028-02-29");
assert.equal(getUpcomingWindow(localDate(2026, 11, 31)).end.toISOString().slice(0, 10), "2027-02-28");

const events = generateMilestones(windowRange.start, windowRange.end);
assert.ok(events.length > 46, "a 15-month window should include more than one cycle of milestones");
assert.ok(events.every((event) => event.date >= windowRange.start && event.date < windowRange.end));
assert.ok(events.some((event) => event.label === "1/1" && event.dateKey === "2027-08-02"));
assert.ok(events.some((event) => event.label === "1/12" && event.dateKey === "2026-09-02"));
assert.ok(events.some((event) => event.label === "1/6" && event.dateKey === "2026-10-02"));
assert.ok(events.some((event) => event.label === "1/4" && event.dateKey === "2026-11-02"));
assert.ok(events.some((event) => event.label === "1/3" && event.dateKey === "2026-12-02"));
assert.ok(events.some((event) => event.label === "5/12" && event.dateKey === "2027-01-02"));
assert.ok(events.some((event) => event.label === "1/2" && event.dateKey === "2027-02-02"));
assert.ok(events.every((event, index) => index === 0 || event.date >= events[index - 1].date));

const nonAlignedEvents = generateMilestones(
  localDate(2025, 7, 2),
  localDate(2026, 7, 3),
);
const oneSeventh = nonAlignedEvents.find((event) => event.label === "1/7");
assert.equal(oneSeventh.dateKey, "2025-09-23", "non-aligned fractions should floor to their containing day");

const leapEvents = generateMilestones(
  localDate(2024, 1, 1),
  localDate(2025, 3, 1),
  { year: 2024, month: 1, day: 29 },
);
assert.ok(leapEvents.some((event) => event.label === "1/12" && event.dateKey === "2024-03-29"));
assert.ok(leapEvents.some((event) => event.label === "1/1" && event.dateKey === "2025-02-28"));
assert.ok(leapEvents.some((event) => event.label === "11/12" && event.dateKey === "2025-01-29"));

const monthEndEvents = generateMilestones(
  localDate(2025, 0, 1),
  localDate(2025, 4, 1),
  { year: 2025, month: 0, day: 31 },
);
assert.ok(monthEndEvents.some((event) => event.label === "1/12" && event.dateKey === "2025-02-28"));
assert.ok(monthEndEvents.some((event) => event.label === "1/4" && event.dateKey === "2025-04-30"));

console.log(`Validated ${fractions.length} fractions and ${events.length} in-range events.`);
