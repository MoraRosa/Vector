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
  const STORAGE_KEY = "jobhunthq:entries";

  let jobs = [];
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
    render();
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)); }
    catch (e) { console.error("Save failed", e); }
  }

  function parsePaste(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    let company = "", title = "", location = "", workType = "", salary = "", recruiter = "", link = "";

    const logoLine = lines.find(l => /\slogo$/i.test(l));
    if (logoLine) company = logoLine.replace(/\slogo$/i, "").trim();
    else if (lines[0]) company = lines[0];

    const linkMatch = text.match(/\((https?:\/\/[^\s)]+)\)/);
    if (linkMatch) link = linkMatch[1];
    else {
      const bareUrl = text.match(/https?:\/\/[^\s)]+/);
      if (bareUrl) link = bareUrl[0];
    }

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

    const locMatch = text.match(/([A-Za-zÀ-ÿ.\s]+,\s?[A-Z]{2})\s*(?:\(|·|\n)/);
    if (locMatch) location = locMatch[1].trim();

    const workMatch = text.match(/\b(Hybrid|Remote|On-site)\b/i);
    if (workMatch) workType = workMatch[1];

    const salMatch = text.match(/CA\$\s?[\d,]+K?(?:\/yr)?\s*(?:-\s*CA\$\s?[\d,]+K?(?:\/yr)?)?/i);
    if (salMatch) salary = salMatch[0];

    const hIdx = lines.findIndex(l => /hiring team/i.test(l));
    if (hIdx >= 0) {
      for (let i = hIdx + 1; i < Math.min(hIdx + 6, lines.length); i++) {
        const l = lines[i];
        if (/^[A-Z][a-zÀ-ÿ'’.-]+(\s[A-Z][a-zÀ-ÿ'’.-]+){0,3}$/.test(l) && !/message|job poster|^\d/i.test(l)) {
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
    });
    save(); render();
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
            <div class="brand-title">Job Hunt HQ</div>
            <div class="brand-sub">paste a listing, watch it move</div>
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
                <td><button class="del-btn" data-id="${j.id}" data-action="delete" title="Delete">×</button></td>
              </tr>`;
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
  }

  load();
})();
