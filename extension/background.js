// Global variables
let pendingEvent = null;
let selectedText = '';
let currentTabId = null;
let eventCache = {}; // Cache for event extraction results

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

// Initialize extension
function initializeExtension() {
  console.log('Initializing extension...');
  
  // Create context menu
  createContextMenu();
  
  // Start keep-alive mechanism
  keepAlive();
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
      // Clear any previous pending event to prevent showing old data
      chrome.storage.local.remove('pendingEvent', () => {
        console.log('Cleared previous pendingEvent from storage');
      });

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
      
      // Check cache first
      const cachedEvent = await checkCache(selectedText);
      if (cachedEvent) {
        console.log('Using cached event data:', cachedEvent);
        await processEventDetails(cachedEvent, tab.id);
        return;
      }
      
      // Try local extraction first as a fallback
      console.log('Attempting basic local event extraction');
      const localEvent = basicLocalEventExtraction(selectedText, currentTime);
      
      try {
        // Attempt to fetch from backend with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('https://ai-calendar-app.onrender.com/process_event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: selectedText,
            current_time: currentTime
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId); // Clear the timeout if the request completes
        
        console.log('Backend response status:', response.status);
        
        // Check if response is OK before parsing JSON
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const eventDetails = await response.json();
        console.log('Backend response:', eventDetails);
        
        // Ensure the event data has the expected format
        const normalizedEvent = {
          title: eventDetails.title || `Event from text: ${selectedText.substring(0, 30)}...`,
          date: eventDetails.date || new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          startTime: eventDetails.startTime || '12:00 PM',
          endTime: eventDetails.endTime || '1:00 PM',
          location: eventDetails.location || '',
          description: eventDetails.description || selectedText,
          attendees: eventDetails.attendees || []
        };
        
        console.log('Normalized event data:', normalizedEvent);
        
        // Cache the result from the backend
        cacheEvent(selectedText, normalizedEvent);
        
        // Validate time formats before proceeding
        validateTimeFormat(normalizedEvent.startTime);
        validateTimeFormat(normalizedEvent.endTime);
        
        await processEventDetails(normalizedEvent, tab.id);
      } catch (error) {
        console.error('Backend fetch error:', error);
        
        // Check if this is an abort error (timeout)
        const errorMessage = error.name === 'AbortError' 
          ? 'Backend request timed out. Using basic extraction instead. Some details may be missing.' 
          : 'Backend service unavailable. Using basic extraction instead. Some details may be missing.';
        
        console.log(errorMessage);
        
        // If we have a local extraction result, use it as fallback
        if (localEvent && localEvent.title) {
          console.log('Using local event extraction as fallback:', localEvent);
          
          // Normalize the local event data to ensure consistent format
          const normalizedLocalEvent = {
            title: localEvent.title || `Event from text: ${selectedText.substring(0, 30)}...`,
            date: localEvent.date || new Date().toISOString().split('T')[0],
            startTime: localEvent.startTime || '12:00 PM',
            endTime: localEvent.endTime || '1:00 PM',
            location: localEvent.location || '',
            description: localEvent.description || selectedText,
            attendees: localEvent.attendees || []
          };
          
          console.log('Normalized local event data:', normalizedLocalEvent);
          
          // Show a warning that we're using local extraction
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateModal',
            state: 'warning',
            message: error.name === 'AbortError' 
              ? 'Backend request timed out. Using basic extraction instead. Some details may be missing.' 
              : 'Backend service unavailable. Using basic extraction instead. Some details may be missing.',
            eventDetails: normalizedLocalEvent
          });
          
          // Cache the local result
          cacheEvent(selectedText, normalizedLocalEvent);
          
          await processEventDetails(normalizedLocalEvent, tab.id);
        } else {
          // Show error in modal
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateModal',
            state: 'error',
            error: `Unable to process event: ${error.message}. Please try again later.`
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending error message:', chrome.runtime.lastError);
            }
          });
        }
      }
    });
  } catch (error) {
    console.error('Error in processSelectedText:', error);
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Calendar Extension Error',
      message: `Error processing text: ${error.message}`
    });
  }
}

