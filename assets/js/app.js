import { renderAuthShell } from "../components/ui.js";
import { toast } from "../components/toast.js";
import { renderRoleDashboard } from "../components/views.js";
import { getSession } from "../core/api.js";
import { go, registerRoute, startRouter } from "../core/router.js";
import { login, logout } from "./auth.js";

function guard() {
  return Boolean(getSession()?.token);
}

let progressValue = 0;
let progressTimer = null;

function setProgress(value) {
  const bar = document.getElementById("global-progress");
  if (!bar) return;
  progressValue = Math.max(0, Math.min(100, value));
  bar.style.width = `${progressValue}%`;
}

function startProgress() {
  const bar = document.getElementById("global-progress");
  if (!bar) return;
  bar.classList.add("show");
  if (progressTimer) clearInterval(progressTimer);
  if (progressValue < 10) setProgress(10);
  progressTimer = setInterval(() => {
    if (progressValue < 85) setProgress(progressValue + Math.max(1, (90 - progressValue) * 0.08));
  }, 120);
}

function finishProgress() {
  const bar = document.getElementById("global-progress");
  if (!bar) return;
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  setProgress(100);
  setTimeout(() => {
    bar.classList.remove("show");
    setProgress(0);
  }, 220);
}

registerRoute("/login", () => {
  if (guard()) return go("/dashboard");
  const app = document.getElementById("app");
  app.innerHTML = renderAuthShell();

  const form = document.getElementById("login-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const submitBtn = form.querySelector('button[type="submit"]');
    try {
      submitBtn?.classList.add("is-loading");
      if (submitBtn) submitBtn.disabled = true;
      const session = await login(data.email, data.password);
      toast(`Signed in as ${session.user?.full_name || session.user?.name || "User"}.`);
      go("/dashboard");
    } catch (err) {
      toast(err.message || "Unable to sign in.", "error");
    } finally {
      submitBtn?.classList.remove("is-loading");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});

registerRoute("/dashboard", async () => {
  if (!guard()) return go("/login");
  await renderRoleDashboard(() => {
    logout();
    toast("Signed out successfully.");
    go("/login");
  });
});

registerRoute("/404", () => {
  document.getElementById("app").innerHTML = `
    <section class="auth-wrap"><article class="card"><h3>Page not found</h3></article></section>
  `;
});

window.addEventListener("sars:unauthorized", () => {
  toast("Session expired. Please sign in again.", "error");
  go("/login");
});

window.addEventListener("sars:loading", (event) => {
  const pending = Number(event?.detail?.pending || 0);
  const loadingEl = document.getElementById("global-loading");
  if (!loadingEl) return;
  loadingEl.classList.toggle("show", pending > 0);
  if (pending > 0) startProgress();
  else finishProgress();
});

if (!location.hash) {
  go(guard() ? "/dashboard" : "/login");
}

startRouter();
