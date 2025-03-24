document.addEventListener('DOMContentLoaded', function() {
  const formScreen = document.getElementById('formScreen');
  const successScreen = document.getElementById('successScreen');
  const closeButton = document.getElementById('closeButton');
  const cancelButton = document.getElementById('cancelButton');
  const addToCalendarButton = document.getElementById('addToCalendar');

  // Form elements
  const titleInput = document.getElementById('title');
  const dateInput = document.getElementById('date');
  const startTimeInput = document.getElementById('startTime');
  const endTimeInput = document.getElementById('endTime');
  const locationInput = document.getElementById('location');
  const guestsInput = document.getElementById('guests');
  const descriptionInput = document.getElementById('description');

  // Update end time when start time changes
  startTimeInput.addEventListener('change', function() {
    const startTime = startTimeInput.value;
    if (startTime) {
      // Parse the time and add one hour
      const [time, period] = startTime.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let endHour = hours;
      
      if (period === 'PM' && hours !== 12) {
        endHour += 12;
      } else if (period === 'AM' && hours === 12) {
        endHour = 0;
      }
      
      // Add one hour
      endHour = (endHour + 1) % 24;
      
      // Convert back to 12-hour format
      let endPeriod = 'AM';
      if (endHour >= 12) {
        endPeriod = 'PM';
        if (endHour > 12) {
          endHour -= 12;
        }
      }
      if (endHour === 0) {
        endHour = 12;
      }
      
      endTimeInput.value = `${endHour}:${String(minutes).padStart(2, '0')} ${endPeriod}`;
    }
  });

  // Collapsible fields
  const collapsibleFields = document.querySelectorAll('.collapsible-field');
  collapsibleFields.forEach(field => {
    field.addEventListener('click', function() {
      const content = this.nextElementSibling;
      content.classList.add('expanded');
      this.style.display = 'none';
    });
  });

  // Load initial event details
  chrome.storage.local.get('pendingEvent', function(data) {
    if (data.pendingEvent) {
      const event = data.pendingEvent;
      console.log('Loading event details from storage:', event);
      
      // Set title
      titleInput.value = event.title || '';
      
      // Set date - store the original YYYY-MM-DD format
      const originalDate = event.date;
      dateInput.setAttribute('data-original-date', originalDate);
      dateInput.value = formatDate(originalDate);
      
      // Handle time conversion and setting
      if (event.startTime) {
        // Ensure the time is properly formatted before conversion
        let startTime = event.startTime;
        if (startTime.includes('NaN')) {
          // Fix NaN minutes by setting to 00
          const match = startTime.match(/^(\d+):NaN\s*(AM|PM)$/i);
          if (match) {
            const [_, hours, period] = match;
            startTime = `${hours}:00 ${period.toUpperCase()}`;
            console.log('Fixed NaN in start time:', startTime);
          }
        }
        startTimeInput.value = convertTo12Hour(startTime);
        console.log('Set start time input to:', startTimeInput.value);
      }
      
      // Set end time (1 hour after start time if not provided)
      if (event.endTime) {
        // Ensure the time is properly formatted before conversion
        let endTime = event.endTime;
        if (endTime.includes('NaN')) {
          // Fix NaN minutes by setting to 00
          const match = endTime.match(/^(\d+):NaN\s*(AM|PM)$/i);
          if (match) {
            const [_, hours, period] = match;
            endTime = `${hours}:00 ${period.toUpperCase()}`;
            console.log('Fixed NaN in end time:', endTime);
          }
        }
        endTimeInput.value = convertTo12Hour(endTime);
        console.log('Set end time input to:', endTimeInput.value);
      } else if (event.startTime) {
        // Calculate end time as start time + 1 hour
        const [hours, minutes] = event.startTime.split(':').map(Number);
        const endHour = (hours + 1) % 24;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`;
        endTimeInput.value = convertTo12Hour(endTime);
        console.log('Set calculated end time to:', endTimeInput.value);
        // Update the event object with the new end time
        event.endTime = endTime;
      }

      // Handle optional fields
      if (event.location) {
        expandField('locationField');
        locationInput.value = event.location;
      }
      
      if (event.attendees && event.attendees.length > 0) {
        expandField('guestsField');
        guestsInput.value = event.attendees.join(', ');
      }
      
      if (event.description) {
        expandField('descriptionField');
        descriptionInput.value = event.description;
      }
    }
  });

  // Close handlers
  closeButton.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);

  function closeModal() {
    window.parent.postMessage({ action: 'closeModal' }, '*');
  }

  // Date picker
  dateInput.addEventListener('click', function(e) {
    e.preventDefault();
    showDatePicker(e.target);
  });

  // Time pickers
  startTimeInput.addEventListener('click', function(e) {
    e.preventDefault();
    showTimePicker(e.target, true);  // true indicates this is a start time picker
  });

  endTimeInput.addEventListener('click', function(e) {
    e.preventDefault();
    showTimePicker(e.target, false);  // false indicates this is an end time picker
  });

  // Add to calendar
  addToCalendarButton.addEventListener('click', function() {
    // Validate required fields
    if (!titleInput.value.trim()) {
      alert('Please enter a title for the event');
      return;
    }
    if (!dateInput.value) {
      alert('Please select a date for the event');
      return;
    }
    if (!startTimeInput.value) {
      alert('Please select a start time for the event');
      return;
    }
    if (!endTimeInput.value) {
      alert('Please select an end time for the event');
      return;
    }

    // Show loading state
    addToCalendarButton.disabled = true;
    addToCalendarButton.textContent = 'Creating event...';

    // Use the original date format that was stored
    const originalDate = dateInput.getAttribute('data-original-date');
    
    // Debug logs for time values
    console.log('Raw time values:', {
      startTime: startTimeInput.value,
      endTime: endTimeInput.value
    });
    
    // Ensure time values are properly formatted (HH:MM AM/PM)
    let formattedStartTime = startTimeInput.value.trim();
    let formattedEndTime = endTimeInput.value.trim();
    
    // Fix any potential NaN issues in the time values
    if (formattedStartTime.includes('NaN')) {
      const match = formattedStartTime.match(/^(\d+):NaN\s*(AM|PM)$/i);
      if (match) {
        const [_, hours, period] = match;
        formattedStartTime = `${hours}:00 ${period.toUpperCase()}`;
        console.log('Fixed NaN in start time:', formattedStartTime);
      }
    }
    
    if (formattedEndTime.includes('NaN')) {
      const match = formattedEndTime.match(/^(\d+):NaN\s*(AM|PM)$/i);
      if (match) {
        const [_, hours, period] = match;
        formattedEndTime = `${hours}:00 ${period.toUpperCase()}`;
        console.log('Fixed NaN in end time:', formattedEndTime);
      }
    }
    
    // Ensure times are in the correct format with two-digit minutes
    // This regex extracts hours, minutes, and period from time strings like "1:30 PM" or "10 AM"
    const startMatch = formattedStartTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (startMatch) {
      const [_, hours, minutes = '00', period] = startMatch;
      formattedStartTime = `${hours}:${minutes.padStart(2, '0')} ${period.toUpperCase()}`;
    }
    
    const endMatch = formattedEndTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (endMatch) {
      const [_, hours, minutes = '00', period] = endMatch;
      formattedEndTime = `${hours}:${minutes.padStart(2, '0')} ${period.toUpperCase()}`;
    }
    
    console.log('Formatted times for event creation:', {
      formattedStartTime,
      formattedEndTime
    });

    const eventDetails = {
      title: titleInput.value.trim(),
      date: originalDate,  // Use the original YYYY-MM-DD format
      startTime: formattedStartTime,
      endTime: formattedEndTime,
      location: locationInput.value.trim(),
      attendees: guestsInput.value.split(',').map(email => email.trim()).filter(Boolean),
      description: descriptionInput.value.trim()
    };

    console.log('Sending event details:', eventDetails);
    chrome.runtime.sendMessage({
      action: 'createEvent',
      eventDetails: eventDetails
    }, function(response) {
      console.log('Received response:', response);
      addToCalendarButton.disabled = false;
      addToCalendarButton.textContent = 'Add to Calendar';

      if (response.success) {
        showSuccessScreen(eventDetails);
      } else {
        // Show error to user
        const errorMessage = response.error || 'Failed to create event. Please try again.';
        alert(errorMessage);
        console.error('Failed to create event:', errorMessage);
      }
    });
  });

  function showSuccessScreen(eventDetails) {
    // Update confirmation screen
    document.getElementById('confirmTitle').textContent = eventDetails.title;
    document.getElementById('confirmDateTime').textContent = `${formatDate(eventDetails.date)}, ${startTimeInput.value} - ${endTimeInput.value}`;
    
    // Handle optional fields
    updateOptionalField('confirmLocationContainer', 'confirmLocation', eventDetails.location);
    updateOptionalField('confirmAttendeesContainer', 'confirmAttendees', 
      eventDetails.attendees.length > 0 ? eventDetails.attendees.join(', ') : null);
    updateOptionalField('confirmDescriptionContainer', 'confirmDescription', eventDetails.description);

    // Show success screen
    formScreen.classList.add('hidden');
    successScreen.classList.add('active');
    
    // Auto-close after 2 seconds
    setTimeout(closeModal, 2000);
  }

  // Helper functions
  function expandField(fieldId) {
    const field = document.getElementById(fieldId);
    const trigger = field.querySelector('.collapsible-field');
    const content = field.querySelector('.collapsible-content');
    trigger.style.display = 'none';
    content.classList.add('expanded');
  }

  function updateOptionalField(containerId, valueId, value) {
    const container = document.getElementById(containerId);
    const valueElement = document.getElementById(valueId);
    if (value) {
      valueElement.textContent = value;
      container.classList.remove('empty');
    } else {
      container.classList.add('empty');
    }
  }

  function convertTo24Hour(time12) {
    if (!time12) {
      return '';
    }
    
    console.log('Converting to 24h:', time12);  // Debug log
    
    // Check if the time is already in 24-hour format (no AM/PM)
    if (!time12.includes('AM') && !time12.includes('PM')) {
      console.log('Time already in 24h format:', time12);
      return time12;
    }
    
    // Parse the time components
    const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      console.error('Invalid time format:', time12);
      return time12; // Return original if parsing failed
    }
    
    let [_, hoursStr, minutesStr, period] = match;
    
    // Convert to numbers
    let hours = parseInt(hoursStr, 10);
    let minutes = parseInt(minutesStr, 10);
    period = period.toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    // Ensure hours and minutes are valid numbers
    if (isNaN(hours) || isNaN(minutes)) {
      console.error('Invalid time components:', { hours, minutes });
      return time12; // Return original if parsing failed
    }
    
    // Format with leading zeros
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    
    const result = `${formattedHours}:${formattedMinutes}`;
    console.log('Conversion result:', result);  // Debug log
    return result;
  }

  function convertTo12Hour(time24) {
    if (!time24) {
      return '';
    }
    
    console.log('Converting to 12h:', time24);  // Debug log
    
    // If already in 12-hour format, return as is
    if (time24.includes('AM') || time24.includes('PM')) {
      console.log('Time already in 12h format:', time24);
      return time24;
    }
    
    // Parse the time components
    const parts = time24.split(':');
    if (parts.length !== 2) {
      console.error('Invalid time format for 24h conversion:', time24);
      return time24; // Return original if parsing failed
    }
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    // Validate parsed values
    if (isNaN(hours) || isNaN(minutes)) {
      console.error('Invalid time components for 24h conversion:', { hours, minutes });
      return time24; // Return original if parsing failed
    }
    
    let period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    
    const result = `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
    console.log('Conversion result:', result);  // Debug log
    return result;
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function showTimePicker(inputElement, isStartTime) {
    // Remove any existing picker
    removePickers();

    const picker = document.createElement('div');
    picker.className = 'time-picker';

    const timeList = document.createElement('div');
    timeList.className = 'time-list';

    // Generate time options
    const times = generateTimeOptions();
    times.forEach(time => {
      const option = document.createElement('div');
      option.className = 'time-option';
      option.textContent = time;
      if (time === inputElement.value) {
        option.classList.add('selected');
      }
      option.addEventListener('click', () => {
        inputElement.value = time;
        // If this is the start time picker, update the end time
        if (isStartTime) {
          // Trigger the change event to update end time
          const event = new Event('change');
          inputElement.dispatchEvent(event);
        }
        removePickers();
      });
      timeList.appendChild(option);
    });

    picker.appendChild(timeList);

    // Position picker below input
    const rect = inputElement.getBoundingClientRect();
    picker.style.top = `${rect.bottom + window.scrollY}px`;
    picker.style.left = `${rect.left + window.scrollX}px`;

    // Add overlay
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.addEventListener('click', removePickers);

    document.body.appendChild(overlay);
    document.body.appendChild(picker);
  }

  function generateTimeOptions() {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date();
        time.setHours(hour, minute, 0);
        times.push(time.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).toUpperCase());
      }
    }
    return times;
  }

  function removePickers() {
    const pickers = document.querySelectorAll('.date-picker, .time-picker, .picker-overlay');
    pickers.forEach(picker => picker.remove());
  }
});
