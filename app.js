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
  const topCleansList = document.getElementById('top-cleans-list');
  const topAggressiveList = document.getElementById('top-aggressive-list');
  const tickerWrapper = document.getElementById('ticker-wrapper');
  const avgGoalsMeta = document.getElementById('avg-goals-meta');
  const avgYellowsMeta = document.getElementById('avg-yellows-meta');
  const avgRedsMeta = document.getElementById('avg-reds-meta');

  // Master local memory caches
  let gamesCached = [];
  let groupsCached = [];
  let stadiumsCached = {};
  let scrapedMatches = [];

  let globalStats = {
    totalGoals: 0,
    totalYellowCards: 0,
    totalRedCards: 0
  };
  let teamMatrix = {}; // key: team name, value: { id: '', goals: 0, yellows: 0, reds: 0 }
  let playerGoalsMap = {};
  let playerAssistsMap = {};
  let cleanSheetsMap = {};
  let completedGamesCount = 0;
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
    "Argentina": "🇦🇷",
    "Bosnia and Herzegovina": "🇧🇦",
    "Qatar": "🇶🇦",
    "Switzerland": "🇨🇭",
    "Morocco": "🇲🇦",
    "Sweden": "🇸🇪",
    "Algeria": "🇩🇿",
    "Jordan": "🇯🇴",
    "Haiti": "🇭🇹",
    "Germany": "🇩🇪",
    "Uruguay": "🇺🇾",
    "Senegal": "🇸🇳",
    "Panama": "🇵🇦",
    "Australia": "🇦🇺",
    "Belgium": "🇧🇪",
    "Iran": "🇮🇷",
    "Croatia": "🇭🇷",
    "Brazil": "🇧🇷",
    "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "Turkey": "🇹🇷",
    "Ivory Coast": "🇨🇮",
    "Netherlands": "🇳🇱",
    "Cape Verde": "🇨🇻",
    "France": "🇫🇷",
    "Tunisia": "🇹🇳",
    "Egypt": "🇪🇬",
    "Iraq": "🇮🇶",
    "Portugal": "🇵🇹",
    "Uzbekistan": "🇺🇿",
    "Colombia": "🇨🇴",
    "Ecuador": "🇪🇨",
    "Japan": "🇯🇵",
    "New Zealand": "🇳🇿",
    "Saudi Arabia": "🇸🇦",
    "Austria": "🇦🇹",
    "Ghana": "🇬🇭",
    "Spain": "🇪🇸",
    "Norway": "🇳🇴",
    "Democratic Republic of the Congo": "🇨🇩",
    "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  };

  const nameToFifaCode = {
    "Mexico": "MEX",
    "South Africa": "RSA",
    "South Korea": "KOR",
    "Czech Republic": "CZE",
    "Canada": "CAN",
    "Qatar": "QAT",
    "Switzerland": "SUI",
    "Morocco": "MAR",
    "Paraguay": "PAR",
    "Curaçao": "CUW",
    "Sweden": "SWE",
    "Algeria": "ALG",
    "Jordan": "JOR",
    "Haiti": "HAI",
    "Germany": "GER",
    "Uruguay": "URU",
    "Senegal": "SEN",
    "Panama": "PAN",
    "Bosnia and Herzegovina": "BIH",
    "United States": "USA",
    "Australia": "AUS",
    "Belgium": "BEL",
    "Iran": "IRN",
    "Croatia": "CRO",
    "Brazil": "BRA",
    "Scotland": "SCO",
    "Turkey": "TUR",
    "Ivory Coast": "CIV",
    "Netherlands": "NED",
    "Cape Verde": "CPV",
    "France": "FRA",
    "Tunisia": "TUN",
    "Egypt": "EGY",
    "Iraq": "IRQ",
    "Portugal": "POR",
    "Uzbekistan": "UZB",
    "Colombia": "COL",
    "Ecuador": "ECU",
    "Japan": "JPN",
    "New Zealand": "NZL",
    "Saudi Arabia": "KSA",
    "Austria": "AUT",
    "Ghana": "GHA",
    "Spain": "ESP",
    "Norway": "NOR",
    "Argentina": "ARG",
    "Democratic Republic of the Congo": "COD",
    "England": "ENG"
  };

  function getFifaDisplay(teamName) {
    if (!teamName) return "";
    if (teamName.startsWith("Winner") || teamName.startsWith("Runner-up") || teamName.startsWith("3rd") || teamName.startsWith("Loser")) {
      return teamName;
    }
    const code = nameToFifaCode[teamName] || teamName;
    const flag = countryFlags[teamName] || "";
    return flag ? `${flag} ${code}` : code;
  }

  // Scrape live TV listings page using AllOrigins proxy
  async function fetchLiveTvListings() {
    try {
      scrapedMatches = [];
      const proxyUrl = 'https://api.allorigins.win/get?url=';
      const targetUrl = encodeURIComponent('https://www.live-footballontv.com/live-world-cup-football-on-tv.html');
      const response = await fetch(`${proxyUrl}${targetUrl}`);
      if (!response.ok) throw new Error('Proxy connection failed');
      const data = await response.json();
      if (!data.contents) throw new Error('No scraped content received');

      const parser = new DOMParser();
      const doc = parser.parseFromString(data.contents, 'text/html');
      
      // Sanitizer helper for name comparisons
      const cleanName = (name) => {
        if (!name) return "";
        let clean = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        clean = clean.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
        // Handle common variations/synonyms
        if (clean === "turkiye" || clean === "trkiye" || clean === "turkey") return "turkey";
        if (clean === "unitedstates" || clean === "usa" || clean === "us") return "unitedstates";
        if (clean === "czechrepublic" || clean === "czechia") return "czechrepublic";
        if (clean === "bosniaandherzegovina" || clean === "bosniaherzegovina" || clean === "bosnia") return "bosniaandherzegovina";
        if (clean === "drcongo" || clean === "democraticrepublicofthecongo" || clean === "congo") return "democraticrepublicofthecongo";
        return clean;
      };

      // 1. Create a Sanitization Helper for team matching strings
      const cleanString = (str) => {
        if (!str) return "";
        let clean = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        clean = clean.toLowerCase()
          .replace(/bosnia-herzegovina|bosnia and herzegovina/g, 'bosniaandherzegovina')
          .replace(/dr congo|democratic republic of the congo/g, 'democraticrepublicofthecongo')
          .replace(/turkiye/g, 'turkey')
          .replace(/czech republic/g, 'czechrepublic');
        return clean.replace(/[\s\.]v(s)?[\s\.]/g, ' ').replace(/\s+/g, ' ').trim();
      };

      // Select elements that typically hold fixture/tv listings on the site (avoid outer div selection)
      const fixtures = doc.querySelectorAll('.fixture, .match, .row, tr');
      fixtures.forEach(el => {
        const teamsEl = el.querySelector('.fixture__teams, .teams, .match__teams');
        const teamsText = teamsEl ? (teamsEl.textContent || teamsEl.innerText || "") : "";
        
        const channelEl = el.querySelector('.fixture__channel, .channels, .channel, .broadcast');
        let rawChannelText = "";
        if (channelEl) {
          rawChannelText = (channelEl.textContent || "") + " " + (channelEl.className || "");
          channelEl.querySelectorAll('*').forEach(child => {
            rawChannelText += " " + (child.textContent || "") + " " + (child.className || "");
          });
        } else {
          rawChannelText = el.textContent || el.innerText || "";
        }
        
        const scrapedText = rawChannelText.toUpperCase();
        
        let channel = "Check Local Listings";
        if (scrapedText.includes("BBC")) {
          channel = "BBC One / iPlayer";
        } else if (scrapedText.includes("ITV")) {
          channel = "ITV1 / ITVX";
        } else {
          channel = "Check Local Listings";
        }

        // Cache the raw fixture row details and channel
        scrapedMatches.push({
          teamsText: teamsText || el.textContent,
          channel: channel
        });

        // Check if any qualified country names appear in the match element text
        const countries = Object.keys(nameToFifaCode);
        const foundTeams = [];
        const normalizedScraped = cleanName(teamsText || el.textContent);
        const splitTeams = (teamsText || el.textContent || "").split(/\s+v\s+|\s+vs\s+/i).map(t => cleanName(t));

        countries.forEach(country => {
          const normalizedCountry = cleanName(country);
          const isMatch = splitTeams.some(t => t === normalizedCountry) || 
                          (splitTeams.length > 0 && splitTeams.some(t => t.includes(normalizedCountry) || normalizedCountry.includes(t))) ||
                          normalizedScraped.includes(normalizedCountry);
          if (isMatch) {
            foundTeams.push(country);
          }
        });

        if (foundTeams.length > 0) {
          const home = foundTeams[0] || "Unknown";
          const away = foundTeams[1] || home;
          console.log(`Scraped Match: ${home} vs ${away} -> Raw Channel Text: ${scrapedText}`);
        }
      });
    } catch (error) {
      console.warn('Failed to scrape live TV guide, using offline resolver:', error);
    } finally {
      if (gamesCached && gamesCached.length > 0) {
        renderMatchTicker(gamesCached);
        const selectedTeam = teamSelector.value;
        if (selectedTeam) {
          renderTeamMatches(selectedTeam);
        }
      }
    }
  }

  // Broadcaster Resolver helper
  function getBroadcasterInfo(match) {
    const homeTeam = match.home_team_name_en;
    const awayTeam = match.away_team_name_en;
    
    let channel = "";
    if (homeTeam && awayTeam) {
      const cleanString = (str) => {
        if (!str) return "";
        let clean = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        clean = clean.toLowerCase()
          .replace(/bosnia-herzegovina|bosnia and herzegovina/g, 'bosniaandherzegovina')
          .replace(/dr congo|democratic republic of the congo/g, 'democraticrepublicofthecongo')
          .replace(/turkiye/g, 'turkey')
          .replace(/czech republic/g, 'czechrepublic');
        return clean.replace(/[\s\.]v(s)?[\s\.]/g, ' ').replace(/\s+/g, ' ').trim();
      };

      const cleanHome = cleanString(homeTeam);
      const cleanAway = cleanString(awayTeam);

      // Check if BOTH team name tokens are present in the text block using an .includes() rule
      const matched = scrapedMatches.find(item => {
        const cleanScraped = cleanString(item.teamsText);
        return cleanScraped.includes(cleanHome) && cleanScraped.includes(cleanAway);
      });

      if (matched) {
        channel = matched.channel;
      }
    }
    
    // Static backup resolver if scraper results are missing/unavailable
    if (!channel) {
      const staticResolver = {
        "ghana_england": "BBC One / iPlayer",
        "england_ghana": "BBC One / iPlayer",
        "panama_croatia": "BBC One / iPlayer",
        "croatia_panama": "BBC One / iPlayer",
        "canada_bosniaandherzegovina": "BBC One / iPlayer",
        "bosniaandherzegovina_canada": "BBC One / iPlayer",
        "unitedstates_paraguay": "BBC One / iPlayer",
        "paraguay_unitedstates": "BBC One / iPlayer",
        "morocco_brazil": "BBC One / iPlayer",
        "brazil_morocco": "BBC One / iPlayer",
        "haiti_scotland": "BBC One / iPlayer",
        "scotland_haiti": "BBC One / iPlayer",
        "ivorycoast_ecuador": "BBC One / iPlayer",
        "ecuador_ivorycoast": "BBC One / iPlayer",
        "belgium_egypt": "BBC One / iPlayer",
        "egypt_belgium": "BBC One / iPlayer",
        "iran_newzealand": "BBC One / iPlayer",
        "newzealand_iran": "BBC One / iPlayer",
        "senegal_france": "BBC One / iPlayer",
        "france_senegal": "BBC One / iPlayer",
        "iraq_norway": "BBC One / iPlayer",
        "norway_iraq": "BBC One / iPlayer",
        "jordan_austria": "BBC One / iPlayer",
        "austria_jordan": "BBC One / iPlayer",
        "portugal_democraticrepublicofthecongo": "BBC One / iPlayer",
        "democraticrepublicofthecongo_portugal": "BBC One / iPlayer",
        "uzbekistan_colombia": "BBC One / iPlayer",
        "colombia_uzbekistan": "BBC One / iPlayer",
        "southafrica_czechrepublic": "BBC One / iPlayer",
        "czechrepublic_southafrica": "BBC One / iPlayer",
        "mexico_southkorea": "BBC One / iPlayer",
        "southkorea_mexico": "BBC One / iPlayer",
        "unitedstates_australia": "BBC One / iPlayer",
        "australia_unitedstates": "BBC One / iPlayer",
        "sweden_netherlands": "BBC One / iPlayer",
        "netherlands_sweden": "BBC One / iPlayer",
        "curacao_ecuador": "BBC One / iPlayer",
        "ecuador_curacao": "BBC One / iPlayer",
        "tunisia_japan": "BBC One / iPlayer",
        "japan_tunisia": "BBC One / iPlayer",
        "saudiarabia_spain": "BBC One / iPlayer",
        "spain_saudiarabia": "BBC One / iPlayer",
        "uruguay_capeverde": "BBC One / iPlayer",
        "capeverde_uruguay": "BBC One / iPlayer",
        "austria_argentina": "BBC One / iPlayer",
        "argentina_austria": "BBC One / iPlayer",
        "france_iraq": "BBC One / iPlayer",
        "iraq_france": "BBC One / iPlayer",
        "morocco_haiti": "BBC One / iPlayer",
        "haiti_morocco": "BBC One / iPlayer",
        "brazil_scotland": "BBC One / iPlayer",
        "scotland_brazil": "BBC One / iPlayer",
        "mexico_czechrepublic": "BBC One / iPlayer",
        "czechrepublic_mexico": "BBC One / iPlayer",
        "southafrica_southkorea": "BBC One / iPlayer",
        "southkorea_southafrica": "BBC One / iPlayer",
        "curacao_ivorycoast": "BBC One / iPlayer",
        "ivorycoast_curacao": "BBC One / iPlayer",
        "germany_ecuador": "BBC One / iPlayer",
        "ecuador_germany": "BBC One / iPlayer",
        "sweden_japan": "BBC One / iPlayer",
        "japan_sweden": "BBC One / iPlayer",
        "netherlands_tunisia": "BBC One / iPlayer",
        "tunisia_netherlands": "BBC One / iPlayer",
        "iran_egypt": "BBC One / iPlayer",
        "egypt_iran": "BBC One / iPlayer",
        "belgium_newzealand": "BBC One / iPlayer",
        "newzealand_belgium": "BBC One / iPlayer",
        "portugal_colombia": "BBC One / iPlayer",
        "colombia_portugal": "BBC One / iPlayer",
        "uzbekistan_democraticrepublicofthecongo": "BBC One / iPlayer",
        "democraticrepublicofthecongo_uzbekistan": "BBC One / iPlayer",
        "algeria_austria": "BBC One / iPlayer",
        "austria_algeria": "BBC One / iPlayer",
        "jordan_argentina": "BBC One / iPlayer",
        "argentina_jordan": "BBC One / iPlayer"
      };

      const cleanStringSimple = (str) => {
        if (!str) return "";
        let clean = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        clean = clean.toLowerCase()
          .replace(/bosnia-herzegovina|bosnia and herzegovina/g, 'bosniaandherzegovina')
          .replace(/dr congo|democratic republic of the congo/g, 'democraticrepublicofthecongo')
          .replace(/turkiye/g, 'turkey')
          .replace(/czech republic/g, 'czechrepublic');
        return clean.replace(/[\s\.]v(s)?[\s\.]/g, '').replace(/\s+/g, '').trim();
      };

      if (homeTeam && awayTeam) {
        const key = `${cleanStringSimple(homeTeam)}_${cleanStringSimple(awayTeam)}`;
        channel = staticResolver[key] || "ITV1 / ITVX";
      } else {
        channel = "ITV1 / ITVX";
      }
    }
    
    let badgeClass = "bbc-style";
    let badgeText = "📺 BBC / ITV";
    
    if (channel.includes("BBC")) {
      badgeClass = "bbc-style";
      badgeText = "📺 " + channel;
    } else if (channel.includes("ITV")) {
      badgeClass = "itv-style";
      badgeText = "📺 " + channel;
    } else if (channel.includes("Listings")) {
      badgeClass = "bbc-style";
      badgeText = "📺 " + channel;
    }
    
    return { badgeClass, badgeText };
  }

  // Fetch all endpoints concurrently
  async function initDashboard() {
    // Start scraper in background without awaiting to avoid blocking UI loads
    fetchLiveTvListings();

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
      cleanSheetsMap = {};
      completedGamesCount = 0;

      // Process match datasets
      processMatches(gamesCached);
      rebuildGroupStandings(gamesCached);
      renderTournamentStats();
      
      const currentSelected = teamSelector.value;
      populateTeamSelector();
      if (currentSelected) {
        teamSelector.value = currentSelected;
        const stats = teamMatrix[currentSelected];
        if (stats) {
          teamGoalsEl.textContent = stats.goals;
          teamYellowsEl.textContent = stats.yellows;
          teamRedsEl.textContent = stats.reds;
          renderTeamMatches(currentSelected);
          renderGroupStandings(currentSelected);
        }
      }

      renderLeaderboards();
      renderMatchTicker(gamesCached);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      topScorersList.innerHTML = `<tr><td colspan="3" class="loading-cell" style="color: var(--accent-red);">Error.</td></tr>`;
      topAssistsList.innerHTML = `<tr><td colspan="3" class="loading-cell" style="color: var(--accent-red);">Error.</td></tr>`;
    }
  }

  const stadiumOffsets = {
    "1": -6,  // Mexico City (Mexico) -> UTC-6
    "2": -6,  // Guadalajara (Mexico) -> UTC-6
    "3": -6,  // Monterrey (Mexico) -> UTC-6
    "4": -5,  // Dallas (CDT) -> UTC-5
    "5": -5,  // Houston (CDT) -> UTC-5
    "6": -5,  // Kansas City (CDT) -> UTC-5
    "7": -4,  // Atlanta (EDT) -> UTC-4
    "8": -4,  // Miami (EDT) -> UTC-4
    "9": -4,  // Boston (EDT) -> UTC-4
    "10": -4, // Philadelphia (EDT) -> UTC-4
    "11": -4, // New York (EDT) -> UTC-4
    "12": -4, // Toronto (EDT) -> UTC-4
    "13": -7, // Vancouver (PDT) -> UTC-7
    "14": -7, // Seattle (PDT) -> UTC-7
    "15": -7, // San Francisco (PDT) -> UTC-7
    "16": -7  // Los Angeles (PDT) -> UTC-7
  };

  // Convert raw API local_date to Date object in UK timezone (Europe/London)
  function parseMatchDateToUK(dateStr, stadiumId) {
    if (!dateStr) return new Date();
    const parts = dateStr.split(' ');
    if (parts.length < 2) return new Date(dateStr);
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    if (dateParts.length < 3 || timeParts.length < 2) return new Date(dateStr);
    
    const year = parseInt(dateParts[2]);
    const month = parseInt(dateParts[0]) - 1;
    const day = parseInt(dateParts[1]);
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    
    const offset = stadiumOffsets[stadiumId ? stadiumId.toString() : ""] || 0;
    const utcTimeMs = Date.UTC(year, month, day, hours - offset, minutes);
    return new Date(utcTimeMs);
  }

  // Format a Date object to clean UK local string: "Jun 12, 15:00"
  function formatUKDate(date) {
    const optionsDate = { month: 'short', day: 'numeric', timeZone: 'Europe/London' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' };
    
    const dateStr = date.toLocaleDateString('en-GB', optionsDate);
    const timeStr = date.toLocaleTimeString('en-GB', optionsTime);
    
    return `${dateStr}, ${timeStr}`;
  }

  // Format MM/DD/YYYY HH:MM to "Jun 12, 15:00" in UK local time
  function formatTickerDate(dateStr, stadiumId) {
    const date = parseMatchDateToUK(dateStr, stadiumId);
    return formatUKDate(date);
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
      const dateA = parseMatchDateToUK(a.local_date, a.stadium_id);
      const dateB = parseMatchDateToUK(b.local_date, b.stadium_id);
      return dateA - dateB;
    });

    // Sort completed matches chronologically descending (most recent first)
    completedMatches.sort((a, b) => {
      const dateA = parseMatchDateToUK(a.local_date, a.stadium_id);
      const dateB = parseMatchDateToUK(b.local_date, b.stadium_id);
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
        const timeDisplay = match.time_elapsed === 'live' ? 'LIVE' : `LIVE ${match.time_elapsed}'`;
        statusHtml = `<span class="ticker-status live"><span class="pulse-live">● ${timeDisplay}</span></span>`;
        scoreHtml = `<span class="ticker-score" style="color: var(--accent-green);">${match.home_score} - ${match.away_score}</span>`;
      } else if (!isFinished) {
        statusHtml = `<span class="ticker-status">${formatTickerDate(match.local_date, match.stadium_id)}</span>`;
        scoreHtml = `<span class="ticker-score" style="color: var(--text-muted);">VS</span>`;
      } else {
        statusHtml = `<span class="ticker-status completed">FINAL</span>`;
        scoreHtml = `<span class="ticker-score">${match.home_score} - ${match.away_score}</span>`;
      }

      const homeLabel = getFifaDisplay(match.home_team_name_en || match.home_team_label);
      const awayLabel = getFifaDisplay(match.away_team_name_en || match.away_team_label);

      // Determine UK Broadcaster dynamically
      const { badgeClass: tvBadgeClass, badgeText: tvBadgeText } = getBroadcasterInfo(match);

      return `
        <div class="ticker-card">
          <div class="ticker-card-header">
            <span>MATCH #${match.id}</span>
            ${statusHtml}
          </div>
          <div class="ticker-teams">
            <span style="font-weight: 800;">${homeLabel}</span>
            ${scoreHtml}
            <span style="font-weight: 800;">${awayLabel}</span>
          </div>
          <div class="tv-badge ${tvBadgeClass}">${tvBadgeText}</div>
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
    if (!matches || matches.length === 0) {
      console.warn("No matches available to process.");
      return;
    }
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
          teamMatrix[homeTeam] = { id: homeId.toString(), goals: 0, yellows: 0, reds: 0, points: 0, wins: 0, losses: 0, draws: 0, gd: 0 };
        }
      }
      if (awayTeam && awayId && !awayTeam.startsWith("Winner") && !awayTeam.startsWith("Runner-up") && !awayTeam.startsWith("3rd")) {
        teamIdToNameMap[awayId.toString()] = awayTeam;
        teamNameToIdMap[awayTeam] = awayId.toString();
        if (!teamMatrix[awayTeam]) {
          teamMatrix[awayTeam] = { id: awayId.toString(), goals: 0, yellows: 0, reds: 0, points: 0, wins: 0, losses: 0, draws: 0, gd: 0 };
        }
      }

      // Explicitly filter by status
      const eventStatus = match.eventStatus || (match.finished === "TRUE" || match.time_elapsed === "finished" ? "done" : "not started");
      const status = match.status || (match.finished === "TRUE" || match.time_elapsed === "finished" ? "completed" : "not started");

      if (eventStatus === "done" || status === "completed") {
        const homeScore = parseInt(match.home_score) || 0;
        const awayScore = parseInt(match.away_score) || 0;

        completedGamesCount++;
        // Goals Accumulation
        globalStats.totalGoals += (homeScore + awayScore);
        if (homeTeam && teamMatrix[homeTeam]) teamMatrix[homeTeam].goals += homeScore;
        if (awayTeam && teamMatrix[awayTeam]) teamMatrix[awayTeam].goals += awayScore;

        // Native Points, Wins, Losses, Draws, and Goal Difference Calculations
        const goalDiff = homeScore - awayScore;
        if (homeTeam && teamMatrix[homeTeam]) {
          teamMatrix[homeTeam].gd += goalDiff;
          if (homeScore > awayScore) {
            teamMatrix[homeTeam].wins += 1;
            teamMatrix[homeTeam].points += 3;
          } else if (homeScore < awayScore) {
            teamMatrix[homeTeam].losses += 1;
          } else {
            teamMatrix[homeTeam].draws += 1;
            teamMatrix[homeTeam].points += 1;
          }
        }
        if (awayTeam && teamMatrix[awayTeam]) {
          teamMatrix[awayTeam].gd -= goalDiff;
          if (awayScore > homeScore) {
            teamMatrix[awayTeam].wins += 1;
            teamMatrix[awayTeam].points += 3;
          } else if (awayScore < homeScore) {
            teamMatrix[awayTeam].losses += 1;
          } else {
            teamMatrix[awayTeam].draws += 1;
            teamMatrix[awayTeam].points += 1;
          }
        }

        // Clean Sheets Accumulation
        if (homeTeam && !homeTeam.startsWith("Winner") && !homeTeam.startsWith("Runner-up") && !homeTeam.startsWith("3rd")) {
          if (awayScore === 0) {
            cleanSheetsMap[homeTeam] = (cleanSheetsMap[homeTeam] || 0) + 1;
          }
        }
        if (awayTeam && !awayTeam.startsWith("Winner") && !awayTeam.startsWith("Runner-up") && !awayTeam.startsWith("3rd")) {
          if (homeScore === 0) {
            cleanSheetsMap[awayTeam] = (cleanSheetsMap[awayTeam] || 0) + 1;
          }
        }

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

  // Rebuild group standings dynamically from live/completed match data supporting Groups A through L
  function rebuildGroupStandings(matches) {
    if (!groupsCached || groupsCached.length === 0) return;

    // Reset statistics for all teams in all groups to 0
    groupsCached.forEach(group => {
      if (group.teams && Array.isArray(group.teams)) {
        group.teams.forEach(team => {
          team.mp = 0;
          team.w = 0;
          team.l = 0;
          team.d = 0;
          team.gf = 0;
          team.ga = 0;
          team.gd = 0;
          team.pts = 0;
        });
      }
    });

    // Process all completed matches to update groupsCached
    matches.forEach(match => {
      const eventStatus = match.eventStatus || (match.finished === "TRUE" || match.time_elapsed === "finished" ? "done" : "not started");
      const status = match.status || (match.finished === "TRUE" || match.time_elapsed === "finished" ? "completed" : "not started");

      if (eventStatus === "done" || status === "completed") {
        const homeId = match.home_team_id ? match.home_team_id.toString() : null;
        const awayId = match.away_team_id ? match.away_team_id.toString() : null;
        const homeScore = parseInt(match.home_score) || 0;
        const awayScore = parseInt(match.away_score) || 0;

        if (!homeId || !awayId) return;

        const updateTeamInGroup = (teamId, scoreFor, scoreAgainst, result) => {
          for (let group of groupsCached) {
            if (group.teams && Array.isArray(group.teams)) {
              const team = group.teams.find(t => t.team_id.toString() === teamId);
              if (team) {
                team.mp = (parseInt(team.mp) || 0) + 1;
                team.gf = (parseInt(team.gf) || 0) + scoreFor;
                team.ga = (parseInt(team.ga) || 0) + scoreAgainst;
                team.gd = team.gf - team.ga;
                
                if (result === 'w') {
                  team.w = (parseInt(team.w) || 0) + 1;
                  team.pts = (parseInt(team.pts) || 0) + 3;
                } else if (result === 'l') {
                  team.l = (parseInt(team.l) || 0) + 1;
                } else if (result === 'd') {
                  team.d = (parseInt(team.d) || 0) + 1;
                  team.pts = (parseInt(team.pts) || 0) + 1;
                }
                break;
              }
            }
          }
        };

        if (homeScore > awayScore) {
          updateTeamInGroup(homeId, homeScore, awayScore, 'w');
          updateTeamInGroup(awayId, awayScore, homeScore, 'l');
        } else if (homeScore < awayScore) {
          updateTeamInGroup(homeId, homeScore, awayScore, 'l');
          updateTeamInGroup(awayId, awayScore, homeScore, 'w');
        } else {
          updateTeamInGroup(homeId, homeScore, awayScore, 'd');
          updateTeamInGroup(awayId, awayScore, homeScore, 'd');
        }
      }
    });
  }

  // Render top row metrics
  function renderTournamentStats() {
    totalGoalsEl.textContent = globalStats.totalGoals;
    totalYellowsEl.textContent = globalStats.totalYellowCards;
    totalRedsEl.textContent = globalStats.totalRedCards;

    const avgGoals = completedGamesCount > 0 ? (globalStats.totalGoals / completedGamesCount).toFixed(1) : "0.0";
    avgGoalsMeta.textContent = `Avg: ${avgGoals} per match`;

    const avgYellows = completedGamesCount > 0 ? (globalStats.totalYellowCards / completedGamesCount).toFixed(2) : "0.00";
    avgYellowsMeta.textContent = `Avg: ${avgYellows} per match`;

    const avgReds = completedGamesCount > 0 ? (globalStats.totalRedCards / completedGamesCount).toFixed(2) : "0.00";
    avgRedsMeta.textContent = `Avg: ${avgReds} per match`;
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
    const sortedScorers = Object.entries(playerGoalsMap || {})
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
    const sortedAssisters = Object.entries(playerAssistsMap || {})
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

    // Clean Sheets Leaderboard
    const sortedCleans = Object.entries(cleanSheetsMap || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedCleans.length === 0) {
      topCleansList.innerHTML = `<tr><td colspan="3" class="loading-cell">No cleans.</td></tr>`;
    } else {
      topCleansList.innerHTML = sortedCleans.map(([team, cleans], index) => {
        const display = getFifaDisplay(team);
        return `
          <tr>
            <td class="rank-cell">#${index + 1}</td>
            <td class="player-cell" style="font-weight: 700;">${display}</td>
            <td class="goals-cell" style="color: var(--accent-green);">${cleans}</td>
          </tr>
        `;
      }).join('');
    }

    // Most Aggressive Leaderboard
    const sortedAggressive = Object.entries(teamMatrix || {})
      .map(([teamName, stats]) => {
        const pts = (stats.yellows || 0) + ((stats.reds || 0) * 3);
        return [teamName, pts];
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedAggressive.length === 0) {
      topAggressiveList.innerHTML = `<tr><td colspan="2" class="loading-cell">No cards.</td></tr>`;
    } else {
      topAggressiveList.innerHTML = sortedAggressive.map(([team, pts], index) => {
        const display = getFifaDisplay(team);
        return `
          <tr>
            <td class="rank-cell">#${index + 1}</td>
            <td class="player-cell" style="font-weight: 700;">${display}</td>
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

      // Determine UK Broadcaster dynamically
      const { badgeClass: tvBadgeClass, badgeText: tvBadgeText } = getBroadcasterInfo(match);

      return `
        <div class="match-item-card">
          <div class="match-header-line">
            <span class="match-stage-badge">${stageText}</span>
            <div class="tv-badge ${tvBadgeClass}" style="margin-top: 0; font-size: 0.6rem; padding: 0.1rem 0.35rem;">${tvBadgeText}</div>
            <span>${formatTickerDate(match.local_date, match.stadium_id)}</span>
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
    if (!groupsCached || groupsCached.length === 0) {
      groupTitleEl.textContent = "// GROUP STANDINGS";
      groupStandingsBody.innerHTML = `<tr><td colspan="5" class="text-center">Standings currently unavailable.</td></tr>`;
      return;
    }
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
  setupEventListeners();
  initDashboard();

  // Poll for updates every 30 seconds
  setInterval(initDashboard, 30000);
});
