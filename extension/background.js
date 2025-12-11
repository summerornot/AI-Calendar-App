// Global variables
let selectedText = '';

// Constants for context menu
const CONTEXT_MENU_ID = 'addToCalendar';
const CONTEXT_MENU_TITLE = 'Add to Calendar';

// Create context menu with better error handling
function createContextMenu() {
  try {
    // First check if the menu already exists to avoid duplicates
    chrome.contextMenus.update(CONTEXT_MENU_ID, {}, () => {
      if (chrome.runtime.lastError) {
        // Menu doesn't exist, create it
        console.log('Context menu does not exist, creating it...');
        chrome.contextMenus.create({
          id: CONTEXT_MENU_ID,
          title: CONTEXT_MENU_TITLE,
          contexts: ['selection']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error creating context menu:', chrome.runtime.lastError);
            // Try again after a short delay
            setTimeout(createContextMenu, 1000);
          } else {
            console.log('Context menu created successfully');
          }
        });
      } else {
        console.log('Context menu already exists');
      }
    });
  } catch (error) {
    console.error('Exception in createContextMenu:', error);
    // Try again after a delay
    setTimeout(createContextMenu, 1000);
  }
}

// Keep the service worker alive
function keepAlive() {
  // Use a longer interval to reduce unnecessary processing
  const keepAliveInterval = 60000; // 60 seconds instead of 20
  
  // Track last context menu check time
  let lastContextMenuCheck = Date.now();
  const contextMenuCheckInterval = 5 * 60000; // Check context menu every 5 minutes
  
  setInterval(() => {
    // Only log every 5 minutes to reduce console spam
    if (Date.now() - lastContextMenuCheck > contextMenuCheckInterval) {
      console.log('Keeping service worker alive and checking context menu');
      
      // Check if context menu exists and recreate if needed
      chrome.contextMenus.update(CONTEXT_MENU_ID, {}, () => {
        if (chrome.runtime.lastError) {
          console.log('Context menu needs recreation');
          createContextMenu();
          lastContextMenuCheck = Date.now();
        } else {
          console.log('Context menu verified');
          lastContextMenuCheck = Date.now();
        }
      });
    }
  }, keepAliveInterval);
  
  console.log('Keep-alive mechanism initialized with interval:', keepAliveInterval, 'ms');
}

// Function to initialize Google Calendar API authorization
function initializeGoogleAuth() {
  console.log('Initializing Google Calendar API authorization');
  
  // Get the extension ID for reference
  const extensionId = chrome.runtime.id;
  console.log('Extension ID:', extensionId);
  
  // Check if already authorized
  chrome.identity.getAuthToken({ interactive: false }, function(token) {
    if (chrome.runtime.lastError || !token) {
      console.log('Not currently authorized with Google Calendar');
    } else {
      console.log('Already authorized with Google Calendar');
      // Store authentication status
      chrome.storage.local.set({ 'isAuthenticated': true });
    }
  });
}

// Initialize extension
function initializeExtension() {
  console.log('Initializing extension...');
  
  // Create context menu
  createContextMenu();
  
  // Start keep-alive mechanism
  keepAlive();
  
  // Initialize Google Calendar authorization
  initializeGoogleAuth();
}

// Start initialization immediately
initializeExtension();

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed...');
  
  // Create context menu on install
  createContextMenu();
  
  // Preload the confirm.html in cache
  fetch(chrome.runtime.getURL('confirm.html'))
    .then(response => {
      console.log('Preloaded confirm.html for faster loading');
    })
    .catch(error => {
      console.error('Failed to preload confirm.html:', error);
    });
    
  // Check authentication status and prompt if needed
  setTimeout(() => {
    console.log('Checking initial authentication status...');
    checkAndPromptForAuth();
  }, 1000);
});

