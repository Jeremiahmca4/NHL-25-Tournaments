/*
  NHL 25 Tournament Manager Script

  This script handles all client‑side functionality for the NHL 25 tournament
  manager. It adds authentication with separate admin and user roles, team
  registration with unique gamertag enforcement, single‑elimination bracket
  creation restricted to admins, random match code generation visible only
  to participants and the admin, and admin‑only winner selection. All data
  (users, teams, tournaments and current session) is persisted using
  localStorage so it survives page reloads. There is no backend; all logic
  runs in the browser.
*/

(() => {
  // ------------------ Constants ------------------
  const MAX_PLAYERS = 15;
  // Secret code used to create the sole admin account. In a real system
  // this would be provided securely; here it's hard‑coded for the demo.
  const ADMIN_CODE = "supersecret";

  // ------------------ State ------------------
  // List of registered users (captains and admin)
  let users = [];
  // Currently logged in user (null if none)
  let currentUser = null;
  // List of registered teams. Each team includes an owner username so we
  // know which user created it, and a list of players with gamertags.
  let teams = [];
  // Array of tournaments; only the latest is currently displayed
  let tournaments = [];

  // ------------------ DOM references ------------------
  const authSection = document.getElementById("auth-section");
  const loginContainer = document.getElementById("login-container");
  const signupContainer = document.getElementById("signup-container");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const showSignupLink = document.getElementById("showSignup");
  const showLoginLink = document.getElementById("showLogin");
  const adminCodeRow = document.getElementById("adminCodeRow");
  const userInfoDiv = document.getElementById("user-info");

  const teamRegistrationSection = document.getElementById("team-registration");
  const tournamentSection = document.getElementById("tournament-section");
  const teamForm = document.getElementById("teamForm");
  const tournamentForm = document.getElementById("tournamentForm");
  const playersContainer = document.getElementById("playersContainer");
  const addPlayerBtn = document.getElementById("addPlayerBtn");
  const teamListUl = document.getElementById("teamListUl");
  const teamSelection = document.getElementById("teamSelection");
  const bracketContainer = document.getElementById("bracketContainer");
  // Container for join tournament controls (added for captains to join tournaments)
  const joinTournamentsDiv = document.getElementById("joinTournaments");

  // ------------------ Persistence helpers ------------------
  // Users persistence
  function loadUsers() {
    const saved = localStorage.getItem("nhl25Users");
    if (saved) {
      try {
        users = JSON.parse(saved);
      } catch (err) {
        console.error("Failed to parse saved users", err);
        users = [];
      }
    }
  }
  function saveUsers() {
    localStorage.setItem("nhl25Users", JSON.stringify(users));
  }
  // Current user persistence
  function loadCurrentUser() {
    const saved = localStorage.getItem("nhl25CurrentUser");
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
      } catch (err) {
        currentUser = null;
      }
    }
  }
  function saveCurrentUser() {
    if (currentUser) {
      localStorage.setItem("nhl25CurrentUser", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("nhl25CurrentUser");
    }
  }
  // Teams persistence
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
  function saveTeams() {
    localStorage.setItem("nhl25Teams", JSON.stringify(teams));
  }
  // Tournaments persistence
  function loadTournaments() {
    const saved = localStorage.getItem("nhl25Tournaments");
    if (saved) {
      try {
        tournaments = JSON.parse(saved);
      } catch (err) {
        tournaments = [];
      }
    }
  }
  function saveTournaments() {
    localStorage.setItem("nhl25Tournaments", JSON.stringify(tournaments));
  }

  // ------------------ UI helpers ------------------
  // Toggle between login and sign‑up forms
  function toggleAuthForms(showLogin) {
    if (showLogin) {
      if (loginContainer) loginContainer.style.display = "";
      if (signupContainer) signupContainer.style.display = "none";
    } else {
      if (loginContainer) loginContainer.style.display = "none";
      if (signupContainer) signupContainer.style.display = "";
    }
  }
  // Update the page based on the current user's status
  function updateUI() {
    // If an admin already exists, hide the admin code field for new sign‑ups
    const adminExists = users.some((u) => u.isAdmin);
    if (adminCodeRow) adminCodeRow.style.display = adminExists ? "none" : "";

    if (!currentUser) {
      // No user logged in
      if (authSection) authSection.style.display = "";
      if (teamRegistrationSection) teamRegistrationSection.style.display = "none";
      if (tournamentSection) tournamentSection.style.display = "none";
      if (userInfoDiv) userInfoDiv.textContent = "";
      // Hide join tournaments area when not logged in
      if (joinTournamentsDiv) joinTournamentsDiv.style.display = "none";
    } else {
      // User logged in
      if (authSection) authSection.style.display = "none";
      // Display user info and logout link
      if (userInfoDiv) {
        userInfoDiv.innerHTML = `Logged in as ${currentUser.username}${currentUser.isAdmin ? ' (Admin)' : ''} <a href="#" id="logoutLink">Logout</a>`;
        const logoutLink = document.getElementById("logoutLink");
        if (logoutLink) {
          logoutLink.addEventListener("click", (ev) => {
            ev.preventDefault();
            logout();
          });
        }
      }
      if (currentUser.isAdmin) {
        // Hide team registration for admin
        if (teamRegistrationSection) teamRegistrationSection.style.display = "none";
        // Show tournament section
        if (tournamentSection) tournamentSection.style.display = "";
        // Show tournament creation form
        if (tournamentForm) tournamentForm.style.display = "";
        // Refresh team list for admin
        renderTeamList();
        // Hide join tournaments area for admin
        if (joinTournamentsDiv) joinTournamentsDiv.style.display = "none";
        // Show the latest bracket if there is one
        const latest = tournaments.length ? tournaments[tournaments.length - 1] : null;
        if (latest) {
          displayBracket(latest);
        } else if (bracketContainer) {
          bracketContainer.innerHTML = "";
        }
      } else {
        // Non‑admin users
        const hasTeam = currentUser.teamId != null;
        if (!hasTeam) {
          // Show team registration form for captains who haven't registered
          if (teamRegistrationSection) teamRegistrationSection.style.display = "";
          renderTeamList();
        } else {
          // Hide registration once a team is registered
          if (teamRegistrationSection) teamRegistrationSection.style.display = "none";
        }
        // Always show tournament section to view brackets
        if (tournamentSection) tournamentSection.style.display = "";
        // Hide creation form for non‑admins
        if (tournamentForm) tournamentForm.style.display = "none";
        // Show latest bracket if exists
        const latest = tournaments.length ? tournaments[tournaments.length - 1] : null;
        if (latest) {
          displayBracket(latest);
        } else if (bracketContainer) {
          bracketContainer.innerHTML = "<p>No tournament has been created yet.</p>";
        }
        // Render join tournament options for captains
        renderJoinTournaments();
      }
    }
  }

  // ------------------ Authentication handlers ------------------
  // Create a new user (captain or admin depending on adminCodeInput)
  function signup(username, email, password, adminCodeInput) {
    // Ensure username is unique
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      alert("Username already taken. Please choose another.");
      return;
    }
    // Ensure email is unique
    if (users.some((u) => u.email && u.email.toLowerCase() === email.toLowerCase())) {
      alert("An account with this email already exists.");
      return;
    }
    // Determine if this should be an admin account
    let isAdmin = false;
    if (adminCodeInput && adminCodeInput.trim() === ADMIN_CODE) {
      // Only allow one admin
      if (users.some((u) => u.isAdmin)) {
        alert("An admin account already exists.");
        return;
      }
      isAdmin = true;
    }
    const user = {
      id: Date.now(),
      username: username.trim(),
      email: email.trim(),
      password: password, // Note: plain text for demo only
      isAdmin,
      teamId: null,
    };
    users.push(user);
    saveUsers();
    currentUser = user;
    saveCurrentUser();
    updateUI();
  }
  // Log in an existing user
  function login(username, password) {
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user || user.password !== password) {
      alert("Invalid username or password.");
      return;
    }
    currentUser = user;
    saveCurrentUser();
    updateUI();
  }
  // Log out the current user
  function logout() {
    currentUser = null;
    saveCurrentUser();
    updateUI();
  }

  // ------------------ Team management ------------------
  // Add a player input row for team registration
  function addPlayerRow() {
    const existingRows = playersContainer ? playersContainer.querySelectorAll(".player-row").length : 0;
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
    if (playersContainer) playersContainer.appendChild(row);
  }
  // Reset all player rows to a single blank row
  function resetPlayerFields() {
    if (playersContainer) {
      playersContainer.innerHTML = "<h3>Players (max 15)</h3>";
      addPlayerRow();
    }
  }
  // Render the list of registered teams in the team registration card
  function renderTeamList() {
    if (!teamListUl) return;
    teamListUl.innerHTML = "";
    teams.forEach((team) => {
      const li = document.createElement("li");
      li.textContent = `${team.name} (Players: ${team.players.length})`;
      teamListUl.appendChild(li);
    });
  }
  // Render checkboxes for each team in the tournament creation form
  function renderTeamSelection() {
    if (!teamSelection) return;
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
  // Check whether a gamertag is already taken across all teams
  function isGamertagTaken(gamertag) {
    const lower = gamertag.toLowerCase();
    return teams.some((t) => t.players.some((p) => p.gamertag.toLowerCase() === lower));
  }

  // ------------------ Tournament helpers ------------------
  // Generate a seeded single‑elimination bracket from an array of team names
  function generateBracket(teamNames) {
    const names = [...teamNames];
    // Randomise order
    names.sort(() => Math.random() - 0.5);
    const numTeams = names.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(numTeams, 2))));
    const size = Math.min(bracketSize, 16);
    // Fill empty slots with BYEs
    while (names.length < size) {
      names.push("BYE");
    }
    // Seed assignments (1 vs N, 2 vs N-1, etc.)
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
    const rounds = Math.log2(size);
    const bracket = [];
    // Round 1 pairings
    bracket[0] = [];
    for (let i = 0; i < size; i += 2) {
      bracket[0].push([seeds[i], seeds[i + 1]]);
    }
    // Fill subsequent rounds with placeholders
    for (let r = 1; r < rounds; r++) {
      const matchesInRound = bracket[r - 1].length / 2;
      bracket[r] = new Array(matchesInRound).fill(["", ""]);
    }
    return bracket;
  }
  // Generate a random alphanumeric match code
  function generateMatchCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  // Generate a structure of codes corresponding to the bracket
  function generateCodes(bracket) {
    return bracket.map((roundMatches) => roundMatches.map(() => generateMatchCode()));
  }
  // Initialise results for each match
  function initResults(bracket) {
    return bracket.map((roundMatches) => roundMatches.map(() => null));
  }

  // ------------------ Join tournament helpers ------------------
  /**
   * Render a list of available tournaments for captains to join. Displays
   * appropriate messages if no tournaments exist, the user is an admin,
   * the user has no team, or the team has already joined a tournament.
   */
  function renderJoinTournaments() {
    if (!joinTournamentsDiv) return;
    // Clear previous content
    joinTournamentsDiv.innerHTML = "";
    // Do not show this section if no user, or user is admin
    if (!currentUser || currentUser.isAdmin) {
      joinTournamentsDiv.style.display = "none";
      return;
    }
    joinTournamentsDiv.style.display = "";
    // If there are no tournaments
    if (!tournaments.length) {
      joinTournamentsDiv.innerHTML = "<p>No tournaments available.</p>";
      return;
    }
    // Ensure the user has a team
    const teamId = currentUser.teamId;
    if (!teamId) {
      joinTournamentsDiv.innerHTML = "<p>Please register a team before joining a tournament.</p>";
      return;
    }
    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      // Shouldn't happen, but reset if needed
      currentUser.teamId = null;
      saveCurrentUser();
      joinTournamentsDiv.innerHTML = "<p>Please register a team before joining a tournament.</p>";
      return;
    }
    // If team already joined a tournament
    if (team.tournamentId) {
      const tournament = tournaments.find((t) => t.id === team.tournamentId);
      if (tournament) {
        joinTournamentsDiv.innerHTML = `<p>Your team is registered for the tournament: <strong>${tournament.name}</strong>.</p>`;
      } else {
        // tournament might have been deleted; clear membership
        team.tournamentId = null;
        saveTeams();
        renderJoinTournaments();
      }
      return;
    }
    // Show available tournaments with join buttons
    let availableCount = 0;
    tournaments.forEach((tour) => {
      const joinedIds = tour.teamIds || [];
      const maxTeams = tour.maxTeams || 16;
      if (!joinedIds.includes(teamId) && joinedIds.length < maxTeams) {
        availableCount++;
        const row = document.createElement("div");
        row.className = "join-tournament-row";
        const label = document.createElement("span");
        label.textContent = `Tournament: ${tour.name} (${joinedIds.length}/${maxTeams}) `;
        row.appendChild(label);
        const btn = document.createElement("button");
        btn.textContent = "Join";
        btn.addEventListener("click", () => joinTournament(tour.id));
        row.appendChild(btn);
        joinTournamentsDiv.appendChild(row);
      }
    });
    if (availableCount === 0) {
      joinTournamentsDiv.innerHTML = "<p>No open tournaments available to join.</p>";
    }
  }

  /**
   * Join the specified tournament with the current user's team. Updates the
   * tournament's team list, generates or updates the bracket and match codes,
   * and persists data to localStorage. Alerts are shown if the team is
   * already in a tournament or the tournament is full.
   * @param {number} tournamentId
   */
  function joinTournament(tournamentId) {
    if (!currentUser || currentUser.isAdmin) return;
    const teamId = currentUser.teamId;
    if (!teamId) {
      alert("Please register a team before joining a tournament.");
      return;
    }
    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      alert("Your team could not be found.");
      return;
    }
    if (team.tournamentId) {
      alert("Your team is already registered in a tournament.");
      return;
    }
    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) {
      alert("Tournament not found.");
      return;
    }
    const joinedIds = tournament.teamIds || [];
    const maxTeams = tournament.maxTeams || 16;
    if (joinedIds.includes(teamId)) {
      alert("Your team is already registered in this tournament.");
      return;
    }
    if (joinedIds.length >= maxTeams) {
      alert("This tournament is full.");
      return;
    }
    // Register team
    joinedIds.push(teamId);
    tournament.teamIds = joinedIds;
    team.tournamentId = tournament.id;
    // Generate or update bracket when there are at least two teams
    const teamNames = joinedIds.map((id) => {
      const tm = teams.find((t) => t.id === id);
      return tm ? tm.name : "";
    });
    if (teamNames.filter((n) => n).length >= 2) {
      tournament.bracket = generateBracket(teamNames);
      tournament.codes = generateCodes(tournament.bracket);
      tournament.results = initResults(tournament.bracket);
    } else {
      tournament.bracket = [];
      tournament.codes = [];
      tournament.results = [];
    }
    saveTeams();
    saveTournaments();
    // Refresh join list and bracket display
    renderJoinTournaments();
    displayBracket(tournament);
    updateUI();
  }

  // Display the bracket for a given tournament with codes and winner selection
  function displayBracket(tournament) {
    if (bracketContainer) bracketContainer.innerHTML = "";
    if (!tournament) return;
    const { name, bracket, codes, results } = tournament;
    // Title
    const title = document.createElement("h3");
    title.textContent = `Bracket: ${name}`;
    title.style.color = "#64ffda";
    if (bracketContainer) bracketContainer.appendChild(title);
    // If no bracket yet (less than two teams)
    if (!bracket || bracket.length === 0) {
      const msg = document.createElement("p");
      msg.style.color = "#a3aed0";
      // Show list of registered teams if any
      if (tournament.teamIds && tournament.teamIds.length > 0) {
        const names = tournament.teamIds.map((id) => {
          const t = teams.find((tm) => tm.id === id);
          return t ? t.name : "";
        }).filter((n) => n);
        msg.innerHTML = `Teams registered: ${names.join(", ")}.`;
      } else {
        msg.textContent = "No teams have registered yet.";
      }
      if (bracketContainer) bracketContainer.appendChild(msg);
      return;
    }
    const bracketDiv = document.createElement("div");
    bracketDiv.className = "bracket";
    // Determine current user's team name, if any
    let userTeamName = null;
    if (currentUser && currentUser.teamId) {
      const myTeam = teams.find((t) => t.id === currentUser.teamId);
      if (myTeam) userTeamName = myTeam.name;
    }
    // For each round
    bracket.forEach((roundMatches, roundIndex) => {
      const roundDiv = document.createElement("div");
      roundDiv.className = "round";
      const roundTitle = document.createElement("div");
      roundTitle.className = "round-title";
      roundTitle.textContent = `Round ${roundIndex + 1}`;
      roundDiv.appendChild(roundTitle);
      roundMatches.forEach((match, matchIndex) => {
        const matchDiv = document.createElement("div");
        matchDiv.className = "match";
        const team1 = match[0];
        const team2 = match[1];
        const winner = results[roundIndex][matchIndex];
        // Render both team slots
        [team1, team2].forEach((teamName) => {
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
            // Highlight winner
            if (winner && winner === teamName) {
              teamDiv.style.fontWeight = "bold";
              teamDiv.style.color = "#64ffda";
            }
          }
          matchDiv.appendChild(teamDiv);
        });
        // Show the match code only to admin or the teams involved
        const code = codes[roundIndex][matchIndex];
        const showCode = currentUser && (currentUser.isAdmin || (userTeamName && (team1 === userTeamName || team2 === userTeamName)));
        if (showCode) {
          const codeDiv = document.createElement("div");
          codeDiv.style.fontSize = "12px";
          codeDiv.style.color = "#a3aed0";
          codeDiv.textContent = `Code: ${code}`;
          matchDiv.appendChild(codeDiv);
        }
        // Admin controls for selecting a winner
        if (currentUser && currentUser.isAdmin && team1 !== "BYE" && team2 !== "BYE" && !winner) {
          const select = document.createElement("select");
          const placeholderOption = document.createElement("option");
          placeholderOption.value = "";
          placeholderOption.textContent = "Select winner";
          select.appendChild(placeholderOption);
          [team1, team2].forEach((teamName) => {
            const opt = document.createElement("option");
            opt.value = teamName;
            opt.textContent = teamName;
            select.appendChild(opt);
          });
          const setBtn = document.createElement("button");
          setBtn.textContent = "Set Winner";
          setBtn.style.marginTop = "6px";
          setBtn.addEventListener("click", (ev) => {
            ev.preventDefault();
            const selected = select.value;
            if (!selected) {
              alert("Please select a winner.");
              return;
            }
            // Record winner
            results[roundIndex][matchIndex] = selected;
            // Advance winner to next round
            const nextRoundIndex = roundIndex + 1;
            if (bracket[nextRoundIndex]) {
              const nextMatchIndex = Math.floor(matchIndex / 2);
              const slot = matchIndex % 2 === 0 ? 0 : 1;
              const nextMatch = bracket[nextRoundIndex][nextMatchIndex];
              if (Array.isArray(nextMatch)) {
                const updated = [...nextMatch];
                updated[slot] = selected;
                bracket[nextRoundIndex][nextMatchIndex] = updated;
              }
            }
            // Persist tournaments
            saveTournaments();
            // Refresh bracket view
            displayBracket(tournament);
          });
          matchDiv.appendChild(select);
          matchDiv.appendChild(setBtn);
        }
        roundDiv.appendChild(matchDiv);
      });
      bracketDiv.appendChild(roundDiv);
    });
    if (bracketContainer) bracketContainer.appendChild(bracketDiv);
  }

  // ------------------ Event listeners ------------------
  // Toggle between login and sign‑up screens
  if (showSignupLink) {
    showSignupLink.addEventListener("click", (ev) => {
      ev.preventDefault();
      toggleAuthForms(false);
    });
  }
  if (showLoginLink) {
    showLoginLink.addEventListener("click", (ev) => {
      ev.preventDefault();
      toggleAuthForms(true);
    });
  }
  // Handle sign‑up form submission
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("signupUsername").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const codeInput = document.getElementById("adminCode").value;
      signup(username, email, password, codeInput);
      signupForm.reset();
    });
  }
  // Handle login form submission
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("loginUsername").value.trim();
      const password = document.getElementById("loginPassword").value;
      login(username, password);
      loginForm.reset();
    });
  }
  // Add player row on click
  if (addPlayerBtn) {
    addPlayerBtn.addEventListener("click", addPlayerRow);
  }
  // Handle team registration form submission
  if (teamForm) {
    teamForm.addEventListener("submit", (e) => {
      e.preventDefault();
      // Ensure a captain is logged in and not admin
      if (!currentUser || currentUser.isAdmin) {
        alert("You must be logged in as a captain to register a team.");
        return;
      }
      // Prevent multiple teams per user
      if (currentUser.teamId != null) {
        alert("You have already registered a team.");
        return;
      }
      const teamName = document.getElementById("teamName").value.trim();
      const captainGamertag = document.getElementById("captainGamertag").value.trim();
      const captainEmail = document.getElementById("captainEmail").value.trim();
      if (!teamName || !captainGamertag || !captainEmail) {
        alert("Please fill in all required fields.");
        return;
      }
      // Collect players from form
      const playerRows = playersContainer ? playersContainer.querySelectorAll(".player-row") : [];
      const players = [];
      let duplicateWithin = false;
      playerRows.forEach((row) => {
        const gamertagInput = row.querySelector(".playerGamertag");
        const emailInput = row.querySelector(".playerEmail");
        const gamertag = gamertagInput.value.trim();
        const email = emailInput.value.trim();
        if (gamertag) {
          // Check duplicates within this team (including captain)
          if (players.some((p) => p.gamertag.toLowerCase() === gamertag.toLowerCase()) || gamertag.toLowerCase() === captainGamertag.toLowerCase()) {
            duplicateWithin = true;
          }
          players.push({ gamertag, email });
        }
      });
      if (duplicateWithin) {
        alert("Duplicate gamertags within the team are not allowed.");
        return;
      }
      // Insert captain at beginning
      players.unshift({ gamertag: captainGamertag, email: captainEmail });
      // Check for duplicate gamertags across teams
      for (const player of players) {
        if (isGamertagTaken(player.gamertag)) {
          alert(`Gamertag ${player.gamertag} is already registered on another team.`);
          return;
        }
      }
      // Create team object with owner field
      const team = {
        id: Date.now(),
        name: teamName,
        captain: { gamertag: captainGamertag, email: captainEmail },
        players,
        owner: currentUser.username,
      };
      teams.push(team);
      saveTeams();
      // Associate team with current user
      currentUser.teamId = team.id;
      const idx = users.findIndex((u) => u.id === currentUser.id);
      if (idx >= 0) {
        users[idx] = currentUser;
      }
      saveUsers();
      saveCurrentUser();
      // Refresh UI and lists
      renderTeamList();
      renderTeamSelection();
      teamForm.reset();
      resetPlayerFields();
      updateUI();
    });
  }
  // Handle tournament creation by admin
  if (tournamentForm) {
    tournamentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!currentUser || !currentUser.isAdmin) {
        alert("Only an admin can create tournaments.");
        return;
      }
      const tournamentName = document.getElementById("tournamentName").value.trim();
      if (!tournamentName) {
        alert("Please provide a tournament name.");
        return;
      }
      // Create an empty tournament. Teams will join later via joinTournament().
      const tournament = {
        id: Date.now(),
        name: tournamentName,
        teamIds: [],
        maxTeams: 16,
        bracket: [],
        codes: [],
        results: [],
      };
      tournaments.push(tournament);
      saveTournaments();
      // Clear form and update UI
      if (tournamentForm) tournamentForm.reset();
      // Display an empty bracket message
      displayBracket(tournament);
      // Render join options for captains
      renderJoinTournaments();
    });
  }
  // ------------------ Initialisation ------------------
  loadUsers();
  loadCurrentUser();
  loadTeams();
  loadTournaments();
  // Ensure at least one blank player row exists
  if (playersContainer) {
    resetPlayerFields();
  }
  // Render existing teams and selection lists
  renderTeamList();
  renderTeamSelection();
  // If a tournament exists, show the latest bracket
  if (tournaments.length && bracketContainer) {
    displayBracket(tournaments[tournaments.length - 1]);
  }
  // Both login and sign‑up forms are visible by default; do not hide sign‑up
  //toggleAuthForms(true);
  // Adjust UI based on current user
  updateUI();
})();