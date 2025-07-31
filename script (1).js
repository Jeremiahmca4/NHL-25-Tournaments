const apiBase = "https://nhl25-backend.onrender.com/api";

async function registerTeam(teamName) {
  const response = await fetch(`${apiBase}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: teamName })
  });

  const data = await response.json();
  console.log("Registration result:", data);
  return data;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registrationForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const teamNameInput = document.getElementById("teamName");
      const teamName = teamNameInput.value.trim();
      if (teamName) {
        await registerTeam(teamName);
        teamNameInput.value = "";
      }
    });
  }
});
