document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('eventForm');
  const titleInput = document.getElementById('title');
  const dateInput = document.getElementById('date');
  const startTimeInput = document.getElementById('start-time');
  const endTimeInput = document.getElementById('end-time');
  const locationInput = document.getElementById('location');
  const attendeesInput = document.getElementById('guests');
  const cancelButton = document.getElementById('cancel');

  // Get stored event details
  const { pendingEvent } = await chrome.storage.local.get('pendingEvent');
  if (pendingEvent) {
    titleInput.value = pendingEvent.title || '';
    dateInput.value = pendingEvent.date || '';
    startTimeInput.value = pendingEvent.startTime || '';
    endTimeInput.value = pendingEvent.endTime || '';
    locationInput.value = pendingEvent.location || '';
    attendeesInput.value = pendingEvent.attendees?.join(', ') || '';

    // Set min date to today to prevent past dates
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;

    // Show warning if date is in the past
    if (pendingEvent.date && pendingEvent.date < today) {
      dateInput.classList.add('error');
      document.getElementById('past-date-warning').classList.add('visible');
    }
  }

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate form
    let isValid = true;
    
    if (!titleInput.value) {
      document.getElementById('title').classList.add('required');
      isValid = false;
    } else {
      document.getElementById('title').classList.remove('required');
    }

    if (!dateInput.value) {
      document.getElementById('date').classList.add('required');
      isValid = false;
    } else {
      document.getElementById('date').classList.remove('required');
    }

    if (!startTimeInput.value) {
      document.getElementById('start-time').classList.add('required');
      isValid = false;
    } else {
      document.getElementById('start-time').classList.remove('required');
    }

    if (endTimeInput.value && endTimeInput.value <= startTimeInput.value) {
      document.getElementById('end-time').classList.add('required');
      isValid = false;
    } else {
      document.getElementById('end-time').classList.remove('required');
    }

    if (!isValid) return;

    // Prepare event details
    const eventDetails = {
      title: titleInput.value,
      date: dateInput.value,
      startTime: startTimeInput.value,
      endTime: endTimeInput.value || null,
      location: locationInput.value || null,
      attendees: attendeesInput.value
        ? attendeesInput.value.split(',').map(email => email.trim())
        : []
    };

    try {
      // First ensure we have authentication
      const response = await chrome.runtime.sendMessage({
        action: 'createEvent',
        eventDetails
      });

      if (response.success) {
        window.parent.postMessage({ action: 'closeModal' }, '*');
      } else {
        throw new Error(response.error || 'Failed to create event');
      }
    } catch (error) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message visible';
      errorDiv.style.marginBottom = '16px';
      errorDiv.textContent = error.message;
      document.querySelector('.button-row').insertAdjacentElement('beforebegin', errorDiv);
    }
  });

  // Handle input changes to clear errors
  titleInput.addEventListener('input', () => {
    document.getElementById('title').classList.remove('required');
  });

  dateInput.addEventListener('input', () => {
    document.getElementById('date').classList.remove('required');
    document.getElementById('past-date-warning').classList.remove('visible');
  });

  startTimeInput.addEventListener('input', () => {
    document.getElementById('start-time').classList.remove('required');
  });

  endTimeInput.addEventListener('input', () => {
    document.getElementById('end-time').classList.remove('required');
  });

  // Handle cancel button
  cancelButton.addEventListener('click', () => {
    window.parent.postMessage({ action: 'closeModal' }, '*');
  });
});