// Function to check auth status and prompt if needed
function checkAndPromptForAuth() {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (chrome.runtime.lastError || !token) {
      console.log('User not authenticated with Google Calendar, showing notification');
      
      // Create a notification prompting the user to authenticate
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Calendar Extension Setup',
        message: 'Please connect to your Google Calendar to use this extension',
        buttons: [
          { title: 'Connect Now' }
        ]
      });
    } else {
      console.log('User already authenticated with Google Calendar');
    }
  });
}

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // "Connect Now" button
    console.log('User clicked Connect Now, initiating auth flow');
    
    // Open the popup to show the auth button
    chrome.action.openPopup();
    
    // Attempt authentication
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error('Authentication failed:', chrome.runtime.lastError);
      } else {
        console.log('Authentication successful');
      }
    });
  }
});

// Listen for browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, recreating context menu...');
  
  // Recreate context menu on browser startup
  createContextMenu();
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    const selectedText = info.selectionText;
    console.log('Selected text:', selectedText);

    try {
      // Inject content script if not already injected
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Script injection error:', chrome.runtime.lastError);
          return;
        }
        console.log('Content script injected successfully');
        
        // Process the selected text
        processSelectedText(selectedText, tab);
      });
    } catch (error) {
      console.error('Error in context menu handler:', error);
    }
  }
});

// Process the selected text
async function processSelectedText(selectedText, tab) {
  try {
    // Store the selected text in case we need to retry
    chrome.storage.local.set({ 'pendingEvent': selectedText });
    
    // Get current time in ISO format
    const currentTime = new Date().toISOString();
    
    // Show loading modal immediately
    chrome.tabs.sendMessage(tab.id, {
      action: 'showModal',
      state: 'loading'
    }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error showing modal:', chrome.runtime.lastError);
        return;
      }
      
      console.log('Loading modal displayed successfully');
      
      // Check cache first for faster response
      const cachedEvent = await getCachedEvent(selectedText);
      if (cachedEvent) {
        console.log('Using cached event data:', cachedEvent);
        await processEventDetails(cachedEvent, tab.id);
        return;
      }
      
      // Always use backend for event extraction - no local fallback
      let eventDetails;
      
      try {
        // Attempt to fetch from backend with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        // Check if text explicitly mentions PM for context
        const isPM = selectedText.toLowerCase().includes('pm') || 
                     selectedText.toLowerCase().includes('p.m.') || 
                     selectedText.toLowerCase().includes('evening') || 
                     selectedText.toLowerCase().includes('afternoon');

        // Get user's timezone from browser
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log('User timezone:', userTimezone);
        
        console.log('Calling backend API for event extraction...');
        const backendResponse = await fetch('https://ai-calendar-app.onrender.com/process_event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: selectedText,
            current_time: currentTime,
            user_timezone: userTimezone,
            context: {
              time_context: isPM ? 'pm' : (selectedText.toLowerCase().includes('am') ? 'am' : 'unknown')
            }
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId); // Clear the timeout if the request completes
        
        console.log('Backend response status:', backendResponse.status);
        
        // Check if response is OK before parsing JSON
        if (!backendResponse.ok) {
          const errorText = await backendResponse.text().catch(() => 'Unknown error');
          throw new Error(`Server returned ${backendResponse.status}: ${backendResponse.statusText}. ${errorText}`);
        }
        
        eventDetails = await backendResponse.json();
        console.log('Backend response:', eventDetails);
        
        // Store the raw text for reference
        eventDetails.rawText = selectedText;
        
        // Normalize the event data from backend response
        const normalizedEvent = {
          title: eventDetails.title || 'Untitled Event',
          date: eventDetails.date || new Date().toISOString().split('T')[0],
          startTime: eventDetails.startTime || eventDetails.start_time || '12:00 PM',
          endTime: eventDetails.endTime || eventDetails.end_time || '1:00 PM',
          location: eventDetails.location || '',
          description: eventDetails.description || '',
          attendees: eventDetails.attendees || [],
          rawText: selectedText
        };
        
        console.log('Normalized event data from backend:', normalizedEvent);
        
        // Cache the result
        cacheEvent(selectedText, normalizedEvent);
        
        // Validate time formats before proceeding
        try {
          validateTimeFormat(normalizedEvent.startTime);
          validateTimeFormat(normalizedEvent.endTime);
        } catch (timeError) {
          console.warn('Time format validation warning:', timeError.message);
          // Don't fail - let the user correct in the form
        }
        
        // Process the event details
        await processEventDetails(normalizedEvent, tab.id);
        
      } catch (backendError) {
        // Backend failed - show explicit error, do NOT fall back to local extraction
        console.error('Backend API error:', backendError);
        
        let errorMessage = 'AI backend is unavailable. Please try again later.';
        
        if (backendError.name === 'AbortError') {
          errorMessage = 'Request timed out. The AI backend is taking too long to respond. Please try again.';
        } else if (backendError.message.includes('Failed to fetch') || backendError.message.includes('NetworkError')) {
          errorMessage = 'Unable to connect to the AI backend. Please check your internet connection and try again.';
        } else if (backendError.message.includes('Server returned')) {
          errorMessage = `AI backend error: ${backendError.message}`;
        }
        
        console.log('Showing error state to user:', errorMessage);
        
        // Update modal to show error state with option for manual entry
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateModal',
          state: 'error',
          error: errorMessage,
          allowManualEntry: true,
          selectedText: selectedText
        });
      }
    });
  } catch (error) {
    console.error('Error processing selected text:', error);
    chrome.tabs.sendMessage(tab.id, {
      action: 'showModal',
      state: 'error',
      error: 'Error processing text. Please try again.'
    });
  }
}

