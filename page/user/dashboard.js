import { api, config, getSession } from "../../assets/core/api.js";
import { renderBarChart } from "../../assets/components/chart.js";
import { consumeUiFlash, rerenderView, setFormSubmitting, setInlineHint, setUiFlash } from "../../assets/components/form-ui.js";
import { sectionCard } from "../../assets/components/ui.js";

let studentAttendanceRefreshId = null;
function listFrom(resp) {
  const payload = resp?.data ?? resp;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function calculateAttendanceStreak(records = []) {
  const byDate = records
    .filter((record) => record?.attendance_date)
    .map((record) => ({
      date: new Date(record.attendance_date),
      status: String(record.status || "").toLowerCase(),
    }))
    .filter((record) => !Number.isNaN(record.date.getTime()))
    .sort((a, b) => b.date - a.date);

  let streak = 0;
  for (const row of byDate) {
    if (row.status === "present" || row.status === "late") {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
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


export async function studentOverviewHtml() {
  let rows = [];
  let reports = [];
  let attendanceRecords = [];
  let readIds = new Set();
  let attendanceSummary = null;
  let warning = "";
  let qrCard = null;
  let curriculumRows = [];
  try {
    const [announcementsResp, absenceReports, attendanceResp, statsResp, qrRes, subRes] = await Promise.all([
      api("/api/student/announcements"),
      api("/api/student/absence-reports"),
      api("/api/student/attendance"),
      api("/api/student/dashboard-stats"),
      api("/api/student/qr-card").catch(() => ({ data: null })),
      api("/api/student/my-subjects").catch(() => ({ data: [] })),
    ]);
    rows = listFrom(announcementsResp);
    reports = listFrom(absenceReports);
    attendanceRecords = listFrom(attendanceResp);
    readIds = new Set(Array.isArray(announcementsResp?.read_ids) ? announcementsResp.read_ids : []);
    attendanceSummary = statsResp?.data?.summary || null;
    qrCard = qrRes?.data ?? null;
    curriculumRows = listFrom(subRes);
  } catch (err) {
    warning = err.message || "Announcements unavailable.";
  }

  const reportedAttendanceIds = new Set(
    reports
      .map((report) => report.attendance_record_id || report.attendance_record?.id)
      .filter((id) => Number.isInteger(Number(id))),
  );
  const absenceChoices = attendanceRecords
    .filter((record) => String(record.status || "").toLowerCase() === "absent")
    .filter((record) => !reportedAttendanceIds.has(record.id));
  const flash = consumeUiFlash("student");
  const flashPanel = flash?.view === "panel" ? flash : null;
  const user = getSession()?.user || {};
  const userName = user.full_name || user.name || "Student";
  const studentId =
    qrCard?.student_number || user.student_id || user.student_number || user.username || `STU${user.id || "-"}`;
  const programLabel = qrCard?.program_name || user.studentProfile?.schoolClass?.program?.name || "";
  const yearLevelLabel = qrCard?.year_level || user.studentProfile?.schoolClass?.year_level || "";
  const classLabel = qrCard?.class_name
    ? `${qrCard.class_name}${qrCard.section ? ` — Sec ${qrCard.section}` : ""}`
    : user.studentProfile?.schoolClass?.class_name || "";
  const qrImgSrc = qrCard?.qr_payload
    ? `https://quickchart.io/qr?size=180&text=${encodeURIComponent(qrCard.qr_payload)}`
    : "";
  const attendanceRate = Number(attendanceSummary?.attendance_rate || 0);
  const rateSafe = Number.isFinite(attendanceRate) ? Math.max(0, Math.min(100, attendanceRate)) : 0;
  const pendingReports = reports.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
  const totalAttendance = Number(attendanceSummary?.total_records || attendanceRecords.length || 0);
  const presentCount = Number(attendanceSummary?.present_records || 0);
  const unreadAnnouncements = rows.filter((item) => !readIds.has(item.id)).length;
  const lateCount = attendanceRecords.filter((item) => String(item.status || "").toLowerCase() === "late").length;
  const absentCount = attendanceRecords.filter((item) => String(item.status || "").toLowerCase() === "absent").length;
  const streakDays = calculateAttendanceStreak(attendanceRecords);

  return `
    <div class="grid stats">
      <article class="card stat-card"><p class="muted stat-label">Attendance Rate</p><div class="metric">${rateSafe}%</div></article>
      <article class="card stat-card"><p class="muted stat-label">Present Records</p><div class="metric">${presentCount}</div></article>
      <article class="card stat-card"><p class="muted stat-label">Pending Reports</p><div class="metric">${pendingReports}</div></article>
      <article class="card stat-card"><p class="muted stat-label">Unread Announcements</p><div class="metric">${unreadAnnouncements}</div></article>
    </div>
    <div class="grid two">
      ${sectionCard({
        title: "Student Command Center",
        subtitle: "Quick shortcuts to your key tasks.",
        body: `
          <div class="actions">
            <button id="student-go-schedule-btn" class="btn btn-primary" type="button">My Schedule</button>
            <button id="student-go-attendance-btn" class="btn btn-outline" type="button">Open Attendance</button>
            <button id="student-go-profile-btn" class="btn btn-outline" type="button">Open Profile</button>
            <button id="student-scroll-checkin-btn" class="btn btn-outline" type="button">Jump to Check-In</button>
            <button id="student-jump-report-form-btn" class="btn btn-outline" type="button" ${absenceChoices.length > 0 ? "" : "disabled"}>Jump to Report Form</button>
          </div>
        `,
      })}
      ${sectionCard({
        title: "My Summary",
        subtitle: "Current status from your records.",
        body: `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Metric</th><th>Value</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td>Total Attendance Records</td><td>${totalAttendance}</td><td><span class="badge">Tracked</span></td></tr>
                <tr><td>Present Records</td><td>${presentCount}</td><td><span class="badge ok">Good</span></td></tr>
                <tr><td>Pending Absence Reports</td><td>${pendingReports}</td><td><span class="badge ${pendingReports > 0 ? "warn" : "ok"}">${pendingReports > 0 ? "Needs action" : "Clear"}</span></td></tr>
                <tr><td>Unread Announcements</td><td>${unreadAnnouncements}</td><td><span class="badge ${unreadAnnouncements > 0 ? "warn" : "ok"}">${unreadAnnouncements > 0 ? "Check now" : "All read"}</span></td></tr>
              </tbody>
            </table>
          </div>
        `,
      })}
    </div>
    <div class="grid two">
      ${sectionCard({
        title: "Attendance Streak",
        subtitle: "Consecutive days with present/late attendance records.",
        body: `
          <div class="actions" style="justify-content:space-between;">
            <span class="badge ${streakDays >= 5 ? "ok" : "warn"}">${streakDays} day streak</span>
            <span class="muted">${streakDays >= 5 ? "Great momentum" : "Keep building your streak"}</span>
          </div>
          <div class="student-progress">
            <span style="width:${Math.min(streakDays * 10, 100)}%;"></span>
          </div>
        `,
      })}
      ${sectionCard({
        title: "Attendance Trends",
        subtitle: "Quick behavior trend from your records.",
        body: `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Metric</th><th>Count</th><th>Indicator</th></tr></thead>
              <tbody>
                <tr><td>Present</td><td>${presentCount}</td><td><span class="badge ok">Good</span></td></tr>
                <tr><td>Late</td><td>${lateCount}</td><td><span class="badge ${lateCount > 3 ? "warn" : "ok"}">${lateCount > 3 ? "Watch" : "Stable"}</span></td></tr>
                <tr><td>Absent</td><td>${absentCount}</td><td><span class="badge ${absentCount > 0 ? "warn" : "ok"}">${absentCount > 0 ? "Needs action" : "Great"}</span></td></tr>
              </tbody>
            </table>
          </div>
        `,
      })}
    </div>
    ${sectionCard({
      title: "Tasks Due",
      subtitle: "Items you should handle today.",
      body: `
        <div class="actions">
          <button id="student-task-unread-btn" class="btn ${unreadAnnouncements > 0 ? "btn-primary" : "btn-outline"}" type="button" ${unreadAnnouncements > 0 ? "" : "disabled"}>Unread Announcements: ${unreadAnnouncements}</button>
          <button id="student-task-absence-btn" class="btn ${absenceChoices.length > 0 ? "btn-primary" : "btn-outline"}" type="button" ${absenceChoices.length > 0 ? "" : "disabled"}>Absence Reports to file: ${absenceChoices.length}</button>
          <button id="student-task-pending-btn" class="btn ${pendingReports > 0 ? "btn-primary" : "btn-outline"}" type="button" ${pendingReports > 0 ? "" : "disabled"}>Reports Pending Review: ${pendingReports}</button>
        </div>
      `,
    })}
    <section class="student-hub">
      <div class="student-hub-top">
        <article class="card student-checkin-card">
          <div class="student-card-head">
            <h3>Check In</h3>
            <p class="muted">Scan QR or upload payload file</p>
          </div>
        <form id="checkin-form" class="grid">
          <textarea class="textarea" name="qr_payload" placeholder="Paste QR payload here..."></textarea>
          <label class="muted">or upload payload file (.txt/.json)</label>
          <input class="input" name="qr_payload_file" type="file" accept=".txt,.json,text/plain,application/json" />
          <p id="checkin-form-hint" class="muted"></p>
          <button class="btn btn-primary" type="submit">Check In Now</button>
        </form>
        <div id="checkin-activity" class="grid" style="margin-top:12px;"></div>
        </article>
        <article class="card student-profile-card">
          <h3>School portal card</h3>
          <p class="muted" style="margin:0 0 10px;">Programme, ID, and check-in QR (for attendance sessions use your teacher’s class QR).</p>
          <div class="student-profile-meta">
            <span class="muted">Name</span>
            <strong>${userName}</strong>
          </div>
          <div class="student-profile-meta">
            <span class="muted">Student ID</span>
            <strong>${studentId}</strong>
          </div>
          ${programLabel ? `<div class="student-profile-meta"><span class="muted">Program</span><strong>${programLabel}</strong></div>` : ""}
          ${yearLevelLabel ? `<div class="student-profile-meta"><span class="muted">Year level</span><strong>Year ${yearLevelLabel}</strong></div>` : ""}
          ${classLabel ? `<div class="student-profile-meta"><span class="muted">Class</span><strong>${classLabel}</strong></div>` : ""}
          ${
            qrImgSrc
              ? `<div style="margin-top:10px;text-align:center;"><img src="${qrImgSrc}" width="180" height="180" alt="Student ID QR" style="border-radius:8px;border:1px solid var(--border);" /><p class="muted" style="font-size:11px;margin-top:6px;">Campus ID QR — do not share publicly</p></div>`
              : ""
          }
          ${curriculumRows.length ? `<p class="muted" style="margin-top:10px;font-size:12px;"><strong>This year’s subjects (${curriculumRows.length}):</strong> ${curriculumRows.map((r) => r.subject?.name || r.subject_id).slice(0, 6).join(", ")}${curriculumRows.length > 6 ? "…" : ""}</p>` : ""}
          <div class="student-profile-meta">
            <span class="muted">Attendance rate</span>
            <strong>${rateSafe}%</strong>
          </div>
          <div class="student-progress">
            <span style="width:${rateSafe}%;"></span>
          </div>
          <div class="actions" style="justify-content:space-between;">
            <span class="badge ${pendingReports > 0 ? "warn" : "ok"}">${pendingReports} pending reports</span>
            <span class="badge">${rows.length} announcements</span>
          </div>
        </article>
      </div>
      <div class="student-hub-bottom">
        ${sectionCard({
          title: "Announcements",
          subtitle: warning ? `API Notice: ${warning}` : "",
          body: `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Body</th><th>Status</th></tr></thead>
            <tbody>
              ${rows.map((a) => `
                <tr>
                  <td>${a.title || "-"}</td>
                  <td>${a.body || "-"}</td>
                  <td><span class="badge ${readIds.has(a.id) ? "ok" : "warn"}">${readIds.has(a.id) ? "read" : "unread"}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        `,
        })}
        ${sectionCard({
          title: "Absence Reports",
          body: `
          ${flashPanel?.message ? `<p class="badge ok" style="margin-bottom:8px;">${flashPanel.message}</p>` : ""}
          <form id="student-create-report-form" class="grid">
        <div class="row">
          <select class="input" name="attendance_record_id" required ${absenceChoices.length ? "" : "disabled"}>
            <option value="">Select absent attendance record</option>
            ${absenceChoices.map((record) => `
              <option value="${record.id}">
                ${formatDate(record.attendance_date)} - ${record.school_class?.class_name || `Class #${record.class_id || "-"}`}
              </option>
            `).join("")}
          </select>
          <input class="input" name="reason" placeholder="Why were you absent?" required />
        </div>
        <input class="input" name="attachments" type="file" multiple />
        <p id="student-report-form-hint" class="muted"></p>
        <p class="muted">${absenceChoices.length ? "Pick from your recent absences. Already reported records are hidden." : "No pending absent records need a report right now."}</p>
        <button class="btn btn-primary" type="submit" ${absenceChoices.length ? "" : "disabled"}>Report Absence</button>
      </form>
      <div class="table-wrap" style="margin-top:12px;">
        <table>
          <thead><tr><th>ID</th><th>Date</th><th>Status</th><th>Attachment</th></tr></thead>
          <tbody>
            ${reports.slice(0, 10).map((r) => `
              <tr style="${Number(flashPanel?.reportId) === Number(r.id) ? "background:var(--brand-soft);" : ""}">
                <td>${r.id ?? "-"}</td>
                <td>${r.absent_date || "-"}</td>
                <td><span class="badge">${r.status || "-"}</span></td>
                <td>${r.attachments?.[0]?.id ? `<button class="btn btn-outline student-open-attachment-btn" data-id="${r.attachments[0].id}" type="button">Open</button>` : "-"}</td>
              </tr>
            `).join("") || '<tr><td colspan="4" class="muted">No reports yet.</td></tr>'}
          </tbody>
        </table>
      </div>
        `,
        })}
      </div>
    </section>
  `;
}

export function bindStudentActions({ toast }) {
  document.getElementById("student-go-schedule-btn")?.addEventListener("click", () => {
    rerenderView("schedule");
    toast?.("Switched to the Schedule tab.");
  });
  document.getElementById("student-go-attendance-btn")?.addEventListener("click", () => {
    rerenderView("attendance");
    toast?.("Switched to the Attendance tab.");
  });
  document.getElementById("student-go-profile-btn")?.addEventListener("click", () => {
    rerenderView("profile");
    toast?.("Switched to the Profile tab.");
  });
  document.getElementById("student-scroll-checkin-btn")?.addEventListener("click", () => {
    jumpTo("#checkin-form", '#checkin-form textarea[name="qr_payload"]');
    toast?.("Jumped to Check-In.");
  });
  document.getElementById("student-jump-report-form-btn")?.addEventListener("click", () => {
    jumpTo("#student-create-report-form", '#student-create-report-form input[name="reason"]');
    toast?.("Jumped to Report Form.");
  });
  document.getElementById("student-task-unread-btn")?.addEventListener("click", () => {
    rerenderView("profile");
    window.setTimeout(() => {
      jumpTo("#student-mark-read-form", '#student-mark-read-form select[name="announcement_id"]');
    }, 80);
    toast?.("Jumped to Unread Announcements.");
  });
  document.getElementById("student-task-absence-btn")?.addEventListener("click", () => {
    jumpTo("#student-create-report-form", '#student-create-report-form select[name="attendance_record_id"]');
    toast?.("Jumped to Absence Report Form.");
  });
  document.getElementById("student-task-pending-btn")?.addEventListener("click", () => {
    jumpTo("#student-create-report-form", '#student-create-report-form input[name="reason"]');
    toast?.("Jumped to Pending Reports.");
  });

  const form = document.getElementById("checkin-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const rawPayload = String(formData.get("qr_payload") || "").trim();
    const payloadFile = formData.get("qr_payload_file");
    let qrPayload = rawPayload;

    if (!qrPayload && payloadFile instanceof File && payloadFile.size > 0) {
      try {
        qrPayload = (await payloadFile.text()).trim();
      } catch {
        setInlineHint("checkin-form-hint", "Unable to read the uploaded file. Try another file.");
        toast("Unable to read the uploaded file. Try another file.", "error");
        return;
      }
    }
    if (!qrPayload) {
      setInlineHint("checkin-form-hint", "Paste QR payload or upload a .txt/.json file.");
      toast("Paste QR payload or upload a .txt/.json file.", "error");
      return;
    }
    setInlineHint("checkin-form-hint", "");
    setFormSubmitting(form, true, "Checking in...");

    const activityRoot = document.getElementById("checkin-activity");
    const optimisticId = `chk-${Date.now()}`;
    if (activityRoot) {
      const row = document.createElement("div");
      row.className = "card";
      row.id = optimisticId;
      row.innerHTML = `
        <div class="actions" style="justify-content:space-between;">
          <strong>Attendance Check-in</strong>
          <span class="badge pending">Submitting...</span>
        </div>
        <p class="muted">Payload queued for verification.</p>
      `;
      activityRoot.prepend(row);
    }
    try {
      await api("/api/student/attendance-sessions/check-in", {
        method: "POST",
        body: JSON.stringify({ qr_payload: qrPayload }),
      });
      form.reset();
      const row = document.getElementById(optimisticId);
      if (row) {
        const badge = row.querySelector(".badge");
        if (badge) {
          badge.textContent = "Checked in";
          badge.className = "badge ok";
        }
      }
      toast("Check-in completed successfully.");
      setUiFlash("student", { view: "panel", message: "Check-in completed successfully." });
      rerenderView("panel");
    } catch (err) {
      document.getElementById(optimisticId)?.remove();
      toast(err.message || "Unable to complete check-in.", "error");
    } finally {
      setFormSubmitting(form, false);
    }
  });

  document.getElementById("student-create-report-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const attendanceRecordId = Number(data.get("attendance_record_id"));
    const reason = String(data.get("reason") || "").trim();
    const attachments = e.currentTarget.querySelector('input[name="attachments"]')?.files || [];
    setInlineHint("student-report-form-hint", "");
    setFormSubmitting(e.currentTarget, true, "Submitting...");

    try {
      if (!attendanceRecordId || !reason) {
        setInlineHint("student-report-form-hint", "Select an attendance record and enter a reason.");
        toast("Select an attendance record and enter a reason.", "error");
        return;
      }

      let createdReport = null;
      if (attachments.length > 0) {
        const body = new FormData();
        body.append("attendance_record_id", String(attendanceRecordId));
        body.append("reason", reason);
        Array.from(attachments).forEach((file) => body.append("attachments[]", file));
        createdReport = await api("/api/student/absence-reports", { method: "POST", body });
      } else {
        createdReport = await api("/api/student/absence-reports", {
          method: "POST",
          body: JSON.stringify({
            attendance_record_id: attendanceRecordId,
            reason,
          }),
        });
      }
      toast("Absence report submitted successfully.");
      setUiFlash("student", {
        view: "panel",
        message: "Absence report submitted successfully.",
        reportId: createdReport?.data?.id,
      });
      rerenderView("panel");
    } catch (err) {
      toast(err.message || "Unable to submit absence report.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.querySelectorAll(".student-open-attachment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (!id) return;
      window.open(`${config.baseUrl}/api/student/absence-attachments/${id}`, "_blank");
    });
  });
}

const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function studentScheduleHtml() {
  let schedulePayload = { class: null, slots: [] };
  let subjects = [];
  let warn = "";
  try {
    const [schedRes, subRes] = await Promise.all([api("/api/student/schedule"), api("/api/student/my-subjects")]);
    schedulePayload = schedRes?.data || schedulePayload;
    subjects = listFrom(subRes);
  } catch (e) {
    warn = e.message || "Unable to load schedule.";
  }

  const byDay = {};
  for (const slot of schedulePayload.slots || []) {
    const d = Number(slot.day_of_week);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(slot);
  }
  for (const d of Object.keys(byDay)) {
    byDay[d].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  }

  const dayBlocks = [1, 2, 3, 4, 5, 6, 7]
    .map((d) => {
      const slots = byDay[d] || [];
      const lines = slots
        .map((slot) => {
          const sub = slot.subject?.name || "Subject";
          const teacher = slot.teacher?.full_name || slot.teacher?.name || "—";
          const room = slot.room || "—";
          const st = String(slot.start_time || "").slice(0, 5);
          const en = String(slot.end_time || "").slice(0, 5);
          return `<tr><td>${st}–${en}</td><td>${sub}</td><td>${teacher}</td><td>${room}</td></tr>`;
        })
        .join("");
      return `
      <article class="card" style="margin-bottom:12px;">
        <h4 style="margin:0 0 8px;">${WEEKDAY_NAMES[d]}</h4>
        ${
          lines
            ? `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead><tbody>${lines}</tbody></table></div>`
            : '<p class="muted">No classes scheduled.</p>'
        }
      </article>`;
    })
    .join("");

  const cls = schedulePayload.class;

  return `
    ${warn ? `<article class="card"><p class="muted">${warn}</p></article>` : ""}
    ${sectionCard({
      title: "Your enrolment",
      subtitle: "Programme, year, and class adviser.",
      body: cls
        ? `<p><strong>${cls.class_name || ""}</strong> · Section ${cls.section || "—"} · <strong>Year ${cls.year_level ?? "—"}</strong></p>
         <p class="muted">Programme: ${cls.program?.name || "—"}</p>
         <p class="muted">Adviser: ${cls.adviser?.full_name || "—"}</p>`
        : '<p class="muted">No class assigned. Ask the registrar to assign you to a cohort.</p>',
    })}
    ${sectionCard({
      title: "Weekly timetable",
      subtitle: "When and where each subject meets (from the school schedule).",
      body: dayBlocks || '<p class="muted">No slots yet.</p>',
    })}
    ${sectionCard({
      title: "This year’s subject list",
      subtitle: "From your programme curriculum for your year level.",
      body: `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Subject</th></tr></thead>
            <tbody>
              ${subjects.map((r) => `<tr><td class="muted">${r.subject?.code || "-"}</td><td>${r.subject?.name || "-"}</td></tr>`).join("") || '<tr><td colspan="2" class="muted">No curriculum rows.</td></tr>'}
            </tbody>
          </table>
        </div>
      `,
    })}
  `;
}

export function bindStudentSchedule() {}

export async function studentAttendanceHtml() {
  const today = new Date();
  const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const fromDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-01`;

  return `
    ${sectionCard({
      title: "Attendance Trend",
      subtitle: "Powered by /api/student/dashboard-stats",
      body: `
      <div class="row" style="margin-bottom:12px;">
        <input id="student-filter-from" class="input" type="month" value="${from.slice(0, 7)}" />
        <input id="student-filter-to" class="input" type="month" value="${to.slice(0, 7)}" />
      </div>
      <div class="actions" style="margin-bottom:12px;">
        <button id="student-filter-apply" class="btn btn-primary" type="button">Apply Filter</button>
      </div>
      <div style="height:260px;">
        <canvas id="student-attendance-chart"></canvas>
      </div>
      <div id="student-summary" class="actions" style="margin-top:12px;"></div>
      <div class="table-wrap" style="margin-top:12px;">
        <table>
          <thead><tr><th>Date</th><th>Class</th><th>Status</th></tr></thead>
          <tbody id="student-attendance-list"></tbody>
        </table>
      </div>
    `,
    })}
  `;
}

export async function bindStudentAttendanceChart({ toast } = {}) {
  if (studentAttendanceRefreshId) {
    clearInterval(studentAttendanceRefreshId);
    studentAttendanceRefreshId = null;
  }

  const fromInput = document.getElementById("student-filter-from");
  const toInput = document.getElementById("student-filter-to");
  const applyBtn = document.getElementById("student-filter-apply");

  const load = async () => {
    let labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    let values = [0, 0, 0, 0, 0, 0];
    let label = "Monthly attendance records";
    let summary = null;

    const params = new URLSearchParams();
    if (fromInput?.value) params.set("from", `${fromInput.value}-01`);
    if (toInput?.value) params.set("to", `${toInput.value}-01`);

    try {
      const stats = await api(`/api/student/dashboard-stats?${params.toString()}`);
      const chart = stats.data?.chart;
      if (Array.isArray(chart?.labels) && Array.isArray(chart?.values)) {
        labels = chart.labels;
        values = chart.values;
        label = chart.label || label;
      }
      summary = stats.data?.summary || null;
    } catch (err) {
      toast?.(err.message || "Unable to load student statistics.", "error");
    }

    renderBarChart({
      id: "student-attendance-chart",
      labels,
      values,
      label,
    });

    const summaryRoot = document.getElementById("student-summary");
    if (summaryRoot && summary) {
      summaryRoot.innerHTML = `
        <span class="badge">Total: ${summary.total_records ?? 0}</span>
        <span class="badge ok">Present: ${summary.present_records ?? 0}</span>
        <span class="badge warn">Rate: ${summary.attendance_rate ?? 0}%</span>
      `;
    }

    try {
      const recordsResp = await api("/api/student/attendance");
      const records = listFrom(recordsResp).slice(0, 10);
      const listEl = document.getElementById("student-attendance-list");
      if (listEl) {
        listEl.innerHTML = records.map((row) => `
          <tr>
            <td>${row.attendance_date || "-"}</td>
            <td>${row.school_class?.class_name || row.class_id || "-"}</td>
            <td>${row.status || "-"}</td>
          </tr>
        `).join("");
      }
    } catch {
      // Keep chart visible even if attendance list fails.
    }
  };

  applyBtn?.addEventListener("click", load);
  await load();

  studentAttendanceRefreshId = setInterval(() => {
    if (!document.getElementById("student-attendance-chart")) {
      clearInterval(studentAttendanceRefreshId);
      studentAttendanceRefreshId = null;
      return;
    }
    load();
  }, 30000);
}

export async function studentProfileHtml() {
  let announcements = [];
  let comments = [];
  const userId = getSession()?.user?.id;
  try {
    const annsResp = await api("/api/student/announcements");
    announcements = listFrom(annsResp);
    const commentResponses = await Promise.all(
      announcements.slice(0, 5).map((announcement) => api(`/api/student/announcements/${announcement.id}/comments`)),
    );
    comments = commentResponses.flatMap((resp) => listFrom(resp));
  } catch {
    announcements = [];
    comments = [];
  }

  const myComments = comments.filter((comment) => Number(comment.student_id) === Number(userId));
  const flash = consumeUiFlash("student");
  const flashProfile = flash?.view === "profile" ? flash : null;

  return `
    ${sectionCard({
      title: "Announcement Interactions",
      body: `
      ${flashProfile?.message ? `<p class="badge ok" style="margin-bottom:8px;">${flashProfile.message}</p>` : ""}
      <form id="student-mark-read-form" class="row">
        <select class="input" name="announcement_id" required ${announcements.length ? "" : "disabled"}>
          <option value="">Select announcement to mark as read</option>
          ${announcements.map((a) => `<option value="${a.id}">${a.title || `Announcement #${a.id}`}</option>`).join("")}
        </select>
        <button class="btn btn-primary" type="submit" ${announcements.length ? "" : "disabled"}>Mark as Read</button>
      </form>
      <form id="student-comment-form" class="grid" style="margin-top:12px;">
        <div class="row">
          <select class="input" name="announcement_id" required ${announcements.length ? "" : "disabled"}>
            <option value="">Select announcement</option>
            ${announcements.map((a) => `<option value="${a.id}">${a.title || `Announcement #${a.id}`}</option>`).join("")}
          </select>
          <input class="input" name="content" placeholder="Comment content" required />
        </div>
        <p id="student-comment-form-hint" class="muted"></p>
        <button class="btn btn-primary" type="submit" ${announcements.length ? "" : "disabled"}>Add Comment</button>
      </form>
      <form id="student-comment-edit-form" class="grid" style="margin-top:12px;">
        <div class="row">
          <select class="input" name="comment_id" required ${myComments.length ? "" : "disabled"}>
            <option value="">Select your comment</option>
            ${myComments.map((c) => `<option value="${c.id}">#${c.id} - ${(c.body || "").slice(0, 50) || "No content"}</option>`).join("")}
          </select>
          <input class="input" name="content" placeholder="Updated comment content" required />
        </div>
        <button class="btn btn-outline" type="submit" ${myComments.length ? "" : "disabled"}>Update Comment</button>
      </form>
      <form id="student-comment-delete-form" class="row" style="margin-top:12px;">
        <select class="input" name="comment_id" required ${myComments.length ? "" : "disabled"}>
          <option value="">Select your comment to delete</option>
          ${myComments.map((c) => `<option value="${c.id}">#${c.id} - ${(c.body || "").slice(0, 50) || "No content"}</option>`).join("")}
        </select>
        <button class="btn btn-danger" type="submit" ${myComments.length ? "" : "disabled"}>Delete Comment</button>
      </form>
      <div class="table-wrap" style="margin-top:12px;">
        <table>
          <thead><tr><th>Announcement</th><th>Title</th></tr></thead>
          <tbody>${announcements.slice(0, 10).map((a) => `<tr><td>${a.id ?? "-"}</td><td>${a.title || "-"}</td></tr>`).join("") || '<tr><td colspan="2" class="muted">No announcements available.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="table-wrap" style="margin-top:12px;">
        <table>
          <thead><tr><th>Comment ID</th><th>Content</th></tr></thead>
          <tbody>${comments.slice(0, 10).map((c) => `<tr style="${Number(flashProfile?.commentId) === Number(c.id) ? "background:var(--brand-soft);" : ""}"><td>${c.id ?? "-"}</td><td>${c.body || "-"}</td></tr>`).join("") || '<tr><td colspan="2" class="muted">No comments yet.</td></tr>'}</tbody>
        </table>
      </div>
    `,
    })}
  `;
}

export function bindStudentProfileActions({ toast } = {}) {
  document.getElementById("student-mark-read-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Marking...");
    try {
      await api(`/api/student/announcements/${Number(data.announcement_id)}/read`, { method: "POST" });
      toast?.("Announcement marked as read successfully.");
      setUiFlash("student", { view: "profile", message: "Announcement marked as read successfully." });
      rerenderView("profile");
    } catch (err) {
      toast?.(err.message || "Unable to mark announcement as read.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("student-comment-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("student-comment-form-hint", "");
    setFormSubmitting(e.currentTarget, true, "Adding...");
    try {
      if (!String(data.content || "").trim()) {
        setInlineHint("student-comment-form-hint", "Enter comment content.");
        toast?.("Enter comment content.", "error");
        return;
      }
      const created = await api(`/api/student/announcements/${Number(data.announcement_id)}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: data.content }),
      });
      toast?.("Comment added successfully.");
      setUiFlash("student", {
        view: "profile",
        message: "Comment added successfully.",
        commentId: created?.data?.id,
      });
      rerenderView("profile");
    } catch (err) {
      toast?.(err.message || "Unable to add comment.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("student-comment-edit-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Updating...");
    try {
      await api(`/api/student/announcement-comments/${Number(data.comment_id)}`, {
        method: "PUT",
        body: JSON.stringify({ body: data.content }),
      });
      toast?.("Comment updated successfully.");
      setUiFlash("student", {
        view: "profile",
        message: "Comment updated successfully.",
        commentId: Number(data.comment_id),
      });
      rerenderView("profile");
    } catch (err) {
      toast?.(err.message || "Unable to update comment.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("student-comment-delete-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Deleting...");
    try {
      await api(`/api/student/announcement-comments/${Number(data.comment_id)}`, { method: "DELETE" });
      toast?.("Comment deleted successfully.");
      setUiFlash("student", { view: "profile", message: "Comment deleted successfully." });
      rerenderView("profile");
    } catch (err) {
      toast?.(err.message || "Unable to delete comment.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });
}

export const studentViews = {
  panel: { html: studentOverviewHtml, bind: bindStudentActions },
  schedule: { html: studentScheduleHtml, bind: bindStudentSchedule },
  attendance: { html: studentAttendanceHtml, bind: bindStudentAttendanceChart },
  profile: { html: studentProfileHtml, bind: bindStudentProfileActions },
};
