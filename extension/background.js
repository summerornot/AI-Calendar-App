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

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addToCalendar") {
    try {
      // Update badge to show processing
      chrome.action.setBadgeText({ text: "..." });
      chrome.action.setBadgeBackgroundColor({ color: "#F4B400" });

      console.log('Selected text:', info.selectionText);  // Debug log

      // Process the event
      const response = await fetch('http://localhost:8000/process_event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: info.selectionText })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Process event error:', errorText);  // Debug log
        throw new Error('Failed to process event: ' + errorText);
      }

      const eventData = await response.json();
      console.log('Event data:', eventData);  // Debug log

      // Create the event
      const createResponse = await fetch('http://localhost:8000/create_event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Create event error:', errorText);  // Debug log
        throw new Error('Failed to create event: ' + errorText);
      }

      // Show success badge
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setBadgeBackgroundColor({ color: "#1e8e3e" });

      // Store event details for popup
      chrome.storage.local.set({
        'lastEvent': {
          status: 'success',
          title: eventData.title,
          date: eventData.date,
          time: eventData.startTime,
          location: eventData.location || ''
        }
      });

    } catch (error) {
      console.error('Error:', error);
      
      // Show error badge
      chrome.action.setBadgeText({ text: "" });
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
