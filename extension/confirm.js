function showError(element, message) {
  element.classList.add('required');
  const errorMessage = element.nextElementSibling;
  if (errorMessage && errorMessage.classList.contains('error-message')) {
    errorMessage.textContent = message;
    errorMessage.classList.add('visible');
  }
}

function hideError(element) {
  element.classList.remove('required');
  const errorMessage = element.nextElementSibling;
  if (errorMessage && errorMessage.classList.contains('error-message')) {
    errorMessage.classList.remove('visible');
  }
}

function validateDateTime(date, startTime, endTime) {
  const now = new Date();
  const eventDate = new Date(date + 'T' + startTime);
  const endDate = new Date(date + 'T' + endTime);
  
  // Check if date is in the past
  if (eventDate < now) {
    document.getElementById('past-date-warning').classList.add('visible');
  } else {
    document.getElementById('past-date-warning').classList.remove('visible');
  }

  // Check if end time is after start time
  if (endDate <= eventDate) {
    showError(document.getElementById('end-time'), 'End time must be after start time');
    return false;
  }

  return true;
}

// Get event details from background script
chrome.storage.local.get(['pendingEvent'], function(result) {
  if (result.pendingEvent) {
    const event = result.pendingEvent;
    
    // Set values
    document.getElementById('title').value = event.title || '';
    document.getElementById('date').value = event.date || '';
    document.getElementById('start-time').value = event.startTime || '';
    document.getElementById('end-time').value = event.endTime || '';
    document.getElementById('location').value = event.location || '';
    
    // Set guests if any were found in the text
    if (event.attendees && event.attendees.length > 0) {
      document.getElementById('guests').value = event.attendees.join(', ');
    }

    // Check if date is in past
    if (event.date && event.startTime) {
      validateDateTime(event.date, event.startTime, event.endTime || '');
    }

    // Mark required fields if empty
    if (!event.date) document.getElementById('date').classList.add('required');
    if (!event.startTime) document.getElementById('start-time').classList.add('required');
    if (!event.endTime) document.getElementById('end-time').classList.add('required');
  }
});

// Handle form submission
document.getElementById('save').addEventListener('click', async () => {
  let isValid = true;
  const requiredFields = ['title', 'date', 'start-time', 'end-time'];
  
  // Check required fields
  requiredFields.forEach(field => {
    const element = document.getElementById(field);
    if (!element.value) {
      showError(element, `${field.replace('-', ' ')} is required`);
      isValid = false;
    } else {
      hideError(element);
    }
  });

  // Validate date and time
  const date = document.getElementById('date').value;
  const startTime = document.getElementById('start-time').value;
  const endTime = document.getElementById('end-time').value;
  
  if (date && startTime && endTime) {
    isValid = validateDateTime(date, startTime, endTime) && isValid;
  }

  if (!isValid) return;

  const eventDetails = {
    title: document.getElementById('title').value,
    date: date,
    startTime: startTime,
    endTime: endTime,
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
      // Close modal via parent window
      window.parent.postMessage({ action: 'closeModal' }, '*');
    } else {
      // Show error in UI
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message visible';
      errorDiv.style.marginBottom = '16px';
      errorDiv.textContent = response.error || 'Failed to create event';
      document.querySelector('.button-row').insertAdjacentElement('beforebegin', errorDiv);
    }
  });
});

// Handle cancel button
document.getElementById('cancel').addEventListener('click', () => {
  window.parent.postMessage({ action: 'closeModal' }, '*');
});
