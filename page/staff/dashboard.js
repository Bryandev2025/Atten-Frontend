import { api, download } from "../../assets/core/api.js";
import { renderBarChart } from "../../assets/components/chart.js";
import { consumeUiFlash, rerenderView, setFormSubmitting, setInlineHint, setUiFlash } from "../../assets/components/form-ui.js";
import { sectionCard } from "../../assets/components/ui.js";

let teacherReportsRefreshId = null;
function listFrom(resp) {
  const payload = resp?.data ?? resp;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function calendarMonthDayRange(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return { from: `${yyyy}-${mm}-01`, to: `${yyyy}-${mm}-31` };
}

async function runTeacherAttendanceCsvExport(toast, params) {
  const q = new URLSearchParams(params);
  try {
    await download(`/api/teacher/attendance-export?${q.toString()}`, "attendance-export.csv");
    toast?.("Attendance export downloaded.");
  } catch (err) {
    toast?.(err.message || "Unable to export attendance.", "error");
  }
}

function jumpTo(selector, focusSelector) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("jump-highlight");
  window.setTimeout(() => target.classList.remove("jump-highlight"), 1200);
  if (focusSelector) {
    const field = document.querySelector(focusSelector);
    field?.focus();
  }
}


export async function teacherOverviewHtml() {
  let classes = [];
  let announcements = [];
  let comments = [];
  let absenceReports = [];
  let warning = "";
  try {
    const [classesResp, annsResp, commentsResp, reportsResp] = await Promise.all([
      api("/api/teacher/classes"),
      api("/api/teacher/announcements"),
      api("/api/teacher/announcement-comments"),
      api("/api/teacher/absence-reports"),
    ]);
    classes = listFrom(classesResp);
    announcements = listFrom(annsResp);
    comments = listFrom(commentsResp);
    absenceReports = listFrom(reportsResp);
  } catch (err) {
    warning = err.message || "Some teacher dashboard data is unavailable.";
  }

  const drafts = announcements.filter((item) => String(item.status || "").toLowerCase() !== "published").length;
  const pendingReports = absenceReports.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
  const recentTimeline = [
    ...absenceReports.slice(0, 4).map((item) => ({
      type: "Absence Report",
      message: `Report #${item.id || "-"} for ${item.student?.full_name || item.student?.name || "Student"}`,
      when: item.created_at || item.absent_date || "-",
      status: item.status || "pending",
    })),
    ...announcements.slice(0, 4).map((item) => ({
      type: "Announcement",
      message: item.title || `Announcement #${item.id || "-"}`,
      when: item.updated_at || item.created_at || "-",
      status: item.status || "draft",
    })),
  ].slice(0, 8);

  const classCards = classes.slice(0, 6).map((item) => {
    const classAnns = announcements.filter((a) => Number(a.class_id) === Number(item.id));
    const classDrafts = classAnns.filter((a) => String(a.status || "").toLowerCase() !== "published").length;
    return `
      <article class="card">
        <h3>${item.class_name || item.name || `Class #${item.id || "-"}`}</h3>
        <p class="muted">School Year: ${item.school_year?.name || item.school_year_id || "-"}</p>
        <div class="actions">
          <span class="badge">Announcements: ${classAnns.length}</span>
          <span class="badge ${classDrafts > 0 ? "warn" : "ok"}">Drafts: ${classDrafts}</span>
        </div>
      </article>
    `;
  }).join("");

  return `
    ${warning ? `<article class="card"><p class="muted">API Notice: ${warning}</p></article>` : ""}
    <div class="grid stats">
      <article class="card stat-card"><p class="muted stat-label">My Classes</p><div class="metric">${classes.length}</div></article>
      <article class="card stat-card"><p class="muted stat-label">Draft Announcements</p><div class="metric">${drafts}</div></article>
      <article class="card stat-card"><p class="muted stat-label">Pending Absence Reviews</p><div class="metric">${pendingReports}</div></article>
      <article class="card stat-card"><p class="muted stat-label">Comments Needing Review</p><div class="metric">${comments.length}</div></article>
    </div>
    <div class="grid two">
      ${sectionCard({
        title: "Teacher Command Center",
        subtitle: "Quick navigation and exports.",
        body: `
          <div class="actions">
            <button id="teacher-go-announcements-btn" class="btn btn-primary" type="button">Manage Announcements</button>
            <button id="teacher-go-reports-btn" class="btn btn-outline" type="button">Open Reports</button>
            <button id="teacher-quick-export-btn" class="btn btn-outline" type="button">Quick Export Attendance</button>
            <button id="teacher-jump-session-btn" class="btn btn-outline" type="button">Jump to Session Form</button>
          </div>
        `,
      })}
      ${sectionCard({
        title: "Class Snapshot",
        subtitle: "Recent classes currently assigned to you.",
        body: `
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Class</th><th>School Year</th></tr></thead>
              <tbody>
                ${classes.slice(0, 8).map((item) => `
                  <tr>
                    <td>${item.id ?? "-"}</td>
                    <td>${item.class_name || item.name || "-"}</td>
                    <td>${item.school_year?.name || item.school_year_id || "-"}</td>
                  </tr>
                `).join("") || '<tr><td colspan="3" class="muted">No classes found.</td></tr>'}
              </tbody>
            </table>
          </div>
        `,
      })}
    </div>
    ${sectionCard({
      title: "Per-Class Breakdown",
      subtitle: "Quick summary of class communication workload.",
      body: `
        <div class="grid two">
          ${classCards || '<article class="card"><p class="muted">No classes available for breakdown.</p></article>'}
        </div>
        <div class="actions" style="margin-top:10px;">
          <button id="teacher-open-class-tools-btn" class="btn btn-outline" type="button">Open Class Tools</button>
        </div>
      `,
    })}
    ${sectionCard({
      title: "Recent Activity Timeline",
      subtitle: "Latest teacher-side events from reports and announcements.",
      body: `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Details</th><th>When</th><th>Status</th></tr></thead>
            <tbody>
              ${recentTimeline.map((item) => `
                <tr>
                  <td>${item.type}</td>
                  <td>${item.message}</td>
                  <td>${item.when}</td>
                  <td><span class="badge ${String(item.status).toLowerCase().includes("pending") || String(item.status).toLowerCase().includes("draft") ? "warn" : "ok"}">${item.status}</span></td>
                </tr>
              `).join("") || '<tr><td colspan="4" class="muted">No recent timeline activity.</td></tr>'}
            </tbody>
          </table>
        </div>
      `,
    })}
    <div class="grid two">
      ${sectionCard({
        title: "Open Attendance Session",
        body: `
        <form id="open-session-form" class="grid">
          <div class="row">
            <input class="input" name="class_id" type="number" placeholder="Class ID" required />
            <input class="input" name="school_year_id" type="number" placeholder="School Year ID" required />
          </div>
          <div class="row">
            <input class="input" name="attendance_date" type="date" required />
            <input class="input" name="duration_minutes" type="number" placeholder="Duration (minutes)" required />
          </div>
          <button class="btn btn-primary" type="submit">Open Session</button>
        </form>
        <div id="session-result" class="muted" style="margin-top:10px;">No active session yet.</div>
      `,
      })}
      ${sectionCard({
        title: "Manual Attendance Mark",
        body: `
        <form id="teacher-mark-attendance-form" class="grid">
          <div class="row">
            <input class="input" name="student_id" type="number" placeholder="Student ID" required />
            <input class="input" name="class_id" type="number" placeholder="Class ID" required />
          </div>
          <div class="row">
            <input class="input" name="school_year_id" type="number" placeholder="School Year ID" required />
            <input class="input" name="attendance_date" type="date" required />
            <select class="select" name="status">
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
          </div>
          <button class="btn btn-primary" type="submit">Submit Mark</button>
        </form>
      `,
      })}
      ${sectionCard({
        title: "Create Announcement",
        body: `
        <form id="announce-form" class="grid">
          <input class="input" name="class_id" type="number" placeholder="Class ID" required />
          <input class="input" name="title" placeholder="Title" required />
          <textarea class="textarea" name="body" placeholder="Body" required></textarea>
          <button class="btn btn-primary" type="submit">Create Draft</button>
        </form>
        <div id="announcement-optimistic-list" class="grid" style="margin-top:12px;"></div>
      `,
      })}
    </div>
    ${sectionCard({
      title: "Export",
      tools: `<button id="export-att-btn" class="btn btn-outline">Export Attendance CSV</button>`,
      body: `<p class="muted">Uses default query: class_id=1, current month range.</p>`,
    })}
  `;
}

export function bindTeacherActions({ toast }) {
  document.getElementById("teacher-go-announcements-btn")?.addEventListener("click", () => {
    rerenderView("announcements");
    toast?.("Switched to the Announcements tab.");
  });
  document.getElementById("teacher-go-reports-btn")?.addEventListener("click", () => {
    rerenderView("reports");
    toast?.("Switched to the Reports tab.");
  });
  document.getElementById("teacher-jump-session-btn")?.addEventListener("click", () => {
    jumpTo("#open-session-form", '#open-session-form input[name="class_id"]');
    toast?.("Jumped to Session Form.");
  });
  document.getElementById("teacher-open-class-tools-btn")?.addEventListener("click", () => {
    jumpTo("#teacher-mark-attendance-form", '#teacher-mark-attendance-form input[name="student_id"]');
    toast?.("Jumped to Class Tools.");
  });
  document.getElementById("teacher-quick-export-btn")?.addEventListener("click", async () => {
    const { from, to } = calendarMonthDayRange();
    await runTeacherAttendanceCsvExport(toast, { class_id: "1", from, to });
  });

  const openForm = document.getElementById("open-session-form");
  openForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(openForm).entries());
    setFormSubmitting(openForm, true, "Opening...");

    try {
      const result = await api("/api/teacher/attendance-sessions", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(data.class_id),
          school_year_id: Number(data.school_year_id),
          attendance_date: data.attendance_date,
          duration_minutes: Number(data.duration_minutes),
        }),
      });

      const session = result.data || result;
      document.getElementById("session-result").innerHTML = `
        <p><b>Session ID:</b> ${session.id || "-"}</p>
        <p><b>QR Payload:</b> ${session.qr_payload || "-"}</p>
      `;
      toast("Attendance session opened successfully.");
    } catch (err) {
      toast(err.message || "Unable to open attendance session.", "error");
    } finally {
      setFormSubmitting(openForm, false);
    }
  });

  const markForm = document.getElementById("teacher-mark-attendance-form");
  markForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(markForm).entries());
    setFormSubmitting(markForm, true, "Submitting...");
    try {
      await api("/api/teacher/attendance/mark", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(data.class_id),
          school_year_id: Number(data.school_year_id),
          attendance_date: data.attendance_date,
          records: [
            {
              student_id: Number(data.student_id),
              status: data.status,
            },
          ],
        }),
      });
      toast("Attendance marked successfully.");
    } catch (err) {
      toast(err.message || "Unable to mark attendance.", "error");
    } finally {
      setFormSubmitting(markForm, false);
    }
  });

  const announceForm = document.getElementById("announce-form");
  announceForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(announceForm).entries());
    const listRoot = document.getElementById("announcement-optimistic-list");
    const optimisticId = `ann-${Date.now()}`;
    if (listRoot) {
      const row = document.createElement("div");
      row.className = "card";
      row.id = optimisticId;
      row.innerHTML = `
        <div class="actions" style="justify-content:space-between;">
          <strong>${data.title}</strong>
          <span class="badge pending">Sending...</span>
        </div>
        <p class="muted">${data.body}</p>
      `;
      listRoot.prepend(row);
    }
    setFormSubmitting(announceForm, true, "Saving...");
    try {
      const created = await api("/api/teacher/announcements", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(data.class_id),
          title: data.title,
          body: data.body,
        }),
      });
      announceForm.reset();
      const row = document.getElementById(optimisticId);
      if (row) {
        const badge = row.querySelector(".badge");
        if (badge) {
          badge.textContent = "Saved";
          badge.className = "badge ok";
        }
      }
      toast("Announcement draft created successfully.");
      setUiFlash("teacher", {
        view: "announcements",
        message: "Announcement draft created successfully.",
        announcementId: created?.data?.id,
      });
      rerenderView("announcements");
    } catch (err) {
      document.getElementById(optimisticId)?.remove();
      toast(err.message || "Unable to create announcement draft.", "error");
    } finally {
      setFormSubmitting(announceForm, false);
    }
  });

  const exportBtn = document.getElementById("export-att-btn");
  exportBtn?.addEventListener("click", async () => {
    const { from, to } = calendarMonthDayRange();
    await runTeacherAttendanceCsvExport(toast, { class_id: "1", from, to });
  });

  document.getElementById("teacher-publish-announcement-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("teacher-publish-hint", "");
    if (!Number(data.announcement_id)) {
      setInlineHint("teacher-publish-hint", "Select an announcement first.");
      toast("Select an announcement first.", "error");
      return;
    }
    setFormSubmitting(e.currentTarget, true, "Publishing...");
    try {
      await api(`/api/teacher/announcements/${data.announcement_id}/publish`, { method: "POST" });
      toast("Announcement published successfully.");
      setUiFlash("teacher", {
        view: "announcements",
        message: "Announcement published successfully.",
        announcementId: Number(data.announcement_id),
      });
      rerenderView("announcements");
    } catch (err) {
      toast(err.message || "Unable to publish announcement.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("teacher-delete-announcement-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("teacher-delete-announcement-hint", "");
    if (!Number(data.announcement_id)) {
      setInlineHint("teacher-delete-announcement-hint", "Select an announcement first.");
      toast("Select an announcement first.", "error");
      return;
    }
    setFormSubmitting(e.currentTarget, true, "Deleting...");
    try {
      await api(`/api/teacher/announcements/${data.announcement_id}`, { method: "DELETE" });
      toast("Announcement deleted successfully.");
      setUiFlash("teacher", { view: "announcements", message: "Announcement deleted successfully." });
      rerenderView("announcements");
    } catch (err) {
      toast(err.message || "Unable to delete announcement.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("teacher-comment-action-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("teacher-comment-action-hint", "");
    if (!Number(data.comment_id)) {
      setInlineHint("teacher-comment-action-hint", "Select a comment first.");
      toast("Select a comment first.", "error");
      return;
    }
    const action = data.action;
    const id = data.comment_id;
    const endpoint = action === "delete" ? `/api/teacher/announcement-comments/${id}` : `/api/teacher/announcement-comments/${id}/${action}`;
    const method = action === "delete" ? "DELETE" : "POST";
    setFormSubmitting(e.currentTarget, true, "Applying...");
    try {
      await api(endpoint, { method });
      toast("Comment action applied successfully.");
      setUiFlash("teacher", {
        view: "announcements",
        message: "Comment action applied successfully.",
        commentId: Number(id),
      });
      rerenderView("announcements");
    } catch (err) {
      toast(err.message || "Unable to apply comment action.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("teacher-absence-action-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("teacher-absence-action-hint", "");
    if (!Number(data.absence_report_id)) {
      setInlineHint("teacher-absence-action-hint", "Select an absence report first.");
      toast("Select an absence report first.", "error");
      return;
    }
    setFormSubmitting(e.currentTarget, true, "Applying...");
    try {
      await api(`/api/teacher/absence-reports/${data.absence_report_id}/${data.decision}`, {
        method: "POST",
        body: JSON.stringify(data.reason ? { admin_remarks: data.reason } : {}),
      });
      const absenceResult = data.decision === "reject" ? "rejected" : "approved";
      toast(`Absence report ${absenceResult} successfully.`);
      setUiFlash("teacher", {
        view: "announcements",
        message: `Absence report ${absenceResult} successfully.`,
        absenceReportId: Number(data.absence_report_id),
      });
      rerenderView("announcements");
    } catch (err) {
      toast(err.message || "Unable to apply absence report action.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("teacher-session-action-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Running...");
    try {
      if (data.session_action === "close") {
        await api(`/api/teacher/attendance-sessions/${data.session_id}/close`, { method: "POST" });
        toast("Session closed successfully.");
      } else {
        const res = await api(`/api/teacher/attendance-sessions/${data.session_id}/qr`);
        const payload = res.data?.qr_payload || res.qr_payload || JSON.stringify(res.data || res);
        document.getElementById("teacher-session-action-result").textContent = payload;
        toast("QR payload loaded successfully.");
      }
    } catch (err) {
      toast(err.message || "Unable to run session action.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });
}

export async function teacherAnnouncementsHtml() {
  let announcements = [];
  let comments = [];
  let absenceReports = [];
  try {
    const [a, c, r] = await Promise.all([
      api("/api/teacher/announcements"),
      api("/api/teacher/announcement-comments"),
      api("/api/teacher/absence-reports"),
    ]);
    announcements = listFrom(a);
    comments = listFrom(c);
    absenceReports = listFrom(r);
  } catch {
    announcements = [];
    comments = [];
    absenceReports = [];
  }
  const flash = consumeUiFlash("teacher");
  const highlightAnnouncementId = Number(flash?.announcementId);
  const highlightCommentId = Number(flash?.commentId);
  const highlightAbsenceId = Number(flash?.absenceReportId);

  return `
    ${sectionCard({
      title: "Create Announcement",
      body: `
      ${flash?.message ? `<p class="badge ok" style="margin-bottom:8px;">${flash.message}</p>` : ""}
      <form id="announce-form" class="grid">
        <input class="input" name="class_id" type="number" placeholder="Class ID" required />
        <input class="input" name="title" placeholder="Title" required />
        <textarea class="textarea" name="body" placeholder="Body" required></textarea>
        <button class="btn btn-primary" type="submit">Create Draft</button>
      </form>
      <div id="announcement-optimistic-list" class="grid" style="margin-top:12px;"></div>
    `,
    })}
    <div class="grid two">
      ${sectionCard({
        title: "Announcement Actions",
        body: `
        <form id="teacher-publish-announcement-form" class="row">
          <select class="input" name="announcement_id" required ${announcements.length ? "" : "disabled"}>
            <option value="">Select an announcement</option>
            ${announcements.map((item) => `<option value="${item.id}">#${item.id} - ${item.title || "Untitled"}</option>`).join("")}
          </select>
          <button class="btn btn-primary" type="submit">Publish</button>
        </form>
        <p id="teacher-publish-hint" class="muted"></p>
        <form id="teacher-delete-announcement-form" class="row" style="margin-top:10px;">
          <select class="input" name="announcement_id" required ${announcements.length ? "" : "disabled"}>
            <option value="">Select an announcement</option>
            ${announcements.map((item) => `<option value="${item.id}">#${item.id} - ${item.title || "Untitled"}</option>`).join("")}
          </select>
          <button class="btn btn-danger" type="submit">Delete</button>
        </form>
        <p id="teacher-delete-announcement-hint" class="muted"></p>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead><tr><th>ID</th><th>Title</th><th>Status</th></tr></thead>
            <tbody>${announcements.slice(0, 10).map((item) => `<tr style="${Number(item.id) === highlightAnnouncementId ? "background:var(--brand-soft);" : ""}"><td>${item.id ?? "-"}</td><td>${item.title || "-"}</td><td>${item.status || "-"}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `,
      })}
      ${sectionCard({
        title: "Comment Moderation",
        body: `
        <form id="teacher-comment-action-form" class="grid">
          <div class="row">
            <select class="input" name="comment_id" required ${comments.length ? "" : "disabled"}>
              <option value="">Select a comment</option>
              ${comments.map((item) => `<option value="${item.id}">#${item.id} - ${(item.body || "").slice(0, 40)}</option>`).join("")}
            </select>
            <select class="select" name="action">
              <option value="hide">Hide</option>
              <option value="unhide">Unhide</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <button class="btn btn-primary" type="submit">Apply</button>
        </form>
        <p id="teacher-comment-action-hint" class="muted"></p>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead><tr><th>ID</th><th>Announcement</th><th>Comment</th></tr></thead>
            <tbody>${comments.slice(0, 10).map((item) => `<tr style="${Number(item.id) === highlightCommentId ? "background:var(--brand-soft);" : ""}"><td>${item.id ?? "-"}</td><td>${item.class_announcement_id || item.announcement_id || "-"}</td><td>${item.body || "-"}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `,
      })}
    </div>
    ${sectionCard({
      title: "Absence Review",
      body: `
      <form id="teacher-absence-action-form" class="row">
        <select class="input" name="absence_report_id" required ${absenceReports.length ? "" : "disabled"}>
          <option value="">Select an absence report</option>
          ${absenceReports.map((item) => `<option value="${item.id}">#${item.id} - ${item.student?.full_name || item.student?.name || item.student_id || "Student"}</option>`).join("")}
        </select>
        <select class="select" name="decision">
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
        </select>
        <input class="input" name="reason" placeholder="Reason (optional)" />
        <button class="btn btn-primary" type="submit">Apply</button>
      </form>
      <p id="teacher-absence-action-hint" class="muted"></p>
      <div class="table-wrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>ID</th><th>Student</th><th>Status</th></tr></thead>
          <tbody>${absenceReports.slice(0, 10).map((item) => `<tr style="${Number(item.id) === highlightAbsenceId ? "background:var(--brand-soft);" : ""}"><td>${item.id ?? "-"}</td><td>${item.student?.full_name || item.student?.name || item.student_id || "-"}</td><td>${item.status || "-"}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    `,
    })}
  `;
}

export async function teacherReportsHtml() {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 6);
  const from = fromDate.toISOString().slice(0, 10);

  return `
    <article class="card">
      <h3>Weekly Attendance Trend</h3>
      <p class="muted">Powered by /api/teacher/dashboard-stats</p>
      <div class="row" style="margin-bottom:12px;">
        <select id="teacher-filter-class" class="select">
          <option value="">All Classes</option>
        </select>
        <button id="teacher-filter-apply" class="btn btn-primary" type="button">Apply Filter</button>
      </div>
      <div class="row" style="margin-bottom:12px;">
        <input id="teacher-filter-from" class="input" type="date" value="${from}" />
        <input id="teacher-filter-to" class="input" type="date" value="${to}" />
      </div>
      <div style="height:260px;">
        <canvas id="teacher-weekly-chart"></canvas>
      </div>
      <div id="teacher-stat-badges" class="actions" style="margin-top:12px;"></div>
      <div class="actions" style="margin-top:20px;">
        <button id="export-att-btn" class="btn btn-outline">Export Attendance CSV</button>
      </div>
      <form id="teacher-attendance-query-form" class="row" style="margin-top:12px;">
        <input class="input" name="class_id" type="number" placeholder="Class ID" required />
        <input class="input" name="attendance_date" type="date" required />
        <button class="btn btn-outline" type="submit">Load Attendance</button>
      </form>
      <div class="table-wrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>Student</th><th>Status</th><th>Remarks</th></tr></thead>
          <tbody id="teacher-attendance-query-results"></tbody>
        </table>
      </div>
      <div class="actions" style="margin-top:12px;">
        <form id="teacher-session-action-form" class="row">
          <input class="input" type="number" name="session_id" placeholder="Session ID" required />
          <select class="select" name="session_action">
            <option value="qr">Get QR</option>
            <option value="close">Close Session</option>
          </select>
          <button class="btn btn-primary" type="submit">Run</button>
        </form>
      </div>
      <p id="teacher-session-action-result" class="muted"></p>
    </article>
  `;
}

export async function bindTeacherReportChart({ toast } = {}) {
  if (teacherReportsRefreshId) {
    clearInterval(teacherReportsRefreshId);
    teacherReportsRefreshId = null;
  }

  const classSelect = document.getElementById("teacher-filter-class");
  const fromInput = document.getElementById("teacher-filter-from");
  const toInput = document.getElementById("teacher-filter-to");
  const applyBtn = document.getElementById("teacher-filter-apply");

  try {
    const classesResp = await api("/api/teacher/classes");
    const classes = classesResp.data || [];
    classSelect.innerHTML = `
      <option value="">All Classes</option>
      ${classes.map((c) => `<option value="${c.id}">${c.class_name || `Class ${c.id}`}</option>`).join("")}
    `;
  } catch (err) {
    // Keep default class option when classes endpoint is unavailable.
  }

  const loadChart = async () => {
    let labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let values = [0, 0, 0, 0, 0, 0, 0];
    let label = "Attendance records";
    let statusCounts = null;

    const params = new URLSearchParams();
    if (classSelect?.value) params.set("class_id", classSelect.value);
    if (fromInput?.value) params.set("from", fromInput.value);
    if (toInput?.value) params.set("to", toInput.value);

    try {
      const stats = await api(`/api/teacher/dashboard-stats?${params.toString()}`);
      const chart = stats.data?.chart;
      if (Array.isArray(chart?.labels) && Array.isArray(chart?.values)) {
        labels = chart.labels;
        values = chart.values;
        label = chart.label || label;
      }
      statusCounts = stats.data?.status_counts || null;
    } catch (err) {
      toast?.(err.message || "Unable to load teacher statistics.", "error");
    }

    renderBarChart({
      id: "teacher-weekly-chart",
      labels,
      values,
      label,
    });

    const badges = document.getElementById("teacher-stat-badges");
    if (badges && statusCounts) {
      badges.innerHTML = `
        <span class="badge ok">Present: ${statusCounts.present ?? 0}</span>
        <span class="badge warn">Late: ${statusCounts.late ?? 0}</span>
        <span class="badge">Absent: ${statusCounts.absent ?? 0}</span>
        <span class="badge">Excused: ${statusCounts.excused ?? 0}</span>
      `;
    }
  };

  applyBtn?.addEventListener("click", loadChart);
  await loadChart();

  teacherReportsRefreshId = setInterval(() => {
    if (!document.getElementById("teacher-weekly-chart")) {
      clearInterval(teacherReportsRefreshId);
      teacherReportsRefreshId = null;
      return;
    }
    loadChart();
  }, 30000);

  const exportBtn = document.getElementById("export-att-btn");
  exportBtn?.addEventListener("click", async () => {
    await runTeacherAttendanceCsvExport(toast, {
      class_id: classSelect?.value || "1",
      from: fromInput?.value || "",
      to: toInput?.value || "",
    });
  });

  document.getElementById("teacher-attendance-query-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await api(`/api/teacher/attendance?class_id=${data.class_id}&attendance_date=${data.attendance_date}`);
      const rows = listFrom(res);
      const target = document.getElementById("teacher-attendance-query-results");
      if (target) {
        target.innerHTML = rows.map((row) => `
          <tr>
            <td>${row.student?.full_name || row.student?.name || row.student_id || "-"}</td>
            <td>${row.status || "-"}</td>
            <td>${row.remarks || "-"}</td>
          </tr>
        `).join("");
      }
    } catch (err) {
      toast?.(err.message || "Unable to load attendance.", "error");
    }
  });
}

export const teacherViews = {
  tools: { html: teacherOverviewHtml, bind: bindTeacherActions },
  announcements: { html: teacherAnnouncementsHtml, bind: bindTeacherActions },
  reports: {
    html: teacherReportsHtml,
    bind: bindTeacherReportChart,
  },
};