// Process event details and update UI
async function processEventDetails(eventDetails, tabId) {
  try {
    console.log('Processing event details:', eventDetails);
    
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

// Basic local event extraction
function basicLocalEventExtraction(text, currentTime) {
  console.log('Attempting basic local event extraction');
  
  // Cache for performance
  if (eventCache[text]) {
    console.log('Using cached event data');
    return eventCache[text];
  }
  
  // Initialize event object
  const event = {
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    description: text,
    attendees: []
  };
  
  // Extract date patterns - prioritize YYYY-MM-DD format
  const datePatterns = [
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{2})/, // MM/DD/YY
    /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
    /(\d{1,2})-(\d{1,2})-(\d{2})/, // DD-MM-YY
    /tomorrow/i, // Tomorrow
    /today/i, // Today
    /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, // Next day of week
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i // Day of week
  ];
  
  // Try to extract date
  let dateFound = false;
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.toString().includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        event.date = tomorrow.toISOString().split('T')[0];
        dateFound = true;
        break;
      } else if (pattern.toString().includes('today')) {
        const today = new Date();
        event.date = today.toISOString().split('T')[0];
        dateFound = true;
        break;
      } else if (pattern.toString().includes('next')) {
        const dayOfWeek = match[1].toLowerCase();
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = new Date();
        const todayDayIndex = today.getDay();
        const targetDayIndex = daysOfWeek.indexOf(dayOfWeek);
        let daysToAdd = targetDayIndex - todayDayIndex;
        if (daysToAdd <= 0) daysToAdd += 7;
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + daysToAdd);
        event.date = targetDate.toISOString().split('T')[0];
        dateFound = true;
        break;
      } else if (pattern.toString().includes('monday|tuesday')) {
        const dayOfWeek = match[0].toLowerCase();
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = new Date();
        const todayDayIndex = today.getDay();
        const targetDayIndex = daysOfWeek.indexOf(dayOfWeek);
        let daysToAdd = targetDayIndex - todayDayIndex;
        if (daysToAdd <= 0) daysToAdd += 7;
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + daysToAdd);
        event.date = targetDate.toISOString().split('T')[0];
        dateFound = true;
        break;
      } else {
        // Handle numeric date formats
        try {
          let year, month, day;
          if (pattern.toString().includes('YYYY-MM-DD')) {
            [, year, month, day] = match;
          } else if (pattern.toString().includes('MM/DD/YYYY') || pattern.toString().includes('MM/DD/YY')) {
            [, month, day, year] = match;
            if (year.length === 2) year = '20' + year;
          } else if (pattern.toString().includes('DD-MM-YYYY') || pattern.toString().includes('DD-MM-YY')) {
            [, day, month, year] = match;
            if (year.length === 2) year = '20' + year;
          }
          
          // Ensure proper formatting
          month = month.padStart(2, '0');
          day = day.padStart(2, '0');
          
          event.date = `${year}-${month}-${day}`;
          dateFound = true;
          break;
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      }
    }
  }
  
  // If no date found, use tomorrow as default
  if (!dateFound) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    event.date = tomorrow.toISOString().split('T')[0];
  }
  
  // Extract time patterns - look for common time formats
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i, // 3:30 pm
    /(\d{1,2})\s*(am|pm)/i, // 3 pm
    /(\d{1,2}):(\d{2})/i, // 15:30 (24-hour)
    /at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i, // at 3:30 pm or at 3 pm
    /from\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i // from 3:30 pm or from 3 pm
  ];
  
  // Try to extract start time
  let startTimeFound = false;
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        let hours = parseInt(match[1]);
        let minutes = match[2] ? parseInt(match[2]) : 0;
        let period = match[3] ? match[3].toLowerCase() : null;
        
        // Handle 24-hour format
        if (!period && hours >= 0 && hours <= 23) {
          period = hours >= 12 ? 'pm' : 'am';
          if (hours > 12) hours -= 12;
          if (hours === 0) hours = 12;
        }
        
        // Handle 12-hour format
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        // Format the time
        const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formattedPeriod = hours >= 12 ? 'PM' : 'AM';
        
        event.startTime = `${formattedHours}:${formattedMinutes} ${formattedPeriod}`;
        startTimeFound = true;
        
        // Set end time to 1 hour after start time
        const endHours = (hours + 1) % 24;
        const endFormattedHours = endHours % 12 === 0 ? 12 : endHours % 12;
        const endFormattedPeriod = endHours >= 12 ? 'PM' : 'AM';
        
        event.endTime = `${endFormattedHours}:${formattedMinutes} ${endFormattedPeriod}`;
        break;
      } catch (e) {
        console.error('Error parsing time:', e);
      }
    }
  }
  
  // If no start time found, use current hour + 1 as default
  if (!startTimeFound) {
    const now = new Date();
    const hours = now.getHours();
    const nextHour = (hours + 1) % 24;
    
    const startFormattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const startFormattedPeriod = hours >= 12 ? 'PM' : 'AM';
    event.startTime = `${startFormattedHours}:00 ${startFormattedPeriod}`;
    
    const endFormattedHours = nextHour % 12 === 0 ? 12 : nextHour % 12;
    const endFormattedPeriod = nextHour >= 12 ? 'PM' : 'AM';
    event.endTime = `${endFormattedHours}:00 ${endFormattedPeriod}`;
  }
  
  // Extract location - look for common location indicators
  const locationPatterns = [
    /at\s+([^,.]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|plaza|square|sq|highway|hwy|parkway|pkwy))/i,
    /at\s+([^,.]+(?:cafe|restaurant|coffee|hotel|building|office|center|centre|mall|park|library|school|university|college|hospital|clinic|theater|theatre|cinema|stadium|arena|hall))/i,
    /location:?\s+([^,.]+)/i,
    /place:?\s+([^,.]+)/i,
    /venue:?\s+([^,.]+)/i,
    /address:?\s+([^,.]+)/i
  ];
  
  // Try to extract location
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      event.location = match[1].trim();
      break;
    }
  }
  
  // Extract title - use first line or first sentence
  const titlePatterns = [
    /^([^.!?\n]+)/, // First sentence
    /subject:?\s+([^.!?\n]+)/i, // Subject: ...
    /title:?\s+([^.!?\n]+)/i, // Title: ...
    /re:?\s+([^.!?\n]+)/i, // Re: ...
    /about:?\s+([^.!?\n]+)/i // About: ...
  ];
  
  // Try to extract title
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      event.title = match[1].trim();
      break;
    }
  }
  
  // If no title found, create one based on date and time
  if (!event.title) {
    event.title = `Event on ${event.date} at ${event.startTime}`;
  }
  
  // Extract attendees - look for email addresses or "with" phrases
  const attendeePatterns = [
    /with\s+([^,.]+)/i, // with John, Mary
    /(?:[\w\.-]+@[\w\.-]+\.\w+)/g, // email addresses
    /attendees:?\s+([^.!?\n]+)/i, // Attendees: John, Mary
    /participants:?\s+([^.!?\n]+)/i, // Participants: John, Mary
    /guests:?\s+([^.!?\n]+)/i // Guests: John, Mary
  ];
  
  // Try to extract attendees
  for (const pattern of attendeePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      if (pattern.toString().includes('with') || pattern.toString().includes('attendees') || 
          pattern.toString().includes('participants') || pattern.toString().includes('guests')) {
        // Handle "with John, Mary" format
        const attendeeText = matches[1];
        const attendeeList = attendeeText.split(/,|and/).map(name => name.trim()).filter(name => name);
        event.attendees = [...event.attendees, ...attendeeList];
      } else {
        // Handle email addresses
        event.attendees = [...event.attendees, ...matches];
      }
      break;
    }
  }
  
  // Cache the result for future use
  eventCache[text] = event;
  
  return event;
}