// Process event details and update UI
async function processEventDetails(eventDetails, tabId) {
  try {
    console.log('Processing event details:', eventDetails);
    
    // Log the final event details (no local title/description generation)
    console.log('Final event title:', eventDetails.title);
    console.log('Final event description:', eventDetails.description);
    
    // Store event details
    chrome.storage.local.set({ eventDetails }, () => {
      console.log('Stored event details in local storage');
    });

    // Store event details in pendingEvent for the modal to access
    chrome.storage.local.set({ pendingEvent: eventDetails }, () => {
      console.log('Stored event details as pendingEvent');
    });

    // Update modal to show form
    chrome.tabs.sendMessage(tabId, {
      action: 'updateModal',
      state: 'ready',
      eventDetails: eventDetails  // Send event details directly to content script
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error updating modal:', chrome.runtime.lastError);
      } else {
        console.log('Modal updated successfully');
      }
    });
  } catch (error) {
    console.error('Error processing event details:', error);
    chrome.tabs.sendMessage(tabId, {
      action: 'updateModal',
      state: 'error',
      error: `Error: ${error.message}`
    });
  }
}

// NOTE: Local extraction functions have been removed.
// The extension now relies solely on the backend API for event extraction.
// If the backend fails, an explicit error is shown to the user.

// Validate time format
function validateTimeFormat(timeStr) {
  if (!timeStr) {
    throw new Error('Missing time value');
  }
  
  console.log('Validating time format:', timeStr);
  
  // Check if it's already in 24-hour format (from confirm.js)
  const time24Regex = /^(\d{2}):(\d{2})$/;
  if (time24Regex.test(timeStr)) {
    console.log('Time is in 24-hour format, valid');
    return true;
  }
  
  // Check 12-hour format
  const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
  if (!timeRegex.test(timeStr)) {
    throw new Error(`Invalid time format: ${timeStr}. Expected format: "HH:MM AM/PM"`);
  }
  
  console.log('Time format is valid');
  return true;
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request.action);
  
  // Handle different message types
  if (request.action === 'processSelectedText') {
    // Clear any cached event data to ensure fresh extraction
    console.log('Clearing event cache to ensure fresh extraction');
    chrome.storage.local.remove(EVENT_CACHE_KEY);
    
    // Process the selected text
    selectedText = request.text;
    console.log('Selected text:', selectedText);
    
    // Clear any previous pending event
    chrome.storage.local.remove('pendingEvent', () => {
      console.log('Cleared previous pendingEvent from storage');
    });
    
    // Process the text and show the modal
    processSelectedText(selectedText, sender.tab);
    
    // Send response
    sendResponse({ success: true });
  } else if (request.action === 'createEvent') {
    console.log('Received createEvent request with details:', request.eventDetails);
    
    // Debug the event details thoroughly
    const eventDetails = request.eventDetails;
    console.log('Event details for debugging:');
    console.log('- Title:', eventDetails.title);
    console.log('- Date:', eventDetails.date);
    console.log('- Start Time (raw):', eventDetails.startTime);
    console.log('- End Time (raw):', eventDetails.endTime);
    
    // Fix any potential issues with time format
    if (eventDetails.startTime && eventDetails.startTime.includes('NaN')) {
      console.log('Fixing invalid start time format');
      // Extract hours from the format "10:NaN AM"
      const match = eventDetails.startTime.match(/^(\d+):NaN\s*(AM|PM)$/i);
      if (match) {
        const [_, hours, period] = match;
        eventDetails.startTime = `${hours}:00 ${period}`;
        console.log('Fixed start time:', eventDetails.startTime);
      }
    }
    
    if (eventDetails.endTime && eventDetails.endTime.includes('NaN')) {
      console.log('Fixing invalid end time format');
      // Extract hours from the format "11:NaN AM"
      const match = eventDetails.endTime.match(/^(\d+):NaN\s*(AM|PM)$/i);
      if (match) {
        const [_, hours, period] = match;
        eventDetails.endTime = `${hours}:00 ${period}`;
        console.log('Fixed end time:', eventDetails.endTime);
      }
    }
    
    // Create the calendar event and ensure we properly handle the response
    createCalendarEvent(eventDetails)
      .then(response => {
        console.log('Calendar event creation response:', response);
        
        // Explicitly send the response back to the confirm.js
        sendResponse(response);
      })
      .catch(error => {
        console.error('Error creating event:', error);
        // Ensure we send a response even in case of error
        sendResponse({ success: false, error: error.message || 'Unknown error occurred' });
      });
      
    // CRITICAL: Return true to indicate we will send a response asynchronously
    return true;
  } else if (request.action === 'checkAuthStatus') {
    // Check if we have a valid auth token
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.log('User is not authenticated with Google Calendar');
        sendResponse({ isAuthenticated: false });
      } else {
        console.log('User is authenticated with Google Calendar');
        // Store authentication status for persistence
        chrome.storage.local.set({ 'isAuthenticated': true });
        sendResponse({ isAuthenticated: true });
      }
    });
    
    return true; // Indicates async response
  } else if (request.action === 'authenticate') {
    // Explicitly trigger the authentication flow
    console.log('Initiating Google Calendar authentication flow');
    
    // Use the correct TokenDetails format
    chrome.identity.getAuthToken({ 
      interactive: true,
    }, (token) => {
      // Log detailed information about the authentication attempt
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError;
        console.error('Authentication failed with error:', error);
        console.error('Error details:', JSON.stringify(error));
        sendResponse({ 
          success: false, 
          error: error.message || 'Authentication failed',
          details: JSON.stringify(error)
        });
      } else if (!token) {
        console.error('No token received from authentication');
        sendResponse({ 
          success: false, 
          error: 'No authentication token received' 
        });
      } else {
        console.log('Authentication successful, token received');
        // Store a flag indicating successful authentication
        chrome.storage.local.set({ 'isAuthenticated': true }, () => {
          console.log('Stored authentication status in local storage');
        });
        sendResponse({ success: true });
      }
    });
    
    return true; // Indicates async response
  }
});

