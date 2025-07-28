/*
  NHL 25 Tournament Manager Script

  This script handles the core functionality of the tournament manager:
   - Captains can register teams with up to 15 players (including the captain)
   - Registered teams are persisted to localStorage
   - Tournament organisers can select up to 16 teams and create a single
     elimination bracket, which is generated and displayed on the page
   - The bracket automatically fills any unused slots with BYEs to
     complete a power‑of‑two bracket up to 16

  All data is maintained client‑side; no backend services are
  required. Reloading the page will retain registered teams, but not
  created brackets.
*/

(() => {
  const MAX_PLAYERS = 15;
  let teams = [];
  const tournaments = [];

  // DOM references
  const playersContainer = document.getElementById("playersContainer");
  const addPlayerBtn = document.getElementById("addPlayerBtn");
  const teamForm = document.getElementById("teamForm");
  const teamListUl = document.getElementById("teamListUl");
  const teamSelection = document.getElementById("teamSelection");
  const tournamentForm = document.getElementById("tournamentForm");
  const bracketContainer = document.getElementById("bracketContainer");

  // Load teams from localStorage
  function loadTeams() {
    const saved = localStorage.getItem("nhl25Teams");
    if (saved) {
      try {
        teams = JSON.parse(saved);
      } catch (err) {
        console.error("Failed to parse saved teams", err);
        teams = [];
      }
    }
  }

  // Persist teams to localStorage
  function saveTeams() {
    localStorage.setItem("nhl25Teams", JSON.stringify(teams));
  }

  // Create a new player row and append to playersContainer
  function addPlayerRow() {
    const existingRows = playersContainer.querySelectorAll(".player-row").length;
    if (existingRows >= MAX_PLAYERS) {
      alert(`You can register up to ${MAX_PLAYERS} players.`);
      return;
    }
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `
      <input type="text" placeholder="Player Gamertag" class="playerGamertag" />
      <input type="email" placeholder="Player Email (optional)" class="playerEmail" />
    `;
    playersContainer.appendChild(row);
  }

  // Reset player input fields to a single empty row
  function resetPlayerFields() {
    playersContainer.innerHTML = "<h3>Players (max 15)</h3>";
    addPlayerRow();
  }

  // Render the list of registered teams
  function renderTeamList() {
    teamListUl.innerHTML = "";
    teams.forEach((team) => {
      const li = document.createElement("li");
      li.textContent = `${team.name} (Players: ${team.players.length})`;
      teamListUl.appendChild(li);
    });
  }

  // Render the team selection checkboxes for tournament creation
  function renderTeamSelection() {
    teamSelection.innerHTML = "";
    const heading = document.createElement("h3");
    heading.textContent = "Select Teams (max 16)";
    teamSelection.appendChild(heading);
    teams.forEach((team) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = team.id;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(team.name));
      teamSelection.appendChild(label);
    });
  }

  // Generate a single elimination bracket for the provided team names
  // Returns a 2D array: bracket[round][match] = [team1, team2]
  function generateBracket(teamNames) {
    // Copy the array to avoid mutating original
    const names = [...teamNames];
    // Randomise team order
    names.sort(() => Math.random() - 0.5);
    // Determine bracket size (next power of two, up to 16)
    const numTeams = names.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(numTeams, 2))));
    const size = Math.min(bracketSize, 16);
    // Fill remaining slots with BYE
    while (names.length < size) {
      names.push("BYE");
    }
    // Seed assignments: fill from edges towards centre (1 vs N, 2 vs N-1, ...)
    const seeds = new Array(size);
    let left = 0;
    let right = size - 1;
    names.forEach((name, index) => {
      if (index % 2 === 0) {
        seeds[left++] = name;
      } else {
        seeds[right--] = name;
      }
    });
    // Number of rounds
    const rounds = Math.log2(size);
    const bracket = [];
    // Round 1 pairings
    bracket[0] = [];
    for (let i = 0; i < size; i += 2) {
      bracket[0].push([seeds[i], seeds[i + 1]]);
    }
    // Subsequent rounds: set placeholders
    for (let r = 1; r < rounds; r++) {
      const matchesInRound = bracket[r - 1].length / 2;
      bracket[r] = new Array(matchesInRound).fill(["", ""]);
    }
    return bracket;
  }

  // Display the generated bracket in the DOM
  function displayBracket(tournamentName, bracket) {
    bracketContainer.innerHTML = "";
    // Title
    const title = document.createElement("h3");
    title.textContent = `Bracket: ${tournamentName}`;
    title.style.color = "#64ffda";
    bracketContainer.appendChild(title);
    // Container
    const bracketDiv = document.createElement("div");
    bracketDiv.className = "bracket";
    // For each round
    bracket.forEach((roundMatches, roundIndex) => {
      const roundDiv = document.createElement("div");
      roundDiv.className = "round";
      const roundTitle = document.createElement("div");
      roundTitle.className = "round-title";
      roundTitle.textContent = `Round ${roundIndex + 1}`;
      roundDiv.appendChild(roundTitle);
      roundMatches.forEach((match) => {
        const matchDiv = document.createElement("div");
        matchDiv.className = "match";
        match.forEach((teamName) => {
          const teamDiv = document.createElement("div");
          teamDiv.className = "team";
          if (!teamName || teamName === "") {
            teamDiv.textContent = "-";
            teamDiv.classList.add("empty");
          } else if (teamName === "BYE") {
            teamDiv.textContent = "BYE";
            teamDiv.classList.add("empty");
          } else {
            teamDiv.textContent = teamName;
          }
          matchDiv.appendChild(teamDiv);
        });
        roundDiv.appendChild(matchDiv);
      });
      bracketDiv.appendChild(roundDiv);
    });
    bracketContainer.appendChild(bracketDiv);
  }

  // Handle team registration submission
  teamForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const teamName = document.getElementById("teamName").value.trim();
    const captainGamertag = document.getElementById("captainGamertag").value.trim();
    const captainEmail = document.getElementById("captainEmail").value.trim();
    if (!teamName || !captainGamertag || !captainEmail) {
      return;
    }
    // Gather player entries
    const playerRows = playersContainer.querySelectorAll(".player-row");
    const players = [];
    playerRows.forEach((row) => {
      const gamertagInput = row.querySelector(".playerGamertag");
      const emailInput = row.querySelector(".playerEmail");
      const gamertag = gamertagInput.value.trim();
      const email = emailInput.value.trim();
      if (gamertag) {
        players.push({ gamertag, email });
      }
    });
    // Insert captain as first player
    players.unshift({ gamertag: captainGamertag, email: captainEmail });
    // Create team object
    const team = {
      id: Date.now(),
      name: teamName,
      captain: { gamertag: captainGamertag, email: captainEmail },
      players,
    };
    teams.push(team);
    saveTeams();
    renderTeamList();
    renderTeamSelection();
    // Reset form
    teamForm.reset();
    resetPlayerFields();
  });

  // Handle add player button
  addPlayerBtn.addEventListener("click", addPlayerRow);

  // Handle tournament creation submission
  tournamentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const tournamentName = document.getElementById("tournamentName").value.trim();
    if (!tournamentName) {
      return;
    }
    // Collect selected teams
    const selectedInputs = teamSelection.querySelectorAll("input[type='checkbox']:checked");
    const selectedIds = Array.from(selectedInputs).map((input) => Number(input.value));
    if (selectedIds.length < 2) {
      alert("Please select at least two teams to create a tournament.");
      return;
    }
    if (selectedIds.length > 16) {
      alert("You can select a maximum of 16 teams.");
      return;
    }
    const selectedTeamNames = teams
      .filter((team) => selectedIds.includes(team.id))
      .map((team) => team.name);
    // Create tournament object (stored locally if needed)
    const tournament = {
      id: Date.now(),
      name: tournamentName,
      teams: selectedTeamNames,
    };
    tournaments.push(tournament);
    const bracket = generateBracket(selectedTeamNames);
    displayBracket(tournament.name, bracket);
    // Reset form selections
    tournamentForm.reset();
    selectedInputs.forEach((input) => (input.checked = false));
  });

  // Initialisation
  loadTeams();
  // Always start with at least one player row
  addPlayerRow();
  renderTeamList();
  renderTeamSelection();
})();