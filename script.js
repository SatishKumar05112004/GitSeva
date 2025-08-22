// ===== Utilities =====
const $ = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);

const state = {
  chart: null,
  theme: localStorage.getItem("gitseva_theme") || "dark",
  bgIndex: 0,
  bgImages: [
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1526378722484-bd91ca387e72?auto=format&fit=crop&w=1920&q=80"
  ]
};

function setBackground(idx){
  document.body.style.backgroundImage =
    `url('${state.bgImages[idx]}')`;
}
setBackground(state.bgIndex);
setInterval(() => {
  state.bgIndex = (state.bgIndex + 1) % state.bgImages.length;
  setBackground(state.bgIndex);
}, 8000);

// ===== Tabs =====
$$(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const key = btn.dataset.tab;
    $$(".tabpanel").forEach(p => p.classList.remove("active"));
    $("#tab-" + key).classList.add("active");
  });
});

// ===== Theme (placeholder for future light theme) =====
function applyTheme() {
  if (state.theme === "dark") {
    document.body.classList.remove("light");
  } else {
    document.body.classList.add("light");
  }
}
applyTheme();
$("#toggleTheme").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("gitseva_theme", state.theme);
  applyTheme();
});

// ===== Forms: Enter key works via submit =====
$("#searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = $("#usernameInput").value.trim();
  if (u) getUser(u);
});

$("#compareForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const u1 = $("#u1").value.trim();
  const u2 = $("#u2").value.trim();
  await compareUsers(u1, u2);
});

// Buttons that exist after render
$("#btnSaveFav")?.addEventListener("click", saveFavorite);
$("#clearFav")?.addEventListener("click", clearFavorites);
$("#btnDownload")?.addEventListener("click", downloadPDF);

