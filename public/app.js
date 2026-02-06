/**
 * Concert Notify - Frontend Application
 *
 * Handles:
 * - Spotify OAuth authentication flow
 * - Fetching user's artists and upcoming shows
 * - Matching shows to user's listening habits
 */

(function() {
  'use strict';

  // DOM Elements
  const elements = {
    authContainer: document.getElementById('authContainer'),
    appContainer: document.getElementById('appContainer'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    errorMessage: document.getElementById('errorMessage'),
    loading: document.getElementById('loading'),
    username: document.getElementById('username'),
    matchesList: document.getElementById('matchesList'),
    calendarContainer: document.getElementById('calendarContainer'),
    calendarView: document.getElementById('calendarView'),
    calendarTitle: document.getElementById('calendarTitle'),
    calendarPrev: document.getElementById('calendarPrev'),
    calendarNext: document.getElementById('calendarNext'),
  };

  // Application state
  const state = {
    userId: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    username: null,
    // Calendar state
    calendarWeekOffset: 0,
    calendarMatches: [],
  };

  // Storage keys
  const STORAGE_KEYS = {
    userId: 'concert_notify_userId',
    accessToken: 'concert_notify_accessToken',
    refreshToken: 'concert_notify_refreshToken',
    expiresAt: 'concert_notify_expiresAt',
    username: 'concert_notify_username',
  };

  // UI Helpers
  const ui = {
    showLoading: () => elements.loading.classList.add('show'),
    hideLoading: () => elements.loading.classList.remove('show'),

    showError: (message) => {
      elements.errorMessage.textContent = message;
      elements.errorMessage.classList.add('show');
    },

    hideError: () => elements.errorMessage.classList.remove('show'),

    showApp: () => {
      elements.authContainer.style.display = 'none';
      elements.appContainer.style.display = 'block';
      elements.username.textContent = state.username || '';
    },

    showLogin: () => {
      elements.authContainer.style.display = 'block';
      elements.appContainer.style.display = 'none';
    },
  };

  // Authentication
  const auth = {
    login: () => {
      window.location.href = '/login';
    },

    logout: () => {
      Object.keys(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(STORAGE_KEYS[key]);
        state[key] = null;
      });
      ui.showLogin();
    },

    saveToStorage: () => {
      localStorage.setItem(STORAGE_KEYS.userId, state.userId);
      localStorage.setItem(STORAGE_KEYS.accessToken, state.accessToken);
      localStorage.setItem(STORAGE_KEYS.refreshToken, state.refreshToken);
      localStorage.setItem(STORAGE_KEYS.expiresAt, state.expiresAt);
      localStorage.setItem(STORAGE_KEYS.username, state.username);
    },

    loadFromStorage: () => {
      state.userId = localStorage.getItem(STORAGE_KEYS.userId);
      state.accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
      state.refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
      state.expiresAt = parseInt(localStorage.getItem(STORAGE_KEYS.expiresAt), 10);
      state.username = localStorage.getItem(STORAGE_KEYS.username);
    },

    refreshToken: async () => {
      try {
        const response = await fetch(`/refresh_token?refresh_token=${state.refreshToken}`);

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        state.accessToken = data.access_token;
        state.expiresAt = Date.now() + (data.expires_in * 1000);

        localStorage.setItem(STORAGE_KEYS.accessToken, state.accessToken);
        localStorage.setItem(STORAGE_KEYS.expiresAt, state.expiresAt);

        return true;
      } catch (error) {
        console.error('Token refresh failed:', error);
        auth.logout();
        return false;
      }
    },

    checkTokensFromUrl: () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      if (params.has('error')) {
        ui.showError(`Authentication failed: ${params.get('error')}`);
        return false;
      }

      if (params.has('access_token')) {
        state.accessToken = params.get('access_token');
        state.refreshToken = params.get('refresh_token');
        state.userId = params.get('userId');
        state.username = params.get('username');
        state.expiresAt = Date.now() + (3600 * 1000);

        auth.saveToStorage();
        window.location.hash = '';
        return true;
      }

      return false;
    },

    init: async () => {
      // Check for tokens in URL (OAuth callback)
      if (auth.checkTokensFromUrl()) {
        ui.showApp();
        fetchData();
        return;
      }

      // Check for existing session
      auth.loadFromStorage();

      if (state.accessToken && state.userId) {
        // Refresh if expired
        if (Date.now() >= state.expiresAt) {
          const refreshed = await auth.refreshToken();
          if (!refreshed) return;
        }

        ui.showApp();
        fetchData();
      }
    },
  };

  // API calls
  async function fetchWithAuth(url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${state.accessToken}` },
    });

    if (response.status === 401) {
      const refreshed = await auth.refreshToken();
      if (refreshed) {
        return fetch(url, {
          headers: { Authorization: `Bearer ${state.accessToken}` },
        });
      }
      throw new Error('Authentication failed');
    }

    return response;
  }

  async function fetchData() {
    if (!state.userId || !state.accessToken) return;

    try {
      ui.showLoading();
      ui.hideError();

      const [topArtistsRes, likedArtistsRes, showsRes] = await Promise.all([
        fetchWithAuth(`/api/top-artists?userId=${state.userId}`),
        fetchWithAuth(`/api/liked-artists?userId=${state.userId}`),
        fetch('/api/upcoming-shows'),
      ]);

      const [topArtistsData, likedArtistsData, showsData] = await Promise.all([
        topArtistsRes.json(),
        likedArtistsRes.json(),
        showsRes.json(),
      ]);

      if (topArtistsData.error || likedArtistsData.error || showsData.error) {
        throw new Error(topArtistsData.error || likedArtistsData.error || showsData.error);
      }

      const matches = findMatches(
        topArtistsData.topArtists || [],
        likedArtistsData.likedArtists || [],
        showsData.upcomingShows || []
      );

      renderMatches(matches);
    } catch (error) {
      console.error('Error fetching data:', error);
      ui.showError('Failed to load data. Please try again.');
    } finally {
      ui.hideLoading();
    }
  }

  /**
   * Normalizes an artist name for matching.
   * Mirrors the logic in src/shared/normalize.js
   */
  function normalizeArtistName(name) {
    if (typeof name !== 'string') return '';

    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^the\s+/i, '')
      .replace(/\s+&\s+/g, ' and ')
      .replace(/['']/g, "'")
      .trim();
  }

  /**
   * Find shows matching the user's artists.
   *
   * Show structure (flat):
   * {
   *   artists: string[],
   *   venue: string,
   *   date: string,
   *   time: string
   * }
   */
  function findMatches(topArtists, likedArtists, shows) {
    // Build set of user's artist names (normalized)
    const userArtistNames = new Set([
      ...topArtists.map(a => normalizeArtistName(a.name)),
      ...likedArtists.map(a => normalizeArtistName(a.name)),
    ]);

    // Filter shows that have at least one matching artist
    const matches = shows.filter(show => {
      if (!show || !Array.isArray(show.artists)) {
        return false;
      }

      return show.artists.some(artist => {
        return userArtistNames.has(normalizeArtistName(artist));
      });
    });

    // Sort by date (ascending)
    matches.sort((a, b) => {
      try {
        return new Date(a.date) - new Date(b.date);
      } catch {
        return 0;
      }
    });

    return matches;
  }

  function renderMatches(matches) {
    // Render list view
    if (matches.length === 0) {
      elements.matchesList.innerHTML = `
        <div class="empty-state">
          <p>No upcoming shows found for your artists.</p>
          <p>Check back later for new announcements!</p>
        </div>
      `;
    } else {
      elements.matchesList.innerHTML = matches.map(show => {
        return `
          <div class="show-card">
            <div class="show-card__artists">${escapeHtml(show.artists.join(', '))}</div>
            <div class="show-card__details">
              <div class="show-card__date">${escapeHtml(show.date)} at ${escapeHtml(show.time)}</div>
              <div class="show-card__venue">${escapeHtml(show.venue)}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Render calendar view
    renderCalendar(matches);
  }

  /**
   * Renders the weekly calendar view with matched shows.
   */
  function renderCalendar(matches) {
    if (!elements.calendarContainer || !elements.calendarView) {
      return;
    }

    // Store matches for navigation
    state.calendarMatches = matches;

    // Render with current offset
    updateCalendarView();

    // Show calendar container
    elements.calendarContainer.style.display = 'block';
  }

  /**
   * Updates the calendar view based on current week offset.
   */
  function updateCalendarView() {
    const weekData = WeeklyShows.getWeekByOffset(state.calendarMatches, state.calendarWeekOffset);

    // Render calendar grid
    WeeklyCalendar.render(weekData, elements.calendarView);

    // Update title
    if (elements.calendarTitle) {
      elements.calendarTitle.textContent = getWeekTitle(weekData, state.calendarWeekOffset);
    }
  }

  /**
   * Generates a human-readable title for the week.
   */
  function getWeekTitle(weekData, offset) {
    if (offset === 0) {
      return 'This Week';
    } else if (offset === 1) {
      return 'Next Week';
    } else if (offset === -1) {
      return 'Last Week';
    }

    // Format as date range: "Feb 9 - 15"
    const start = weekData.weekStartDate;
    const end = weekData.weekEndDate;

    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const endDay = end.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
  }

  /**
   * Navigate to previous week.
   */
  function calendarPrevWeek() {
    state.calendarWeekOffset--;
    updateCalendarView();
  }

  /**
   * Navigate to next week.
   */
  function calendarNextWeek() {
    state.calendarWeekOffset++;
    updateCalendarView();
  }

  // Prevent XSS when rendering user-controlled data
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Event listeners
  document.addEventListener('DOMContentLoaded', () => {
    elements.loginButton.addEventListener('click', auth.login);
    elements.logoutButton.addEventListener('click', auth.logout);

    // Calendar navigation
    if (elements.calendarPrev) {
      elements.calendarPrev.addEventListener('click', calendarPrevWeek);
    }
    if (elements.calendarNext) {
      elements.calendarNext.addEventListener('click', calendarNextWeek);
    }

    auth.init();
  });
})();
