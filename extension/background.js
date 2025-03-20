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
      console.log('Selected text:', info.selectionText);
      
      // Process the selected text
      const response = await fetch('https://ai-calendar-app.onrender.com/process_event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: info.selectionText })
      });

      console.log('Backend response status:', response.status);
      const responseText = await response.text();
      console.log('Backend response:', responseText);

      if (!response.ok) {
        throw new Error(`Failed to process event details: ${responseText}`);
      }

      const eventDetails = JSON.parse(responseText);
      console.log('Parsed event details:', eventDetails);
      
      // Store event details for the confirmation popup
      await chrome.storage.local.set({ pendingEvent: eventDetails });
      console.log('Stored event details in local storage');

      // Show modal in the current tab
      await chrome.tabs.sendMessage(tab.id, { action: 'showModal' });
      console.log('Sent showModal message to content script');

    } catch (error) {
      console.error('Detailed error:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });

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
        console.error('Calendar event creation error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Create calendar event
async function createCalendarEvent(eventDetails) {
  try {
    console.log('Creating calendar event with details:', eventDetails);

    // Get OAuth token
    const token = await chrome.identity.getAuthToken({ interactive: true });
    if (!token) {
      throw new Error('Failed to get authentication token');
    }
    console.log('Got authentication token');

    // Format date and time
    const startDateTime = `${eventDetails.date}T${eventDetails.startTime}:00`;
    const endDateTime = `${eventDetails.date}T${eventDetails.endTime}:00`;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const eventData = {
      summary: eventDetails.title,
      location: eventDetails.location,
      start: {
        dateTime: startDateTime,
        timeZone: timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone
      },
      attendees: eventDetails.attendees
    };
    console.log('Prepared event data:', eventData);

    // Create event
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData)
    });

    console.log('Calendar API response status:', response.status);
    const responseData = await response.json();
    console.log('Calendar API response:', responseData);

    if (!response.ok) {
      throw new Error(responseData.error?.message || 'Failed to create calendar event');
    }

    return { success: true };
  } catch (error) {
    console.error('Detailed calendar error:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
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
