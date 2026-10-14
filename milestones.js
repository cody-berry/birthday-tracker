export const BIRTHDAY = Object.freeze({ year: 2014, month: 7, day: 2 });

export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

export function uniqueFractions(maxDenominator = 12) {
  const fractions = [];
  for (let denominator = 1; denominator <= maxDenominator; denominator += 1) {
    for (let numerator = 1; numerator <= denominator; numerator += 1) {
      if (gcd(numerator, denominator) === 1) {
        fractions.push({ numerator, denominator, value: numerator / denominator });
      }
    }
  }
  return fractions.sort((a, b) => a.value - b.value || a.denominator - b.denominator);
}

export function localDate(year, month, day) {
  return new Date(year, month, day, 12, 0, 0, 0);
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function cappedDate(year, month, preferredDay) {
  const normalized = localDate(year, month, 1);
  const cappedDay = Math.min(preferredDay, daysInMonth(normalized.getFullYear(), normalized.getMonth()));
  return localDate(normalized.getFullYear(), normalized.getMonth(), cappedDay);
}

export function addMonths(date, amount) {
  return localDate(date.getFullYear(), date.getMonth() + amount, 1);
}

export function startOfMonth(date) {
  return localDate(date.getFullYear(), date.getMonth(), 1);
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateMilestones(rangeStart, rangeEnd, birthday = BIRTHDAY) {
  const fractions = uniqueFractions();
  const events = [];
  const firstCycle = rangeStart.getFullYear() - 2;
  const lastCycle = rangeEnd.getFullYear() + 1;

  for (let cycleYear = firstCycle; cycleYear <= lastCycle; cycleYear += 1) {
    const cycleStart = cappedDate(cycleYear, birthday.month, birthday.day);
    const cycleEnd = cappedDate(cycleYear + 1, birthday.month, birthday.day);
    const cycleStartUtc = Date.UTC(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate());
    const cycleEndUtc = Date.UTC(cycleEnd.getFullYear(), cycleEnd.getMonth(), cycleEnd.getDate());
    const cycleDays = (cycleEndUtc - cycleStartUtc) / 86_400_000;

    for (const fraction of fractions) {
      const twelfthPosition = (12 * fraction.numerator) / fraction.denominator;
      let date;

      if (Number.isInteger(twelfthPosition)) {
        date = cappedDate(cycleYear, birthday.month + twelfthPosition, birthday.day);
      } else {
        const elapsedDays = Math.floor(cycleDays * fraction.value);
        date = new Date(cycleStart);
        date.setDate(date.getDate() + elapsedDays);
        date.setHours(12, 0, 0, 0);
      }

      if (date < rangeStart || date >= rangeEnd) continue;

      const age = cycleYear - birthday.year + fraction.value;
      events.push({
        id: `${cycleYear}-${fraction.numerator}-${fraction.denominator}`,
        date,
        dateKey: toDateKey(date),
        numerator: fraction.numerator,
        denominator: fraction.denominator,
        label: `${fraction.numerator}/${fraction.denominator}`,
        age,
        cycleYear,
        isWhole: fraction.denominator === 1,
      });
    }
  }

  return events.sort((a, b) => a.date - b.date || a.age - b.age);
}

export function getWindow(today = new Date()) {
  const currentMonth = startOfMonth(today);
  return {
    start: addMonths(currentMonth, -1),
    end: addMonths(currentMonth, 14),
  };
}

export function getUpcomingWindow(today = new Date()) {
  const start = localDate(today.getFullYear(), today.getMonth(), today.getDate());
  return {
    start,
    end: cappedDate(today.getFullYear(), today.getMonth() + 2, today.getDate()),
  };
}