// ===== Fetch helper =====
async function fetchJSON(url) {
  const res = await fetch(url, { headers: { "Accept": "application/vnd.github+json" }});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ===== Single user flow =====
async function getUser(username) {
  const result = $("#result");
  const error  = $("#error");
  const load   = $("#loading");
  const reposCard = $("#reposList");
  const repoItems = $("#repoItems");
  const activityCard = $("#activityCard");
  const orgsCard = $("#orgsCard");
  const orgsList = $("#orgsList");

  // reset
  [result, error, reposCard, activityCard, orgsCard].forEach(el => el.classList.add("hidden"));
  error.classList.remove("bad");
  error.textContent = "";
  repoItems.innerHTML = "";
  orgsList.innerHTML = "";
  load.classList.remove("hidden");

  try {
    const user = await fetchJSON(`https://api.github.com/users/${username}`);

    // Profile basics
    $("#avatar").src = user.avatar_url;
    $("#name").textContent = user.name || user.login;
    $("#bio").textContent = user.bio || "No bio";
    $("#repos").textContent = user.public_repos ?? 0;
    $("#gists").textContent = user.public_gists ?? 0;
    $("#followers").href = `${user.html_url}?tab=followers`;
    $("#followers").textContent = user.followers ?? 0;
    $("#following").href = `${user.html_url}?tab=following`;
    $("#following").textContent = user.following ?? 0;
    $("#profileLink").href = user.html_url;

    // Extras (company, location, blog, email, twitter, joined)
    toggleChip("#company", user.company);
    toggleChip("#location", user.location);
    if (user.blog) {
      const blogUrl = user.blog.startsWith("http") ? user.blog : `https://${user.blog}`;
      const a = $("#blog");
      a.href = blogUrl;
      a.textContent = "Website";
      a.classList.remove("hidden");
    } else { $("#blog").classList.add("hidden"); }

    if (user.email) {
      const e = $("#email");
      e.href = `mailto:${user.email}`;
      e.textContent = "Email";
      e.classList.remove("hidden");
    } else { $("#email").classList.add("hidden"); }

    if (user.twitter_username) {
      const t = $("#twitter");
      t.href = `https://twitter.com/${user.twitter_username}`;
      t.textContent = `@${user.twitter_username}`;
      t.classList.remove("hidden");
    } else { $("#twitter").classList.add("hidden"); }

    if (user.created_at) {
      const d = new Date(user.created_at);
      const j = $("#joined");
      j.textContent = `Joined ${d.toLocaleDateString()}`;
      j.classList.remove("hidden");
    } else { $("#joined").classList.add("hidden"); }

    result.classList.remove("hidden");

    // Repos (top 8)
    const sortMode = $("#repoSort").value; // "updated" | "stars"
    const repos = await fetchJSON(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`);
    const top = repos
      .filter(r => !r.fork)
      .sort((a,b) => sortMode === "stars"
        ? (b.stargazers_count||0) - (a.stargazers_count||0)
        : new Date(b.pushed_at) - new Date(a.pushed_at))
      .slice(0, 8);

    for (const r of top) {
      const li = document.createElement("li");
      li.className = "repo";
      li.innerHTML = `
        <div>
          <a href="${r.html_url}" target="_blank" rel="noopener">${r.name}</a>
          <div class="muted tiny">${r.description ? r.description : ""}</div>
        </div>
        <div class="badges">
          <span class="badge">⭐ ${r.stargazers_count}</span>
          <span class="badge">🍴 ${r.forks_count}</span>
          <span class="badge">${r.language || "N/A"}</span>
          <span class="badge">⬆ ${new Date(r.pushed_at).toLocaleDateString()}</span>
        </div>
      `;
      repoItems.appendChild(li);
    }
    reposCard.classList.remove("hidden");

    // Activity (30 days)
    await buildActivity(username);
    activityCard.classList.remove("hidden");

    // Orgs
    try {
      const orgs = await fetchJSON(`https://api.github.com/users/${username}/orgs`);
      if (Array.isArray(orgs) && orgs.length) {
        for (const o of orgs.slice(0, 12)) {
          const li = document.createElement("li");
          li.className = "org";
          li.innerHTML = `
            <img src="${o.avatar_url}" alt="${o.login}"/>
            <span>${o.login}</span>
          `;
          orgsList.appendChild(li);
        }
        orgsCard.classList.remove("hidden");
      }
    } catch (_) { /* ignore org errors */ }

    // Favorites visible
    showFavorites();

  } catch (err) {
    $("#error").textContent = "User not found or API rate limit reached.";
    $("#error").classList.add("bad");
    $("#error").classList.remove("hidden");
  } finally {
    $("#loading").classList.add("hidden");
  }
}

// Helper to toggle simple chips
function toggleChip(sel, val){
  const el = $(sel);
  if (val) { el.textContent = val; el.classList.remove("hidden"); }
  else { el.classList.add("hidden"); }
}

// Re-sort repos when dropdown changes
$("#repoSort").addEventListener("change", () => {
  const link = $("#profileLink").href;
  if (!link || link === "#") return;
  const username = new URL(link).pathname.replace("/", "");
  if (username) getUser(username);
});

// ===== Activity (30 days) from public push events =====
async function buildActivity(username) {
  const events = await fetchJSON(`https://api.github.com/users/${username}/events?per_page=100`);
  const days = [];
  const counts = {};

  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    days.push(key); counts[key] = 0;
  }

  for (const ev of events) {
    if (ev.type === "PushEvent") {
      const day = ev.created_at.slice(0,10);
      if (counts[day] !== undefined) {
        const c = Array.isArray(ev.payload?.commits) ? ev.payload.commits.length : 0;
        counts[day] += c;
      }
    }
  }

  const data = days.map(d => counts[d]);
  const ctx = $("#activityChart").getContext("2d");
  if (state.chart) state.chart.destroy();

  state.chart = new Chart(ctx, {
    type: "bar",
    data: { labels: days.map(d => d.slice(5)), datasets: [{ label: "Commits", data }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,.18)" } }
      }
    }
  });
}

