import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/manrope";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  createIcons,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide";

import {
  searchPolicies,
  type SearchOptions,
} from "../../src/catalog/search.js";
import type { Policy } from "../../src/schema/policy.js";
import {
  learningConcepts,
  searchLearningConcepts,
  type LearningConcept,
} from "./learning.js";

import "./styles.css";

type DomainFilter = "all" | Policy["domain"];

const appRoot = document.querySelector<HTMLElement>("#app");

if (!appRoot) throw new Error("Application root not found");

const app: HTMLElement = appRoot;

let policies: Policy[] = [];
let matches: Policy[] = [];
let selectedPolicyId: string | undefined;
let query = new URLSearchParams(window.location.search).get("q") ?? "";
let domain = parseDomain(
  new URLSearchParams(window.location.search).get("domain"),
);

void initialize().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  app.innerHTML = `
    <main class="fatal-state">
      <i data-lucide="circle-alert"></i>
      <p class="eyebrow">Catalog unavailable</p>
      <h1>Retry Atlas could not start.</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  `;
  renderIcons();
});

async function initialize(): Promise<void> {
  const response = await fetch("./catalog.json");
  if (!response.ok) {
    throw new Error(`Catalog request failed with HTTP ${response.status}.`);
  }

  policies = (await response.json()) as Policy[];
  const requestedPolicy = new URLSearchParams(window.location.search).get(
    "policy",
  );
  selectedPolicyId =
    policies.find((policy) => policy.id === requestedPolicy)?.id ??
    policies[0]?.id;

  renderShell();
  applySearch(false);
}