// Create calendar event
async function createCalendarEvent(eventDetails) {
  console.log('Creating calendar event with details:', eventDetails);
  try {
    // Get OAuth token with more detailed error logging
    console.log('Getting OAuth token...');
    
    // Use a direct approach to get the token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('OAuth error:', chrome.runtime.lastError);
          console.error('Error details:', JSON.stringify(chrome.runtime.lastError));
          reject(new Error(`Authentication failed: ${chrome.runtime.lastError.message}`));
        } else if (!token) {
          console.error('No token received');
          reject(new Error('Failed to get authentication token'));
        } else {
          console.log('Successfully obtained token');
          // Store authentication status
          chrome.storage.local.set({ 'isAuthenticated': true });
          resolve(token);
        }
      });
    });
    
    // Parse event times into ISO format
    const parsedEvent = parseEventTimes(eventDetails);
    
    // Create the event in Google Calendar
    console.log('Creating event with parsed details:', parsedEvent);
    
    // Prepare the event data
    const event = {
      'summary': parsedEvent.title || 'Untitled Event',
      'location': parsedEvent.location || '',
      'description': parsedEvent.description || '',
      'start': {
        'dateTime': parsedEvent.startDateTime,
        'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      'end': {
        'dateTime': parsedEvent.endDateTime,
        'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
    
    // Add attendees if present
    if (parsedEvent.attendees && parsedEvent.attendees.length > 0) {
      event.attendees = parsedEvent.attendees.map(attendee => {
        // Check if it's already an object with email property
        if (typeof attendee === 'object' && attendee.email) {
          return attendee;
        }
        // Otherwise, assume it's an email string
        return { 'email': attendee };
      });
    }
    
    // Log the final event data being sent to Google Calendar
    console.log('Sending event data to Google Calendar:', JSON.stringify(event, null, 2));
    
    // Make the API request to create the event
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
    
    // Check if the request was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response from Google Calendar API:', errorData);
      throw new Error(`Google Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    // Parse and return the response
    const data = await response.json();
    console.log('Event created successfully:', data);
    return { success: true, eventData: data };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return { success: false, error: error.message };
  }
}

// Parse event times from HH:MM AM/PM format to ISO datetime
function parseEventTimes(eventDetails) {
  try {
    const { date, startTime, endTime } = eventDetails;
    console.log('Parsing event times:', { date, startTime, endTime });
    
    // Validate date format (YYYY-MM-DD)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date format: ${date}. Expected format: "YYYY-MM-DD"`);
    }
    
    // Handle 24-hour format directly (from confirm.js)
    const time24Regex = /^(\d{2}):(\d{2})$/;
    let startHours, startMinutes, endHours, endMinutes;
    
    if (time24Regex.test(startTime)) {
      // Already in 24-hour format
      const [hours, minutes] = startTime.split(':').map(Number);
      startHours = hours;
      startMinutes = minutes;
      console.log('Start time already in 24-hour format:', { startHours, startMinutes });
    } else {
      // Parse 12-hour format
      const start = parseTime(startTime);
      if (!start) {
        throw new Error(`Failed to parse start time: ${startTime}`);
      }
      
      // Convert to 24-hour format
      startHours = start.isPM && start.hours !== 12 ? start.hours + 12 : (start.isPM || start.hours !== 12 ? start.hours : 0);
      startMinutes = start.minutes;
      console.log('Parsed start time to 24-hour format:', { startHours, startMinutes });
    }
    
    // Handle end time similarly
    if (time24Regex.test(endTime)) {
      // Already in 24-hour format
      const [hours, minutes] = endTime.split(':').map(Number);
      endHours = hours;
      endMinutes = minutes;
      console.log('End time already in 24-hour format:', { endHours, endMinutes });
    } else if (endTime) {
      // Parse 12-hour format
      const end = parseTime(endTime);
      if (!end) {
        throw new Error(`Failed to parse end time: ${endTime}`);
      }
      
      // Convert to 24-hour format
      endHours = end.isPM && end.hours !== 12 ? end.hours + 12 : (end.isPM || end.hours !== 12 ? end.hours : 0);
      endMinutes = end.minutes;
      console.log('Parsed end time to 24-hour format:', { endHours, endMinutes });
    } else {
      // Default to start time + 1 hour
      endHours = (startHours + 1) % 24;
      endMinutes = startMinutes;
      console.log('Using default end time (start + 1 hour):', { endHours, endMinutes });
    }
    
    // Create Date objects
    const [year, month, day] = date.split('-').map(Number);
    
    // Validate date components
    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid date: ${date}`);
    }
    
    // Create start and end dates
    const startDateTime = new Date(year, month - 1, day, startHours, startMinutes);
    const endDateTime = new Date(year, month - 1, day, endHours, endMinutes);
    
    // If end time is before start time, assume it's the next day
    if (endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }
    
    console.log('Final datetime objects:', {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString()
    });
    
    // Return all original event details along with the parsed time information
    return {
      ...eventDetails,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString()
    };
  } catch (error) {
    console.error('Error parsing times:', error);
    throw new Error(`Failed to parse event times: ${error.message}`);
  }
}

// Helper function to parse time string in "HH:MM AM/PM" format
function parseTime(timeStr) {
  try {
    // Remove any extra spaces
    timeStr = timeStr.trim();
    console.log('Parsing time string:', timeStr);
    
    // Check for valid format
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}. Expected format: "HH:MM AM/PM"`);
    }
    
    let hours = parseInt(match[1], 10);
    let minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    
    console.log('Parsed time components:', { hours, minutes, period });
    
    // Validate hours and minutes
    if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      throw new Error(`Invalid time: ${hours}:${minutes}`);
    }
    
    return {
      hours,
      minutes,
      isPM: period === 'PM'
    };
  } catch (error) {
    console.error('Time parsing error:', error);
    throw error;
  }
}

