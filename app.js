(function () {
  const STAGES = ["Wishlist", "Applied", "Outreach Sent", "Interviewing", "Offer", "Rejected"];
  const STAGE_CLASS = {
    "Wishlist": ["--stage-wishlist-bg", "--stage-wishlist-fg"],
    "Applied": ["--stage-applied-bg", "--stage-applied-fg"],
    "Outreach Sent": ["--stage-outreach-bg", "--stage-outreach-fg"],
    "Interviewing": ["--stage-interview-bg", "--stage-interview-fg"],
    "Offer": ["--stage-offer-bg", "--stage-offer-fg"],
    "Rejected": ["--stage-rejected-bg", "--stage-rejected-fg"],
  };
  const STORAGE_KEY = "vector:entries";
  const LINKS_KEY = "vector:links";

  let jobs = [];
  let links = [];
  let editingLinkId = null;
  let showLinkAdd = false;
  let expandedJobId = null;
  let filterStage = "All";
  let searchTerm = "";
  let showAdd = false;
  let stageChart = null;
  let timeChart = null;

  const app = document.getElementById("app");
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function uid() { return "j" + Date.now() + Math.random().toString(36).slice(2, 8); }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      jobs = raw ? JSON.parse(raw) : [];
    } catch (e) { jobs = []; }
    try {
      const rawLinks = localStorage.getItem(LINKS_KEY);
      links = rawLinks ? JSON.parse(rawLinks) : [];
    } catch (e) { links = []; }
    render();
  }

  function saveLinks() {
    try { localStorage.setItem(LINKS_KEY, JSON.stringify(links)); }
    catch (e) { console.error("Save links failed", e); }
  }

  function addLink(label, url) {
    links.push({ id: uid(), label: label.trim(), url: url.trim() });
    saveLinks(); render();
  }

  function updateLink(id, label, url) {
    const l = links.find(x => x.id === id);
    if (l) { l.label = label.trim(); l.url = url.trim(); }
    editingLinkId = null;
    saveLinks(); render();
  }

  function deleteLink(id) {
    links = links.filter(l => l.id !== id);
    saveLinks(); render();
  }

  function copyLink(id) {
    const l = links.find(x => x.id === id);
    if (!l) return;
    navigator.clipboard.writeText(l.url).then(() => {
      const chip = document.querySelector(`.link-label[data-id="${id}"]`);
      if (chip) {
        const original = chip.textContent;
        chip.textContent = "Copied!";
        chip.parentElement.classList.add("just-copied");
        setTimeout(() => {
          chip.textContent = original;
          if (chip.parentElement) chip.parentElement.classList.remove("just-copied");
        }, 1100);
      }
    }).catch(() => {});
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)); }
    catch (e) { console.error("Save failed", e); }
  }

  function parsePaste(text) {
    const rawLines = text.split("\n").map(l => l.trim()).filter(Boolean);

    let link = "";
    const mdLinkMatch = text.match(/\((https?:\/\/[^\s)]+)\)/);
    if (mdLinkMatch) link = mdLinkMatch[1];
    else {
      const bareUrl = text.match(/https?:\/\/[^\s)]+/);
      if (bareUrl) link = bareUrl[0];
    }

    const isUrlOnlyLine = (l) =>
      /^\[?[^\]]*\]?\(?https?:\/\/\S+\)?$/.test(l) && /https?:\/\//.test(l) && l.replace(/https?:\/\/\S+/g, "").trim().length < 3;
    const lines = rawLines.filter(l => !isUrlOnlyLine(l));

    let company = "", title = "", location = "", workType = "", salary = "", recruiter = "";

    const locLineRe = /^([A-Za-zÀ-ÿ'.\s]{2,45},\s?[A-Z]{2})\s*·/;
    let locLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(locLineRe);
      if (m) { location = m[1].trim(); locLineIdx = i; break; }
    }

    if (locLineIdx > 0) {
      title = lines[locLineIdx - 1];
      const logoLine = lines.slice(0, locLineIdx).find(l => /\slogo$/i.test(l));
      if (logoLine) company = logoLine.replace(/\slogo$/i, "").trim();
      else {
        for (let i = locLineIdx - 2; i >= 0; i--) {
          const l = lines[i];
          if (l.length > 1 && l.length < 60 && !/share|show more|promoted|actively reviewing/i.test(l)) {
            company = l;
            break;
          }
        }
      }
    } else {
      const logoLine = lines.find(l => /\slogo$/i.test(l));
      if (logoLine) company = logoLine.replace(/\slogo$/i, "").trim();
      else if (lines[0]) company = lines[0];

      const mdTitleMatch = text.match(/\[([^\]]{4,80})\]\(https?:\/\/[^\s)]*linkedin\.com\/jobs/i);
      if (mdTitleMatch) title = mdTitleMatch[1].trim();
      if (!title) {
        const cand = lines.find(l =>
          l.length > 3 && l.length < 80 &&
          !/logo|share|show more|apply|save|promoted|applicants|ago|premium|message|about the job|hiring team/i.test(l) &&
          /[A-Z]/.test(l[0])
        );
        if (cand) title = cand;
      }
    }

    const workMatch = text.match(/\b(Hybrid|Remote|On-site)\b/i);
    if (workMatch) workType = workMatch[1];

    const rangeRe = /CAD?\s?\$\s?[\d,]+(?:\.\d+)?K?\s*(?:\/\s?yr|per\s?year)?\s*(?:-|to|–)\s*CAD?\s?\$\s?[\d,]+(?:\.\d+)?K?\s*(?:\/\s?yr|per\s?year)?/i;
    const singleRe = /CAD?\s?\$\s?[\d,]+(?:\.\d+)?K?\s*(?:\/\s?yr|per\s?year)?/i;
    const rangeMatch = text.match(rangeRe);
    if (rangeMatch) salary = rangeMatch[0].replace(/\s+/g, " ").trim();
    else {
      const singleMatch = text.match(singleRe);
      if (singleMatch) salary = singleMatch[0].replace(/\s+/g, " ").trim();
    }

    const hIdx = lines.findIndex(l => /hiring team/i.test(l));
    if (hIdx >= 0) {
      for (let i = hIdx + 1; i < Math.min(hIdx + 6, lines.length); i++) {
        const l = lines[i];
        if (/^[A-Z][A-Za-zÀ-ÿ'’.-]*(\s[A-Z][A-Za-zÀ-ÿ'’.-]*){0,3}$/.test(l) && !/message|job poster|^\d/i.test(l)) {
          recruiter = l;
          break;
        }
      }
    }
    return { company, title, location, workType, salary, recruiter, link };
  }

  function addJob(entry) {
    jobs.unshift({
      id: uid(),
      company: entry.company || "Unknown Company",
      title: entry.title || "Untitled Role",
      location: entry.location || "",
      workType: entry.workType || "",
      salary: entry.salary || "",
      recruiter: entry.recruiter || "",
      link: entry.link || "",
      stage: "Wishlist",
      notes: "",
      dateAdded: new Date().toISOString().slice(0, 10),
      // Extended fields (from the spreadsheet) — all optional, edited via the Details panel
      jobType: "", industry: "", companyWebsite: "",
      dateApplied: "", followUpSent: false, followUpDate: "", responseReceived: false, lastContactDate: "",
      resumeUsed: "", coverLetterUsed: false, portfolioLink: "",
      salaryLow: "", salaryHigh: "", myMinSalary: "",
      recruiterEmail: "", hiringManager: "", internalContact: "",
      referralRequested: false, referralGiven: false,
      interviewStage: "", interviewType: "", interviewDate: "", takeHomeAssignment: false, interviewFeedback: "",
      companyVibe: "", roleFit: "", techStackFit: "", growthPotential: "", gutFeeling: "",
      finalOutcome: "", offerAmount: "", rejectionReason: "", wouldReapply: "",
    });
    save(); render();
  }

  function updateJobField(id, field, value) {
    const job = jobs.find(j => j.id === id);
    if (job) { job[field] = value; save(); }
  }

  function priorityScore(job) {
    const vals = [job.companyVibe, job.roleFit, job.techStackFit, job.growthPotential, job.gutFeeling]
      .map(Number).filter(n => !isNaN(n) && n > 0);
    if (!vals.length) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }

  function daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
  }

  function detailField(label, id, jobId, value, type = "text") {
    if (type === "checkbox") {
      return `<div class="dfield"><label>${label}</label><input type="checkbox" class="detail-input" data-field="${id}" data-id="${jobId}" ${value ? "checked" : ""} /></div>`;
    }
    if (type === "select5") {
      const opts = ["", "1", "2", "3", "4", "5"].map(v => `<option value="${v}" ${String(value) === v ? "selected" : ""}>${v || "—"}</option>`).join("");
      return `<div class="dfield"><label>${label}</label><select class="detail-input" data-field="${id}" data-id="${jobId}">${opts}</select></div>`;
    }
    return `<div class="dfield"><label>${label}</label><input type="${type}" class="detail-input" data-field="${id}" data-id="${jobId}" value="${escapeHtml(value || "")}" /></div>`;
  }

  function renderDetailsRow(j) {
    const score = priorityScore(j);
    const ds = daysSince(j.dateApplied);
    return `
    <tr class="details-row">
      <td colspan="6">
        <div class="details-panel">

          <div class="dgroup">
            <h4>Application Info</h4>
            <div class="dfield-grid">
              ${detailField("Job Type", "jobType", j.id, j.jobType)}
              ${detailField("Industry", "industry", j.id, j.industry)}
              ${detailField("Company Website", "companyWebsite", j.id, j.companyWebsite)}
              ${detailField("Date Applied", "dateApplied", j.id, j.dateApplied, "date")}
              ${detailField("Follow-Up Sent", "followUpSent", j.id, j.followUpSent, "checkbox")}
              ${detailField("Follow-Up Date", "followUpDate", j.id, j.followUpDate, "date")}
              ${detailField("Response Received", "responseReceived", j.id, j.responseReceived, "checkbox")}
              ${detailField("Last Contact Date", "lastContactDate", j.id, j.lastContactDate, "date")}
              ${detailField("Resume Version Used", "resumeUsed", j.id, j.resumeUsed)}
              ${detailField("Cover Letter Used", "coverLetterUsed", j.id, j.coverLetterUsed, "checkbox")}
              ${detailField("Portfolio Link", "portfolioLink", j.id, j.portfolioLink)}
              <div class="dfield"><label>Days Since Applied</label><div class="dread">${ds === null ? "—" : ds}</div></div>
            </div>
          </div>

          <div class="dgroup">
            <h4>Salary</h4>
            <div class="dfield-grid">
              ${detailField("Range Low", "salaryLow", j.id, j.salaryLow, "number")}
              ${detailField("Range High", "salaryHigh", j.id, j.salaryHigh, "number")}
              ${detailField("My Minimum", "myMinSalary", j.id, j.myMinSalary, "number")}
            </div>
          </div>

          <div class="dgroup">
            <h4>Contacts &amp; Referrals</h4>
            <div class="dfield-grid">
              ${detailField("Recruiter Email", "recruiterEmail", j.id, j.recruiterEmail)}
              ${detailField("Hiring Manager", "hiringManager", j.id, j.hiringManager)}
              ${detailField("Internal Contact", "internalContact", j.id, j.internalContact)}
              ${detailField("Referral Requested", "referralRequested", j.id, j.referralRequested, "checkbox")}
              ${detailField("Referral Given", "referralGiven", j.id, j.referralGiven, "checkbox")}
            </div>
          </div>

          <div class="dgroup">
            <h4>Interview</h4>
            <div class="dfield-grid">
              ${detailField("Stage", "interviewStage", j.id, j.interviewStage)}
              ${detailField("Type", "interviewType", j.id, j.interviewType)}
              ${detailField("Date", "interviewDate", j.id, j.interviewDate, "date")}
              ${detailField("Take-Home Assignment", "takeHomeAssignment", j.id, j.takeHomeAssignment, "checkbox")}
            </div>
            <textarea class="detail-textarea" data-field="interviewFeedback" data-id="${j.id}" placeholder="Interview feedback / prep notes...">${escapeHtml(j.interviewFeedback)}</textarea>
          </div>

          <div class="dgroup">
            <h4>Gut-Check Scoring <span class="dread" style="margin-left:8px;">Priority: ${score === null ? "—" : score}/5</span></h4>
            <div class="dfield-grid">
              ${detailField("Company Vibe", "companyVibe", j.id, j.companyVibe, "select5")}
              ${detailField("Role Fit", "roleFit", j.id, j.roleFit, "select5")}
              ${detailField("Tech Stack Fit", "techStackFit", j.id, j.techStackFit, "select5")}
              ${detailField("Growth Potential", "growthPotential", j.id, j.growthPotential, "select5")}
              ${detailField("Gut Feeling", "gutFeeling", j.id, j.gutFeeling, "select5")}
            </div>
          </div>

          <div class="dgroup">
            <h4>Outcome</h4>
            <div class="dfield-grid">
              ${detailField("Final Outcome", "finalOutcome", j.id, j.finalOutcome)}
              ${detailField("Offer Amount", "offerAmount", j.id, j.offerAmount, "number")}
              ${detailField("Would Reapply", "wouldReapply", j.id, j.wouldReapply)}
            </div>
            <textarea class="detail-textarea" data-field="rejectionReason" data-id="${j.id}" placeholder="Rejection reason, if any...">${escapeHtml(j.rejectionReason)}</textarea>
          </div>

        </div>
      </td>
    </tr>`;
  }

  function cycleStage(id, backward) {
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    let idx = STAGES.indexOf(job.stage);
    idx = backward ? (idx - 1 + STAGES.length) % STAGES.length : (idx + 1) % STAGES.length;
    job.stage = STAGES[idx];
    save(); render();
  }

  function updateNotes(id, val) {
    const job = jobs.find(j => j.id === id);
    if (job) { job.notes = val; save(); }
  }

  function deleteJob(id) {
    jobs = jobs.filter(j => j.id !== id);
    save(); render();
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function computeStats() {
    const total = jobs.length;
    const active = jobs.filter(j => j.stage !== "Rejected").length;
    const interviewingPlus = jobs.filter(j => ["Interviewing", "Offer"].includes(j.stage)).length;
    const appliedOrBeyond = jobs.filter(j => j.stage !== "Wishlist").length;
    const responseRate = appliedOrBeyond > 0
      ? Math.round((jobs.filter(j => !["Wishlist", "Applied"].includes(j.stage)).length / appliedOrBeyond) * 100)
      : 0;
    return { total, active, interviewingPlus, responseRate };
  }

  function renderCharts() {
    const stageCounts = STAGES.map(s => jobs.filter(j => j.stage === s).length);
    const stageColors = STAGES.map(s => cssVar(STAGE_CLASS[s][1]));

    const stageCtx = document.getElementById("stageChart");
    if (stageChart) stageChart.destroy();
    if (stageCtx) {
      stageChart = new Chart(stageCtx, {
        type: "doughnut",
        data: {
          labels: STAGES,
          datasets: [{ data: stageCounts, backgroundColor: stageColors, borderWidth: 0 }],
        },
        options: {
          plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
          cutout: "62%",
        },
      });
    }

    const byDate = {};
    jobs.forEach(j => { byDate[j.dateAdded] = (byDate[j.dateAdded] || 0) + 1; });
    const sortedDates = Object.keys(byDate).sort();
    const last14 = sortedDates.slice(-14);

    const timeCtx = document.getElementById("timeChart");
    if (timeChart) timeChart.destroy();
    if (timeCtx) {
      timeChart = new Chart(timeCtx, {
        type: "bar",
        data: {
          labels: last14.map(d => d.slice(5)),
          datasets: [{ data: last14.map(d => byDate[d]), backgroundColor: cssVar("--coral"), borderRadius: 5, maxBarThickness: 22 }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } },
        },
      });
    }
  }

  function render() {
    const stats = computeStats();
    let visible = jobs.filter(j => filterStage === "All" || j.stage === filterStage);
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      visible = visible.filter(j =>
        (j.company || "").toLowerCase().includes(t) ||
        (j.title || "").toLowerCase().includes(t) ||
        (j.location || "").toLowerCase().includes(t)
      );
    }

    app.innerHTML = `
      <div class="header">
        <div class="brand">
          <div class="brand-mark">🚀</div>
          <div>
            <div class="brand-title">Vector</div>
            <div class="brand-sub">track applications, paste to parse, click to advance</div>
          </div>
        </div>
        <button class="btn" id="toggle-add">${showAdd ? "Close" : "+ Add Job"}</button>
      </div>

      <div class="stats-row">
        <div class="stat-card"><div class="stat-num">${stats.total}</div><div class="stat-label">Total tracked</div></div>
        <div class="stat-card"><div class="stat-num">${stats.active}</div><div class="stat-label">Still active</div></div>
        <div class="stat-card"><div class="stat-num">${stats.interviewingPlus}</div><div class="stat-label">Interviewing or further</div></div>
        <div class="stat-card"><div class="stat-num">${stats.responseRate}%</div><div class="stat-label">Response rate</div></div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <h3>Applications by day (last 14 active days)</h3>
          <canvas id="timeChart"></canvas>
        </div>
        <div class="chart-card">
          <h3>Pipeline breakdown</h3>
          <canvas id="stageChart"></canvas>
        </div>
      </div>

      <div class="panel links-panel">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <h3>Quick Links</h3>
            <p class="hint" style="margin-bottom:0;">Save your LinkedIn, portfolio, GitHub, etc. Click any link to copy it instantly for application forms.</p>
          </div>
          <button class="btn ghost small" id="toggle-link-add">${showLinkAdd ? "Close" : "+ Add Link"}</button>
        </div>

        ${showLinkAdd ? `
        <div class="link-add-row">
          <input id="new-link-label" placeholder="Label (e.g. LinkedIn, Portfolio, GitHub)" />
          <input id="new-link-url" placeholder="https://..." />
          <button class="btn small" id="save-link-btn">Save</button>
        </div>
        ` : ""}

        <div class="links-wrap">
          ${links.length === 0 ? `<div class="loc" style="padding:6px 0;">No links saved yet.</div>` :
            links.map(l => `
              <div class="link-chip" data-id="${l.id}">
                ${editingLinkId === l.id ? `
                  <input class="edit-link-label" data-id="${l.id}" value="${escapeHtml(l.label)}" />
                  <input class="edit-link-url" data-id="${l.id}" value="${escapeHtml(l.url)}" />
                  <button class="chip-btn confirm" data-id="${l.id}" data-action="confirm-edit" title="Save">✓</button>
                  <button class="chip-btn" data-id="${l.id}" data-action="cancel-edit" title="Cancel">×</button>
                ` : `
                  <span class="link-label" data-id="${l.id}" data-action="copy" title="Click to copy">${escapeHtml(l.label)}</span>
                  <button class="chip-btn" data-id="${l.id}" data-action="edit-link" title="Edit">✎</button>
                  <button class="chip-btn del" data-id="${l.id}" data-action="delete-link" title="Delete">×</button>
                `}
              </div>
            `).join("")
          }
        </div>
      </div>

      ${showAdd ? `
      <div class="panel">
        <h3>Paste a listing</h3>
        <p class="hint">Paste the raw job posting text &mdash; company, title, location, salary, and recruiter fill in automatically where possible. Review before saving.</p>
        <textarea id="paste-box" placeholder="Paste the full job posting text here..."></textarea>
        <div style="display:flex; gap:10px; margin-bottom:6px;">
          <button class="btn small" id="parse-btn">Parse &amp; Fill Fields</button>
          <button class="btn ghost small" id="clear-paste">Clear</button>
        </div>
        <h3 style="margin-top:16px;">Or fill in manually</h3>
        <div class="field-grid">
          <div class="field"><label>Company</label><input id="f-company" /></div>
          <div class="field"><label>Title</label><input id="f-title" /></div>
          <div class="field"><label>Location</label><input id="f-location" /></div>
          <div class="field"><label>Work Type</label><input id="f-worktype" placeholder="Hybrid / Remote / On-site" /></div>
          <div class="field"><label>Salary</label><input id="f-salary" /></div>
          <div class="field"><label>Recruiter / Contact</label><input id="f-recruiter" /></div>
          <div class="field" style="grid-column: span 2;"><label>Link</label><input id="f-link" /></div>
        </div>
        <button class="btn" id="save-btn">Save Job</button>
      </div>
      ` : ""}

      <div class="toolbar">
        <input class="search-input" id="search-box" placeholder="Search company, title, location..." value="${escapeHtml(searchTerm)}" />
        <span class="chip ${filterStage === "All" ? "active" : ""}" data-stage="All">All</span>
        ${STAGES.map(s => `<span class="chip ${filterStage === s ? "active" : ""}" data-stage="${s}">${s}</span>`).join("")}
      </div>

      ${visible.length === 0 ? `
        <div class="empty-state">
          <div class="big">📭</div>
          <div>No jobs here yet. Paste your first listing above to get started.</div>
        </div>
      ` : `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Company / Role</th><th>Location</th><th>Status</th><th>Notes</th><th>Added</th><th></th></tr>
          </thead>
          <tbody>
            ${visible.map(j => {
              const [bgVar, fgVar] = STAGE_CLASS[j.stage] || ["--paper-alt", "--ink"];
              const isOpen = expandedJobId === j.id;
              return `
              <tr>
                <td>
                  <div class="company">${escapeHtml(j.company)}</div>
                  <div class="role-title">${escapeHtml(j.title)}</div>
                  ${j.link ? `<a class="view-link" href="${escapeHtml(j.link)}" target="_blank" rel="noopener">View posting →</a>` : ""}
                  ${j.recruiter ? `<div class="loc">Contact: ${escapeHtml(j.recruiter)}</div>` : ""}
                </td>
                <td class="loc">${escapeHtml(j.location)}${j.workType ? " · " + escapeHtml(j.workType) : ""}${j.salary ? "<br/>" + escapeHtml(j.salary) : ""}</td>
                <td><span class="pill" style="background:var(${bgVar});color:var(${fgVar})" data-id="${j.id}" data-action="stage-fwd" title="Click to advance, shift-click to go back">${j.stage}</span></td>
                <td><textarea class="notes-input" data-id="${j.id}" placeholder="notes...">${escapeHtml(j.notes)}</textarea></td>
                <td class="loc">${escapeHtml(j.dateAdded)}</td>
                <td style="white-space:nowrap;">
                  <button class="details-toggle" data-id="${j.id}" title="More fields">${isOpen ? "▲" : "Details"}</button>
                  <button class="del-btn" data-id="${j.id}" data-action="delete" title="Delete">×</button>
                </td>
              </tr>
              ${isOpen ? renderDetailsRow(j) : ""}`;
            }).join("")}
          </tbody>
        </table>
      </div>
      `}
    `;

    attachHandlers();
    renderCharts();
  }

  function attachHandlers() {
    const toggle = document.getElementById("toggle-add");
    if (toggle) toggle.onclick = () => { showAdd = !showAdd; render(); };

    const parseBtn = document.getElementById("parse-btn");
    if (parseBtn) parseBtn.onclick = () => {
      const text = document.getElementById("paste-box").value;
      if (!text.trim()) return;
      const p = parsePaste(text);
      document.getElementById("f-company").value = p.company;
      document.getElementById("f-title").value = p.title;
      document.getElementById("f-location").value = p.location;
      document.getElementById("f-worktype").value = p.workType;
      document.getElementById("f-salary").value = p.salary;
      document.getElementById("f-recruiter").value = p.recruiter;
      document.getElementById("f-link").value = p.link;
    };

    const clearBtn = document.getElementById("clear-paste");
    if (clearBtn) clearBtn.onclick = () => { document.getElementById("paste-box").value = ""; };

    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) saveBtn.onclick = () => {
      const entry = {
        company: document.getElementById("f-company").value.trim(),
        title: document.getElementById("f-title").value.trim(),
        location: document.getElementById("f-location").value.trim(),
        workType: document.getElementById("f-worktype").value.trim(),
        salary: document.getElementById("f-salary").value.trim(),
        recruiter: document.getElementById("f-recruiter").value.trim(),
        link: document.getElementById("f-link").value.trim(),
      };
      if (!entry.company && !entry.title) return;
      addJob(entry);
      showAdd = false;
    };

    const searchBox = document.getElementById("search-box");
    if (searchBox) searchBox.oninput = (e) => { searchTerm = e.target.value; render(); document.getElementById("search-box").focus(); };

    document.querySelectorAll(".chip").forEach(chip => {
      chip.onclick = () => { filterStage = chip.getAttribute("data-stage"); render(); };
    });

    document.querySelectorAll(".pill[data-action='stage-fwd']").forEach(pill => {
      pill.onclick = (e) => cycleStage(pill.getAttribute("data-id"), e.shiftKey);
    });

    document.querySelectorAll(".del-btn[data-action='delete']").forEach(btn => {
      btn.onclick = () => { if (confirm("Delete this entry?")) deleteJob(btn.getAttribute("data-id")); };
    });

    document.querySelectorAll(".notes-input").forEach(ta => {
      ta.onblur = (e) => updateNotes(ta.getAttribute("data-id"), e.target.value);
    });

    document.querySelectorAll(".details-toggle").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        expandedJobId = expandedJobId === id ? null : id;
        render();
      };
    });

    document.querySelectorAll(".detail-input").forEach(el => {
      const handler = (e) => {
        const field = el.getAttribute("data-field");
        const id = el.getAttribute("data-id");
        const val = el.type === "checkbox" ? el.checked : el.value;
        updateJobField(id, field, val);
        if (["companyVibe", "roleFit", "techStackFit", "growthPotential", "gutFeeling", "dateApplied"].includes(field)) render();
      };
      el.addEventListener(el.tagName === "SELECT" || el.type === "checkbox" || el.type === "date" ? "change" : "blur", handler);
    });

    document.querySelectorAll(".detail-textarea").forEach(ta => {
      ta.onblur = (e) => updateJobField(ta.getAttribute("data-id"), ta.getAttribute("data-field"), e.target.value);
    });

    const toggleLinkAdd = document.getElementById("toggle-link-add");
    if (toggleLinkAdd) toggleLinkAdd.onclick = () => { showLinkAdd = !showLinkAdd; render(); };

    const saveLinkBtn = document.getElementById("save-link-btn");
    if (saveLinkBtn) saveLinkBtn.onclick = () => {
      const label = document.getElementById("new-link-label").value;
      const url = document.getElementById("new-link-url").value;
      if (!label.trim() || !url.trim()) return;
      addLink(label, url);
      showLinkAdd = false;
    };

    document.querySelectorAll(".link-label[data-action='copy']").forEach(el => {
      el.onclick = () => copyLink(el.getAttribute("data-id"));
    });

    document.querySelectorAll(".chip-btn[data-action='edit-link']").forEach(btn => {
      btn.onclick = () => { editingLinkId = btn.getAttribute("data-id"); render(); };
    });

    document.querySelectorAll(".chip-btn[data-action='cancel-edit']").forEach(btn => {
      btn.onclick = () => { editingLinkId = null; render(); };
    });

    document.querySelectorAll(".chip-btn[data-action='confirm-edit']").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const label = document.querySelector(`.edit-link-label[data-id="${id}"]`).value;
        const url = document.querySelector(`.edit-link-url[data-id="${id}"]`).value;
        updateLink(id, label, url);
      };
    });

    document.querySelectorAll(".chip-btn[data-action='delete-link']").forEach(btn => {
      btn.onclick = () => { if (confirm("Delete this link?")) deleteLink(btn.getAttribute("data-id")); };
    });
  }

  load();
})();
