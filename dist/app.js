import {
  BIRTHDAY,
  generateMilestones,
  getWindow,
  localDate,
  toDateKey,
  uniqueFractions,
} from "./milestones.js";

const today = new Date();
today.setHours(12, 0, 0, 0);
const windowRange = getWindow(today);
const events = generateMilestones(windowRange.start, windowRange.end);
const upcomingEvents = events.filter((event) => event.date >= today);

const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const monthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const compactMonth = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAge(age) {
  const whole = Math.floor(age);
  const remainder = age - whole;
  if (remainder < 0.0001) return `${whole} years`;
  const fraction = uniqueFractions().find((item) => Math.abs(item.value - remainder) < 0.0001);
  return fraction ? `${whole} + ${fraction.numerator}/${fraction.denominator} years` : `${age.toFixed(2)} years`;
}

function daysFromToday(date) {
  const dayMs = 86_400_000;
  return Math.round((date - today) / dayMs);
}

function relativeLabel(date) {
  const days = daysFromToday(date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return longDate.format(date);
}

function renderUpcoming() {
  const list = document.querySelector("#event-list");
  document.querySelector("#event-count").textContent = String(upcomingEvents.length);
  document.querySelector("#list-range").textContent = `Through ${monthYear.format(
    new Date(windowRange.end.getFullYear(), windowRange.end.getMonth(), 0),
  )}`;

  if (!upcomingEvents.length) {
    list.innerHTML = '<p class="empty-state">No milestones remain in this window.</p>';
    return;
  }

  let lastMonth = "";
  list.innerHTML = upcomingEvents
    .map((event) => {
      const eventMonth = compactMonth.format(event.date);
      const monthDivider = eventMonth !== lastMonth
        ? `<h3 class="month-divider">${escapeHtml(eventMonth)}</h3>`
        : "";
      lastMonth = eventMonth;
      return `${monthDivider}
        <article class="event-row${event.isWhole ? " event-row--whole" : ""}">
          <time datetime="${event.dateKey}" class="event-date">
            <span>${escapeHtml(event.date.toLocaleDateString(undefined, { month: "short" }))}</span>
            <strong>${event.date.getDate()}</strong>
          </time>
          <div class="event-info">
            <strong>${escapeHtml(event.label)} birthday</strong>
            <span>${escapeHtml(formatAge(event.age))}</span>
          </div>
          <span class="relative-time">${escapeHtml(relativeLabel(event.date))}</span>
        </article>`;
    })
    .join("");
}

function renderFractionStrip() {
  document.querySelector("#fraction-strip").innerHTML = uniqueFractions()
    .map(
      ({ numerator, denominator }) =>
        `<span><sup>${numerator}</sup><i></i><sub>${denominator}</sub></span>`,
    )
    .join("");
}

function renderCalendar() {
  const calendarElement = document.querySelector("#calendar");
  const calendarEvents = events.map((event) => ({
    id: event.id,
    title: event.isWhole ? "Whole birthday" : `${event.label} birthday`,
    start: event.dateKey,
    allDay: true,
    classNames: event.isWhole ? ["whole-event"] : [],
    extendedProps: { fraction: event.label, age: formatAge(event.age) },
  }));

  if (!window.FullCalendar) {
    calendarElement.innerHTML = '<p class="empty-state">The calendar could not load. Please refresh the page.</p>';
    return null;
  }

  const calendar = new FullCalendar.Calendar(calendarElement, {
    themeSystem: "monarch",
    initialView: "dayGridMonth",
    initialDate: today,
    validRange: { start: toDateKey(windowRange.start), end: toDateKey(windowRange.end) },
    events: calendarEvents,
    headerToolbar: { left: "prev", center: "title", right: "next" },
    height: "auto",
    fixedWeekCount: false,
    showNonCurrentDates: false,
    dayMaxEvents: 3,
    eventDisplay: "block",
    eventContent(info) {
      const label = info.event.extendedProps.fraction;
      return { html: `<span class="calendar-event-label">${escapeHtml(label)}</span>` };
    },
    moreLinkContent(args) {
      return `+${args.num} more`;
    },
  });
  calendar.render();
  return calendar;
}

const birthdayThisYear = localDate(today.getFullYear(), BIRTHDAY.month, BIRTHDAY.day);
const completedYears = today >= birthdayThisYear
  ? today.getFullYear() - BIRTHDAY.year
  : today.getFullYear() - BIRTHDAY.year - 1;
document.querySelector("#years-tracked").textContent = String(completedYears);
document.querySelector("#calendar-range").textContent = `${monthYear.format(windowRange.start)}—${monthYear.format(
  new Date(windowRange.end.getFullYear(), windowRange.end.getMonth(), 0),
)}`;

renderUpcoming();
renderFractionStrip();
const calendar = renderCalendar();
document.querySelector("#today-button").addEventListener("click", () => calendar?.today());
