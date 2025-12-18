/**
 * AI Calendar Extension - Background Service Worker
 * Handles event extraction via backend API and Google Calendar integration
 */

'use strict';

// =============================================================================
// CONSTANTS
// =============================================================================

const CONFIG = {
  CONTEXT_MENU_ID: 'addToCalendar',
  CONTEXT_MENU_TITLE: 'Add to Calendar',
  BACKEND_URL: 'https://ai-calendar-app.onrender.com/process_event',
  LOG_SAVE_URL: 'https://ai-calendar-app.onrender.com/log_calendar_save',
  CALENDAR_API_URL: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
  REQUEST_TIMEOUT: 15000,
  KEEP_ALIVE_INTERVAL: 60000,
  CONTEXT_MENU_CHECK_INTERVAL: 300000,
  CACHE_MAX_ITEMS: 20,
  CACHE_EXPIRY: 3600000, // 1 hour
  CACHE_KEY: 'eventCache'
};

const ERROR_CODES = {
  BACKEND_ERROR: 'BACKEND_ERROR',
  BACKEND_TIMEOUT: 'BACKEND_TIMEOUT',
  BACKEND_UNREACHABLE: 'BACKEND_UNREACHABLE',
  RATE_LIMITED: 'RATE_LIMITED'
};

// =============================================================================
// CONTEXT MENU
// =============================================================================

function createContextMenu() {
  chrome.contextMenus.update(CONFIG.CONTEXT_MENU_ID, {}, () => {
    if (chrome.runtime.lastError) {
      chrome.contextMenus.create({
        id: CONFIG.CONTEXT_MENU_ID,
        title: CONFIG.CONTEXT_MENU_TITLE,
        contexts: ['selection']
      }, () => {
        if (chrome.runtime.lastError) {
          setTimeout(createContextMenu, 1000);
        }
      });
    }
  });
}

// =============================================================================
// SERVICE WORKER KEEP-ALIVE
// =============================================================================

function keepAlive() {
  let lastCheck = Date.now();
  
  setInterval(() => {
    if (Date.now() - lastCheck > CONFIG.CONTEXT_MENU_CHECK_INTERVAL) {
      chrome.contextMenus.update(CONFIG.CONTEXT_MENU_ID, {}, () => {
        if (chrome.runtime.lastError) createContextMenu();
        lastCheck = Date.now();
      });
    }
  }, CONFIG.KEEP_ALIVE_INTERVAL);
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

function checkAuthStatus(interactive = false) {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        resolve(null);
      } else {
        chrome.storage.local.set({ isAuthenticated: true });
        resolve(token);
      }
    });
  });
}

async function getAuthToken() {
  // Try non-interactive first (faster)
  let token = await checkAuthStatus(false);
  if (!token) {
    token = await checkAuthStatus(true);
  }
  if (!token) {
    throw new Error('Authentication failed');
  }
  return token;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function initialize() {
  createContextMenu();
  keepAlive();
  checkAuthStatus();
}

initialize();

// =============================================================================
// EVENT LISTENERS
// =============================================================================

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
  fetch(chrome.runtime.getURL('confirm.html')).catch(() => {});
  setTimeout(promptAuthIfNeeded, 1000);
});

chrome.runtime.onStartup.addListener(createContextMenu);

chrome.notifications.onButtonClicked.addListener((_, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.action.openPopup();
    checkAuthStatus(true);
  }
});

function promptAuthIfNeeded() {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (!token) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Calendar Extension Setup',
        message: 'Please connect to your Google Calendar to use this extension',
        buttons: [{ title: 'Connect Now' }]
      });
    }
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONFIG.CONTEXT_MENU_ID) return;
  
  const selectedText = info.selectionText;
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, () => {
    if (!chrome.runtime.lastError) {
      processSelectedText(selectedText, tab);
    }
  });
});

// =============================================================================
// EVENT EXTRACTION
// =============================================================================

