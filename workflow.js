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

// Deterministic stand-in for an Anthropic/Claude qualification node. In production,
// this contract is where a server-side Claude call would return structured output.
export function scoreLead(input) {
  const text = `${input.requestType ?? ""} ${input.notes ?? ""}`.toLowerCase();
  const signals = [
    ["implementation", 28], ["integration", 24], ["automation", 22],
    ["demo", 18], ["pricing", 14], ["urgent", 20], ["support", 10]
  ];
  const matched = signals.filter(([term]) => text.includes(term));
  const score = Math.min(99, 28 + matched.reduce((sum, [, weight]) => sum + weight, 0));
  const intent = score >= 70 ? "High-intent" : score >= 50 ? "Exploring" : "General inquiry";
  return {
    score,
    intent,
    priority: score >= 70 ? "High" : score >= 50 ? "Normal" : "Low",
    rationale: matched.length ? `Matched ${matched.map(([term]) => term).join(", ")}.` : "No high-intent signals detected.",
    tags: matched.slice(0, 3).map(([term]) => term)
  };
}

export function buildCrmUpdate(row, qualification) {
  const stage = qualification.score >= 70 ? "Sales qualified" : qualification.score >= 50 ? "Nurture" : "Needs review";
  return {
    stage,
    tags: [qualification.intent, ...qualification.tags],
    customFields: { leadScore: qualification.score, requestType: row.requestType },
    nextAction: qualification.score >= 70 ? "Create follow-up task within 1 hour" : "Send helpful follow-up sequence"
  };
}

export function routeLead(qualification) {
  return qualification.score >= 70 ? "sales-hot" : qualification.score >= 50 ? "nurture" : "review";
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
  const qualification = scoreLead(input);
  return {
    ok: true,
    row,
    notification: buildNotification(row),
    qualification,
    crmUpdate: buildCrmUpdate(row, qualification),
    leadRoute: routeLead(qualification)
  };
}
