// Check notification permissions when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed...');
  
  // Create context menu item
  chrome.contextMenus.create({
    id: "addToCalendar",
    title: "Add to Calendar",
    contexts: ["selection"],
  });
});

// Check if user is authenticated
async function checkAuth() {
  try {
    // First try to get token without interaction
    let token = await chrome.identity.getAuthToken({ 
      interactive: false,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    
    if (!token) {
      console.log('No cached token, trying interactive auth...');
      // If no token, try interactive auth
      await chrome.identity.removeCachedAuthToken({ token });
      token = await chrome.identity.getAuthToken({ 
        interactive: true,
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
    }
    
    return token;
  } catch (error) {
    console.error('Authentication error details:', {
      message: error.message,
      stack: error.stack,
      error
    });
    return null;
  }
}

// Create calendar event using Google Calendar API
async function createCalendarEvent(eventDetails) {
  try {
    const authResult = await checkAuth();
    if (!authResult) {
      throw new Error('Not authenticated - no token received');
    }

    const event = {
      summary: eventDetails.title,
      location: eventDetails.location,
      start: {
        dateTime: `${eventDetails.date}T${eventDetails.startTime}:00`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: `${eventDetails.date}T${eventDetails.endTime}:00`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      attendees: eventDetails.attendees || []
    };

    console.info('Sending request to Google Calendar API...');
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authResult.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Calendar API error:', errorText);
      throw new Error(`Failed to create event: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
}

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addToCalendar") {
    try {
      // Update badge to show processing
      chrome.action.setBadgeText({ text: "..." });
      chrome.action.setBadgeBackgroundColor({ color: "#F4B400" });

      // Process the event using our backend
      const response = await fetch('https://ai-calendar-app.onrender.com/process_event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: info.selectionText })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error:', errorText);
        throw new Error(`Failed to process event: ${errorText}`);
      }

      const eventDetails = await response.json();
      
      // Store event details for confirmation popup
      chrome.storage.local.set({ 'pendingEvent': eventDetails });

      // Open confirmation popup
      chrome.windows.create({
        url: 'confirm.html',
        type: 'popup',
        width: 450,
        height: 600
      });

      // Clear badge
      chrome.action.setBadgeText({ text: "" });

    } catch (error) {
      console.error('Error:', error);
      
      // Show error badge
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#EA4335" });

      // Store error for popup
      chrome.storage.local.set({
        'lastEvent': {
          status: 'error',
          message: error.message
        }
      });
    }
  }
});

// Listen for messages from confirmation popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createEvent') {
    createCalendarEvent(request.eventDetails)
      .then(() => {
        // Show success badge
        chrome.action.setBadgeText({ text: "✓" });
        chrome.action.setBadgeBackgroundColor({ color: "#1e8e3e" });
        
        // Store event details for popup
        chrome.storage.local.set({
          'lastEvent': {
            status: 'success',
            title: request.eventDetails.title,
            date: request.eventDetails.date,
            time: request.eventDetails.startTime,
            location: request.eventDetails.location || ''
          }
        });

        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Error creating event:', error);
        
        // Show error badge
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#EA4335" });

        // Store error for popup
        chrome.storage.local.set({
          'lastEvent': {
            status: 'error',
            message: error.message
          }
        });

        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});
