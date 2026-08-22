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
      <div class="catalog-status" aria-label="Catalog status">
        <span class="status-light"></span>
        <span><strong>${policies.length}</strong> cited policies</span>
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
          <div id="results" class="results-list"></div>
        </aside>
        <article id="policy-detail" class="detail-pane" aria-live="polite"></article>
      </section>
    </main>

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

  renderIcons();
}

function applySearch(updateHistory = true): void {
  const options: SearchOptions = { query };
  if (domain !== "all") options.domain = domain;

  matches = searchPolicies(policies, options);
  if (!matches.some((policy) => policy.id === selectedPolicyId)) {
    selectedPolicyId = matches[0]?.id;
  }

  renderResults();
  renderDetail();
  if (updateHistory) updateUrl();
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
        selectedPolicyId = button.dataset.policyId;
        renderResults();
        renderDetail();
        updateUrl();
        if (window.matchMedia("(max-width: 820px)").matches) {
          document
            .querySelector("#policy-detail")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  renderIcons();
}

function renderDetail(): void {
  const detail = document.querySelector<HTMLElement>("#policy-detail");
  if (!detail) return;

  const policy = matches.find((candidate) => candidate.id === selectedPolicyId);
  if (!policy) {
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
      <h2 class="policy-title">${escapeHtml(policy.title)}</h2>
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
    } catch {
      button.textContent = "Copy failed";
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

function updateUrl(): void {
  const url = new URL(window.location.href);
  setSearchParameter(url, "q", query || undefined);
  setSearchParameter(url, "domain", domain === "all" ? undefined : domain);
  setSearchParameter(url, "policy", selectedPolicyId);
  window.history.replaceState(null, "", url);
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