// Helper function to extract participants from conversation
function extractParticipants(text) {
  const participants = new Set();
  
  // Look for name patterns in conversation format
  const nameRegex = /\b([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?\s*:/g;
  const nameMatches = [...text.matchAll(nameRegex)];
  
  nameMatches.forEach(match => {
    const name = match[1].trim();
    if (name !== 'You' && name !== 'I') {
      participants.add(name);
    }
  });
  
  // Look for mentions of looping in or including someone
  const loopMatches = [
    ...text.matchAll(/\b(?:loop in|include|invite|adding)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi),
    ...text.matchAll(/\bI'll\s+(?:also\s+)?(?:add|invite)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi)
  ];
  
  loopMatches.forEach(match => {
    const name = match[1].trim();
    if (name !== 'you' && name !== 'myself') {
      participants.add(name);
    }
  });
  
  return Array.from(participants);
}

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
  
  if (request.action === 'createEvent') {
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
  } else if (request.action === 'showLoadingModal') {
    // Handle showLoadingModal message
    console.log('Received showLoadingModal request');
    return false; // Synchronous response
  } else if (request.action === 'showConfirmModal') {
    // Handle showConfirmModal message
    console.log('Received showConfirmModal request');
    return false; // Synchronous response
  } else if (request.action === 'closeModal') {
    // Handle closeModal message
    console.log('Received closeModal request');
    return false; // Synchronous response
  } else if (request.action === 'checkAuthStatus') {
    // Check if we have a valid auth token
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.log('User is not authenticated with Google Calendar');
        sendResponse({ isAuthenticated: false });
      } else {
        console.log('User is authenticated with Google Calendar');
        sendResponse({ isAuthenticated: true });
      }
    });
    
    return true; // Indicates async response
  } else if (request.action === 'authenticate') {
    // Explicitly trigger the authentication flow
    console.log('Initiating Google Calendar authentication flow');
    
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error('Authentication failed:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Authentication failed' });
      } else {
        console.log('Authentication successful, token received');
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
    // Get OAuth token
    console.log('Getting OAuth token...');
    
    // Use a more robust approach to get the token
    const getToken = () => {
      return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            console.error('OAuth error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!token) {
            reject(new Error('Failed to get authentication token'));
          } else {
            resolve(token);
          }
        });
      });
    };
    
    const token = await getToken();
    console.log('Got OAuth token:', token ? 'Token received' : 'No token received');
    
    // Validate required fields
    if (!eventDetails.title || !eventDetails.date || !eventDetails.startTime) {
      throw new Error('Missing required fields: title, date, and startTime are required');
    }

    // Parse times
    const { startDateTime, endDateTime } = parseEventTimes(eventDetails);
    
    // Get timezone
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Create event object
    const event = {
      summary: eventDetails.title,
      description: eventDetails.description || '',
      location: eventDetails.location || '',
      start: {
        dateTime: startDateTime,
        timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone
      }
    };

    if (eventDetails.attendees && eventDetails.attendees.length > 0) {
      event.attendees = eventDetails.attendees.map(email => ({ email }));
    }

    console.log('Formatted event:', event);

    // Create event
    console.log('Sending request to Google Calendar API...');
    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(event)
      });

      console.log('Google Calendar API response status:', response.status);
      
      // Handle non-JSON responses
      let responseData;
      try {
        responseData = await response.json();
        console.log('Google Calendar API response:', responseData);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        if (!response.ok) {
          throw new Error(`Failed to create calendar event: HTTP ${response.status}`);
        }
        // If we can't parse JSON but the response is OK, we'll assume success
        return { success: true };
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, clear it and try again
          console.log('Token expired, clearing cache');
          await new Promise(resolve => {
            chrome.identity.clearAllCachedAuthTokens(resolve);
          });
          throw new Error('Authentication token expired. Please try again.');
        }
        throw new Error(`Failed to create calendar event: ${responseData.error?.message || 'Unknown error'}`);
      }

      return { success: true, eventId: responseData.id };
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error creating calendar event:', error);
    
    // Handle token issues
    if (error.message.includes('token') || error.message.includes('auth')) {
      console.log('Authentication error detected, clearing token cache');
      
      // Clear the token cache
      await new Promise(resolve => {
        chrome.identity.clearAllCachedAuthTokens(resolve);
      });
      
      return { 
        success: false, 
        error: 'Authentication failed. Please try again and allow access to your calendar.' 
      };
    }
    
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
    
    return {
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
          delete cache[key];
          chrome.storage.local.set({ [EVENT_CACHE_KEY]: cache });
        }
      }
      
      resolve(null);
    });
  });
}

// Check cache for event extraction result
function checkCache(text) {
  return getCachedEvent(text);
}
