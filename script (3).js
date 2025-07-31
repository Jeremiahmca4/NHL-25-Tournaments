// Full Client-side Logic for NHL 25 Tournament Platform

const apiBase = "https://nhl25-backend.onrender.com/api";
const messageDiv = document.createElement("div");
messageDiv.id = "message";
document.body.prepend(messageDiv);

function showMessage(msg, type = "success") {
  messageDiv.textContent = msg;
  messageDiv.className = type;
  setTimeout(() => {
    messageDiv.textContent = "";
    messageDiv.className = "";
  }, 4000);
}

function decodeToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

function saveToken(token) {
  localStorage.setItem("jwt", token);
}

function getToken() {
  return localStorage.getItem("jwt");
}

function logout() {
  localStorage.removeItem("jwt");
  location.reload();
}

async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  if (!token) throw new Error("Not logged in");
  return await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      ...(options.headers || {})
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");
  const tournamentForm = document.getElementById("createTournamentForm");
  const teamForm = document.getElementById("registerTeamForm");
  const codeGenForm = document.getElementById("generateCodeForm");
  const tournamentSelect = document.getElementById("tournamentSelect");
  const tournamentList = document.getElementById("tournamentList");
  const teamList = document.getElementById("teamList");

  async function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById("signupUsername").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value.trim();
    const adminCode = document.getElementById("adminCode").value.trim();
    try {
      const res = await fetch(`${apiBase}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, adminCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      showMessage("Signed up! Please log in.", "success");
    } catch (err) {
      showMessage(err.message, "error");
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    try {
      const res = await fetch(`${apiBase}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      saveToken(data.token);
      renderDashboard();
    } catch (err) {
      showMessage(err.message, "error");
    }
  }

  async function renderDashboard() {
    const token = getToken();
    if (!token) return;
    const decoded = decodeToken(token);
    if (!decoded) return;

    document.getElementById("auth-section").style.display = "none";
    document.getElementById("user-info").innerHTML = \`Logged in as: \${decoded.id} <button onclick="logout()">Logout</button>\`;

    loadTournaments();

    if (decoded.isAdmin) {
      document.getElementById("tournament-section").style.display = "block";
      document.getElementById("admin-settings").style.display = "block";
      loadTeams();
    } else {
      document.getElementById("team-registration").style.display = "block";
    }
  }

  async function loadTournaments() {
    try {
      const res = await fetch(`${apiBase}/tournaments`);
      const tournaments = await res.json();
      tournamentList.innerHTML = tournaments.map(t => `<li>${t.name}</li>`).join("");
      tournamentSelect.innerHTML = tournaments.map(t => `<option value="${t._id}">${t.name}</option>`).join("");
    } catch {
      showMessage("Failed to load tournaments", "error");
    }
  }

  async function loadTeams() {
    try {
      const res = await fetchWithAuth(`${apiBase}/teams`);
      const teams = await res.json();
      teamList.innerHTML = teams.map(t => `<li>${t.teamName} (Captain: ${t.captainEmail})</li>`).join("");
    } catch {
      showMessage("Failed to load teams", "error");
    }
  }

  async function handleTournamentCreate(e) {
    e.preventDefault();
    const name = document.getElementById("tournamentName").value.trim();
    try {
      const res = await fetchWithAuth(`${apiBase}/tournaments`, {
        method: "POST",
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMessage("Tournament created");
      loadTournaments();
    } catch (err) {
      showMessage(err.message, "error");
    }
  }

  async function handleTeamRegister(e) {
    e.preventDefault();
    const teamName = document.getElementById("teamName").value.trim();
    const tournamentId = tournamentSelect.value;
    const gamertags = document.getElementById("gamertags").value.trim().split(",").map(g => g.trim());
    try {
      const res = await fetchWithAuth(`${apiBase}/teams`, {
        method: "POST",
        body: JSON.stringify({ teamName, tournamentId, gamertags })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMessage("Team registered");
      loadTournaments();
    } catch (err) {
      showMessage(err.message, "error");
    }
  }

  async function handleCodeGeneration(e) {
    e.preventDefault();
    try {
      const res = await fetchWithAuth(`${apiBase}/generate-admin-code`, {
        method: "POST",
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMessage("New admin code: " + data.code);
    } catch (err) {
      showMessage(err.message, "error");
    }
  }

  if (signupForm) signupForm.addEventListener("submit", handleSignup);
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (tournamentForm) tournamentForm.addEventListener("submit", handleTournamentCreate);
  if (teamForm) teamForm.addEventListener("submit", handleTeamRegister);
  if (codeGenForm) codeGenForm.addEventListener("submit", handleCodeGeneration);

  renderDashboard();
});