function renderShell(): void {
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="./" aria-label="Retry Atlas home">
        <span class="brand-mark"><i data-lucide="activity"></i></span>
        <span>Retry Atlas</span>
      </a>
      <div class="topbar-actions">
        <button class="learning-trigger" type="button" aria-label="Retry basics" title="Retry basics">
          <i data-lucide="book-open"></i>
          <span>Retry basics</span>
        </button>
        <div class="catalog-status" aria-label="${policies.length} cited policies">
          <span class="status-light"></span>
          <span><strong>${policies.length}</strong><span class="status-label"> cited policies</span></span>
        </div>
      </div>
    </header>

    <main>
      <section class="query-panel" aria-labelledby="query-heading">
        <div class="query-copy">
          <p class="eyebrow">Failure decision catalog</p>
          <h1 id="query-heading">What failed?</h1>
        </div>
        <div class="search-controls">
          <div class="search-field">
            <i data-lucide="search"></i>
            <label class="sr-only" for="error-query">Error, status, or code</label>
            <input
              id="error-query"
              type="search"
              value="${escapeHtml(query)}"
              placeholder="503, ECONNRESET, expired token..."
              autocomplete="off"
              spellcheck="false"
            />
            <button class="clear-button" type="button" aria-label="Clear search" title="Clear search"${query ? "" : " hidden disabled"}>
              <i data-lucide="x"></i>
            </button>
          </div>
          <p class="search-thesis">
            <strong>Don’t retry blindly.</strong> Find out what failed first.
          </p>
          <div class="domain-filter" role="group" aria-label="Filter by domain">
            ${domainButton("all", "All")}
            ${domainButton("authentication", "Auth")}
            ${domainButton("http", "HTTP")}
            ${domainButton("network", "Network")}
          </div>
        </div>
      </section>

      <section class="workspace" aria-label="Retry policies">
        <aside class="results-pane" aria-labelledby="results-heading">
          <div class="pane-heading">
            <div>
              <p class="eyebrow">Matches</p>
              <h2 id="results-heading"><span id="result-count">0</span> <span id="result-label">policies</span></h2>
            </div>
            <span class="keyboard-hint"><kbd>/</kbd> focus</span>
          </div>
          <div id="concept-results" class="concept-results"></div>
          <div id="results" class="results-list"></div>
        </aside>
        <article id="policy-detail" class="detail-pane"></article>
      </section>
    </main>

    <dialog id="learning-dialog" class="learning-dialog" aria-labelledby="learning-title">
      <div class="learning-dialog-frame">
        <header class="learning-dialog-header">
          <div>
            <p class="eyebrow">Retry guidance</p>
            <h2 id="learning-title">Before you retry</h2>
          </div>
          <button class="learning-close" type="button" aria-label="Close retry basics" title="Close">
            <i data-lucide="x"></i>
          </button>
        </header>
        <div id="learning-content" class="learning-content"></div>
      </div>
    </dialog>

    <p id="app-status" class="sr-only" aria-live="polite"></p>

    <footer>
      <span>Retry guidance, not retry automation.</span>
      <span>Every decision links to its sources.</span>
    </footer>
  `;

  const input = document.querySelector<HTMLInputElement>("#error-query");
  input?.addEventListener("input", () => {
    query = input.value;
    updateClearButton();
    applySearch();
  });

  document.querySelector(".clear-button")?.addEventListener("click", () => {
    query = "";
    if (input) {
      input.value = "";
      input.focus();
    }
    updateClearButton();
    applySearch();
  });

  document
    .querySelectorAll<HTMLButtonElement>("[data-domain]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        domain = parseDomain(button.dataset.domain ?? null);
        updateDomainButtons();
        applySearch();
      });
    });

  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    if (
      event.key === "/" &&
      target?.tagName !== "INPUT" &&
      target?.tagName !== "TEXTAREA"
    ) {
      event.preventDefault();
      input?.focus();
    }
  });

  window.addEventListener("popstate", restoreFromUrl);
  bindLearningDialog();

  renderIcons();
}

function applySearch(updateHistory = true): void {
  const options: SearchOptions = { query };
  if (domain !== "all") options.domain = domain;

  matches = searchPolicies(policies, options);
  if (!matches.some((policy) => policy.id === selectedPolicyId)) {
    selectedPolicyId = matches[0]?.id;
  }

  renderConceptResults();
  renderResults();
  renderDetail();
  if (updateHistory) updateUrl();
}

function renderConceptResults(): void {
  const container = document.querySelector<HTMLElement>("#concept-results");
  if (!container) return;

  const concepts = searchLearningConcepts(query);
  if (concepts.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <section class="concept-match" aria-labelledby="concept-match-heading">
      <div class="concept-match-heading">
        <div>
          <p class="eyebrow">Concept guide</p>
          <h3 id="concept-match-heading">Learn the decision terms</h3>
        </div>
        <i data-lucide="book-open"></i>
      </div>
      ${concepts
        .map(
          (concept) => `
            <button type="button" data-learning-concept="${concept.id}">
              <strong>${escapeHtml(concept.title)}</strong>
              <span>${escapeHtml(concept.summary)}</span>
              <i data-lucide="chevron-right"></i>
            </button>
          `,
        )
        .join("")}
    </section>
  `;

  container
    .querySelectorAll<HTMLButtonElement>("[data-learning-concept]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const concept = learningConcepts.find(
          (candidate) => candidate.id === button.dataset.learningConcept,
        );
        if (concept) openLearningDialog(concept);
      });
    });
  renderIcons();
}

