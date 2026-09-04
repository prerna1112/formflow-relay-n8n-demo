export const REQUIRED_FIELDS = ["fullName", "email", "requestType"];

export function validateSubmission(input) {
  const errors = {};
  for (const field of REQUIRED_FIELDS) {
    if (!String(input[field] ?? "").trim()) errors[field] = "Required";
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = "Enter a valid email";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function normalizeSubmission(input, now = new Date()) {
  return {
    submissionId: `FF-${now.getTime().toString().slice(-6)}`,
    receivedAt: now.toISOString(),
    fullName: String(input.fullName).trim(),
    email: String(input.email).trim().toLowerCase(),
    requestType: String(input.requestType).trim(),
    priority: input.requestType === "Urgent support" ? "High" : "Normal",
    notes: String(input.notes ?? "").trim() || "—",
    status: "Received"
  };
}

export function buildNotification(row) {
  return {
    to: "operations@example.com",
    subject: `[${row.priority}] New ${row.requestType} request — ${row.submissionId}`,
    body: `${row.fullName} (${row.email}) submitted a request at ${row.receivedAt}.`
  };
}

export function processSubmission(input, options = {}) {
  const validation = validateSubmission(input);
  if (!validation.valid) {
    return { ok: false, stage: "validation", errors: validation.errors };
  }
  if (options.simulateFailure) {
    return {
      ok: false,
      stage: "google-sheets",
      retryable: true,
      error: "Simulated Google Sheets timeout"
    };
  }
  const row = normalizeSubmission(input, options.now);
  return { ok: true, row, notification: buildNotification(row) };
}
