// Get event details from background script
chrome.storage.local.get(['pendingEvent'], function(result) {
  if (result.pendingEvent) {
    document.getElementById('title').value = result.pendingEvent.title || '';
    document.getElementById('date').value = result.pendingEvent.date || '';
    document.getElementById('start-time').value = result.pendingEvent.startTime || '';
    document.getElementById('end-time').value = result.pendingEvent.endTime || '';
    document.getElementById('location').value = result.pendingEvent.location || '';
  }
});

// Handle form submission
document.getElementById('save').addEventListener('click', async () => {
  const eventDetails = {
    title: document.getElementById('title').value,
    date: document.getElementById('date').value,
    startTime: document.getElementById('start-time').value,
    endTime: document.getElementById('end-time').value,
    location: document.getElementById('location').value,
    attendees: document.getElementById('guests').value
      .split(',')
      .map(email => email.trim())
      .filter(email => email)
      .map(email => ({ email }))
  };

  // Send event details to background script
  chrome.runtime.sendMessage({
    action: 'createEvent',
    eventDetails: eventDetails
  }, (response) => {
    if (response.success) {
      window.close();
    } else {
      // TODO: Show error message
      console.error('Failed to create event:', response.error);
    }
  });
});

// Handle cancel button
document.getElementById('cancel').addEventListener('click', () => {
  window.close();
});
