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
    const token = await chrome.identity.getAuthToken({ interactive: true });
    return token;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

// Create calendar event using Google Calendar API
async function createCalendarEvent(eventDetails) {
  try {
    const token = await checkAuth();
    if (!token) {
      throw new Error('Not authenticated');
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
      }
    };

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      throw new Error('Failed to create event');
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
        throw new Error('Failed to process event');
      }

      const eventDetails = await response.json();
      
      // Create event in user's calendar
      const calendarEvent = await createCalendarEvent(eventDetails);

      // Show success badge
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#1e8e3e" });

      // Store event details for popup
      chrome.storage.local.set({
        'lastEvent': {
          status: 'success',
          title: eventDetails.title,
          date: eventDetails.date,
          time: eventDetails.startTime,
          location: eventDetails.location || ''
        }
      });

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
