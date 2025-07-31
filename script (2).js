// Client side logic for NHL 25 Tournament Manager

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

// Run auth checks and UI state on page load
document.addEventListener("DOMContentLoaded", () => {
  // Full script omitted for brevity in preview
});
