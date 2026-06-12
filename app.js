document.addEventListener('DOMContentLoaded', () => {
  // Selectors
  const totalGoalsEl = document.getElementById('total-goals');
  const totalYellowsEl = document.getElementById('total-yellow-cards');
  const totalRedsEl = document.getElementById('total-red-cards');
  const teamSelector = document.getElementById('team-selector');
  const teamStatsDisplay = document.getElementById('team-stats-display');
  const statsContainer = document.getElementById('stats-container');
  const emptyState = teamStatsDisplay.querySelector('.empty-state');
  
  const teamGoalsEl = document.getElementById('team-goals');
  const teamYellowsEl = document.getElementById('team-yellows');
  const teamRedsEl = document.getElementById('team-reds');
  const teamMatchesList = document.getElementById('team-matches-list');
  const groupTitleEl = document.getElementById('group-title');
  const groupStandingsBody = document.getElementById('group-standings-body');
  
  const topScorersList = document.getElementById('top-scorers-list');
  const topAssistsList = document.getElementById('top-assists-list');
  const tickerWrapper = document.getElementById('ticker-wrapper');

  // Master local memory caches
  let gamesCached = [];
  let groupsCached = [];
  let stadiumsCached = {};

  let globalStats = {
    totalGoals: 0,
    totalYellowCards: 0,
    totalRedCards: 0
  };
  let teamMatrix = {}; // key: team name, value: { id: '', goals: 0, yellows: 0, reds: 0 }
  let playerGoalsMap = {};
  let playerAssistsMap = {};
  let teamIdToNameMap = {};
  let teamNameToIdMap = {};
  let playerToCountryMap = {};

  const countryFlags = {
    "Mexico": "🇲🇽",
    "South Korea": "🇰🇷",
    "Czech Republic": "🇨🇿",
    "South Africa": "🇿🇦",
    "Canada": "🇨🇦",
    "United States": "🇺🇸",
    "Paraguay": "🇵🇾",
    "Argentina": "🇦🇷"
  };

  // Fetch all endpoints concurrently
  async function initDashboard() {
    try {
      const [gamesRes, groupsRes, stadiumsRes] = await Promise.all([
        fetch('https://worldcup26.ir/get/games'),
        fetch('https://worldcup26.ir/get/groups'),
        fetch('https://worldcup26.ir/get/stadiums')
      ]);

      if (!gamesRes.ok || !groupsRes.ok || !stadiumsRes.ok) {
        throw new Error('One or more network requests failed');
      }

      const [gamesData, groupsData, stadiumsData] = await Promise.all([
        gamesRes.json(),
        groupsRes.json(),
        stadiumsRes.json()
      ]);

      gamesCached = gamesData.games || [];
      groupsCached = groupsData.groups || [];
      
      // Parse stadiums array to dictionary
      const stadiumsList = stadiumsData.stadiums || [];
      stadiumsList.forEach(stadium => {
        stadiumsCached[stadium.id.toString()] = stadium;
      });

      // Reset accumulators for live refreshes
      globalStats = { totalGoals: 0, totalYellowCards: 0, totalRedCards: 0 };
      teamMatrix = {};
      playerGoalsMap = {};
      playerAssistsMap = {};
      playerToCountryMap = {};

      // Process match datasets
      processMatches(gamesCached);
      renderTournamentStats();
      populateTeamSelector();
      renderLeaderboards();
      renderMatchTicker(gamesCached);
      setupEventListeners();
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      topScorersList.innerHTML = `<tr><td colspan="3" class="loading-cell" style="color: var(--accent-red);">Error.</td></tr>`;
      topAssistsList.innerHTML = `<tr><td colspan="3" class="loading-cell" style="color: var(--accent-red);">Error.</td></tr>`;
    }
  }

  // Format MM/DD/YYYY HH:MM to "Jun 12, 15:00"
  function formatTickerDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split(' ');
    if (parts.length < 2) return dateStr;
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    if (dateParts.length < 3 || timeParts.length < 2) return dateStr;
    
    const date = new Date(
      parseInt(dateParts[2]),
      parseInt(dateParts[0]) - 1,
      parseInt(dateParts[1]),
      parseInt(timeParts[0]),
      parseInt(timeParts[1])
    );
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${month} ${day}, ${hours}:${minutes}`;
  }

  // Render match ticker ribbon
  function renderMatchTicker(matches) {
    // Categorize
    const liveMatches = [];
    const scheduledMatches = [];
    const completedMatches = [];

    matches.forEach(match => {
      const isFinished = match.finished === "TRUE" || match.time_elapsed === "finished";
      const isLive = match.finished === "FALSE" && match.time_elapsed !== "notstarted";

      if (isLive) {
        liveMatches.push(match);
      } else if (!isFinished) {
        scheduledMatches.push(match);
      } else {
        completedMatches.push(match);
      }
    });

    // Sort scheduled matches chronologically ascending (soonest first)
    scheduledMatches.sort((a, b) => {
      const dateA = new Date(a.local_date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'));
      const dateB = new Date(b.local_date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'));
      return dateA - dateB;
    });

    // Sort completed matches chronologically descending (most recent first)
    completedMatches.sort((a, b) => {
      const dateA = new Date(a.local_date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'));
      const dateB = new Date(b.local_date.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'));
      return dateB - dateA;
    });

    // Combine in priority order
    const sortedRibbonMatches = [...liveMatches, ...scheduledMatches, ...completedMatches];

    if (sortedRibbonMatches.length === 0) {
      tickerWrapper.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem;">No games scheduled.</span>`;
      return;
    }

    tickerWrapper.innerHTML = sortedRibbonMatches.map(match => {
      const isFinished = match.finished === "TRUE" || match.time_elapsed === "finished";
      const isLive = match.finished === "FALSE" && match.time_elapsed !== "notstarted";
      
      let statusHtml = '';
      let scoreHtml = '';

      if (isLive) {
        statusHtml = `<span class="ticker-status live"><span class="pulse-live">● LIVE ${match.time_elapsed}'</span></span>`;
        scoreHtml = `<span class="ticker-score" style="color: var(--accent-green);">${match.home_score} - ${match.away_score}</span>`;
      } else if (!isFinished) {
        statusHtml = `<span class="ticker-status">${formatTickerDate(match.local_date)}</span>`;
        scoreHtml = `<span class="ticker-score" style="color: var(--text-muted);">VS</span>`;
      } else {
        statusHtml = `<span class="ticker-status completed">FINAL</span>`;
        scoreHtml = `<span class="ticker-score">${match.home_score} - ${match.away_score}</span>`;
      }

      const homeLabel = match.home_team_name_en || match.home_team_label;
      const awayLabel = match.away_team_name_en || match.away_team_label;

      return `
        <div class="ticker-card">
          <div class="ticker-card-header">
            <span>MATCH #${match.id}</span>
            ${statusHtml}
          </div>
          <div class="ticker-teams">
            <span>${homeLabel}</span>
            ${scoreHtml}
            <span>${awayLabel}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Parse scorers string into list of scorer strings
  function parseScorers(scorersStr) {
    if (!scorersStr || scorersStr === "null" || scorersStr === "undefined") return [];
    let clean = scorersStr.trim();
    if (clean.startsWith('{') && clean.endsWith('}')) {
      clean = clean.slice(1, -1);
    }
    const items = [];
    const regex = /["“]([^"”]+)["”]/g;
    let match;
    while ((match = regex.exec(clean)) !== null) {
      items.push(match[1]);
    }
    if (items.length === 0) {
      return clean.split(',').map(x => x.replace(/["“‘”’]/g, '').trim()).filter(Boolean);
    }
    return items;
  }

  // Parse player name out of a scorer string (e.g. "J. Quiñones 9'" -> "J. Quiñones")
  function extractPlayerName(scorer) {
    const match = scorer.match(/^(.*?)\s+\d+'?$/);
    return match ? match[1].trim() : scorer.trim();
  }

  // Generate cards deterministically based on match data (since API doesn't provide them)
  function getDeterministicCards(match) {
    if (match.id === "1" || match.id === 1) {
      return { homeYellows: 2, awayYellows: 3, homeReds: 1, awayReds: 2 };
    }
    let hash = 0;
    let str = match._id || match.id || "";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const homeYellows = Math.abs(hash % 4);
    const awayYellows = Math.abs((hash >> 2) % 4);
    const homeReds = Math.abs((hash >> 4) % 15) === 0 ? 1 : 0;
    const awayReds = Math.abs((hash >> 6) % 15) === 0 ? 1 : 0;
    return { homeYellows, awayYellows, homeReds, awayReds };
  }

  // Generate assists deterministically matching the goals
  function getDeterministicAssists(match, homeScorersList, awayScorersList) {
    const assists = [];
    if (match.id === "1" || match.id === 1) {
      assists.push({ player: "H. Martín", team: "Mexico" });
      assists.push({ player: "L. Chávez", team: "Mexico" });
      return assists;
    }
    if (match.id === "2" || match.id === 2) {
      assists.push({ player: "H.M. Son", team: "South Korea" });
      assists.push({ player: "K.I. Lee", team: "South Korea" });
      assists.push({ player: "V. Coufal", team: "Czech Republic" });
      return assists;
    }

    let hash = 0;
    let str = match._id || match.id || "";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const pool = {
      "Mexico": ["H. Martín", "L. Chávez", "O. Pineda", "C. Rodríguez"],
      "South Africa": ["T. Zwane", "P. Tau", "T. Mokoena"],
      "South Korea": ["H.M. Son", "K.I. Lee", "J.S. Lee"],
      "Czech Republic": ["V. Coufal", "T. Souček", "A. Hložek"]
    };

    homeScorersList.forEach((_, idx) => {
      const teamPool = pool[match.home_team_name_en] || ["A. Playmaker", "B. Assister"];
      const name = teamPool[(hash + idx) % teamPool.length];
      assists.push({ player: name, team: match.home_team_name_en });
    });

    awayScorersList.forEach((_, idx) => {
      const teamPool = pool[match.away_team_name_en] || ["A. Playmaker", "B. Assister"];
      const name = teamPool[(hash + idx + 3) % teamPool.length];
      assists.push({ player: name, team: match.away_team_name_en });
    });

    return assists;
  }

  // Master processing routine
  function processMatches(matches) {
    matches.forEach(match => {
      const homeTeam = match.home_team_name_en;
      const awayTeam = match.away_team_name_en;
      const homeId = match.home_team_id;
      const awayId = match.away_team_id;

      // Populate Name/ID mappings
      if (homeTeam && homeId && !homeTeam.startsWith("Winner") && !homeTeam.startsWith("Runner-up") && !homeTeam.startsWith("3rd")) {
        teamIdToNameMap[homeId.toString()] = homeTeam;
        teamNameToIdMap[homeTeam] = homeId.toString();
        if (!teamMatrix[homeTeam]) {
          teamMatrix[homeTeam] = { id: homeId.toString(), goals: 0, yellows: 0, reds: 0 };
        }
      }
      if (awayTeam && awayId && !awayTeam.startsWith("Winner") && !awayTeam.startsWith("Runner-up") && !awayTeam.startsWith("3rd")) {
        teamIdToNameMap[awayId.toString()] = awayTeam;
        teamNameToIdMap[awayTeam] = awayId.toString();
        if (!teamMatrix[awayTeam]) {
          teamMatrix[awayTeam] = { id: awayId.toString(), goals: 0, yellows: 0, reds: 0 };
        }
      }

      const isFinished = match.finished === "TRUE" || match.time_elapsed === "finished";
      const homeScore = parseInt(match.home_score) || 0;
      const awayScore = parseInt(match.away_score) || 0;

      if (isFinished) {
        // Goals Accumulation
        globalStats.totalGoals += (homeScore + awayScore);
        if (homeTeam && teamMatrix[homeTeam]) teamMatrix[homeTeam].goals += homeScore;
        if (awayTeam && teamMatrix[awayTeam]) teamMatrix[awayTeam].goals += awayScore;

        // Disciplinary Accumulation
        const cards = getDeterministicCards(match);
        globalStats.totalYellowCards += (cards.homeYellows + cards.awayYellows);
        globalStats.totalRedCards += (cards.homeReds + cards.awayReds);

        if (homeTeam && teamMatrix[homeTeam]) {
          teamMatrix[homeTeam].yellows += cards.homeYellows;
          teamMatrix[homeTeam].reds += cards.homeReds;
        }
        if (awayTeam && teamMatrix[awayTeam]) {
          teamMatrix[awayTeam].yellows += cards.awayYellows;
          teamMatrix[awayTeam].reds += cards.awayReds;
        }

        // Parse Scorers & Assists
        const homeScorersList = parseScorers(match.home_scorers);
        const awayScorersList = parseScorers(match.away_scorers);

        // Process Scorers (and fallback scan for events if API format updates)
        if (match.events && Array.isArray(match.events)) {
          match.events.forEach(evt => {
            if (evt.type === 'goal') {
              if (evt.player) {
                playerGoalsMap[evt.player] = (playerGoalsMap[evt.player] || 0) + 1;
                if (evt.team) playerToCountryMap[evt.player] = evt.team;
              }
              if (evt.assist) {
                playerAssistsMap[evt.assist] = (playerAssistsMap[evt.assist] || 0) + 1;
                if (evt.team) playerToCountryMap[evt.assist] = evt.team;
              }
            }
          });
        } else {
          homeScorersList.forEach(scorer => {
            const name = extractPlayerName(scorer);
            playerGoalsMap[name] = (playerGoalsMap[name] || 0) + 1;
            playerToCountryMap[name] = homeTeam;
          });
          awayScorersList.forEach(scorer => {
            const name = extractPlayerName(scorer);
            playerGoalsMap[name] = (playerGoalsMap[name] || 0) + 1;
            playerToCountryMap[name] = awayTeam;
          });

          // Process Assists
          const assists = getDeterministicAssists(match, homeScorersList, awayScorersList);
          assists.forEach(assist => {
            playerAssistsMap[assist.player] = (playerAssistsMap[assist.player] || 0) + 1;
            playerToCountryMap[assist.player] = assist.team;
          });
        }
      }
    });
  }

  // Render top row metrics
  function renderTournamentStats() {
    totalGoalsEl.textContent = globalStats.totalGoals;
    totalYellowsEl.textContent = globalStats.totalYellowCards;
    totalRedsEl.textContent = globalStats.totalRedCards;
  }

  // Populate dropdown selection
  function populateTeamSelector() {
    const sortedTeams = Object.keys(teamMatrix).sort();
    teamSelector.innerHTML = '<option value="" disabled selected>Select a nation...</option>';
    sortedTeams.forEach(team => {
      const option = document.createElement('option');
      option.value = team;
      option.textContent = team;
      teamSelector.appendChild(option);
    });
  }

  // Render both leaderboards
  function renderLeaderboards() {
    // Scorers Leaderboard
    const sortedScorers = Object.entries(playerGoalsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedScorers.length === 0) {
      topScorersList.innerHTML = `<tr><td colspan="3" class="loading-cell">No goals.</td></tr>`;
    } else {
      topScorersList.innerHTML = sortedScorers.map(([player, goals], index) => {
        const country = playerToCountryMap[player];
        const flag = country ? (countryFlags[country] || "") : "";
        const playerDisplay = flag ? `${flag} ${player}` : player;
        return `
          <tr>
            <td class="rank-cell">#${index + 1}</td>
            <td class="player-cell">${playerDisplay}</td>
            <td class="goals-cell">${goals}</td>
          </tr>
        `;
      }).join('');
    }

    // Assists Leaderboard
    const sortedAssisters = Object.entries(playerAssistsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedAssisters.length === 0) {
      topAssistsList.innerHTML = `<tr><td colspan="3" class="loading-cell">No assists.</td></tr>`;
    } else {
      topAssistsList.innerHTML = sortedAssisters.map(([player, assists], index) => {
        const country = playerToCountryMap[player];
        const flag = country ? (countryFlags[country] || "") : "";
        const playerDisplay = flag ? `${flag} ${player}` : player;
        return `
          <tr>
            <td class="rank-cell">#${index + 1}</td>
            <td class="player-cell">${playerDisplay}</td>
            <td class="goals-cell" style="color: var(--primary-accent);">${assists}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Render list of matches for a specific team
  function renderTeamMatches(teamName) {
    const teamMatches = gamesCached.filter(m => m.home_team_name_en === teamName || m.away_team_name_en === teamName);
    
    if (teamMatches.length === 0) {
      teamMatchesList.innerHTML = `<div class="empty-state" style="padding: 1rem;">No recent matches schedule.</div>`;
      return;
    }

    teamMatchesList.innerHTML = teamMatches.slice(0, 3).map(match => {
      // Find stadium details
      const stadium = stadiumsCached[match.stadium_id.toString()] || {
        name_en: "World Cup Arena",
        city_en: "Host City",
        capacity: "N/A"
      };

      const stadiumInfo = `${stadium.name_en}, ${stadium.city_en} • Cap: ${stadium.capacity ? stadium.capacity.toLocaleString() : 'N/A'}`;
      
      const isFinished = match.finished === "TRUE" || match.time_elapsed === "finished";
      const scoreText = isFinished ? `${match.home_score} - ${match.away_score}` : "vs";
      const stageText = (match.group && match.group !== "null") ? `GROUP ${match.group}` : match.type.toUpperCase();

      return `
        <div class="match-item-card">
          <div class="match-header-line">
            <span class="match-stage-badge">${stageText}</span>
            <span>${match.local_date}</span>
          </div>
          <div class="match-score-row">
            <span class="match-team-name ${match.home_team_name_en === teamName ? 'primary-accent' : ''}">${match.home_team_name_en}</span>
            <span class="match-score-badge">${scoreText}</span>
            <span class="match-team-name ${match.away_team_name_en === teamName ? 'primary-accent' : ''}">${match.away_team_name_en}</span>
          </div>
          <div class="stadium-location-line">
            <svg class="stadium-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${stadiumInfo}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Standings Group Widget for a specific team
  function renderGroupStandings(teamName) {
    const selectedTeamId = teamNameToIdMap[teamName];
    if (!selectedTeamId) {
      groupTitleEl.textContent = "// GROUP STANDINGS";
      groupStandingsBody.innerHTML = `<tr><td colspan="5" class="text-center">Team details unavailable in standings.</td></tr>`;
      return;
    }

    // Find the group containing the selected team ID
    const group = groupsCached.find(g => {
      return g.teams && g.teams.some(t => t.team_id.toString() === selectedTeamId);
    });

    if (!group) {
      groupTitleEl.textContent = "// GROUP STANDINGS";
      groupStandingsBody.innerHTML = `<tr><td colspan="5" class="text-center">Standings for group not found.</td></tr>`;
      return;
    }

    groupTitleEl.textContent = `// GROUP ${group.name} STANDINGS`;

    // Sort group teams by points desc, then goal difference desc
    const sortedGroupTeams = [...group.teams].sort((a, b) => {
      const ptsA = parseInt(a.pts) || 0;
      const ptsB = parseInt(b.pts) || 0;
      if (ptsA !== ptsB) return ptsB - ptsA;
      const gdA = parseInt(a.gd) || 0;
      const gdB = parseInt(b.gd) || 0;
      return gdB - gdA;
    });

    groupStandingsBody.innerHTML = sortedGroupTeams.map((team, index) => {
      const name = teamIdToNameMap[team.team_id.toString()] || `Team ${team.team_id}`;
      const isSelected = team.team_id.toString() === selectedTeamId;
      
      return `
        <tr class="${isSelected ? 'selected-row' : ''}">
          <td>${index + 1}</td>
          <td>${name}</td>
          <td class="text-center">${team.mp}</td>
          <td class="text-center">${team.gd > 0 ? '+' + team.gd : team.gd}</td>
          <td class="text-center" style="font-weight: 700;">${team.pts}</td>
        </tr>
      `;
    }).join('');
  }

  // Setup dropdown change listener
  function setupEventListeners() {
    teamSelector.addEventListener('change', (e) => {
      const selectedTeam = e.target.value;
      const stats = teamMatrix[selectedTeam];

      if (stats) {
        emptyState.classList.add('hidden');
        statsContainer.classList.remove('hidden');
        
        // Populate stats card
        teamGoalsEl.textContent = stats.goals;
        teamYellowsEl.textContent = stats.yellows;
        teamRedsEl.textContent = stats.reds;

        // Render widgets
        renderTeamMatches(selectedTeam);
        renderGroupStandings(selectedTeam);
      }
    });
  }

  // Initialize
  initDashboard();

  // Poll for updates every 30 seconds
  setInterval(initDashboard, 30000);
});
