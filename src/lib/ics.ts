/**
 * iCalendar (RFC 5545) generasiyası — Outlook / Google / Apple təqvimləri ilə uyğundur.
 * METHOD:REQUEST → təqvimə əlavə/yeniləmə, METHOD:CANCEL → ləğv.
 */
export type IcsEvent = {
  uid: string;
  sequence: number;
  method: "REQUEST" | "CANCEL" | "PUBLISH";
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  organizer: { email: string; name?: string };
  attendees: { email: string; name?: string | null }[];
  alarmMinutes?: number;
};

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 75 oktetlik sətir bükülməsi (UTF-8 simvolları bölünmədən) */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(e: IcsEvent): string {
  const cancel = e.method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Qarabag Universiteti//Kitabxana Rezervasiya//AZ",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `SEQUENCE:${e.sequence}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.start)}`,
    `DTEND:${fmt(e.end)}`,
    `SUMMARY:${esc(e.summary)}`,
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    e.location ? `LOCATION:${esc(e.location)}` : "",
    e.url ? `URL:${e.url}` : "",
    `ORGANIZER;CN=${esc(e.organizer.name ?? "QU Kitabxana")}:mailto:${e.organizer.email}`,
    ...e.attendees.map(
      (a) => `ATTENDEE;CN=${esc(a.name || a.email)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${a.email}`,
    ),
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(cancel || !e.alarmMinutes
      ? []
      : ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.summary)}`, `TRIGGER:-PT${e.alarmMinutes}M`, "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}
