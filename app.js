import { processSubmission } from "./workflow.js";

const form = document.querySelector("#intake-form");
const runButton = document.querySelector("#run-workflow");
const simulateFailure = document.querySelector("#simulate-failure");
const statusPill = document.querySelector("#status-pill");
const nodes = [...document.querySelectorAll("[data-node]")];
const eventLog = document.querySelector("#event-log");
const sheetBody = document.querySelector("#sheet-body");
const emailPreview = document.querySelector("#email-preview");
const retryButton = document.querySelector("#retry-button");
const toast = document.querySelector("#toast");
let lastPayload = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setNode(name, state) {
  const node = nodes.find((item) => item.dataset.node === name);
  node.dataset.state = state;
  node.querySelector(".node-state").textContent = state;
}

function resetRun() {
  nodes.forEach((node) => setNode(node.dataset.node, "waiting"));
  eventLog.innerHTML = "";
  retryButton.hidden = true;
  emailPreview.classList.add("empty");
  emailPreview.innerHTML = "<span>No message generated yet.</span>";
}

function log(message, tone = "neutral") {
  const item = document.createElement("li");
  item.dataset.tone = tone;
  item.innerHTML = `<time>${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><span>${message}</span>`;
  eventLog.append(item);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

async function run(payload, failure = false) {
  resetRun();
  runButton.disabled = true;
  statusPill.dataset.tone = "running";
  statusPill.textContent = "Workflow running";

  setNode("trigger", "running");
  log("Google Forms webhook received a new submission.");
  await wait(450);
  setNode("trigger", "success");

  setNode("validate", "running");
  log("Checking required fields and email format.");
  await wait(500);
  const result = processSubmission(payload, { simulateFailure: failure });
  if (result.stage === "validation") {
    setNode("validate", "error");
    statusPill.dataset.tone = "error";
    statusPill.textContent = "Validation stopped run";
    Object.entries(result.errors).forEach(([field, message]) => {
      form.elements[field].closest("label").dataset.error = message;
    });
    log("Required information is missing. No Sheet row or email was created.", "error");
    runButton.disabled = false;
    return;
  }
  setNode("validate", "success");
  setNode("route", "running");
  log(`Conditional route selected: ${payload.requestType === "Urgent support" ? "high-priority" : "standard"}.`);
  await wait(420);
  setNode("route", "success");

  setNode("sheet", "running");
  log("Writing a normalized row to Google Sheets.");
  await wait(520);
  if (!result.ok) {
    setNode("sheet", "error");
    setNode("gmail", "blocked");
    statusPill.dataset.tone = "error";
    statusPill.textContent = "Execution failed safely";
    retryButton.hidden = false;
    log(`${result.error}. Error captured for retry; notification was not duplicated.`, "error");
    runButton.disabled = false;
    return;
  }
  setNode("sheet", "success");
  const row = result.row;
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${row.submissionId}</td><td>${row.fullName}</td><td>${row.requestType}</td><td><span class="priority ${row.priority.toLowerCase()}">${row.priority}</span></td><td>${row.status}</td>`;
  sheetBody.prepend(tr);

  setNode("gmail", "running");
  log("Preparing and sending the Gmail notification.");
  await wait(500);
  setNode("gmail", "success");
  emailPreview.classList.remove("empty");
  emailPreview.innerHTML = `<small>To</small><strong>${result.notification.to}</strong><small>Subject</small><strong>${result.notification.subject}</strong><p>${result.notification.body}</p>`;
  statusPill.dataset.tone = "success";
  statusPill.textContent = "Execution successful";
  log("Workflow completed without errors.", "success");
  showToast("Submission processed successfully");
  runButton.disabled = false;
}

form.addEventListener("input", (event) => {
  event.target.closest("label")?.removeAttribute("data-error");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  lastPayload = Object.fromEntries(new FormData(form));
  run(lastPayload, simulateFailure.checked);
});

retryButton.addEventListener("click", () => {
  simulateFailure.checked = false;
  run(lastPayload, false);
});
