/**
 * Hikvision HttpHost JSON (AccessControllerEvent) ni terminal otmetkasiga aylantiradi.
 * Hodim kodi harfli bo‘lishi mumkin (PMAND008) — raqamga kesilmaydi.
 */

export type TerminalIngestEvent = {
  employeeNo: string;
  direction?: "IN" | "OUT";
  photoBase64?: string | null;
};

const FACE_FAIL_SUB = new Set([76]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function eventNode(root: Record<string, unknown>): Record<string, unknown> | null {
  const kind = String(root.eventType ?? root.eventDescription ?? "").toLowerCase();
  if (kind.includes("heartbeat")) return null;
  const direct = asRecord(root.AccessControllerEvent);
  if (direct) return direct;
  const alert = asRecord(root.EventNotificationAlert);
  const nested = alert ? asRecord(alert.AccessControllerEvent) : null;
  if (nested) return nested;
  if (root.employeeNoString || root.employeeNo) return root;
  return null;
}

function pickPhoto(record: Record<string, unknown> | null): string | null {
  if (!record) return null;
  for (const key of ["picture", "picData", "facePic", "image"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 200) {
      return value.replace(/^data:image\/\w+;base64,/, "").trim();
    }
  }
  return null;
}

function directionOf(event: Record<string, unknown>): "IN" | "OUT" | undefined {
  const status = String(event.attendanceStatus ?? event.type ?? "").toLowerCase();
  if (status.includes("checkin") || status === "in") return "IN";
  if (status.includes("checkout") || status === "out") return "OUT";
  return undefined;
}

export function parseTerminalIngest(body: unknown): TerminalIngestEvent {
  if (typeof body === "string" && body.includes("<") && /employeeNo/i.test(body)) {
    return parseXmlEvent(body);
  }
  const root = typeof body === "string" ? asRecord(safeJson(body)) : asRecord(body);
  if (!root) return { employeeNo: "" };
  const event = eventNode(root);
  if (!event) return { employeeNo: "" };
  const sub = Number(event.subEventType ?? event.minor ?? 0);
  if (FACE_FAIL_SUB.has(sub)) return { employeeNo: "" };
  const employeeNo = String(event.employeeNoString ?? event.employeeNo ?? "").trim();
  return {
    employeeNo,
    direction: directionOf(event),
    photoBase64: pickPhoto(event) ?? pickPhoto(root)
  };
}

function xmlTag(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function parseXmlEvent(text: string): TerminalIngestEvent {
  const sub = Number(xmlTag(text, "subEventType") || xmlTag(text, "minor") || 0);
  if (FACE_FAIL_SUB.has(sub)) return { employeeNo: "" };
  const employeeNo = xmlTag(text, "employeeNoString") || xmlTag(text, "employeeNo");
  const status = xmlTag(text, "attendanceStatus").toLowerCase();
  let direction: "IN" | "OUT" | undefined;
  if (status.includes("checkin") || status === "in") direction = "IN";
  if (status.includes("checkout") || status === "out") direction = "OUT";
  return { employeeNo, direction };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** JSON va JPEG bitta tanada kelsa (multipart/mixed), faqat terminal kadrini oladi. */
export function parseTerminalIngestBuffer(body: Buffer): TerminalIngestEvent {
  const jpegAt = body.indexOf(Buffer.from([0xff, 0xd8]));
  const head = jpegAt > 0 ? body.subarray(0, jpegAt) : body;
  const text = head.toString("utf8");
  let parsed = parseTerminalIngest(text);
  if (!parsed.employeeNo) {
    const brace = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (brace >= 0 && end > brace) parsed = parseTerminalIngest(text.slice(brace, end + 1));
  }
  const photo = extractJpeg(body);
  if (photo && !parsed.photoBase64) parsed = { ...parsed, photoBase64: photo.toString("base64") };
  return parsed;
}

function extractJpeg(body: Buffer): Buffer | null {
  const start = body.indexOf(Buffer.from([0xff, 0xd8]));
  if (start < 0) return null;
  const end = body.lastIndexOf(Buffer.from([0xff, 0xd9]));
  if (end > start) return body.subarray(start, end + 2);
  if (body.length - start >= 2500) return body.subarray(start);
  return null;
}
