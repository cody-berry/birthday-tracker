import { calendarAge, generateMilestones, getUpcomingWindow, getWindow, glowStrength, isMonthlyFraction, toDateKey, uniqueFractions } from "./milestones.js";
import { normalizeConfigText } from "./config.js";

const STORAGE_KEY = "fractional-birthdays-v2";
const COLORS = ["#ff6b3d", "#8d7cff", "#2dd4bf", "#f4c95d", "#ec77a8", "#6db5ff", "#c084fc", "#84cc16", "#fb7185", "#22d3ee", "#f97316", "#a3e635"];
const today = new Date();
today.setHours(12, 0, 0, 0);
const windowRange = getWindow(today);
const upcomingRange = getUpcomingWindow(today);
const longDate = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const monthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const compactMonth = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
let people = loadPeople();
let calendar = null;
let editingPersonId = null;
let selectedView = "list";
const dualViewQuery = window.matchMedia("(min-width: 1200px)");

function loadPeople() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    const migrated = saved.filter((person) => person.id !== "origin" && person.name !== "Original birthday");
    const used = new Set();
    let changed = migrated.length !== saved.length;
    for (const person of migrated) {
      if (!["annual", "monthly", "fractional"].includes(person.milestoneMode)) {
        person.milestoneMode = person.wholeOnly ? "annual" : "fractional";
        delete person.wholeOnly;
        changed = true;
      }
      const color = String(person.color || "").toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(color) || used.has(color)) {
        person.color = nextAvailableColor(used);
        changed = true;
      }
      used.add(person.color.toLowerCase());
    }
    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch { return []; }
}
function savePeople() { localStorage.setItem(STORAGE_KEY, JSON.stringify(people)); }
function nextAvailableColor(usedColors = new Set(people.map((person) => person.color.toLowerCase()))) {
  return COLORS.find((color) => !usedColors.has(color.toLowerCase())) || COLORS[people.length % COLORS.length];
}
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function plural(value, singular) { return `${value} ${singular}${value === 1 ? "" : "s"}`; }
function parseBirthday(value) { const [year, month, day] = value.split("-").map(Number); return { year, month: month - 1, day }; }
function isValidBirthday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const birthday = parseBirthday(value);
  const candidate = new Date(birthday.year, birthday.month, birthday.day, 12);
  return birthday.year >= 1 && candidate.getFullYear() === birthday.year && candidate.getMonth() === birthday.month && candidate.getDate() === birthday.day;
}
function allEvents() {
  return people.flatMap((person) => generateMilestones(windowRange.start, windowRange.end, parseBirthday(person.birthday))
    .filter((event) => person.milestoneMode === "annual" ? event.label === "1/1" : person.milestoneMode === "monthly" ? isMonthlyFraction(event) : true)
    .map((event) => ({ ...event, id: `${person.id}-${event.id}`, personId: person.id, personName: person.name, color: person.color })))
    .sort((a, b) => a.date - b.date || a.personName.localeCompare(b.personName) || a.age - b.age);
}
function formatAge(age) {
  const whole = Math.floor(age); const remainder = age - whole;
  if (remainder < 0.0001) return `${whole} years`;
  const fraction = uniqueFractions().find((item) => Math.abs(item.value - remainder) < 0.0001);
  return fraction ? `${whole} + ${fraction.numerator}/${fraction.denominator} years` : `${age.toFixed(2)} years`;
}
function daysFromToday(date) { return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000); }
function relativeLabel(date) { const days = daysFromToday(date); if (days === 0) return "Today"; if (days === 1) return "Tomorrow"; if (days < 7) return `In ${days} days`; return longDate.format(date); }
function glowColor(hex, strength) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${(0.72 * strength).toFixed(3)})`;
}

function renderPeople() {
  if (!people.length) {
    document.querySelector("#people-list").innerHTML = '<p class="empty-state empty-state--people">Add a birthday to begin tracking milestones.</p>';
    return;
  }
  document.querySelector("#people-list").innerHTML = people.map((person) => {
    const birthday = parseBirthday(person.birthday);
    const label = new Date(birthday.year, birthday.month, birthday.day, 12).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    const mode = person.milestoneMode === "annual" ? " · Real birthday only" : person.milestoneMode === "monthly" ? " · Monthly" : "";
    const age = calendarAge(birthday, today);
    const ageLabel = age.totalDays < 0 ? `Born in ${plural(Math.abs(age.totalDays), "day")}` : `${age.totalDays.toLocaleString()} days old · ${plural(age.years, "year")} + ${plural(age.days, "day")} old`;
    return `<article class="person-chip"><span class="person-dot" style="--person-color:${person.color}"></span><div class="person-details"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(label)}${mode}</span><span class="person-age">${escapeHtml(ageLabel)}</span></div><div class="person-actions"><button type="button" class="chip-button" data-edit-person="${escapeHtml(person.id)}" aria-label="Edit ${escapeHtml(person.name)}">Edit</button><button type="button" class="chip-button chip-button--danger" data-remove-person="${escapeHtml(person.id)}" aria-label="Remove ${escapeHtml(person.name)}">Remove</button></div></article>`;
  }).join("");
}
function renderList(events) {
  const upcoming = events.filter((event) => event.date >= upcomingRange.start && event.date <= upcomingRange.end);
  const nextSevenDays = upcoming.filter((event) => { const days = daysFromToday(event.date); return days >= 0 && days < 7; });
  const eventsByDate = nextSevenDays.reduce((groups, event) => {
    if (!groups.has(event.dateKey)) groups.set(event.dateKey, []);
    groups.get(event.dateKey).push(event);
    return groups;
  }, new Map());
  const nextSevenDaysByDate = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    const dateKey = toDateKey(date);
    return { dateKey, date, events: eventsByDate.get(dateKey) || [] };
  });
  document.querySelector("#up-next-events").innerHTML = nextSevenDaysByDate.map((day) => {
    const distance = daysFromToday(day.date);
    const dayName = distance <= 1 ? relativeLabel(day.date) : day.date.toLocaleDateString(undefined, { weekday: "long" });
    const calendarDate = day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const dayEvents = day.events.length ? day.events.map((event) => `<span class="up-next__birthday"><i class="person-dot" style="--person-color:${event.color}"></i><span>${escapeHtml(event.personName)} · ${escapeHtml(event.label)}</span></span>`).join("") : '<span class="up-next__none">No milestones</span>';
    return `<article class="up-next__day"><time datetime="${day.dateKey}"><strong>${escapeHtml(dayName)}</strong><span>${escapeHtml(calendarDate)}</span></time><div class="up-next__birthdays">${dayEvents}</div></article>`;
  }).join("");
  document.querySelector("#event-count").textContent = String(upcoming.length);
  if (!upcoming.length) { document.querySelector("#event-list").innerHTML = '<p class="empty-state">No milestones remain in this window.</p>'; return; }
  let lastMonth = "";
  document.querySelector("#event-list").innerHTML = upcoming.map((event) => {
    const eventMonth = compactMonth.format(event.date); const divider = eventMonth !== lastMonth ? `<h3 class="month-divider">${escapeHtml(eventMonth)}</h3>` : ""; lastMonth = eventMonth;
    const strength = glowStrength(event.label);
    const glow = strength ? ` event-row--glow` : "";
    const style = strength ? `--event-color:${event.color};--glow-strength:${strength};--event-glow:${glowColor(event.color, strength)}` : "";
    const eventDays = daysFromToday(event.date);
    const compactTime = eventDays < 7 ? " relative-time--compact" : "";
    const imminent = eventDays <= 1 ? " relative-time--imminent" : "";
    return `${divider}<article class="event-row${glow}" style="${style}"><time datetime="${event.dateKey}" class="event-date"><span>${escapeHtml(event.date.toLocaleDateString(undefined, { month: "short" }))}</span><strong>${event.date.getDate()}</strong></time><span class="person-dot" style="--person-color:${event.color}"></span><div class="event-info"><strong>${escapeHtml(event.personName)} · ${escapeHtml(event.label)} birthday</strong><span>${escapeHtml(formatAge(event.age))}</span></div><span class="relative-time${compactTime}${imminent}">${escapeHtml(relativeLabel(event.date))}</span></article>`;
  }).join("");
}
function renderCalendar(events) {
  calendar?.destroy();
  const element = document.querySelector("#calendar");
  if (!window.FullCalendar) { element.innerHTML = '<p class="empty-state">The calendar could not load. Please refresh the page.</p>'; return; }
  calendar = new FullCalendar.Calendar(element, {
    themeSystem: "monarch", initialView: "dayGridMonth", initialDate: today,
    validRange: { start: toDateKey(windowRange.start), end: toDateKey(windowRange.end) },
    headerToolbar: { left: "prev", center: "title", right: "next" }, height: "auto", fixedWeekCount: false, showNonCurrentDates: false, dayMaxEvents: 3,
    events: events.map((event) => ({ id: event.id, title: `${event.personName} · ${event.label}`, start: event.dateKey, allDay: true, backgroundColor: "transparent", borderColor: "transparent", textColor: "#f5f2eb", extendedProps: { color: event.color, glowStrength: glowStrength(event.label), glowColor: glowColor(event.color, glowStrength(event.label)) } })),
    dayCellDidMount(info) {
      if (toDateKey(info.date) === toDateKey(today)) info.el.classList.add("calendar-day--today");
    },
    eventDidMount(info) {
      info.el.classList.add("calendar-event-wrapper");
      info.el.style.setProperty("--fc-event-color", "transparent");
      info.el.style.setProperty("--fc-event-contrast-color", "#f5f2eb");
    },
    eventContent(info) {
      const { color, glowStrength: strength, glowColor: eventGlow } = info.event.extendedProps;
      const glowClass = strength ? " calendar-event-dot--glow" : "";
      const contentGlowClass = strength ? " calendar-event-content--glow" : "";
      const glowStyle = strength ? `--glow-strength:${strength};--event-glow:${eventGlow};` : "";
      return { html: `<span class="calendar-event-content${contentGlowClass}" style="--event-color:${color};${glowStyle}"><i class="calendar-event-dot${glowClass}" style="--person-color:${color};${glowStyle}"></i><span>${escapeHtml(info.event.title)}</span></span>` };
    },
  });
  calendar.render();
}
function renderAll() { const events = allEvents(); renderPeople(); renderList(events); renderCalendar(events); }
function setView(view) {
  selectedView = view;
  syncViewVisibility();
}
function syncViewVisibility() {
  const showBoth = dualViewQuery.matches;
  const showList = showBoth || selectedView === "list";
  const showCalendar = showBoth || selectedView === "calendar";
  document.querySelector("#list-view").hidden = !showList;
  document.querySelector("#calendar-view").hidden = !showCalendar;
  document.querySelector("#show-list").classList.toggle("is-active", selectedView === "list");
  document.querySelector("#show-calendar").classList.toggle("is-active", selectedView === "calendar");
  document.querySelector("#show-list").setAttribute("aria-pressed", String(selectedView === "list"));
  document.querySelector("#show-calendar").setAttribute("aria-pressed", String(selectedView === "calendar"));
  document.querySelector("#view-range").textContent = showBoth ? `${upcomingRangeLabel} · Month view alongside` : selectedView === "list" ? upcomingRangeLabel : calendarRangeLabel;
  if (showCalendar) requestAnimationFrame(() => calendar?.updateSize());
}

const calendarRangeLabel = `${monthYear.format(windowRange.start)}—${monthYear.format(new Date(windowRange.end.getFullYear(), windowRange.end.getMonth(), 0))}`;
const upcomingRangeLabel = `${longDate.format(upcomingRange.start)}—${longDate.format(upcomingRange.end)}`;
document.querySelector("#view-range").textContent = upcomingRangeLabel;
document.querySelector("#fraction-strip").innerHTML = uniqueFractions().map(({ numerator, denominator }) => `<span><sup>${numerator}</sup><i></i><sub>${denominator}</sub></span>`).join("");
document.querySelector("#show-list").addEventListener("click", () => setView("list"));
document.querySelector("#show-calendar").addEventListener("click", () => setView("calendar"));
dualViewQuery.addEventListener("change", syncViewVisibility);
document.querySelector("#today-button").addEventListener("click", () => calendar?.today());
document.querySelector("#birthday-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get("name")).trim();
  const year = Number(data.get("year"));
  const month = Number(data.get("month"));
  const day = Number(data.get("day"));
  const color = String(data.get("color"));
  const milestoneMode = String(data.get("milestoneMode"));
  const candidate = new Date(year, month - 1, day, 12);
  const isValid = year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
  const error = document.querySelector("#birthday-error");
  if (!name || !isValid) { error.textContent = "Enter a valid birthday."; return; }
  error.textContent = "";
  const birthday = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (editingPersonId) {
    people = people.map((person) => person.id === editingPersonId ? { ...person, name, birthday, color, milestoneMode } : person);
  } else {
    people.push({ id: crypto.randomUUID(), name, birthday, color, milestoneMode });
  }
  savePeople(); resetForm(); renderAll();
});
function resetForm() {
  document.querySelector("#birthday-form").reset();
  document.querySelector("#birthday-error").textContent = "";
  editingPersonId = null;
  document.querySelector("#submit-birthday").textContent = "Add birthday";
  document.querySelector("#cancel-edit").hidden = true;
  document.querySelector("#person-color").value = nextAvailableColor();
}
document.querySelector("#cancel-edit").addEventListener("click", resetForm);
document.querySelector("#people-list").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-person]");
  if (editButton) {
    const person = people.find((item) => item.id === editButton.dataset.editPerson);
    if (!person) return;
    const birthday = parseBirthday(person.birthday);
    editingPersonId = person.id;
    document.querySelector("#person-name").value = person.name;
    document.querySelector("#person-color").value = person.color;
    document.querySelector("#birthday-month").value = birthday.month + 1;
    document.querySelector("#birthday-day").value = birthday.day;
    document.querySelector("#birthday-year").value = birthday.year;
    document.querySelector("#milestone-mode").value = person.milestoneMode || "fractional";
    document.querySelector("#submit-birthday").textContent = "Save changes";
    document.querySelector("#cancel-edit").hidden = false;
    document.querySelector("#person-name").focus();
    return;
  }
  const removeButton = event.target.closest("[data-remove-person]");
  if (!removeButton) return;
  people = people.filter((person) => person.id !== removeButton.dataset.removePerson);
  if (editingPersonId === removeButton.dataset.removePerson) resetForm();
  savePeople(); renderAll();
});
function configJson() {
  return JSON.stringify({ version: 2, birthdays: people.map(({ id, name, birthday, color, milestoneMode }) => ({ id, name, birthday, color, milestoneMode })) }, null, 2);
}
document.querySelector("#copy-config").addEventListener("click", async () => {
  const textarea = document.querySelector("#config-data");
  const status = document.querySelector("#config-status");
  textarea.value = configJson();
  try {
    await navigator.clipboard.writeText(textarea.value);
    status.textContent = "Configuration copied.";
  } catch {
    textarea.focus(); textarea.select(); document.execCommand("copy");
    status.textContent = "Configuration selected and copied.";
  }
});
function loadConfigText(rawConfig) {
  const textarea = document.querySelector("#config-data");
  const status = document.querySelector("#config-status");
  try {
    const normalizedConfig = normalizeConfigText(rawConfig);
    const parsed = JSON.parse(normalizedConfig);
    if (![1, 2].includes(parsed?.version) || !Array.isArray(parsed.birthdays)) throw new Error("Unsupported config");
    const ids = new Set();
    const imported = parsed.birthdays.map((item, index) => {
      const name = String(item?.name || "").trim();
      const birthday = String(item?.birthday || "");
      if (!name || !isValidBirthday(birthday)) throw new Error("Invalid birthday");
      let id = typeof item.id === "string" && item.id ? item.id : crypto.randomUUID();
      while (ids.has(id)) id = crypto.randomUUID();
      ids.add(id);
      const color = /^#[0-9a-f]{6}$/i.test(item.color) ? item.color.toLowerCase() : COLORS[index % COLORS.length];
      const milestoneMode = ["annual", "monthly", "fractional"].includes(item.milestoneMode) ? item.milestoneMode : item.wholeOnly ? "annual" : "fractional";
      return { id, name, birthday, color, milestoneMode };
    });
    people = imported;
    savePeople(); resetForm(); renderAll();
    textarea.value = normalizedConfig;
    status.textContent = `Loaded ${people.length} ${people.length === 1 ? "birthday" : "birthdays"}.`;
    return true;
  } catch {
    status.textContent = "That configuration is not valid.";
    return false;
  }
}
document.querySelector("#load-config").addEventListener("click", () => {
  loadConfigText(document.querySelector("#config-data").value);
});
document.querySelector("#load-family-config")?.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const status = document.querySelector("#config-status");
  status.textContent = "Loading family birthdays…";
  try {
    const response = await fetch("./family-birthdays.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Family config unavailable");
    loadConfigText(await response.text());
  } catch {
    status.textContent = "The family birthday file could not be loaded.";
  }
});
document.querySelector("#person-color").value = nextAvailableColor();
syncViewVisibility();
renderAll();
