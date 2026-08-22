// Fonte única da programação — usada por Schedule e ENTEC AO VIVO
// Edite apenas aqui. Horários em America/Sao_Paulo (BRT UTC-3).

export const EVENT_INFO = {
  name: "ENTEC 2026",
  subtitle: "Futuro conectado: como a tecnologia está redesenhando o mundo",
  supportText: "Dois dias de palestras, projetos e conexões que aproximam a sala de aula do futuro.",
  dates: "16 e 17 de setembro de 2026",
  datesShort: "16—17 SET 2026",
  location: "IFTO — Campus Araguatins",
  locationFull: "Instituto Federal de Educação, Ciência e Tecnologia do Tocantins — Campus Araguatins",
  city: "Araguatins — TO",
  address: "Povoado Santa Tereza, s/n, Zona Rural, Araguatins - TO, 77950-000",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=IFTO+Campus+Araguatins",
  mapsEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3950.0!2d-48.124!3d-5.65!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x92d9a5e1b3c4d5e6%3A0x7f8a9b0c1d2e3f4a!2sIFTO%20Campus%20Araguatins!5e0!3m2!1spt-BR!2sbr!4v1",
};

export const SCHEDULE = [
  {
    date: "2026-09-16",
    label: "DIA 1",
    dateLabel: "16 de setembro",
    items: [
      { start: "08:00", end: "08:30", activity: "Credenciamento e abertura oficial do ENTEC 2026" },
      { start: "08:30", end: "09:00", activity: "Coffee Break" },
      { start: "09:00", end: "10:30", activity: "Palestra: Inteligência Artificial, tecnologia e sociedade" },
      { start: "10:30", end: "12:00", activity: "Sorteios, dinâmicas e atividades interativas" },
    ],
  },
  {
    date: "2026-09-17",
    label: "DIA 2",
    dateLabel: "17 de setembro",
    items: [
      { start: "14:00", end: "16:30", activity: "Apresentação dos stands e projetos" },
      { start: "16:30", end: "17:00", activity: "Premiação dos stands vencedores" },
      { start: "17:00", end: "18:00", activity: "Encerramento oficial do ENTEC 2026" },
    ],
  },
];

// Compat: formato antigo usado por Schedule (time/activity) — derivado do novo
export const DAYS_LEGACY = SCHEDULE.map((d) => ({
  label: d.label,
  items: d.items.map((it) => ({ time: it.start, end: it.end, activity: it.activity })),
}));

function parseDateTime(dateStr, timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  // BRT UTC-3
  return new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-03:00`);
}

export function getEntecStatus(now = new Date()) {
  const allActivities = [];
  for (const day of SCHEDULE) {
    for (const item of day.items) {
      const start = parseDateTime(day.date, item.start);
      const end = parseDateTime(day.date, item.end);
      allActivities.push({ ...item, date: day.date, dayLabel: day.label, start, end });
    }
  }
  allActivities.sort((a, b) => a.start - b.start);
  if (allActivities.length === 0) return { phase: "before", allActivities };

  const firstStart = allActivities[0].start;
  const lastEnd = allActivities[allActivities.length - 1].end;

  if (now < firstStart) {
    return { phase: "before", allActivities, next: allActivities[0] };
  }
  if (now >= lastEnd) {
    return { phase: "ended", allActivities };
  }

  // Procura atividade atual
  const current = allActivities.find((a) => now >= a.start && now < a.end) || null;
  if (current) {
    const next = allActivities.find((a) => a.start > now) || null;
    // timeline do dia atual
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // Ajusta para BRT: compara pela data local de Brasília (aprox. usando -03:00)
    // Simplifica: encontra o dia que contém o horário atual
    const todayActivities = allActivities.filter((a) => now >= a.start && now <= a.end ? true : a.date === todayStr || (current && a.date === current.date));
    // fallback: usa as atividades do dia da atividade atual
    const dayActivities = current ? allActivities.filter((a) => a.date === current.date) : [];
    return { phase: "live", current, next, allActivities, dayActivities, todayActivities: dayActivities };
  }

  // Entre atividades (intervalo) ou entre dias
  const next = allActivities.find((a) => a.start > now) || null;
  // Verifica se ainda há atividades hoje
  const todayDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD em BRT
  const todayRemaining = allActivities.filter((a) => a.date === todayDateStr && a.start > now);
  if (todayRemaining.length === 0) {
    // Verifica se há algum dia futuro (amanhã)
    const hasFutureDay = allActivities.some((a) => a.start > now);
    if (hasFutureDay) {
      return { phase: "between_days", next, allActivities };
    }
  }
  // Intervalo entre atividades do mesmo dia
  const dayOfNext = next ? allActivities.filter((a) => a.date === next.date) : [];
  return { phase: "between", next, allActivities, dayActivities: dayOfNext };
}

export function formatTimeRange(start, end) {
  const fmt = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${fmt(start)} — ${fmt(end)}`;
}

export function minutesUntil(date, now = new Date()) {
  return Math.max(0, Math.round((date - now) / 60000));
}
