import { api, download } from "../../assets/core/api.js";
import { renderBarChart } from "../../assets/components/chart.js";
import { consumeUiFlash, rerenderView, setFormSubmitting, setInlineHint, setUiFlash } from "../../assets/components/form-ui.js";
import { sectionCard, statCards } from "../../assets/components/ui.js";

function listFrom(resp) {
  const payload = resp?.data ?? resp;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}


export async function adminOverviewHtml() {
  let users = [];
  let schoolYears = [];
  let classes = [];
  let logs = [];
  let reports = [];
  let announcements = [];
  let comments = [];
  let health = "unknown";
  let warning = "";
  try {
    const [usersResp, yearsResp, classesResp, logsResp, reportsResp, annsResp, commentsResp, healthResp] = await Promise.all([
      api("/api/admin/users"),
      api("/api/admin/school-years"),
      api("/api/admin/classes"),
      api("/api/admin/audit-logs"),
      api("/api/admin/absence-reports"),
      api("/api/admin/announcements"),
      api("/api/admin/announcement-comments"),
      api("/api/health"),
    ]);
    users = listFrom(usersResp);
    schoolYears = listFrom(yearsResp);
    classes = listFrom(classesResp);
    logs = listFrom(logsResp);
    reports = listFrom(reportsResp);
    announcements = listFrom(annsResp);
    comments = listFrom(commentsResp);
    health = healthResp?.ok ? "healthy" : "degraded";
  } catch (err) {
    warning = err.message || "Admin data unavailable.";
  }
  const flash = consumeUiFlash("admin");
  const flashOverview = flash?.view === "overview" ? flash : null;
  const pendingReports = reports.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
  const unpublishedAnnouncements = announcements.filter((item) => String(item.status || "").toLowerCase() !== "published").length;

  return `
    ${flashOverview?.message ? `<article class="card"><span class="badge ok">${flashOverview.message}</span></article>` : ""}
    ${warning ? `<article class="card"><p class="muted">API Notice: ${warning}</p></article>` : ""}
    ${statCards([
      { label: "Users", value: users.length },
      { label: "School Years", value: schoolYears.length },
      { label: "Classes", value: classes.length },
      { label: "Pending Reports", value: pendingReports },
      { label: "Draft Announcements", value: unpublishedAnnouncements },
      { label: "System Health", value: `<span class="badge ${health === "healthy" ? "ok" : "warn"}">${health}</span>` },
    ])}
    <div class="grid two">
      ${sectionCard({
        title: "Admin Command Center",
        subtitle: "Fast actions for common platform operations.",
        tools: `
          <button id="admin-refresh-overview-btn" class="btn btn-outline" type="button">Reload</button>
        `,
        body: `
          <div class="actions">
            <button id="admin-go-reports-btn" class="btn btn-primary" type="button">Go to Reports</button>
            <button id="admin-go-settings-btn" class="btn btn-outline" type="button">Go to Settings</button>
            <button id="admin-export-users-quick-btn" class="btn btn-outline" type="button">Export Users</button>
            <button id="admin-export-absence-quick-btn" class="btn btn-outline" type="button">Export Absence Reports</button>
          </div>
        `,
      })}
      ${sectionCard({
        title: "Moderation Queue Snapshot",
        subtitle: "Latest workload for admin review.",
        body: `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Count</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td>Absence Reports (Pending)</td><td>${pendingReports}</td><td><span class="badge ${pendingReports > 0 ? "warn" : "ok"}">${pendingReports > 0 ? "Needs Review" : "Clear"}</span></td></tr>
                <tr><td>Announcements (Unpublished)</td><td>${unpublishedAnnouncements}</td><td><span class="badge ${unpublishedAnnouncements > 0 ? "warn" : "ok"}">${unpublishedAnnouncements > 0 ? "Needs Review" : "Clear"}</span></td></tr>
                <tr><td>Comments (Recent total)</td><td>${comments.length}</td><td><span class="badge">Tracked</span></td></tr>
              </tbody>
            </table>
          </div>
        `,
      })}
    </div>
    <div class="grid two">
      ${sectionCard({
        title: "Users",
        tools: `
          <button id="admin-refresh-users-btn" class="btn btn-outline" type="button">Refresh</button>
          <button id="export-users-btn" class="btn btn-outline" type="button">Export CSV</button>
        `,
        body: `
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              ${users.slice(0, 10).map((item) => `
                <tr>
                  <td>${item.id ?? "-"}</td>
                  <td>${item.full_name || item.name || "-"}</td>
                  <td>${item.email || "-"}</td>
                  <td>${item.role?.name || item.role || "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `,
      })}
      ${sectionCard({
        title: "School Years",
        body: `
        <form id="admin-set-active-year-form" class="row">
          <select class="input" name="school_year_id" required ${schoolYears.length ? "" : "disabled"}>
          <option value="">Select a school year</option>
            ${schoolYears.map((item) => `<option value="${item.id}">${item.name || item.school_year || `SY #${item.id}`}</option>`).join("")}
          </select>
          <button class="btn btn-primary" type="submit">Set Active</button>
        </form>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Status</th></tr></thead>
            <tbody>
              ${schoolYears.slice(0, 10).map((item) => `
                <tr>
                  <td>${item.id ?? "-"}</td>
                  <td>${item.name || item.school_year || "-"}</td>
                  <td><span class="badge ${item.is_active ? "ok" : ""}">${item.is_active ? "active" : "inactive"}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `,
      })}
    </div>
    ${sectionCard({
      title: "Classes",
      body: `
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Class</th><th>School Year</th><th>Teacher</th></tr></thead>
          <tbody>
            ${classes.slice(0, 10).map((item) => `
              <tr>
                <td>${item.id ?? "-"}</td>
                <td>${item.class_name || item.name || "-"}</td>
                <td>${item.school_year?.name || item.school_year_id || "-"}</td>
                <td>${item.teacher?.full_name || item.teacher?.name || item.teacher_id || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      `,
    })}
    ${sectionCard({
      title: "Recent Audit Activity",
      subtitle: "Most recent admin actions captured by the system log.",
      body: `
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Action</th><th>Actor</th><th>When</th></tr></thead>
          <tbody>
            ${logs.slice(0, 10).map((item) => `
              <tr>
                <td>${item.id ?? "-"}</td>
                <td>${item.action || "-"}</td>
                <td>${item.user?.full_name || item.user?.name || item.user_id || "-"}</td>
                <td>${item.created_at || "-"}</td>
              </tr>
            `).join("") || '<tr><td colspan="4" class="muted">No audit activity found.</td></tr>'}
          </tbody>
        </table>
      </div>
      `,
    })}
  `;
}

export async function adminReportsHtml() {
  let reports = [];
  try {
    const res = await api("/api/admin/absence-reports");
    reports = listFrom(res);
  } catch {
    reports = [];
  }
  const flash = consumeUiFlash("admin");
  const flashReports = flash?.view === "reports" ? flash : null;
  return `
    <article class="card">
      <h3>Audit Action Trends</h3>
      <p class="muted">Visual breakdown of recent admin activities.</p>
      <div style="height:260px;">
        <canvas id="admin-audit-chart"></canvas>
      </div>
    </article>
    <article class="card">
      ${flashReports?.message ? `<p class="badge ok" style="margin-bottom:8px;">${flashReports.message}</p>` : ""}
      <div class="actions" style="justify-content:space-between;">
        <h3 style="margin:0;">Absence Reports</h3>
        <button id="admin-export-absence-btn" class="btn btn-outline" type="button">Export CSV</button>
      </div>
      <form id="admin-absence-action-form" class="row" style="margin-top:10px;">
        <select class="input" name="absence_report_id" required ${reports.length ? "" : "disabled"}>
          <option value="">Select an absence report</option>
          ${reports.map((item) => `<option value="${item.id}">#${item.id} - ${item.student?.full_name || item.student?.name || item.student_id || "Student"}</option>`).join("")}
        </select>
        <select class="select" name="decision">
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
        </select>
        <input class="input" name="reason" placeholder="Reason (optional)" />
        <button class="btn btn-primary" type="submit">Apply</button>
      </form>
      <p id="admin-absence-action-hint" class="muted"></p>
      <div class="table-wrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>ID</th><th>Student</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${reports.slice(0, 10).map((item) => `
              <tr style="${Number(item.id) === Number(flashReports?.absenceReportId) ? "background:var(--brand-soft);" : ""}">
                <td>${item.id ?? "-"}</td>
                <td>${item.student?.full_name || item.student?.name || item.student_id || "-"}</td>
                <td><span class="badge">${item.status || "-"}</span></td>
                <td>${item.absent_date || item.created_at || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

export async function adminSettingsHtml() {
  let announcements = [];
  let comments = [];
  let roles = [];
  try {
    const [aRes, cRes, roleRes] = await Promise.all([
      api("/api/admin/announcements"),
      api("/api/admin/announcement-comments"),
      api("/api/roles"),
    ]);
    announcements = listFrom(aRes);
    comments = listFrom(cRes);
    roles = listFrom(roleRes);
  } catch {
    announcements = [];
    comments = [];
    roles = [];
  }
  const flash = consumeUiFlash("admin");
  const flashSettings = flash?.view === "settings" ? flash : null;

  return `
    ${flashSettings?.message ? `<article class="card"><p class="badge ok">${flashSettings.message}</p></article>` : ""}
    <article class="card">
      <h3>Import Users</h3>
      <p class="muted">Uses POST /api/admin/users-import</p>
      <div class="actions">
        <input id="admin-users-import-file" class="input" type="file" accept=".csv,.xlsx,.xls" />
        <button id="admin-users-import-btn" class="btn btn-primary" type="button">Import</button>
      </div>
    </article>
    <div class="grid two">
      <article class="card">
        <h3>Create User</h3>
        <form id="admin-create-user-form" class="grid">
          <div class="row">
            <input class="input" name="first_name" placeholder="First Name" required />
            <input class="input" name="last_name" placeholder="Last Name" required />
          </div>
          <input class="input" name="email" type="email" placeholder="Email" required />
          <div class="row">
            <input class="input" name="password" type="password" placeholder="Password (min 6)" required />
            <select class="select" name="role_id" required>
              <option value="">Role</option>
              ${roles.map((r) => `<option value="${r.id}">${r.name}</option>`).join("")}
            </select>
          </div>
          <select class="select" name="status">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <button class="btn btn-primary" type="submit">Create User</button>
        </form>
      </article>
      <article class="card">
        <h3>Delete User</h3>
        <form id="admin-delete-user-form" class="row">
          <input class="input" name="user_id" type="number" placeholder="User ID" required />
          <button class="btn btn-danger" type="submit">Delete</button>
        </form>
      </article>
    </div>
    <div class="grid two">
      <article class="card">
        <h3>Create School Year</h3>
        <form id="admin-create-school-year-form" class="grid">
          <input class="input" name="name" placeholder="e.g. 2026-2027" required />
          <div class="row">
            <input class="input" name="start_date" type="date" required />
            <input class="input" name="end_date" type="date" required />
          </div>
          <label class="muted"><input id="admin-school-year-active" type="checkbox" /> set active</label>
          <button class="btn btn-primary" type="submit">Create School Year</button>
        </form>
      </article>
      <article class="card">
        <h3>Delete School Year</h3>
        <form id="admin-delete-school-year-form" class="row">
          <input class="input" name="school_year_id" type="number" placeholder="School Year ID" required />
          <button class="btn btn-danger" type="submit">Delete</button>
        </form>
      </article>
    </div>
    <div class="grid two">
      <article class="card">
        <h3>Create Class</h3>
        <form id="admin-create-class-form" class="grid">
          <div class="row">
            <input class="input" name="school_year_id" type="number" placeholder="School Year ID" required />
            <input class="input" name="teacher_id" type="number" placeholder="Teacher User ID" required />
          </div>
          <div class="row">
            <input class="input" name="class_name" placeholder="Class name" required />
            <input class="input" name="grade_level" placeholder="Grade level" required />
          </div>
          <input class="input" name="section" placeholder="Section" required />
          <textarea class="textarea" name="description" placeholder="Description (optional)"></textarea>
          <button class="btn btn-primary" type="submit">Create Class</button>
        </form>
      </article>
      <article class="card">
        <h3>Delete Class</h3>
        <form id="admin-delete-class-form" class="row">
          <input class="input" name="class_id" type="number" placeholder="Class ID" required />
          <button class="btn btn-danger" type="submit">Delete</button>
        </form>
      </article>
    </div>
    <div class="grid two">
      <article class="card">
        <h3>Announcements Moderation</h3>
        <form id="admin-delete-announcement-form" class="row">
          <select class="input" name="announcement_id" required ${announcements.length ? "" : "disabled"}>
            <option value="">Select an announcement</option>
            ${announcements.map((item) => `<option value="${item.id}">#${item.id} - ${item.title || "Untitled"}</option>`).join("")}
          </select>
          <button class="btn btn-danger" type="submit">Delete Announcement</button>
        </form>
        <p id="admin-delete-announcement-hint" class="muted"></p>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead><tr><th>ID</th><th>Title</th><th>Status</th></tr></thead>
            <tbody>
              ${announcements.slice(0, 10).map((item) => `
                <tr style="${Number(item.id) === Number(flashSettings?.announcementId) ? "background:var(--brand-soft);" : ""}">
                  <td>${item.id ?? "-"}</td>
                  <td>${item.title || "-"}</td>
                  <td><span class="badge">${item.status || "-"}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
      <article class="card">
        <h3>Comment Moderation</h3>
        <form id="admin-delete-comment-form" class="row">
          <select class="input" name="comment_id" required ${comments.length ? "" : "disabled"}>
            <option value="">Select a comment</option>
            ${comments.map((item) => `<option value="${item.id}">#${item.id} - ${(item.body || "").slice(0, 40)}</option>`).join("")}
          </select>
          <button class="btn btn-danger" type="submit">Delete Comment</button>
        </form>
        <p id="admin-delete-comment-hint" class="muted"></p>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead><tr><th>ID</th><th>Announcement</th><th>Comment</th></tr></thead>
            <tbody>
              ${comments.slice(0, 10).map((item) => `
                <tr style="${Number(item.id) === Number(flashSettings?.commentId) ? "background:var(--brand-soft);" : ""}">
                  <td>${item.id ?? "-"}</td>
                  <td>${item.class_announcement_id || item.announcement_id || "-"}</td>
                  <td>${item.body || "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  `;
}

export function bindAdminActions({ toast } = {}) {
  const exportBtn = document.getElementById("export-users-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      await download("/api/admin/users-export", "users-export.csv");
      toast?.("Users export downloaded.");
    });
  }
  document.getElementById("admin-refresh-users-btn")?.addEventListener("click", () => window.location.reload());
  document.getElementById("admin-refresh-overview-btn")?.addEventListener("click", () => {
    toast?.("Refreshing dashboard...");
    window.location.reload();
  });
  document.getElementById("admin-go-reports-btn")?.addEventListener("click", () => {
    rerenderView("reports");
    toast?.("Switched to the Reports tab.");
  });
  document.getElementById("admin-go-settings-btn")?.addEventListener("click", () => {
    rerenderView("settings");
    toast?.("Switched to the Settings tab.");
  });
  document.getElementById("admin-export-users-quick-btn")?.addEventListener("click", async () => {
    await download("/api/admin/users-export", "users-export.csv");
    toast?.("Users export downloaded.");
  });
  document.getElementById("admin-export-absence-quick-btn")?.addEventListener("click", async () => {
    await download("/api/admin/absence-reports-export", "absence-reports.csv");
    toast?.("Absence reports export downloaded.");
  });

  document.getElementById("admin-set-active-year-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!Number(data.school_year_id)) {
      toast?.("Select a school year first.", "error");
      return;
    }
    setFormSubmitting(e.currentTarget, true, "Setting...");
    try {
      await api(`/api/admin/school-years/${data.school_year_id}/set-active`, { method: "POST" });
      toast?.("School year set as active.");
      setUiFlash("admin", { view: "overview", message: "School year set as active." });
      rerenderView("overview");
    } catch (err) {
      toast?.(err.message || "Unable to set active school year.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });
}

export async function bindAdminReportChart({ toast } = {}) {
  let rows = [];
  try {
    const logs = await api("/api/admin/audit-logs");
    rows = listFrom(logs).slice(0, 14);
  } catch {
    rows = [];
  }
  const actionCounts = rows.reduce((acc, row) => {
    const key = row.action || "other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const labels = Object.keys(actionCounts);
  const values = Object.values(actionCounts);

  if (labels.length === 0) return;
  renderBarChart({
    id: "admin-audit-chart",
    labels,
    values,
    label: "Audit actions",
  });

  document.getElementById("admin-export-absence-btn")?.addEventListener("click", async () => {
    try {
      await download("/api/admin/absence-reports-export", "absence-reports.csv");
      toast?.("Absence reports export downloaded.");
    } catch (err) {
      toast?.(err.message || "Unable to export absence reports.", "error");
    }
  });

  document.getElementById("admin-absence-action-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("admin-absence-action-hint", "");
    if (!Number(data.absence_report_id)) {
      setInlineHint("admin-absence-action-hint", "Select an absence report first.");
      toast?.("Select an absence report first.", "error");
      return;
    }
    const endpoint = data.decision === "reject" ? "reject" : "approve";
    const absenceResult = endpoint === "reject" ? "rejected" : "approved";
    setFormSubmitting(e.currentTarget, true, "Applying...");
    try {
      await api(`/api/admin/absence-reports/${data.absence_report_id}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(data.reason ? { admin_remarks: data.reason } : {}),
      });
      toast?.(`Absence report ${absenceResult} successfully.`);
      setUiFlash("admin", {
        view: "reports",
        message: `Absence report ${absenceResult} successfully.`,
        absenceReportId: Number(data.absence_report_id),
      });
      rerenderView("reports");
    } catch (err) {
      toast?.(err.message || "Unable to apply absence report action.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });
}

export function bindAdminSettingsActions({ toast } = {}) {
  document.getElementById("admin-users-import-btn")?.addEventListener("click", async () => {
    const fileInput = document.getElementById("admin-users-import-file");
    const file = fileInput?.files?.[0];
    if (!file) return toast?.("Select a file first.", "error");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api("/api/admin/users-import", {
        method: "POST",
        headers: {},
        body: formData,
      });
      toast?.("User import submitted successfully.");
    } catch (err) {
      toast?.(err.message || "Unable to import users.", "error");
    }
  });

  document.getElementById("admin-create-user-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Creating...");
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          role_id: Number(data.role_id),
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          password: data.password,
          status: data.status,
        }),
      });
      toast?.("User created successfully.");
      setUiFlash("admin", { view: "settings", message: "User created successfully." });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to create user.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("admin-delete-user-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Deleting...");
    try {
      await api(`/api/admin/users/${data.user_id}`, { method: "DELETE" });
      toast?.("User deleted successfully.");
      setUiFlash("admin", { view: "settings", message: "User deleted successfully." });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to delete user.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("admin-create-school-year-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const isActive = Boolean(document.getElementById("admin-school-year-active")?.checked);
    setFormSubmitting(e.currentTarget, true, "Creating...");
    try {
      await api("/api/admin/school-years", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          start_date: data.start_date,
          end_date: data.end_date,
          is_active: isActive,
        }),
      });
      toast?.("School year created successfully.");
      setUiFlash("admin", { view: "settings", message: "School year created successfully." });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to create school year.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("admin-delete-school-year-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Deleting...");
    try {
      await api(`/api/admin/school-years/${data.school_year_id}`, { method: "DELETE" });
      toast?.("School year deleted successfully.");
      setUiFlash("admin", { view: "settings", message: "School year deleted successfully." });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to delete school year.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("admin-create-class-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Creating...");
    try {
      await api("/api/admin/classes", {
        method: "POST",
        body: JSON.stringify({
          school_year_id: Number(data.school_year_id),
          teacher_id: Number(data.teacher_id),
          class_name: data.class_name,
          grade_level: data.grade_level,
          section: data.section,
          description: data.description || null,
        }),
      });
      toast?.("Class created successfully.");
      setUiFlash("admin", { view: "settings", message: "Class created successfully." });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to create class.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("admin-delete-class-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Deleting...");
    try {
      await api(`/api/admin/classes/${data.class_id}`, { method: "DELETE" });
      toast?.("Class deleted successfully.");
      setUiFlash("admin", { view: "settings", message: "Class deleted successfully." });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to delete class.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("admin-delete-announcement-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("admin-delete-announcement-hint", "");
    if (!Number(data.announcement_id)) {
      setInlineHint("admin-delete-announcement-hint", "Select an announcement first.");
      toast?.("Select an announcement first.", "error");
      return;
    }
    setFormSubmitting(e.currentTarget, true, "Deleting...");
    try {
      await api(`/api/admin/announcements/${data.announcement_id}`, { method: "DELETE" });
      toast?.("Announcement deleted successfully.");
      setUiFlash("admin", {
        view: "settings",
        message: "Announcement deleted successfully.",
        announcementId: Number(data.announcement_id),
      });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to delete announcement.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("admin-delete-comment-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("admin-delete-comment-hint", "");
    if (!Number(data.comment_id)) {
      setInlineHint("admin-delete-comment-hint", "Select a comment first.");
      toast?.("Select a comment first.", "error");
      return;
    }
    setFormSubmitting(e.currentTarget, true, "Deleting...");
    try {
      await api(`/api/admin/announcement-comments/${data.comment_id}`, { method: "DELETE" });
      toast?.("Comment deleted successfully.");
      setUiFlash("admin", {
        view: "settings",
        message: "Comment deleted successfully.",
        commentId: Number(data.comment_id),
      });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to delete comment.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });
}

export const adminViews = {
  overview: { html: adminOverviewHtml, bind: bindAdminActions },
  reports: { html: adminReportsHtml, bind: bindAdminReportChart },
  settings: { html: adminSettingsHtml, bind: bindAdminSettingsActions },
};
