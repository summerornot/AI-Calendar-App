// Check notification permissions when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed...');
  
  // Create context menu item
  chrome.contextMenus.create({
    id: 'addToCalendar',
    title: 'Add to Calendar',
    contexts: ['selection']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToCalendar') {
    try {
      // Process the selected text
      const response = await fetch('https://ai-calendar-assistant.onrender.com/process_event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: info.selectionText })
      });

      if (!response.ok) {
        throw new Error('Failed to process event details');
      }

      const eventDetails = await response.json();
      
      // Store event details for the confirmation popup
      await chrome.storage.local.set({ pendingEvent: eventDetails });

      // Show modal in the current tab
      await chrome.tabs.sendMessage(tab.id, { action: 'showModal' });

    } catch (error) {
      console.error('Error:', error);
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Error',
        message: error.message || 'Failed to process event details. Please try again.'
      });
    }
  }
});

// Handle messages from confirmation popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createEvent') {
    createCalendarEvent(request.eventDetails)
      .then(response => {
        if (response.success) {
          // Close the modal
          chrome.tabs.sendMessage(sender.tab.id, { action: 'closeModal' });
        }
        sendResponse(response);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Create calendar event
async function createCalendarEvent(eventDetails) {
  try {
    // Get OAuth token
    const token = await chrome.identity.getAuthToken({ interactive: true });
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    // Format date and time
    const startDateTime = `${eventDetails.date}T${eventDetails.startTime}:00`;
    const endDateTime = `${eventDetails.date}T${eventDetails.endTime}:00`;

    // Create event
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: eventDetails.title,
        location: eventDetails.location,
        start: {
          dateTime: startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        attendees: eventDetails.attendees
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to create calendar event');
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return { success: false, error: error.message };
  }
}

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
async function createCalendarEventUsingGoogleAPI(eventDetails) {
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
        'Authorization': `Bearer ${authResult}`,
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