function renderResults(): void {
  const resultCount = document.querySelector("#result-count");
  const resultLabel = document.querySelector("#result-label");
  const results = document.querySelector<HTMLElement>("#results");
  if (!resultCount || !resultLabel || !results) return;

  resultCount.textContent = String(matches.length);
  resultLabel.textContent = matches.length === 1 ? "policy" : "policies";
  if (matches.length === 0) {
    const searchDescription = query
      ? `No cited policy matches “${escapeHtml(query)}”.`
      : "No cited policy matches these filters.";
    results.innerHTML = `
      <div class="empty-results">
        <i data-lucide="circle-alert"></i>
        <h3>No policy found</h3>
        <p>${searchDescription} Try a status, runtime code, or one of these catalog terms.</p>
        <div class="suggestions">
          ${suggestionButton("503")}
          ${suggestionButton("ECONNRESET")}
          ${suggestionButton("rate limited")}
        </div>
      </div>
    `;
    bindSuggestionButtons();
    renderIcons();
    return;
  }

  results.innerHTML = matches
    .map((policy, index) => {
      const selected = policy.id === selectedPolicyId;
      return `
        <button
          class="result-row${selected ? " is-selected" : ""}"
          type="button"
          data-policy-id="${policy.id}"
          aria-pressed="${selected}"
          style="--result-index: ${index}"
        >
          <span class="result-topline">
            <span class="domain-label">${formatLabel(policy.domain)}</span>
            <span class="decision-label decision-${policy.decision.retry}">${formatDecision(policy.decision.retry)}</span>
          </span>
          <strong>${escapeHtml(policy.title)}</strong>
          <span class="result-signals">${formatSignals(policy)}</span>
          <i data-lucide="chevron-right"></i>
        </button>
      `;
    })
    .join("");

  results
    .querySelectorAll<HTMLButtonElement>("[data-policy-id]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const previousPolicyId = selectedPolicyId;
        selectedPolicyId = button.dataset.policyId;
        renderResults();
        renderDetail();
        updateUrl(previousPolicyId === selectedPolicyId ? "replace" : "push");
        revealSelectedPolicy();
      });
    });
  renderIcons();
}

