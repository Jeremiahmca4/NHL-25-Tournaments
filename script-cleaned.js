
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
    return JSON.parse(atob(token.split('.')[1]));
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

document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();
  const user = token ? decodeToken(token) : null;

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const logoutBtn = document.getElementById("logout-btn");
  const adminPanel = document.getElementById("admin-panel");
  const userPanel = document.getElementById("user-panel");
  const tournamentForm = document.getElementById("tournament-form");
  const teamForm = document.getElementById("team-form");
  const tournamentSelect = document.getElementById("tournament-select");

  if (user) {
    loginForm.style.display = "none";
    registerForm.style.display = "none";
    logoutBtn.style.display = "block";
    userPanel.style.display = "block";

    if (user.isAdmin) {
      adminPanel.style.display = "block";
    }

    fetch(`${apiBase}/tournaments`)
      .then(res => res.json())
      .then(tournaments => {
        tournamentSelect.innerHTML = tournaments.map(t => `<option value="${t._id}">${t.name}</option>`).join("");
      });
  }

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const adminCode = document.getElementById("reg-admincode").value;

    const res = await fetch(`${apiBase}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, adminCode })
    });
    const data = await res.json();
    if (res.ok) {
      showMessage("Registered! Now log in.");
    } else {
      showMessage(data.error || "Registration failed", "error");
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("log-email").value;
    const password = document.getElementById("log-password").value;

    const res = await fetch(`${apiBase}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      saveToken(data.token);
      location.reload();
    } else {
      showMessage(data.error || "Login failed", "error");
    }
  });

  logoutBtn.addEventListener("click", logout);

  tournamentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("tournament-name").value;
    const date = document.getElementById("tournament-date").value;

    const res = await fetch(`${apiBase}/tournaments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken()
      },
      body: JSON.stringify({ name, date })
    });
    const data = await res.json();
    if (res.ok) {
      showMessage("Tournament created");
      location.reload();
    } else {
      showMessage(data.error || "Failed to create", "error");
    }
  });

  teamForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const teamName = document.getElementById("team-name").value;
    const gamertag = document.getElementById("team-gamertag").value;
    const tournamentId = tournamentSelect.value;

    const res = await fetch(`${apiBase}/register-team`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken()
      },
      body: JSON.stringify({ teamName, gamertag, tournamentId })
    });
    const data = await res.json();
    if (res.ok) {
      showMessage("Team registered!");
    } else {
      showMessage(data.error || "Failed to register", "error");
    }
  });
});
