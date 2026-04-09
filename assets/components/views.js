import { getSession } from "../core/api.js";
import { displayNameOf, roleOf } from "../js/auth.js";
import { dashboardShell } from "./ui.js";
import { toast } from "./toast.js";
import { adminViews } from "../../page/admin/dashboard.js";
import { teacherViews } from "../../page/staff/dashboard.js";
import { studentViews } from "../../page/user/dashboard.js";

const themeKey = "sars_theme";

function viewSkeletonHtml() {
  return `
    <article class="card">
      <div class="skeleton-line w-40"></div>
      <div class="skeleton-line w-90"></div>
      <div class="skeleton-grid">
        <div class="skeleton-box"></div>
        <div class="skeleton-box"></div>
        <div class="skeleton-box"></div>
      </div>
    </article>
  `;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(themeKey, theme);
}

function initThemeToggle() {
  const saved = localStorage.getItem(themeKey) || "light";
  applyTheme(saved);
  document.getElementById("theme-toggle-btn")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    toast(`Appearance set to ${next}.`);
  });
}

export async function renderRoleDashboard(onLogout) {
  const session = getSession();
  const user = session?.user || {};
  const role = roleOf(user);
  const app = document.getElementById("app");

  const roleMap = {
    admin: {
      title: "Admin Dashboard",
      subtitle: "Monitor logs and platform health",
      nav: [
        { label: "Home", view: "overview" },
        { label: "Reports", view: "reports" },
        { label: "Settings", view: "settings" },
      ],
      views: adminViews,
    },
    teacher: {
      title: "Teacher Dashboard",
      subtitle: "Manage attendance sessions and announcements",
      nav: [
        { label: "Home", view: "tools" },
        { label: "Announcements", view: "announcements" },
        { label: "Reports", view: "reports" },
      ],
      views: teacherViews,
    },
    student: {
      title: "Student Dashboard",
      subtitle: "Track announcements and check-in attendance",
      nav: [
        { label: "Home", view: "panel" },
        { label: "Schedule", view: "schedule" },
        { label: "Attendance", view: "attendance" },
        { label: "Profile", view: "profile" },
      ],
      views: studentViews,
    },
  };

  const cfg = roleMap[role] || roleMap.student;
  app.innerHTML = dashboardShell({
    title: cfg.title,
    subtitle: cfg.subtitle,
    name: displayNameOf(user),
    role,
    nav: cfg.nav,
  });

  const viewRoot = document.getElementById("view-root");
  const navButtons = Array.from(document.querySelectorAll(".nav-link"));
  const renderView = async (viewName) => {
    const view = cfg.views[viewName] || cfg.views[cfg.nav[0].view];
    const activeBtn = navButtons.find((btn) => btn.dataset.view === viewName);
    navButtons.forEach((btn) => {
      const on = btn.dataset.view === viewName;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (activeBtn?.id) viewRoot?.setAttribute("aria-labelledby", activeBtn.id);
    viewRoot.innerHTML = viewSkeletonHtml();
    try {
      viewRoot.innerHTML = await view.html();
      viewRoot.classList.remove("view-enter");
      requestAnimationFrame(() => viewRoot.classList.add("view-enter"));
      await view.bind?.({ toast });
    } catch (err) {
      viewRoot.innerHTML = `
        <article class="card empty-state">
          <h3>Unable to load dashboard data</h3>
          <p class="muted">${err.message}</p>
          <button id="retry-view-btn" class="btn btn-outline" type="button">Retry</button>
        </article>
      `;
      document.getElementById("retry-view-btn")?.addEventListener("click", () => renderView(viewName));
    }
  };

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => renderView(btn.dataset.view));
  });

  await renderView(cfg.nav[0].view);
  initThemeToggle();
  document.getElementById("logout-btn")?.addEventListener("click", onLogout);
}