function renderDetail(): void {
  const detail = document.querySelector<HTMLElement>("#policy-detail");
  if (!detail) return;

  const policy = matches.find((candidate) => candidate.id === selectedPolicyId);
  if (!policy) {
    document.title = "Retry Atlas";
    detail.innerHTML = `
      <div class="detail-empty">
        <div class="empty-signal" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <p class="eyebrow">No decision loaded</p>
        <h2>Adjust the search to find a retry policy.</h2>
      </div>
    `;
    return;
  }

  document.title = `${policy.title} · Retry Atlas`;

  detail.innerHTML = `
    <header class="policy-header">
      <div class="policy-toolbar">
        <div class="policy-meta">
          <span>Domain: ${formatLabel(policy.domain)}</span>
          <span>Failure class: ${formatLabel(policy.classification)}</span>
          <code>${policy.id}</code>
        </div>
        <button class="copy-link" type="button" title="Copy a link to this policy">
          <i data-lucide="copy"></i>
          <span>Copy link</span>
        </button>
      </div>
      <div class="decision-banner decision-banner-${policy.decision.retry}">
        <span class="decision-icon">${decisionIcon(policy.decision.retry)}</span>
        <div class="decision-copy">
          <p class="eyebrow">${decisionVerdict(policy.decision.retry)}</p>
          <h2>${escapeHtml(policy.summary)}</h2>
          <p class="decision-why"><strong>Why:</strong> ${escapeHtml(policy.decision.rationale)}</p>
        </div>
        <span class="same-request">Retry same request: <strong>${policy.decision.retrySameRequest ? "yes" : "no"}</strong></span>
      </div>
      <h2 class="policy-title" tabindex="-1">${escapeHtml(policy.title)}</h2>
    </header>

    <div class="policy-body">
      <section class="detail-section diagnosis-section">
        <div class="section-heading">
          <i data-lucide="circle-alert"></i>
          <div>
            <p class="eyebrow">Understand the signal</p>
            <h3>Meaning and diagnosis</h3>
          </div>
        </div>
        <p class="diagnosis-meaning">${escapeHtml(policy.diagnosis.meaning)}</p>
        <div class="diagnostic-grid">
          <div>
            <h4>Common causes</h4>
            ${formatList(policy.diagnosis.commonCauses)}
          </div>
          <div>
            <h4>Checks</h4>
            ${formatList(policy.diagnosis.checks)}
          </div>
        </div>
      </section>

      <section class="detail-section resolution-section">
        <div class="section-heading">
          <i data-lucide="check"></i>
          <div>
            <p class="eyebrow">Owner: ${formatLabel(policy.resolution.owner)}</p>
            <h3>Resolution</h3>
          </div>
        </div>
        <div class="diagnostic-grid">
          <div>
            <h4>Immediate</h4>
            ${formatList(policy.resolution.immediate)}
          </div>
          <div>
            <h4>Long term</h4>
            ${formatList(policy.resolution.longTerm)}
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="section-heading">
          <i data-lucide="rotate-ccw"></i>
          <div>
            <p class="eyebrow">Before another attempt</p>
            <h3>What must change</h3>
          </div>
        </div>
        ${formatList(
          policy.decision.prerequisites.length > 0
            ? policy.decision.prerequisites
            : ["Nothing; follow the bounded strategy."],
        )}
      </section>

      ${formatStrategy(policy)}

      <section class="detail-section safety-section">
        <div class="section-heading">
          <i data-lucide="shield-check"></i>
          <div>
            <p class="eyebrow">Operational constraints</p>
            <h3>Safety</h3>
          </div>
        </div>
        <dl class="safety-grid">
          ${metric("Idempotency", policy.safety.idempotency)}
          ${metric("Duplicate risk", policy.safety.duplicateSideEffectRisk)}
          ${metric("Amplification", policy.safety.retryAmplificationRisk)}
          ${metric("Circuit breaker", policy.safety.circuitBreaker)}
        </dl>
        ${formatList(policy.safety.guidance)}
        ${policy.safety.reconciliation ? `<p class="reconciliation"><strong>Reconciliation:</strong> ${escapeHtml(policy.safety.reconciliation)}</p>` : ""}
      </section>

      <section class="detail-section telemetry-section">
        <div class="section-heading">
          <i data-lucide="activity"></i>
          <div>
            <p class="eyebrow">Instrument the outcome</p>
            <h3>Telemetry</h3>
          </div>
        </div>
        <div class="tag-list">${policy.telemetry.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}</div>
      </section>

      <section class="detail-section references-section">
        <div class="section-heading">
          <i data-lucide="book-open"></i>
          <div>
            <p class="eyebrow">Primary material</p>
            <h3>References</h3>
          </div>
        </div>
        <div class="reference-list">
          ${policy.references
            .map(
              (reference) => `
                <a href="${escapeHtml(reference.url)}" target="_blank" rel="noreferrer">
                  <span>${escapeHtml(reference.title)}</span>
                  <i data-lucide="arrow-up-right"></i>
                </a>
              `,
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
  bindCopyLink(detail);
  renderIcons();
}

function formatStrategy(policy: Policy): string {
  if (!policy.strategy) return "";

  const delay =
    policy.strategy.baseDelayMs === undefined
      ? "Server directed"
      : `${policy.strategy.baseDelayMs}–${policy.strategy.maxDelayMs ?? "?"} ms`;

  return `
    <section class="detail-section strategy-section">
      <div class="section-heading">
        <i data-lucide="clock-3"></i>
        <div>
          <p class="eyebrow">Bounded execution</p>
          <h3>Retry strategy</h3>
        </div>
      </div>
      <dl class="strategy-strip">
        ${metric("Mechanism", policy.strategy.mechanism)}
        ${metric("Maximum retries", String(policy.strategy.maxRetries))}
        ${metric("Delay window", delay, false)}
        ${metric("Jitter", policy.strategy.jitter ?? "not applicable")}
      </dl>
    </section>
  `;
}

function metric(label: string, value: string, humanize = true): string {
  const displayValue = humanize ? formatLabel(value) : escapeHtml(value);
  return `<div><dt>${escapeHtml(label)}</dt><dd>${displayValue}</dd></div>`;
}

function formatList(items: string[]): string {
  return `<ul class="guidance-list">${items
    .map(
      (item) =>
        `<li><span><i data-lucide="check"></i></span>${escapeHtml(item)}</li>`,
    )
    .join("")}</ul>`;
}

function formatSignals(policy: Policy): string {
  const signals = [
    ...(policy.signals.httpStatuses?.map(String) ?? []),
    ...(policy.signals.errorCodes ?? []),
  ];
  return signals.length > 0
    ? signals.map(escapeHtml).join(" · ")
    : "Text match";
}

function decisionIcon(decision: Policy["decision"]["retry"]): string {
  if (decision === "no") return '<i data-lucide="x"></i>';
  if (decision === "yes") return '<i data-lucide="check"></i>';
  return '<i data-lucide="circle-alert"></i>';
}

function formatDecision(decision: Policy["decision"]["retry"]): string {
  return decision === "conditional" ? "Conditional" : formatLabel(decision);
}

function decisionVerdict(decision: Policy["decision"]["retry"]): string {
  if (decision === "no") return "Do not retry";
  if (decision === "yes") return "Retry supported";
  return "Conditional";
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function domainButton(value: DomainFilter, label: string): string {
  const selected = domain === value;
  return `<button type="button" data-domain="${value}" aria-pressed="${selected}" class="${selected ? "is-active" : ""}">${label}</button>`;
}

function updateDomainButtons(): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-domain]")
    .forEach((button) => {
      const selected = button.dataset.domain === domain;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
}

function suggestionButton(value: string): string {
  return `<button type="button" data-suggestion="${escapeHtml(value)}">${escapeHtml(value)}</button>`;
}

function bindSuggestionButtons(): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-suggestion]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        query = button.dataset.suggestion ?? "";
        domain = "all";
        updateDomainButtons();
        const input = document.querySelector<HTMLInputElement>("#error-query");
        if (input) input.value = query;
        updateClearButton();
        applySearch();
      });
    });
}

function updateClearButton(): void {
  const button = document.querySelector<HTMLButtonElement>(".clear-button");
  if (!button) return;
  button.hidden = query.length === 0;
  button.disabled = query.length === 0;
}

function bindCopyLink(detail: HTMLElement): void {
  const button = detail.querySelector<HTMLButtonElement>(".copy-link");
  button?.addEventListener("click", async () => {
    try {
      await copyText(window.location.href);
      button.innerHTML = '<i data-lucide="check"></i><span>Link copied</span>';
      renderIcons();
      announce("Policy link copied.");
    } catch {
      button.textContent = "Copy failed";
      announce("Policy link could not be copied.");
    }
  });
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    if (!copied) throw new Error("Clipboard unavailable");
  }
}

function updateUrl(mode: "push" | "replace" = "replace"): void {
  const url = new URL(window.location.href);
  setSearchParameter(url, "q", query || undefined);
  setSearchParameter(url, "domain", domain === "all" ? undefined : domain);
  setSearchParameter(url, "policy", selectedPolicyId);
  window.history[`${mode}State`](null, "", url);
}

function restoreFromUrl(): void {
  const parameters = new URLSearchParams(window.location.search);
  query = parameters.get("q") ?? "";
  domain = parseDomain(parameters.get("domain"));
  selectedPolicyId = parameters.get("policy") ?? undefined;

  const input = document.querySelector<HTMLInputElement>("#error-query");
  if (input) input.value = query;
  updateClearButton();
  updateDomainButtons();
  applySearch(false);
}

function revealSelectedPolicy(): void {
  const detail = document.querySelector<HTMLElement>("#policy-detail");
  const heading = detail?.querySelector<HTMLElement>(".policy-title");
  const policy = matches.find((candidate) => candidate.id === selectedPolicyId);
  if (!detail || !heading || !policy) return;

  detail.scrollIntoView({ behavior: "auto", block: "start" });
  heading.focus({ preventScroll: true });
  announce(`${policy.title}. ${decisionVerdict(policy.decision.retry)}.`);
}

function bindLearningDialog(): void {
  const dialog = document.querySelector<HTMLDialogElement>("#learning-dialog");
  if (!dialog) return;

  document.querySelector(".learning-trigger")?.addEventListener("click", () => {
    openLearningDialog();
  });
  dialog.querySelector(".learning-close")?.addEventListener("click", () => {
    dialog.close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function openLearningDialog(concept?: LearningConcept): void {
  const dialog = document.querySelector<HTMLDialogElement>("#learning-dialog");
  const content = document.querySelector<HTMLElement>("#learning-content");
  const title = document.querySelector<HTMLElement>("#learning-title");
  if (!dialog || !content || !title) return;

  title.textContent = concept?.title ?? "Before you retry";
  content.innerHTML = concept
    ? formatLearningConcept(concept)
    : formatLearningOverview();
  bindLearningConceptButtons(content);
  renderIcons();
  if (!dialog.open) dialog.showModal();
}

function formatLearningOverview(): string {
  return `
    <p class="learning-lead">A retry is defensible only when another attempt can succeed without unacceptable duplicate effects or recovery load.</p>
    <ol class="decision-questions">
      <li><span>1</span><div><strong>Why did the first attempt fail?</strong><p>Locate the failure and decide how far the operation might have progressed.</p></div></li>
      <li><span>2</span><div><strong>What will change?</strong><p>Name the state change, server timing, or transient condition that makes another attempt useful.</p></div></li>
      <li><span>3</span><div><strong>Could it already have succeeded?</strong><p>Reconcile ambiguous mutations before replaying them.</p></div></li>
      <li><span>4</span><div><strong>Is the replay protected?</strong><p>Prove idempotency or use a stable operation ID and duplicate suppression.</p></div></li>
      <li><span>5</span><div><strong>Does it fit the budget?</strong><p>Keep attempts, delay, and downstream work inside one caller deadline.</p></div></li>
    </ol>
    <section class="learning-index" aria-labelledby="learning-index-title">
      <p class="eyebrow">Explore the vocabulary</p>
      <h3 id="learning-index-title">Retry concepts</h3>
      <div>
        ${learningConcepts
          .map(
            (item) =>
              `<button type="button" data-learning-concept="${item.id}">${escapeHtml(item.title)}<i data-lucide="chevron-right"></i></button>`,
          )
          .join("")}
      </div>
    </section>
  `;
}

function formatLearningConcept(concept: LearningConcept): string {
  return `
    <p class="learning-lead">${escapeHtml(concept.summary)}</p>
    <p class="learning-explanation">${escapeHtml(concept.explanation)}</p>
    <section class="learning-checks" aria-labelledby="learning-checks-title">
      <p class="eyebrow">Apply it</p>
      <h3 id="learning-checks-title">Questions to answer</h3>
      ${formatList(concept.checks)}
    </section>
    <section class="learning-references" aria-labelledby="learning-references-title">
      <p class="eyebrow">Primary material</p>
      <h3 id="learning-references-title">References</h3>
      ${concept.references
        .map(
          (reference) => `
            <a href="${escapeHtml(reference.url)}" target="_blank" rel="noreferrer">
              <span>${escapeHtml(reference.title)}</span>
              <i data-lucide="arrow-up-right"></i>
            </a>
          `,
        )
        .join("")}
    </section>
    <button class="learning-back" type="button" data-learning-overview>
      <i data-lucide="rotate-ccw"></i>
      <span>All retry concepts</span>
    </button>
  `;
}

function bindLearningConceptButtons(container: HTMLElement): void {
  container
    .querySelectorAll<HTMLButtonElement>("[data-learning-concept]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const concept = learningConcepts.find(
          (candidate) => candidate.id === button.dataset.learningConcept,
        );
        if (concept) openLearningDialog(concept);
      });
    });
  container
    .querySelector("[data-learning-overview]")
    ?.addEventListener("click", () => openLearningDialog());
}

function announce(message: string): void {
  const status = document.querySelector<HTMLElement>("#app-status");
  if (!status) return;
  status.textContent = "";
  window.setTimeout(() => {
    status.textContent = message;
  }, 0);
}

function setSearchParameter(
  url: URL,
  key: string,
  value: string | undefined,
): void {
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
}

function parseDomain(value: string | null): DomainFilter {
  if (value === "authentication" || value === "http" || value === "network") {
    return value;
  }
  return "all";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

function renderIcons(): void {
  createIcons({
    icons: {
      Activity,
      ArrowUpRight,
      BookOpen,
      Check,
      ChevronRight,
      CircleAlert,
      Clock3,
      Copy,
      RotateCcw,
      Search,
      ShieldCheck,
      X,
    },
    attrs: {
      "aria-hidden": "true",
      "stroke-width": "1.8",
    },
  });
}