async function processSelectedText(selectedText, tab) {
  chrome.storage.local.set({ pendingEvent: selectedText });
  
  chrome.tabs.sendMessage(tab.id, { action: 'showModal', state: 'loading' }, async () => {
    if (chrome.runtime.lastError) return;
    
    // Check cache first
    const cached = await getCachedEvent(selectedText);
    if (cached) {
      await showEventForm(cached, tab.id);
      return;
    }
    
    try {
      const eventDetails = await fetchEventFromBackend(selectedText);
      
      // Backend returned error without usable data
      if (eventDetails.error_code && !eventDetails.title) {
        sendError(tab.id, eventDetails.error_code, eventDetails.extraction_error, selectedText);
        return;
      }
      
      const normalized = normalizeEventData(eventDetails, selectedText);
      cacheEvent(selectedText, normalized);
      await showEventForm(normalized, tab.id);
      
    } catch (error) {
      const { code, message } = categorizeError(error);
      sendError(tab.id, code, message, selectedText);
    }
  });
}

async function fetchEventFromBackend(text) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
  
  const textLower = text.toLowerCase();
  const timeContext = textLower.includes('pm') || textLower.includes('evening') || textLower.includes('afternoon')
    ? 'pm' : textLower.includes('am') ? 'am' : 'unknown';
  
  try {
    const response = await fetch(CONFIG.BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        current_time: new Date().toISOString(),
        user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        context: { time_context: timeContext }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeEventData(data, rawText) {
  return {
    title: data.title || 'Untitled Event',
    date: data.date || new Date().toISOString().split('T')[0],
    startTime: data.startTime || data.start_time || '12:00 PM',
    endTime: data.endTime || data.end_time || '1:00 PM',
    location: data.location || '',
    description: data.description || '',
    attendees: data.attendees || [],
    rawText,
    error_code: data.error_code || null,
    extraction_error: data.extraction_error || null
  };
}

function categorizeError(error) {
  if (error.name === 'AbortError') {
    return { code: ERROR_CODES.BACKEND_TIMEOUT, message: 'Request timed out. Please try again.' };
  }
  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    return { code: ERROR_CODES.BACKEND_UNREACHABLE, message: 'Unable to connect. Check your internet connection.' };
  }
  if (error.message.includes('429') || error.message.includes('rate limit')) {
    return { code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests. Please wait a moment.' };
  }
  return { code: ERROR_CODES.BACKEND_ERROR, message: 'AI backend unavailable. Please try again.' };
}

function sendError(tabId, errorCode, errorMessage, selectedText) {
  chrome.tabs.sendMessage(tabId, {
    action: 'updateModal',
    state: 'error',
    errorCode,
    error: errorMessage || 'Could not extract event details.',
    allowManualEntry: true,
    selectedText
  });
}

async function showEventForm(eventDetails, tabId) {
  chrome.storage.local.set({ eventDetails, pendingEvent: eventDetails });
  chrome.tabs.sendMessage(tabId, {
    action: 'updateModal',
    state: 'ready',
    eventDetails
  });
}

// =============================================================================
// MESSAGE HANDLERS
// =============================================================================

function fixNaNTime(timeStr) {
  if (!timeStr || !timeStr.includes('NaN')) return timeStr;
  const match = timeStr.match(/^(\d+):NaN\s*(AM|PM)$/i);
  return match ? `${match[1]}:00 ${match[2]}` : timeStr;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;
  
  if (action === 'processSelectedText') {
    chrome.storage.local.remove([CONFIG.CACHE_KEY, 'pendingEvent']);
    processSelectedText(request.text, sender.tab);
    sendResponse({ success: true });
    
  } else if (action === 'createEvent') {
    const eventDetails = {
      ...request.eventDetails,
      startTime: fixNaNTime(request.eventDetails.startTime),
      endTime: fixNaNTime(request.eventDetails.endTime)
    };
    
    createCalendarEvent(eventDetails)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Async response
    
  } else if (action === 'checkAuthStatus') {
    checkAuthStatus().then(token => sendResponse({ isAuthenticated: !!token }));
    return true;
    
  } else if (action === 'authenticate') {
    checkAuthStatus(true)
      .then(token => sendResponse({ success: !!token, error: token ? null : 'Authentication failed' }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// =============================================================================
// GOOGLE CALENDAR API
// =============================================================================

async function createCalendarEvent(eventDetails) {
  const saveStartTime = Date.now();
  const token = await getAuthToken();
  const parsedEvent = parseEventTimes(eventDetails);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const event = {
    summary: parsedEvent.title || 'Untitled Event',
    location: parsedEvent.location || '',
    description: parsedEvent.description || '',
    start: { dateTime: parsedEvent.startDateTime, timeZone: timezone },
    end: { dateTime: parsedEvent.endDateTime, timeZone: timezone }
  };
  
  if (parsedEvent.attendees?.length) {
    event.attendees = parsedEvent.attendees.map(a => 
      typeof a === 'object' ? a : { email: a }
    );
  }
  
  const response = await fetch(CONFIG.CALENDAR_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });
  
  const saveDuration = Date.now() - saveStartTime;
  
  if (!response.ok) {
    const error = await response.json();
    const errorMsg = error.error?.message || 'Failed to create event';
    
    // Log failed save to backend
    logCalendarSave({
      success: false,
      event_title: eventDetails.title || 'Untitled Event',
      event_date: eventDetails.date,
      event_start_time: eventDetails.startTime,
      event_end_time: eventDetails.endTime,
      error: errorMsg,
      save_duration_ms: saveDuration
    });
    
    throw new Error(errorMsg);
  }
  
  const eventData = await response.json();
  
  // Log successful save to backend
  logCalendarSave({
    success: true,
    event_id: eventData.id,
    event_title: eventDetails.title || 'Untitled Event',
    event_date: eventDetails.date,
    event_start_time: eventDetails.startTime,
    event_end_time: eventDetails.endTime,
    save_duration_ms: saveDuration
  });
  
  return { success: true, eventData };
}

// Log calendar save result to backend for LangSmith tracing
async function logCalendarSave(data) {
  try {
    await fetch(CONFIG.LOG_SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) {
    // Silent fail - don't break the main flow
    console.error('Failed to log calendar save:', e);
  }
}

// =============================================================================
// TIME PARSING
// =============================================================================

function parseEventTimes(eventDetails) {
  const { date, startTime, endTime } = eventDetails;
  
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format');
  }
  
  const [year, month, day] = date.split('-').map(Number);
  const start = parseTimeToHours(startTime);
  const end = endTime ? parseTimeToHours(endTime) : { hours: (start.hours + 1) % 24, minutes: start.minutes };
  
  const startDateTime = new Date(year, month - 1, day, start.hours, start.minutes);
  const endDateTime = new Date(year, month - 1, day, end.hours, end.minutes);
  
  // Handle overnight events
  if (endDateTime <= startDateTime) {
    endDateTime.setDate(endDateTime.getDate() + 1);
  }
  
  return {
    ...eventDetails,
    startDateTime: startDateTime.toISOString(),
    endDateTime: endDateTime.toISOString()
  };
}

function parseTimeToHours(timeStr) {
  if (!timeStr) throw new Error('Missing time');
  
  // 24-hour format
  const match24 = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (match24) {
    return { hours: parseInt(match24[1]), minutes: parseInt(match24[2]) };
  }
  
  // 12-hour format
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = parseInt(match12[2]);
    const isPM = match12[3].toUpperCase() === 'PM';
    
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    
    return { hours, minutes };
  }
  
  throw new Error(`Invalid time format: ${timeStr}`);
}

// =============================================================================
// CACHING
// =============================================================================

function cacheEvent(text, eventDetails) {
  chrome.storage.local.get(CONFIG.CACHE_KEY, (data) => {
    const cache = data[CONFIG.CACHE_KEY] || {};
    const key = text.trim().toLowerCase().substring(0, 50);
    
    cache[key] = { eventDetails, timestamp: Date.now() };
    
    // Prune old entries
    const keys = Object.keys(cache);
    if (keys.length > CONFIG.CACHE_MAX_ITEMS) {
      keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp)
        .slice(0, keys.length - CONFIG.CACHE_MAX_ITEMS)
        .forEach(k => delete cache[k]);
    }
    
    chrome.storage.local.set({ [CONFIG.CACHE_KEY]: cache });
  });
}

function getCachedEvent(text) {
  return new Promise((resolve) => {
    chrome.storage.local.get(CONFIG.CACHE_KEY, (data) => {
      const cache = data[CONFIG.CACHE_KEY] || {};
      const key = text.trim().toLowerCase().substring(0, 50);
      const item = cache[key];
      
      if (item && Date.now() - item.timestamp < CONFIG.CACHE_EXPIRY) {
        resolve(item.eventDetails);
      } else {
        if (item) {
          delete cache[key];
          chrome.storage.local.set({ [CONFIG.CACHE_KEY]: cache });
        }
        resolve(null);
      }
    });
  });
}
