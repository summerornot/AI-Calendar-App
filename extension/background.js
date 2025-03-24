// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed...');
  // Create context menu item
  chrome.contextMenus.create({
    id: 'addToCalendar',
    title: 'Add to Calendar',
    contexts: ['selection']
  });
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToCalendar') {
    const selectedText = info.selectionText;
    console.log('Selected text:', selectedText);

    try {
      // Inject content script first
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('Content script injected successfully');

      // Get current time in ISO format
      const currentTime = new Date().toISOString();

      // Send text to backend
      try {
        const response = await fetch('http://localhost:8000/process_event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: selectedText,
            currentTime
          })
        });

        console.log('Backend response status:', response.status);
        const eventDetails = await response.json();
        console.log('Backend response:', eventDetails);

        if (!response.ok) {
          throw new Error(eventDetails.detail || 'Failed to process event');
        }

        // Validate time formats before proceeding
        validateTimeFormat(eventDetails.startTime);
        validateTimeFormat(eventDetails.endTime);

        // Store event details
        chrome.storage.local.set({ eventDetails }, () => {
          console.log('Parsed event details:', eventDetails);
          console.log('Stored event details in local storage');
        });

        // Show modal
        chrome.tabs.sendMessage(tab.id, {
          action: 'displayModal',
          eventDetails
        });
        console.log('Modal display message sent');
      } catch (error) {
        console.error('Backend fetch error:', error);
        
        // Show error in modal
        chrome.tabs.sendMessage(tab.id, {
          action: 'displayModal',
          state: 'error',
          error: `Failed to process event: ${error.message}`
        });
      }
    } catch (error) {
      console.error('Script injection error:', error);
      // If content script injection fails, show popup
      chrome.windows.create({
        url: 'confirm.html',
        type: 'popup',
        width: 400,
        height: 600
      });
    }
  }
});

// Validate time format
function validateTimeFormat(timeStr) {
  if (!timeStr) {
    throw new Error('Missing time value');
  }
  
  const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
  if (!timeRegex.test(timeStr)) {
    throw new Error(`Invalid time format: ${timeStr}. Expected format: "HH:MM AM/PM"`);
  }
  
  return true;
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createEvent') {
    console.log('Received createEvent request:', request.eventDetails);
    createCalendarEvent(request.eventDetails)
      .then(response => {
        console.log('Calendar event creation response:', response);
        sendResponse(response);
        
        // Close any open popup windows
        chrome.windows.getAll({ windowTypes: ['popup'] }, (windows) => {
          windows.forEach(window => chrome.windows.remove(window.id));
        });
      })
      .catch(error => {
        console.error('Error creating event:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Create calendar event
async function createCalendarEvent(eventDetails) {
  console.log('Creating calendar event with details:', eventDetails);
  try {
    // Get OAuth token
    console.log('Getting OAuth token...');
    const { token } = await chrome.identity.getAuthToken({ interactive: true });
    console.log('Got OAuth token:', token ? 'Token received' : 'No token received');
    
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

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
    const responseData = await response.json();
    console.log('Google Calendar API response:', responseData);

    if (!response.ok) {
      console.error('Google Calendar API error:', responseData);
      throw new Error(`Failed to create calendar event: ${responseData.error?.message || 'Unknown error'}`);
    }

    return { success: true, eventId: responseData.id };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    if (error.message.includes('Failed to get authentication token')) {
      // Try to clear the token and get a new one
      await chrome.identity.removeCachedAuthToken({ token });
      return { success: false, error: 'Authentication failed. Please try again.' };
    }
    return { success: false, error: error.message };
  }
}

// Parse event times from HH:MM AM/PM format to ISO datetime
function parseEventTimes(eventDetails) {
  try {
    const { date, startTime, endTime } = eventDetails;
    
    // Validate date format (YYYY-MM-DD)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date format: ${date}. Expected format: "YYYY-MM-DD"`);
    }
    
    // Parse start time
    const start = parseTime(startTime);
    if (!start) {
      throw new Error(`Failed to parse start time: ${startTime}`);
    }
    
    // Parse end time or default to start time + 1 hour
    const end = endTime ? parseTime(endTime) : {
      hours: (start.hours === 12 ? 1 : (start.hours + 1) % 12 || 12),
      minutes: start.minutes,
      isPM: start.hours + 1 >= 12 ? start.isPM : !start.isPM
    };
    
    if (!end) {
      throw new Error(`Failed to parse end time: ${endTime}`);
    }
    
    // Create Date objects
    const [year, month, day] = date.split('-').map(Number);
    
    // Validate date components
    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid date: ${date}`);
    }
    
    // Create start date with proper 24-hour conversion
    const startHours = start.isPM && start.hours !== 12 ? start.hours + 12 : (start.isPM || start.hours !== 12 ? start.hours : 0);
    const startDateTime = new Date(year, month - 1, day, startHours, start.minutes);
    
    // Create end date with proper 24-hour conversion
    const endHours = end.isPM && end.hours !== 12 ? end.hours + 12 : (end.isPM || end.hours !== 12 ? end.hours : 0);
    const endDateTime = new Date(year, month - 1, day, endHours, end.minutes);
    
    // If end time is before start time, assume it's the next day
    if (endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }
    
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
    
    // Check for valid format
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}. Expected format: "HH:MM AM/PM"`);
    }
    
    let hours = parseInt(match[1], 10);
    let minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    
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