// ===== Favorites =====
function saveFavorite() {
  const name = $("#name").textContent;
  const link = $("#profileLink").href;
  const avatar = $("#avatar").src;
  if (!link || link === "#") return;

  const list = JSON.parse(localStorage.getItem("gitseva_fav") || "[]");
  if (!list.some(x => x.link === link)) {
    list.push({ name, link, avatar });
    localStorage.setItem("gitseva_fav", JSON.stringify(list));
    showFavorites();
  }
}
function removeFavorite(link) {
  let list = JSON.parse(localStorage.getItem("gitseva_fav") || "[]");
  list = list.filter(x => x.link !== link);
  localStorage.setItem("gitseva_fav", JSON.stringify(list));
  showFavorites();
}
function clearFavorites() {
  localStorage.removeItem("gitseva_fav");
  showFavorites();
}
function showFavorites() {
  const wrap = $("#favoritesSection");
  const ul = $("#favoriteList");
  const list = JSON.parse(localStorage.getItem("gitseva_fav") || "[]");
  ul.innerHTML = "";

  if (!list.length) { wrap.classList.add("hidden"); return; }

  for (const f of list) {
    const li = document.createElement("li");
    li.className = "fav-item";
    li.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <img src="${f.avatar}" alt="" style="width:28px;height:28px;border-radius:50%">
        <a href="${f.link}" target="_blank" rel="noopener">${f.name}</a>
      </div>
      <div>
        <button type="button" data-link="${f.link}">Remove</button>
      </div>
    `;
    ul.appendChild(li);
  }
  ul.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => removeFavorite(b.dataset.link));
  });

  wrap.classList.remove("hidden");
}

// ===== PDF export =====
async function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const card = $("#result");
  if (card.classList.contains("hidden")) return;

  const canvas = await html2canvas(card, { backgroundColor: null, scale: 2 });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageWidth * 0.9 / canvas.width, pageHeight * 0.9 / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  const x = (pageWidth - w) / 2;
  const y = 40;

  pdf.addImage(img, "PNG", x, y, w, h);
  pdf.save("gitseva-profile.pdf");
}

// ===== Compare users =====
async function getSummary(username) {
  const user = await fetchJSON(`https://api.github.com/users/${username}`);
  const repos = await fetchJSON(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`);
  const starSum = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
  return {
    name: user.name || user.login,
    link: user.html_url,
    avatar: user.avatar_url,
    repos: user.public_repos ?? 0,
    followers: user.followers ?? 0,
    following: user.following ?? 0,
    stars: starSum
  };
}

async function compareUsers(u1, u2) {
  const error  = $("#cmpError");
  const load   = $("#cmpLoading");
  const wrap   = $("#compareWrap");
  error.classList.add("hidden");
  wrap.classList.add("hidden");
  load.classList.remove("hidden");

  if (!u1 || !u2) {
    error.textContent = "Enter two usernames.";
    error.classList.remove("hidden");
    load.classList.add("hidden");
    return;
  }

  try {
    const [a, b] = await Promise.all([getSummary(u1), getSummary(u2)]);
    $("#c1avatar").src = a.avatar; $("#c1name").textContent = a.name; $("#c1link").href = a.link;
    $("#c1repos").textContent = a.repos; $("#c1followers").textContent = a.followers; $("#c1following").textContent = a.following; $("#c1stars").textContent = a.stars;

    $("#c2avatar").src = b.avatar; $("#c2name").textContent = b.name; $("#c2link").href = b.link;
    $("#c2repos").textContent = b.repos; $("#c2followers").textContent = b.followers; $("#c2following").textContent = b.following; $("#c2stars").textContent = b.stars;

    wrap.classList.remove("hidden");
  } catch {
    error.textContent = "One or both users not found, or API limit reached.";
    error.classList.remove("hidden");
  } finally {
    load.classList.add("hidden");
  }
}

// Init favorites on load
document.addEventListener("DOMContentLoaded", showFavorites);
