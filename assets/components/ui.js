export function renderAuthShell() {
  return `
    <section class="auth-wrap">
      <div class="auth-card">
        <form id="login-form" class="auth-form">
          <div class="auth-form-header">
            <h2>MLGCL Portal Sign In</h2>
            <p>Welcome to MLGCL. Use your school account to continue.</p>
          </div>
          <div>
            <label class="label" for="login-email">Email</label>
            <input id="login-email" class="input" name="email" type="email" required autocomplete="email" placeholder="you@school.edu" />
          </div>
          <div>
            <label class="label" for="login-password">Password</label>
            <input id="login-password" class="input" name="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%;">Continue</button>
        </form>
      </div>
    </section>
  `;
}

export function dashboardShell({ title, subtitle, name, role, nav, quickStartTitle = "", quickStartItems = [] }) {
  const initials = String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";
  const roleLabel = role ? String(role).charAt(0).toUpperCase() + String(role).slice(1) : "User";

  const iconFor = (view) => {
    if (view.includes("overview") || view.includes("panel")) return "home";
    if (view.includes("report")) return "chart";
    if (view.includes("setting")) return "settings";
    if (view.includes("announcement")) return "megaphone";
    if (view.includes("attendance") || view.includes("tool")) return "clipboard";
    if (view.includes("schedule")) return "calendar";
    if (view.includes("profile")) return "user";
    return "dot";
  };

  const iconSvg = (kind) => {
    if (kind === "home") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>`;
    }
    if (kind === "chart") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16v2H2V3h2zM8 10h3v7H8zm5-4h3v11h-3zm5 6h3v5h-3z"/></svg>`;
    }
    if (kind === "settings") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.9 13.6.1-1.6-1.9-.8a7.6 7.6 0 0 0-.5-1.2l1-1.8-1.2-1.2-1.8 1a7.6 7.6 0 0 0-1.2-.5L14 3.1h-1.6l-.8 1.9a7.6 7.6 0 0 0-1.2.5l-1.8-1-1.2 1.2 1 1.8a7.6 7.6 0 0 0-.5 1.2l-1.9.8v1.6l1.9.8c.1.4.3.8.5 1.2l-1 1.8 1.2 1.2 1.8-1c.4.2.8.4 1.2.5l.8 1.9H14l.8-1.9c.4-.1.8-.3 1.2-.5l1.8 1 1.2-1.2-1-1.8c.2-.4.4-.8.5-1.2zM13 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>`;
    }
    if (kind === "megaphone") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v-2l12-5v14L4 14zm1 4h3l1 4H6zm13-9h2v10h-2z"/></svg>`;
    }
    if (kind === "clipboard") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h-2.2a3 3 0 0 0-5.6 0H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a4 4 0 0 1 4-4V5a2 2 0 0 0-2-2zM8 11h8v2H8zm0 4h5v2H8zm3-10a1 1 0 0 1 1 1h-2a1 1 0 0 1 1-1z"/></svg>`;
    }
    if (kind === "calendar") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8-4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>`;
    }
    if (kind === "user") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>`;
  };

  const tabButtons = nav
    .map(
      (item, i) => `
    <button
      type="button"
      role="tab"
      class="nav-link app-tab ${i === 0 ? "active" : ""}"
      data-view="${item.view}"
      id="dashboard-tab-${item.view}"
      aria-selected="${i === 0 ? "true" : "false"}"
      aria-controls="view-root"
    >
      <span class="app-tab-icon" aria-hidden="true">${iconSvg(iconFor(item.view))}</span>
      <span>${item.label}</span>
    </button>`,
    )
    .join("");
  const quickStartHtml = quickStartItems.length
    ? `
      <article class="card" style="margin-top:12px;">
        <h3 style="margin:0 0 8px;">${quickStartTitle || "Quick Start"}</h3>
        <div class="actions" style="gap:8px;flex-wrap:wrap;">
          ${quickStartItems.map((item) => `<span class="badge">${item}</span>`).join("")}
        </div>
      </article>
    `
    : "";

  return `
    <div class="app-shell">
      <div class="app-main">
        <header class="app-header">
          <div class="app-header-left">
            <div class="app-brand">
              <img class="app-brand-logo" src="./assets/img/mlgcl-logo.svg" alt="MLGCL logo" />
              <div>
                <div class="app-brand-title">MLGCL</div>
                <div class="app-brand-role">${roleLabel}</div>
              </div>
            </div>
            <div class="app-title-block">
              <p class="eyebrow">Dashboard</p>
              <h1>${title}</h1>
              <p class="tagline">${subtitle}</p>
            </div>
          </div>
          <div class="app-header-actions">
            <button id="help-btn" class="btn btn-outline" type="button" aria-haspopup="dialog" aria-controls="help-modal">Need Help?</button>
            <button id="help-reset-btn" class="btn btn-outline" type="button">Reset Help Tips</button>
            <button id="theme-toggle-btn" class="btn btn-outline" type="button" aria-label="Toggle light or dark theme">Theme</button>
            <span class="user-chip">
              <span class="avatar" aria-hidden="true">${initials}</span>
              <span>${name}</span>
            </span>
            <button id="logout-btn" class="btn btn-danger" type="button">Log out</button>
          </div>
        </header>
        <nav class="app-tabs" role="tablist" aria-label="Main sections">
          ${tabButtons}
        </nav>
        ${quickStartHtml}
        <div id="help-modal" class="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title" hidden>
          <div class="help-modal-backdrop" data-help-close="true"></div>
          <article class="help-modal-card">
            <div class="panel-header" style="margin-bottom:10px;">
              <h3 id="help-modal-title" class="panel-title">Portal Guide</h3>
              <button id="help-close-btn" class="btn btn-outline btn-xs" type="button">Close</button>
            </div>
            <div id="help-modal-content" class="help-modal-content"></div>
            <label class="help-modal-footer">
              <input id="help-dont-show-checkbox" type="checkbox" />
              <span>Don’t show this guide automatically next time</span>
            </label>
          </article>
        </div>
        <div id="view-root" class="app-view" role="tabpanel" tabindex="0"></div>
      </div>
    </div>
  `;
}

export function panelHeader(title, subtitle = "", toolsHtml = "", helpTitle = "", helpText = "") {
  const helpButton = helpText
    ? `<button
        type="button"
        class="btn btn-outline btn-xs section-help-btn"
        data-help-title="${String(helpTitle || title).replace(/"/g, "&quot;")}"
        data-help-text="${String(helpText).replace(/"/g, "&quot;")}"
        aria-label="Open help for ${String(title).replace(/"/g, "&quot;")}"
      >?</button>`
    : "";
  return `
    <div class="panel-header">
      <div>
        <h3 class="panel-title">${title}</h3>
        ${subtitle ? `<p class="panel-subtitle">${subtitle}</p>` : ""}
      </div>
      ${toolsHtml || helpButton ? `<div class="panel-tools">${helpButton}${toolsHtml}</div>` : ""}
    </div>
  `;
}

export function statCards(items = []) {
  return `
    <div class="grid stats">
      ${items
        .map(
          (item) => `
        <article class="card stat-card">
          <p class="muted stat-label">${item.label}</p>
          <div class="metric">${item.value}</div>
        </article>`,
        )
        .join("")}
    </div>
  `;
}

export function sectionCard({ title, subtitle = "", body = "", tools = "", helpTitle = "", helpText = "" }) {
  return `
    <article class="card">
      ${panelHeader(title, subtitle, tools, helpTitle, helpText)}
      ${body}
    </article>
  `;
}
