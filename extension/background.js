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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToCalendar') {
    const selectedText = info.selectionText;
    console.log('Selected text:', selectedText);

    try {
      // Send text to backend for processing
      const response = await fetch('https://ai-calendar-app.onrender.com/process_event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: selectedText })
      });

      console.log('Backend response status:', response.status);
      const data = await response.json();
      console.log('Backend response:', JSON.stringify(data));

      // Store event details
      const eventDetails = {
        title: data.title,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        attendees: data.attendees || []
      };
      console.log('Parsed event details:', eventDetails);
      await chrome.storage.local.set({ pendingEvent: eventDetails });
      console.log('Stored event details in local storage');

      // Inject content script and show modal
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
      } catch (error) {
        if (error.message.includes('Cannot access contents of url')) {
          console.log('Cannot inject content script in this page. Opening in popup instead...');
          // Open as popup if we can't inject the content script
          chrome.windows.create({
            url: 'confirm.html',
            type: 'popup',
            width: 400,
            height: 600
          });
          return;
        }
        throw error;
      }

      // Show the modal
      await chrome.tabs.sendMessage(tab.id, { action: 'showModal' });
      console.log('Modal display message sent');

    } catch (error) {
      console.error('Error:', error);
      // If there's an error, open in popup
      chrome.windows.create({
        url: 'confirm.html',
        type: 'popup',
        width: 400,
        height: 600
      });
    }
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createEvent') {
    createCalendarEvent(request.eventDetails)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
});

// Create calendar event
async function createCalendarEvent(eventDetails) {
  try {
    // Get OAuth token
    const token = await chrome.identity.getAuthToken({ interactive: true });
    
    // Format the event for Google Calendar API
    const event = {
      summary: eventDetails.title,
      location: eventDetails.location,
      start: {
        dateTime: `${eventDetails.date}T${eventDetails.startTime}:00`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: eventDetails.endTime 
          ? `${eventDetails.date}T${eventDetails.endTime}:00`
          : `${eventDetails.date}T${addOneHour(eventDetails.startTime)}:00`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    if (eventDetails.attendees && eventDetails.attendees.length > 0) {
      event.attendees = eventDetails.attendees.map(email => ({ email }));
    }

    // Create event
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      throw new Error('Failed to create calendar event');
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to add one hour to time
function addOneHour(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setHours(date.getHours() + 1);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
