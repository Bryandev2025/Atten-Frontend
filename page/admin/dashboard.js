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

function featureTabsHtml({ idPrefix, tabs }) {
  const nav = tabs
    .map(
      (tab, index) => `
      <button
        type="button"
        class="feature-tab-btn ${index === 0 ? "active" : ""}"
        data-feature-tab="${idPrefix}:${tab.id}"
        aria-selected="${index === 0 ? "true" : "false"}"
        role="tab"
      >${tab.label}</button>
    `,
    )
    .join("");
  const panels = tabs
    .map(
      (tab, index) => `
      <section
        class="feature-tab-panel ${index === 0 ? "active" : ""}"
        data-feature-panel="${idPrefix}:${tab.id}"
        role="tabpanel"
      >
        ${tab.content}
      </section>
    `,
    )
    .join("");
  return `
    <div class="feature-tabs" data-feature-tabs="${idPrefix}">
      <nav class="feature-tab-nav" role="tablist">${nav}</nav>
      <div class="feature-tab-content">${panels}</div>
    </div>
  `;
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
        helpText: "Use these buttons for quick navigation and exports. Start with Reports for approvals, then go to Settings for setup tasks.",
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
        helpText: "This table shows pending review counts. If any row shows Needs Review, open the matching area and resolve items.",
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
        helpText: "This table shows recent users. Use the Settings tab for creating or deleting users.",
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
        helpText: "Set the active school year before class and attendance operations to avoid incorrect records.",
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
      helpText: "This is a snapshot of created classes and assigned advisers for the active setup.",
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
      helpText: "Use this as an activity trail to verify who changed what and when.",
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
  let atRiskStudents = [];
  try {
    const res = await api("/api/admin/absence-reports");
    reports = listFrom(res);
    atRiskStudents = Array.isArray(res?.summary?.at_risk_students) ? res.summary.at_risk_students : [];
  } catch {
    reports = [];
    atRiskStudents = [];
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
      <form id="admin-reports-filter-form" class="grid" style="margin-top:10px;">
        <div class="row">
          <select class="select" name="status">
            <option value="">Any status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input class="input" name="class_id" type="number" placeholder="Class ID" />
          <input class="input" name="student_id" type="number" placeholder="Student ID" />
        </div>
        <div class="row">
          <input class="input" name="from" type="date" />
          <input class="input" name="to" type="date" />
          <input class="input" name="search" placeholder="Search name, student #, reason" />
        </div>
        <div class="actions">
          <button class="btn btn-primary" type="submit">Apply Filters</button>
        </div>
      </form>
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
      <h3 style="margin-top:14px;">At-risk students</h3>
      <div class="table-wrap" style="margin-top:8px;">
        <table>
          <thead><tr><th>Student</th><th>Class</th><th>Recent Absences</th><th>Consecutive</th><th>Risk</th></tr></thead>
          <tbody>
            ${
              atRiskStudents.map((s) => `
                <tr>
                  <td>${s.student_name || "-"} ${s.student_number ? `<span class="muted">(${s.student_number})</span>` : ""}</td>
                  <td>${s.class_name || s.class_id || "-"}</td>
                  <td>${s.recent_absences ?? 0}</td>
                  <td>${s.consecutive_absences ?? 0}</td>
                  <td><span class="badge ${s.risk_level === "high" ? "warn" : ""}">${s.risk_level || "low"} (${s.risk_score ?? 0})</span></td>
                </tr>
              `).join("") || '<tr><td colspan="5" class="muted">No at-risk students found for current filter context.</td></tr>'
            }
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
  let programs = [];
  let classes = [];
  let users = [];
  let subjects = [];
  let schoolYears = [];
  let studentInvites = [];
  try {
    const [aRes, cRes, roleRes, pRes, classRes, userRes, sRes, yearsRes, invitesRes] = await Promise.all([
      api("/api/admin/announcements"),
      api("/api/admin/announcement-comments"),
      api("/api/roles"),
      api("/api/admin/programs").catch(() => ({ data: [] })),
      api("/api/admin/classes").catch(() => ({ data: [] })),
      api("/api/admin/users").catch(() => ({ data: [] })),
      api("/api/admin/subjects").catch(() => ({ data: [] })),
      api("/api/admin/school-years").catch(() => ({ data: [] })),
      api("/api/admin/student-invites").catch(() => ({ data: [] })),
    ]);
    announcements = listFrom(aRes);
    comments = listFrom(cRes);
    roles = listFrom(roleRes);
    programs = listFrom(pRes);
    classes = listFrom(classRes);
    users = listFrom(userRes);
    subjects = listFrom(sRes);
    schoolYears = listFrom(yearsRes);
    studentInvites = listFrom(invitesRes);
  } catch {
    announcements = [];
    comments = [];
    roles = [];
    schoolYears = [];
  }
  const teachers = users.filter((u) => String(u.role?.name || u.role || "").toLowerCase() === "teacher");
  const admins = users.filter((u) => String(u.role?.name || u.role || "").toLowerCase() === "admin");
  const students = users.filter((u) => String(u.role?.name || u.role || "").toLowerCase() === "student");
  const classNameOptions = [...new Set(classes.map((c) => String(c?.class_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const gradeLevelOptions = [...new Set(classes.map((c) => String(c?.grade_level || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sectionOptions = [...new Set(classes.map((c) => String(c?.section || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const programById = new Map(programs.map((p) => [Number(p.id), p]));
  const studentPrograms = {
    bsit: students.filter((u) => {
      const pid = Number(u?.student_profile?.school_class?.program_id || 0);
      return String(programById.get(pid)?.code || "").toLowerCase() === "it";
    }),
    educSocial: students.filter((u) => {
      const pid = Number(u?.student_profile?.school_class?.program_id || 0);
      return String(programById.get(pid)?.code || "").toLowerCase() === "ed_social";
    }),
    educMath: students.filter((u) => {
      const pid = Number(u?.student_profile?.school_class?.program_id || 0);
      return String(programById.get(pid)?.code || "").toLowerCase() === "ed_math";
    }),
    other: students.filter((u) => {
      const pid = Number(u?.student_profile?.school_class?.program_id || 0);
      const code = String(programById.get(pid)?.code || "").toLowerCase();
      return code !== "it" && code !== "ed_social" && code !== "ed_math";
    }),
  };
  const inviteStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "sent" || s === "accepted") return "ok";
    if (s === "failed" || s === "expired") return "warn";
    return "";
  };
  const flash = consumeUiFlash("admin");
  const flashSettings = flash?.view === "settings" ? flash : null;
  const sortedSubjects = [...subjects].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  const subjectGroups = {
    bsit: sortedSubjects.filter((s) => String(s.code || "").toUpperCase().startsWith("IT-")),
    educMath: sortedSubjects.filter((s) => String(s.code || "").toUpperCase().startsWith("EDM-")),
    educSocialStudies: sortedSubjects.filter((s) => String(s.code || "").toUpperCase().startsWith("EDS-")),
    uncategorized: sortedSubjects.filter((s) => {
      const code = String(s.code || "").toUpperCase();
      return !(code.startsWith("IT-") || code.startsWith("EDM-") || code.startsWith("EDS-"));
    }),
  };
  const renderSubjectRows = (rows = []) =>
    rows.map((s) => `
      <tr>
        <td>${s.id}</td>
        <td class="muted">${s.code || "-"}</td>
        <td>${s.name || "-"}</td>
        <td style="text-align:right;">
          <button class="btn btn-outline btn-xs" type="button" data-admin-delete-subject="${s.id}">Delete</button>
        </td>
      </tr>
    `).join("");
  const renderSubjectTable = (rows = [], emptyMessage = "No subjects in this group.") => `
    <div class="table-wrap" style="max-height:360px;overflow:auto;">
      <table>
        <thead><tr><th>ID</th><th>Code</th><th>Subject</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? renderSubjectRows(rows) : `<tr><td colspan="4" class="muted">${emptyMessage}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  const userManagementContent = `
    ${flashSettings?.message ? `<article class="card"><p class="badge ok">${flashSettings.message}</p></article>` : ""}
    <article class="card">
      <h3>Users by role</h3>
      <p class="muted">Browse users by role first, then filter students by program.</p>
      <div data-admin-user-tabs>
        <div class="actions" style="margin-bottom:8px;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-xs active" type="button" data-admin-user-tab="admin">Admin (${admins.length})</button>
          <button class="btn btn-outline btn-xs" type="button" data-admin-user-tab="teacher">Teacher (${teachers.length})</button>
          <button class="btn btn-outline btn-xs" type="button" data-admin-user-tab="student">Student (${students.length})</button>
        </div>
        <div data-admin-user-panel="admin">
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Status</th></tr></thead>
              <tbody>
                ${admins.map((u) => `<tr><td>${u.id}</td><td>${u.full_name || "-"}</td><td>${u.email || "-"}</td><td>${u.status || "-"}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">No admin users.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div data-admin-user-panel="teacher" style="display:none;">
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Status</th></tr></thead>
              <tbody>
                ${teachers.map((u) => `<tr><td>${u.id}</td><td>${u.full_name || "-"}</td><td>${u.email || "-"}</td><td>${u.status || "-"}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">No teacher users.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div data-admin-user-panel="student" style="display:none;">
          <div data-admin-student-program-tabs>
            <div class="actions" style="margin-bottom:8px;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-outline btn-xs active" type="button" data-admin-student-program-tab="bsit">BSIT (${studentPrograms.bsit.length})</button>
              <button class="btn btn-outline btn-xs" type="button" data-admin-student-program-tab="educSocial">EDUC Social Studies (${studentPrograms.educSocial.length})</button>
              <button class="btn btn-outline btn-xs" type="button" data-admin-student-program-tab="educMath">EDUC Math (${studentPrograms.educMath.length})</button>
              ${studentPrograms.other.length ? `<button class="btn btn-outline btn-xs" type="button" data-admin-student-program-tab="other">Other (${studentPrograms.other.length})</button>` : ""}
            </div>
            <div data-admin-student-program-panel="bsit">
              <div class="table-wrap">
                <table>
                  <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Class</th></tr></thead>
                  <tbody>
                    ${studentPrograms.bsit.map((u) => `<tr><td>${u.id}</td><td>${u.full_name || "-"}</td><td>${u.email || "-"}</td><td>${u.student_profile?.school_class?.class_name || "-"}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">No BSIT students.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
            <div data-admin-student-program-panel="educSocial" style="display:none;">
              <div class="table-wrap">
                <table>
                  <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Class</th></tr></thead>
                  <tbody>
                    ${studentPrograms.educSocial.map((u) => `<tr><td>${u.id}</td><td>${u.full_name || "-"}</td><td>${u.email || "-"}</td><td>${u.student_profile?.school_class?.class_name || "-"}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">No EDUC Social Studies students.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
            <div data-admin-student-program-panel="educMath" style="display:none;">
              <div class="table-wrap">
                <table>
                  <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Class</th></tr></thead>
                  <tbody>
                    ${studentPrograms.educMath.map((u) => `<tr><td>${u.id}</td><td>${u.full_name || "-"}</td><td>${u.email || "-"}</td><td>${u.student_profile?.school_class?.class_name || "-"}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">No EDUC Math students.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
            ${
              studentPrograms.other.length
                ? `<div data-admin-student-program-panel="other" style="display:none;">
                    <div class="table-wrap">
                      <table>
                        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Class</th></tr></thead>
                        <tbody>
                          ${studentPrograms.other.map((u) => `<tr><td>${u.id}</td><td>${u.full_name || "-"}</td><td>${u.email || "-"}</td><td>${u.student_profile?.school_class?.class_name || "-"}</td></tr>`).join("")}
                        </tbody>
                      </table>
                    </div>
                  </div>`
                : ""
            }
          </div>
        </div>
      </div>
    </article>
    <article class="card">
      <h3>Import Users</h3>
      <p class="muted">Uses POST /api/admin/users-import (CSV/TXT only, Laravel multipart upload)</p>
      <div class="upload-field">
        <input id="admin-users-import-file" class="upload-native-input" type="file" accept=".csv,.txt,text/csv,text/plain" />
        <label for="admin-users-import-file" class="btn btn-outline" role="button">Choose File</label>
        <span id="admin-users-import-name" class="upload-file-name muted">No file chosen</span>
        <button id="admin-users-import-clear" class="btn btn-outline" type="button">Remove</button>
      </div>
      <div class="actions" style="margin-top:10px;">
        <button id="admin-users-import-btn" class="btn btn-primary" type="button">Import</button>
      </div>
    </article>
    <article class="card">
      <h3>Bulk Create Students</h3>
      <p class="muted">Create many students in one go and automatically send password setup email invites.</p>
      <form id="admin-bulk-student-form" class="grid">
        <textarea
          class="textarea"
          name="rows"
          placeholder="Format (CSV or tab-separated):&#10;email,first_name,last_name&#10;juan.cruz@mlgcl.edu,Juan,Cruz&#10;ana.reyes@mlgcl.edu,Ana,Reyes"
          required
          style="min-height:170px;"
        ></textarea>
        <p class="field-hint">Tip: you may include a header row. Existing student emails are updated and re-invited. New students start as inactive until they set password.</p>
        <div class="actions">
          <button class="btn btn-primary" type="submit">Create</button>
        </div>
      </form>
      <div class="table-wrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>Student</th><th>Email</th><th>Status</th><th>Expires</th><th></th></tr></thead>
          <tbody>
            ${
              studentInvites.slice(0, 15).map((inv) => `
                <tr>
                  <td>${inv.user?.full_name || `${inv.user?.first_name || ""} ${inv.user?.last_name || ""}`.trim() || "-"}</td>
                  <td>${inv.email || inv.user?.email || "-"}</td>
                  <td><span class="badge ${inviteStatusBadge(inv.status)}">${inv.status || "-"}</span></td>
                  <td>${inv.expires_at || "-"}</td>
                  <td style="text-align:right;">
                    ${
                      ["pending", "sent", "failed", "expired"].includes(String(inv.status || "").toLowerCase())
                        ? `<button class="btn btn-outline btn-xs" type="button" data-admin-resend-student-invite="${inv.id}">Resend invite</button>`
                        : ""
                    }
                  </td>
                </tr>
              `).join("") || '<tr><td colspan="5" class="muted">No student invites yet.</td></tr>'
            }
          </tbody>
        </table>
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
          <select class="select" name="user_id" required ${users.length ? "" : "disabled"}>
            <option value="">Select user to delete</option>
            ${users.map((u) => `<option value="${u.id}">#${u.id} — ${u.full_name || u.email || "User"} (${u.role?.name || u.role || "-"})</option>`).join("")}
          </select>
          <button class="btn btn-danger" type="submit">Delete</button>
        </form>
      </article>
    </div>
  `;

  const schoolYearsContent = `
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
          <select class="select" name="school_year_id" required ${schoolYears.length ? "" : "disabled"}>
            <option value="">Select school year to delete</option>
            ${schoolYears.map((y) => `<option value="${y.id}">#${y.id} — ${y.name || y.school_year || `SY ${y.id}`}${y.is_active ? " (active)" : ""}</option>`).join("")}
          </select>
          <button class="btn btn-danger" type="submit">Delete</button>
        </form>
      </article>
    </div>
  `;

  const academicContent = `
    <article class="card">
      <h3>Academic structure</h3>
      <p class="muted">Programmes (IT, BSEd Math, BSEd Social Studies) and subjects are seeded; link classes to a programme and assign teachers to each subject.</p>
      <div class="grid two" style="margin-top:10px;">
        <div>
          <h4 style="margin:0 0 8px;">Add subject</h4>
          <form id="admin-create-subject-form" class="grid">
            <div class="row">
              <input class="input" name="code" placeholder="Code (optional) e.g. MATH101" />
              <input class="input" name="name" placeholder="Subject name" required />
            </div>
            <p class="field-hint">Use short codes by program: IT- (BSIT), EDM- (EDUC-MATH), EDS- (EDUC-SOCIAL STUDIES).</p>
            <textarea class="textarea" name="description" placeholder="Description (optional)"></textarea>
            <button class="btn btn-primary" type="submit">Save subject</button>
          </form>
          <p class="muted" style="font-size:12px;margin-top:8px;">This is dynamic: any subject you add here will instantly appear anywhere the app loads subjects.</p>
        </div>
        <div class="card" style="background:transparent;padding:0;border:none;">
          <p class="muted" style="margin:0;">Tip: you can delete a subject from the list. If it’s already used in assignments/timetables, the API may block deletion.</p>
        </div>
      </div>
      <div class="grid two" style="margin-top:10px;">
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Programme</th><th>Years</th></tr></thead>
            <tbody>
              ${programs.map((p) => `<tr><td>${p.id}</td><td>${p.name || p.code}</td><td>${p.duration_years || 4}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">No programmes.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div data-admin-subject-tabs>
          <div class="actions" style="margin-bottom:8px;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-xs active" type="button" data-admin-subject-tab="bsit">BSIT</button>
            <button class="btn btn-outline btn-xs" type="button" data-admin-subject-tab="educMath">EDUC-MATH</button>
            <button class="btn btn-outline btn-xs" type="button" data-admin-subject-tab="educSocialStudies">EDUC-SOCIAL STUDIES</button>
            ${subjectGroups.uncategorized.length ? '<button class="btn btn-outline btn-xs" type="button" data-admin-subject-tab="uncategorized">OTHER</button>' : ""}
          </div>
          <div data-admin-subject-panel="bsit">
            ${renderSubjectTable(subjectGroups.bsit, "No BSIT subjects.")}
          </div>
          <div data-admin-subject-panel="educMath" style="display:none;">
            ${renderSubjectTable(subjectGroups.educMath, "No EDUC-MATH subjects.")}
          </div>
          <div data-admin-subject-panel="educSocialStudies" style="display:none;">
            ${renderSubjectTable(subjectGroups.educSocialStudies, "No EDUC-SOCIAL STUDIES subjects.")}
          </div>
          ${
            subjectGroups.uncategorized.length
              ? `<div data-admin-subject-panel="uncategorized" style="display:none;">${renderSubjectTable(subjectGroups.uncategorized, "No uncategorized subjects.")}</div>`
              : ""
          }
        </div>
      </div>
      <p class="muted" style="font-size:12px;">Use Subject IDs when assigning teachers.</p>
    </article>
    <article class="card">
      <h3>Assign teacher to class subject</h3>
      <p class="muted">POST /api/admin/class-subject-teachers — each teacher may teach at most 3 <em>different</em> subjects per school year.</p>
      <form id="admin-assign-subject-teacher-form" class="grid">
        <div class="row">
          <select class="select" name="class_id" required ${classes.length ? "" : "disabled"}>
            <option value="">Class</option>
            ${classes.map((c) => `<option value="${c.id}">#${c.id} — ${c.class_name || c.section || "Class"} (${c.school_year?.name || "SY"})</option>`).join("")}
          </select>
          <select class="select" name="subject_id" required ${subjects.length ? "" : "disabled"}>
            <option value="">Subject</option>
            ${subjects.map((s) => `<option value="${s.id}">${s.code ? `${s.code} — ` : ""}${s.name}</option>`).join("")}
          </select>
          <select class="select" name="teacher_id" required ${teachers.length ? "" : "disabled"}>
            <option value="">Teacher</option>
            ${teachers.map((t) => `<option value="${t.id}">#${t.id} — ${t.full_name || t.name || t.email || "Teacher"}</option>`).join("")}
          </select>
        </div>
        <p class="field-hint">Pick one class, one subject, and one teacher. Use the IDs shown in the tables above if needed.</p>
        <button class="btn btn-primary" type="submit">Save assignment</button>
      </form>
    </article>
    <article class="card">
      <h3>Timetable slots</h3>
      <p class="muted">Create a weekly timetable row for a class. Subjects here come from the dynamic Admin subject list.</p>
      <form id="admin-create-timetable-slot-form" class="grid">
        <div class="row">
          <select id="admin-timetable-class" class="select" name="class_id" required ${classes.length ? "" : "disabled"}>
            <option value="">Class</option>
            ${classes.map((c) => `<option value="${c.id}">#${c.id} — ${c.class_name || c.section || "Class"} (${c.school_year?.name || "SY"})</option>`).join("")}
          </select>
          <select class="select" name="day_of_week" required>
            <option value="">Day</option>
            <option value="1">Mon</option>
            <option value="2">Tue</option>
            <option value="3">Wed</option>
            <option value="4">Thu</option>
            <option value="5">Fri</option>
            <option value="6">Sat</option>
            <option value="7">Sun</option>
          </select>
        </div>
        <div class="row">
          <input class="input" name="start_time" type="time" required />
          <input class="input" name="end_time" type="time" required />
          <input class="input" name="room" placeholder="Room (optional)" />
        </div>
        <div class="row">
          <select class="select" name="subject_id" required ${subjects.length ? "" : "disabled"}>
            <option value="">Subject</option>
            ${subjects.map((s) => `<option value="${s.id}">${s.code ? `${s.code} — ` : ""}${s.name}</option>`).join("")}
          </select>
          <select class="select" name="teacher_id" required ${teachers.length ? "" : "disabled"}>
            <option value="">Teacher</option>
            ${teachers.map((t) => `<option value="${t.id}">#${t.id} — ${t.full_name || t.name || t.email || "Teacher"}</option>`).join("")}
          </select>
        </div>
        <div class="actions">
          <button class="btn btn-primary" type="submit">Add timetable slot</button>
          <button id="admin-load-timetable-btn" class="btn btn-outline" type="button">Load timetable</button>
        </div>
      </form>
      <p id="admin-timetable-hint" class="muted"></p>
      <div id="admin-timetable-list" class="table-wrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>ID</th><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th></th></tr></thead>
          <tbody><tr><td colspan="7" class="muted">Select a class and click “Load timetable”.</td></tr></tbody>
        </table>
      </div>
    </article>
  `;

  const classesContent = `
    <div class="grid two">
      <article class="card">
        <h3>Create Class</h3>
        <form id="admin-create-class-form" class="grid">
          <div class="row">
            <select class="select" name="school_year_id" required ${schoolYears.length ? "" : "disabled"}>
              <option value="">School Year</option>
              ${schoolYears.map((y) => `<option value="${y.id}">#${y.id} — ${y.name || y.school_year || `SY ${y.id}`}${y.is_active ? " (active)" : ""}</option>`).join("")}
            </select>
            <select class="select" name="teacher_id" required ${teachers.length ? "" : "disabled"}>
              <option value="">Class Adviser (Teacher)</option>
              ${teachers.map((t) => `<option value="${t.id}">#${t.id} — ${t.full_name || t.name || t.email || "Teacher"}</option>`).join("")}
            </select>
          </div>
        <p class="field-hint">Pick the school year and class adviser from the lists instead of typing raw IDs.</p>
          <div class="row">
            <select class="select" name="program_id">
              <option value="">Program (optional)</option>
              ${programs.map((p) => `<option value="${p.id}">#${p.id} — ${p.name || p.code || "Program"}</option>`).join("")}
            </select>
            <select class="select" name="year_level">
              <option value="">Year level (optional)</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>
          <div class="row">
            <select class="select" name="class_name" required ${classNameOptions.length ? "" : "disabled"}>
              <option value="">Class name</option>
              ${classNameOptions.map((v) => `<option value="${v}">${v}</option>`).join("")}
            </select>
            <select class="select" name="grade_level" required ${gradeLevelOptions.length ? "" : "disabled"}>
              <option value="">Grade level label</option>
              ${gradeLevelOptions.map((v) => `<option value="${v}">${v}</option>`).join("")}
            </select>
          </div>
          <select class="select" name="section" required ${sectionOptions.length ? "" : "disabled"}>
            <option value="">Section</option>
            ${sectionOptions.map((v) => `<option value="${v}">${v}</option>`).join("")}
          </select>
          <textarea class="textarea" name="description" placeholder="Description (optional)"></textarea>
          <button class="btn btn-primary" type="submit">Create Class</button>
        </form>
      </article>
      <article class="card">
        <h3>Delete Class</h3>
        <form id="admin-delete-class-form" class="row">
          <select class="select" name="class_id" required ${classes.length ? "" : "disabled"}>
            <option value="">Select class to delete</option>
            ${
              classes.map((c) => `
                <option value="${c.id}">
                  #${c.id} — ${c.class_name || c.section || "Class"} (${c.school_year?.name || "SY"})${c.teacher?.full_name ? ` — Adviser: ${c.teacher.full_name}` : ""}
                </option>
              `).join("")
            }
          </select>
          <button class="btn btn-danger" type="submit">Delete</button>
        </form>
      </article>
    </div>
  `;

  const moderationContent = `
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

  return `
    ${featureTabsHtml({
      idPrefix: "admin-settings",
      tabs: [
        { id: "users", label: "User Management", content: userManagementContent },
        { id: "school-years", label: "School Years", content: schoolYearsContent },
        { id: "academic", label: "Academic Setup", content: academicContent },
        { id: "classes", label: "Classes", content: classesContent },
        { id: "moderation", label: "Moderation", content: moderationContent },
      ],
    })}
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

  document.getElementById("admin-create-subject-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Saving...");
    try {
      await api("/api/admin/subjects", {
        method: "POST",
        body: JSON.stringify({
          code: String(data.code || "").trim() || null,
          name: String(data.name || "").trim(),
          description: String(data.description || "").trim() || null,
        }),
      });
      toast?.("Subject saved.");
      setUiFlash("admin", { view: "settings", message: "Subject saved." });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to save subject.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.querySelectorAll("[data-admin-delete-subject]")?.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = Number(e.currentTarget?.getAttribute("data-admin-delete-subject"));
      if (!id) return;
      try {
        await api(`/api/admin/subjects/${id}`, { method: "DELETE" });
        toast?.("Subject deleted.");
        setUiFlash("admin", { view: "settings", message: "Subject deleted." });
        rerenderView("settings");
      } catch (err) {
        toast?.(err.message || "Unable to delete subject.", "error");
      }
    });
  });

  async function loadTimetableSlotsForSelectedClass() {
    const classId = Number(document.getElementById("admin-timetable-class")?.value);
    setInlineHint("admin-timetable-hint", "");
    if (!classId) {
      setInlineHint("admin-timetable-hint", "Select a class first.");
      return;
    }
    const wrap = document.getElementById("admin-timetable-list");
    if (!wrap) return;
    wrap.innerHTML = `
      <table>
        <thead><tr><th>ID</th><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th></th></tr></thead>
        <tbody><tr><td colspan="7" class="muted">Loading...</td></tr></tbody>
      </table>
    `;
    try {
      const res = await api(`/api/admin/timetable-slots?class_id=${classId}`);
      const rows = listFrom(res);
      const dayName = (d) => ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][Number(d) || 0] || "-";
      wrap.innerHTML = `
        <table>
          <thead><tr><th>ID</th><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th></th></tr></thead>
          <tbody>
            ${
              rows.map((r) => `
                <tr>
                  <td>${r.id ?? "-"}</td>
                  <td>${dayName(r.day_of_week)}</td>
                  <td class="muted">${r.start_time || "-"}–${r.end_time || "-"}</td>
                  <td>${r.subject?.name || r.subject_id || "-"}</td>
                  <td>${r.teacher?.full_name || r.teacher?.name || r.teacher_id || "-"}</td>
                  <td class="muted">${r.room || "-"}</td>
                  <td style="text-align:right;">
                    <button class="btn btn-outline btn-xs" type="button" data-admin-delete-slot="${r.id}">Delete</button>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="7" class="muted">No timetable slots for this class yet.</td></tr>`
            }
          </tbody>
        </table>
      `;
      wrap.querySelectorAll("[data-admin-delete-slot]")?.forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = Number(e.currentTarget?.getAttribute("data-admin-delete-slot"));
          if (!id) return;
          try {
            await api(`/api/admin/timetable-slots/${id}`, { method: "DELETE" });
            toast?.("Timetable slot deleted.");
            loadTimetableSlotsForSelectedClass();
          } catch (err) {
            toast?.(err.message || "Unable to delete slot.", "error");
          }
        });
      });
    } catch (err) {
      setInlineHint("admin-timetable-hint", err.message || "Unable to load timetable slots.");
    }
  }

  document.getElementById("admin-load-timetable-btn")?.addEventListener("click", loadTimetableSlotsForSelectedClass);
  document.getElementById("admin-timetable-class")?.addEventListener("change", loadTimetableSlotsForSelectedClass);

  document.getElementById("admin-create-timetable-slot-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("admin-timetable-hint", "");
    setFormSubmitting(e.currentTarget, true, "Saving...");
    try {
      await api("/api/admin/timetable-slots", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(data.class_id),
          day_of_week: Number(data.day_of_week),
          start_time: data.start_time,
          end_time: data.end_time,
          subject_id: Number(data.subject_id),
          teacher_id: Number(data.teacher_id),
          room: String(data.room || "").trim() || null,
        }),
      });
      toast?.("Timetable slot added.");
      loadTimetableSlotsForSelectedClass();
    } catch (err) {
      toast?.(err.message || "Unable to add timetable slot.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
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

  document.getElementById("admin-reports-filter-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const qs = new URLSearchParams();
    if (data.status) qs.set("status", String(data.status));
    if (data.class_id) qs.set("class_id", String(data.class_id));
    if (data.student_id) qs.set("student_id", String(data.student_id));
    if (data.from && data.to) {
      qs.set("from", String(data.from));
      qs.set("to", String(data.to));
    }
    if (data.search) qs.set("search", String(data.search));

    try {
      const res = await api(`/api/admin/absence-reports?${qs.toString()}`);
      const rows = listFrom(res).slice(0, 10);
      const atRiskRows = Array.isArray(res?.summary?.at_risk_students) ? res.summary.at_risk_students : [];

      const reportBody = document.querySelector("#admin-absence-action-form")
        ?.closest("article")
        ?.querySelector("table tbody");
      if (reportBody) {
        reportBody.innerHTML = rows.map((item) => `
          <tr>
            <td>${item.id ?? "-"}</td>
            <td>${item.student?.full_name || item.student?.name || item.student_id || "-"}</td>
            <td><span class="badge">${item.status || "-"}</span></td>
            <td>${item.absent_date || item.created_at || "-"}</td>
          </tr>
        `).join("") || '<tr><td colspan="4" class="muted">No absence reports match your filters.</td></tr>';
      }

      const riskBody = Array.from(document.querySelectorAll("article .table-wrap table tbody")).pop();
      if (riskBody) {
        riskBody.innerHTML = atRiskRows.map((s) => `
          <tr>
            <td>${s.student_name || "-"} ${s.student_number ? `<span class="muted">(${s.student_number})</span>` : ""}</td>
            <td>${s.class_name || s.class_id || "-"}</td>
            <td>${s.recent_absences ?? 0}</td>
            <td>${s.consecutive_absences ?? 0}</td>
            <td><span class="badge ${s.risk_level === "high" ? "warn" : ""}">${s.risk_level || "low"} (${s.risk_score ?? 0})</span></td>
          </tr>
        `).join("") || '<tr><td colspan="5" class="muted">No at-risk students found.</td></tr>';
      }
      toast?.("Report filters applied.");
    } catch (err) {
      toast?.(err.message || "Unable to apply report filters.", "error");
    }
  });
}

export function bindAdminSettingsActions({ toast } = {}) {
  document.querySelectorAll("[data-feature-tabs='admin-settings']").forEach((root) => {
    const buttons = Array.from(root.querySelectorAll("[data-feature-tab]"));
    const panels = Array.from(root.querySelectorAll("[data-feature-panel]"));
    const activate = (key) => {
      buttons.forEach((btn) => {
        const on = btn.getAttribute("data-feature-tab") === key;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      panels.forEach((panel) => {
        const on = panel.getAttribute("data-feature-panel") === key;
        panel.classList.toggle("active", on);
      });
    };
    buttons.forEach((btn) => btn.addEventListener("click", () => activate(btn.getAttribute("data-feature-tab"))));
  });
  document.querySelectorAll("[data-admin-subject-tabs]").forEach((root) => {
    const tabButtons = Array.from(root.querySelectorAll("[data-admin-subject-tab]"));
    const tabPanels = Array.from(root.querySelectorAll("[data-admin-subject-panel]"));
    const activateSubjectTab = (key) => {
      tabButtons.forEach((btn) => {
        const on = btn.getAttribute("data-admin-subject-tab") === key;
        btn.classList.toggle("active", on);
      });
      tabPanels.forEach((panel) => {
        panel.style.display = panel.getAttribute("data-admin-subject-panel") === key ? "" : "none";
      });
    };
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => activateSubjectTab(btn.getAttribute("data-admin-subject-tab")));
    });
  });
  document.querySelectorAll("[data-admin-user-tabs]").forEach((root) => {
    const tabButtons = Array.from(root.querySelectorAll("[data-admin-user-tab]"));
    const tabPanels = Array.from(root.querySelectorAll("[data-admin-user-panel]"));
    const activateUserTab = (key) => {
      tabButtons.forEach((btn) => {
        const on = btn.getAttribute("data-admin-user-tab") === key;
        btn.classList.toggle("active", on);
      });
      tabPanels.forEach((panel) => {
        panel.style.display = panel.getAttribute("data-admin-user-panel") === key ? "" : "none";
      });
    };
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => activateUserTab(btn.getAttribute("data-admin-user-tab")));
    });
  });
  document.querySelectorAll("[data-admin-student-program-tabs]").forEach((root) => {
    const tabButtons = Array.from(root.querySelectorAll("[data-admin-student-program-tab]"));
    const tabPanels = Array.from(root.querySelectorAll("[data-admin-student-program-panel]"));
    const activateProgramTab = (key) => {
      tabButtons.forEach((btn) => {
        const on = btn.getAttribute("data-admin-student-program-tab") === key;
        btn.classList.toggle("active", on);
      });
      tabPanels.forEach((panel) => {
        panel.style.display = panel.getAttribute("data-admin-student-program-panel") === key ? "" : "none";
      });
    };
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => activateProgramTab(btn.getAttribute("data-admin-student-program-tab")));
    });
  });

  const importFileInput = document.getElementById("admin-users-import-file");
  const importFileName = document.getElementById("admin-users-import-name");
  const importClearBtn = document.getElementById("admin-users-import-clear");
  const syncImportFileName = () => {
    if (!importFileName) return;
    const file = importFileInput?.files?.[0];
    importFileName.textContent = file?.name || "No file chosen";
  };
  importFileInput?.addEventListener("change", syncImportFileName);
  importClearBtn?.addEventListener("click", () => {
    if (importFileInput) importFileInput.value = "";
    syncImportFileName();
  });
  syncImportFileName();

  document.getElementById("admin-users-import-btn")?.addEventListener("click", async () => {
    const file = importFileInput?.files?.[0];
    if (!file) return toast?.("Select a file first.", "error");
    const fileName = String(file.name || "").toLowerCase();
    const isAllowed = fileName.endsWith(".csv") || fileName.endsWith(".txt");
    if (!isAllowed) {
      toast?.("Invalid file type. Upload a .csv or .txt file.", "error");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api("/api/admin/users-import", {
        method: "POST",
        body: formData,
      });
      toast?.("User import submitted successfully.");
      if (importFileInput) importFileInput.value = "";
      syncImportFileName();
    } catch (err) {
      toast?.(err.message || "Unable to import users.", "error");
    }
  });
  document.getElementById("admin-bulk-student-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const rawRows = String(data.rows || "").trim();
    if (!rawRows) return toast?.("Paste at least one student line.", "error");

    const lines = rawRows
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return toast?.("No valid student lines found.", "error");
    const separators = [",", "\t", "|"];
    const pickParts = (line) => {
      for (const sep of separators) {
        const p = line.split(sep).map((s) => s.trim());
        if (p.length >= 3) return p;
      }
      return [line];
    };
    const maybeHeader = pickParts(lines[0]).map((s) => s.toLowerCase());
    const hasHeader = maybeHeader.includes("email") && maybeHeader.includes("first_name");
    const dataLines = hasHeader ? lines.slice(1) : lines;
    if (!dataLines.length) return toast?.("No student rows found after header.", "error");

    const rowErrors = [];
    const rows = [];
    dataLines.forEach((line, idx) => {
      const parts = pickParts(line);
      const [email = "", firstName = "", lastName = ""] = parts;
      if (!email || !firstName || !lastName) {
        rowErrors.push(`Line ${idx + 1} is incomplete.`);
        return;
      }
      rows.push({
        email,
        first_name: firstName,
        last_name: lastName,
      });
    });
    if (rowErrors.length) {
      toast?.(rowErrors.slice(0, 3).join(" ") + (rowErrors.length > 3 ? " ..." : ""), "error");
      return;
    }

    setFormSubmitting(form, true, "Creating...");
    try {
      const res = await api("/api/admin/student-invites/bulk-create", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      const created = Number(res?.created || 0);
      const updated = Number(res?.updated || 0);
      const sent = Number(res?.invites_sent || 0);
      const failures = Number(res?.invite_failures || 0);
      const errors = Array.isArray(res?.errors) ? res.errors.length : 0;
      toast?.(`Created: ${created}, Updated: ${updated}, Sent: ${sent}, Failed: ${failures}, Errors: ${errors}.`);
      setUiFlash("admin", { view: "settings", message: `Bulk student creation finished. Invites sent: ${sent}, failed: ${failures}.` });
      rerenderView("settings");
    } catch (err) {
      toast?.(err.message || "Unable to bulk create students.", "error");
    } finally {
      setFormSubmitting(form, false);
    }
  });
  document.querySelectorAll("[data-admin-resend-student-invite]")?.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const inviteId = Number(e.currentTarget?.getAttribute("data-admin-resend-student-invite"));
      if (!inviteId) return;
      try {
        await api(`/api/admin/student-invites/${inviteId}/resend`, { method: "POST" });
        toast?.("Student invite resent.");
        setUiFlash("admin", { view: "settings", message: "Student invite resent." });
        rerenderView("settings");
      } catch (err) {
        toast?.(err.message || "Unable to resend invite.", "error");
      }
    });
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

  document.getElementById("admin-assign-subject-teacher-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Saving...");
    try {
      await api("/api/admin/class-subject-teachers", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(data.class_id),
          subject_id: Number(data.subject_id),
          teacher_id: Number(data.teacher_id),
        }),
      });
      toast?.("Subject teacher assignment saved successfully.");
      e.currentTarget.reset();
    } catch (err) {
      toast?.(err.message || "Unable to save assignment.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("admin-create-class-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Creating...");
    try {
      const payload = {
        school_year_id: Number(data.school_year_id),
        teacher_id: Number(data.teacher_id),
        class_name: data.class_name,
        grade_level: data.grade_level,
        section: data.section,
        description: data.description || null,
      };
      if (Number(data.program_id)) payload.program_id = Number(data.program_id);
      if (Number(data.year_level)) payload.year_level = Number(data.year_level);
      await api("/api/admin/classes", {
        method: "POST",
        body: JSON.stringify(payload),
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
