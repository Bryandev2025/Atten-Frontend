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

registerRoute("/setup-password", ({ query } = {}) => {
  const app = document.getElementById("app");
  const token = String(query?.token || "").trim();
  app.innerHTML = `
    <section class="auth-wrap">
      <div class="auth-card">
        <form id="setup-password-form" class="auth-form">
          <div class="auth-form-header">
            <h2>Set Your Password</h2>
            <p>Create your account password to activate student login.</p>
          </div>
          <div>
            <label class="label" for="setup-password">Password</label>
            <input id="setup-password" class="input" name="password" type="password" required minlength="6" placeholder="Minimum 6 characters" />
          </div>
          <div>
            <label class="label" for="setup-password-confirmation">Confirm Password</label>
            <input id="setup-password-confirmation" class="input" name="password_confirmation" type="password" required minlength="6" placeholder="Repeat password" />
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%;">Set Password</button>
          <button id="setup-password-back-btn" class="btn btn-outline" type="button" style="width:100%;">Back to Sign In</button>
        </form>
      </div>
    </section>
  `;

  if (!token) {
    toast("Missing or invalid password setup token.", "error");
  }
  document.getElementById("setup-password-back-btn")?.addEventListener("click", () => go("/login"));
  document.getElementById("setup-password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!token) return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const submitBtn = form.querySelector('button[type="submit"]');
    try {
      submitBtn?.classList.add("is-loading");
      if (submitBtn) submitBtn.disabled = true;
      await api("/api/auth/student-invites/accept", {
        method: "POST",
        body: JSON.stringify({
          token,
          password: data.password,
          password_confirmation: data.password_confirmation,
        }),
      });
      toast("Password set successfully. You can now sign in.");
      go("/login");
    } catch (err) {
      toast(err.message || "Unable to set password.", "error");
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
    <section class="auth-wrap">
      <article class="card empty-state" style="max-width:400px;">
        <h3>Page not found</h3>
        <p class="muted">This route does not exist. Return to your dashboard from the login page.</p>
        <p style="margin-top:16px;"><button type="button" class="btn btn-primary" id="404-home-btn">Go to sign in</button></p>
      </article>
    </section>`;
  document.getElementById("404-home-btn")?.addEventListener("click", () => go(guard() ? "/dashboard" : "/login"));
});

window.addEventListener("sars:unauthorized", () => {
  toast("Session expired. Please sign in again.", "error");
  go("/login");
});

window.addEventListener("sars:loading", (event) => {
  const pending = Number(event?.detail?.pending || 0);
  const loadingEl = document.getElementById("global-loading");
  if (!loadingEl) return;
  const busy = pending > 0;
  loadingEl.classList.toggle("show", busy);
  loadingEl.setAttribute("aria-busy", busy ? "true" : "false");
  if (busy) startProgress();
  else finishProgress();
});

if (!location.hash) {
  go(guard() ? "/dashboard" : "/login");
}

startRouter();