// Simple event caching
const EVENT_CACHE_KEY = 'eventCache';
const MAX_CACHE_ITEMS = 20;
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

// Cache an event extraction result
function cacheEvent(text, eventDetails) {
  // Get existing cache
  chrome.storage.local.get(EVENT_CACHE_KEY, (data) => {
    const cache = data[EVENT_CACHE_KEY] || {};
    
    // Generate a simple key from the text
    const key = text.trim().toLowerCase().substring(0, 50);
    
    // Add to cache with timestamp
    cache[key] = {
      eventDetails,
      timestamp: Date.now()
    };
    
    // Prune cache if needed
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ITEMS) {
      // Sort by timestamp (oldest first)
      const oldestKeys = keys
        .sort((a, b) => cache[a].timestamp - cache[b].timestamp)
        .slice(0, keys.length - MAX_CACHE_ITEMS);
      
      // Remove oldest items
      oldestKeys.forEach(k => delete cache[k]);
    }
    
    // Save updated cache
    chrome.storage.local.set({ [EVENT_CACHE_KEY]: cache }, () => {
      console.log('Event cache updated');
    });
  });
}

// Get a cached event extraction result
function getCachedEvent(text) {
  return new Promise((resolve) => {
    chrome.storage.local.get(EVENT_CACHE_KEY, (data) => {
      const cache = data[EVENT_CACHE_KEY] || {};
      const key = text.trim().toLowerCase().substring(0, 50);
      const cachedItem = cache[key];
      
      if (cachedItem) {
        // Check if cache is still valid
        const now = Date.now();
        if (now - cachedItem.timestamp < CACHE_EXPIRY) {
          console.log('Cache hit for event extraction');
          resolve(cachedItem.eventDetails);
          return;
        } else {
          // Cache expired, remove it
          console.log('Cache expired, removing');
          delete cache[key];
          chrome.storage.local.set({ [EVENT_CACHE_KEY]: cache });
        }
      }
      
      resolve(null);
    });
  });
}

// NOTE: All local extraction functions have been removed.
// The extension now relies solely on the backend API for event extraction.

