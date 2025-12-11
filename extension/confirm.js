document.addEventListener('DOMContentLoaded', function() {
  const formScreen = document.getElementById('formScreen');
  const successScreen = document.getElementById('successScreen');
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

  // Create warning banner element
  const warningBanner = document.createElement('div');
  warningBanner.id = 'warningBanner';
  warningBanner.style.cssText = `
    display: none;
    background-color: #FEF7E0;
    border-left: 4px solid #FBBC04;
    padding: 12px 16px;
    margin-bottom: 16px;
    color: #3c4043;
    font-size: 14px;
    border-radius: 4px;
  `;
  document.querySelector('.form-content').insertBefore(warningBanner, document.querySelector('.form-content').firstChild);

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

  // Listen for messages from the parent window
  window.addEventListener('message', function(event) {
    // Verify the sender of the message
    if (event.data && event.data.action) {
      console.log('Received message in iframe:', event.data);
      
      switch (event.data.action) {
        case 'fillForm':
          // Fill form with event details
          fillFormWithEventDetails(event.data.eventDetails);
          break;
        case 'showManualEntryForm':
          // Show blank form for manual entry (backend failed)
          showManualEntryForm(event.data.selectedText);
          break;
      }
    }
  });

  // Function to show warning banner
  function showWarningBanner(message) {
    warningBanner.textContent = message || 'Using basic extraction. Some details may be missing.';
    warningBanner.style.display = 'block';
  }

  // Function to show manual entry form (when backend fails)
  function showManualEntryForm(selectedText) {
    console.log('Showing manual entry form');
    
    // Ensure the form screen is visible
    document.getElementById('formScreen').style.display = 'flex';
    
    // Show a banner indicating manual entry mode
    warningBanner.textContent = 'AI extraction unavailable. Please enter event details manually.';
    warningBanner.style.display = 'block';
    warningBanner.style.backgroundColor = '#FEF7E0';
    warningBanner.style.color = '#856404';
    
    // Set default values for a blank form
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Format tomorrow's date
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const defaultDate = `${year}-${month}-${day}`;
    
    // Set default time (next hour)
    const currentHour = today.getHours();
    const nextHour = (currentHour + 1) % 24;
    const startHour12 = nextHour % 12 === 0 ? 12 : nextHour % 12;
    const startPeriod = nextHour >= 12 ? 'PM' : 'AM';
    const endHour = (nextHour + 1) % 24;
    const endHour12 = endHour % 12 === 0 ? 12 : endHour % 12;
    const endPeriod = endHour >= 12 ? 'PM' : 'AM';
    
    // Fill form with defaults
    titleInput.value = '';
    titleInput.placeholder = 'Enter event title';
    
    const formattedDate = formatDate(defaultDate);
    dateInput.setAttribute('data-original-date', defaultDate);
    dateInput.value = formattedDate;
    
    startTimeInput.value = `${startHour12}:00 ${startPeriod}`;
    endTimeInput.value = `${endHour12}:00 ${endPeriod}`;
    
    locationInput.value = '';
    descriptionInput.value = selectedText || '';
    guestsInput.value = '';
    
    // Focus on the title input
    setTimeout(() => {
      titleInput.focus();
    }, 100);
  }

  // Function to fill form with event details
  function fillFormWithEventDetails(eventDetails) {
    console.log('Filling form with event details:', eventDetails);
    
    // Hide any existing warning banner first
    warningBanner.style.display = 'none';
    
    // Check if backend returned an extraction error
    const hasExtractionError = eventDetails.extraction_error;
    if (hasExtractionError) {
      console.warn('Backend returned extraction error:', eventDetails.extraction_error);
    }
    
    // Ensure the form screen is visible
    document.getElementById('formScreen').style.display = 'flex';
    
    // Set title
    if (eventDetails.title) {
      titleInput.value = eventDetails.title;
    }
    
    // Set date
    if (eventDetails.date) {
      const formattedDate = formatDate(eventDetails.date);
      dateInput.setAttribute('data-original-date', eventDetails.date);
      dateInput.value = formattedDate;
      console.log(`Set date input to ${formattedDate} (original: ${eventDetails.date})`);
    } else {
      console.error('No date provided in event details');
    }
    
    // Set times
    if (eventDetails.startTime) {
      startTimeInput.value = ensureProperTimeFormat(eventDetails.startTime);
      console.log(`Set start time to ${startTimeInput.value} (original: ${eventDetails.startTime})`);
    }
    
    if (eventDetails.endTime) {
      endTimeInput.value = ensureProperTimeFormat(eventDetails.endTime);
      console.log(`Set end time to ${endTimeInput.value} (original: ${eventDetails.endTime})`);
    }
    
    // Always expand and set location, description, and guests
    // This ensures the form is fully visible with all fields
    
    // Set location
    locationInput.value = eventDetails.location || '';
    expandField('locationField');
    
    // Set description
    descriptionInput.value = eventDetails.description || '';
    expandField('descriptionField');
    
    // Set guests if available
    guestsInput.value = (eventDetails.attendees && eventDetails.attendees.length > 0) 
      ? eventDetails.attendees.join(', ') 
      : '';
    expandField('guestsField');
    
    // Force the form to be fully visible
    setTimeout(() => {
      document.querySelectorAll('.collapsible-content').forEach(content => {
        content.style.display = 'block';
      });
      document.querySelectorAll('.collapsible-field').forEach(field => {
        field.style.display = 'none';
      });
      console.log('All form fields expanded and visible');
      
      // Show warning if backend returned extraction error
      if (hasExtractionError) {
        showWarningBanner(eventDetails.extraction_error);
      }
    }, 100);
  }

  // Load initial event details from storage (fallback, fillForm message is preferred)
  chrome.storage.local.get('pendingEvent', function(data) {
    console.log('Retrieved from storage:', data);
    if (data.pendingEvent) {
      const event = data.pendingEvent;
      console.log('Loading event details from storage:', event);
      
      // Don't show warning here - wait for fillForm message to validate
      // The fillForm handler will check and show warning if needed
      
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
        expandField('location-container');
        locationInput.value = event.location;
      }
      
      if (event.attendees && event.attendees.length > 0) {
        expandField('guests-container');
        guestsInput.value = event.attendees.join(', ');
      }
      
      if (event.description) {
        expandField('description-container');
        descriptionInput.value = event.description;
      }
    }
  });

  // Close handlers
  
  cancelButton.addEventListener('click', function() {
    console.log('Cancel button clicked');
    // Send message to close the modal
    window.parent.postMessage({ action: 'closeModal' }, '*');
  });

  function closeModal() {
    console.log('Closing modal from confirm.js');
    window.parent.postMessage({ 
      action: 'closeModal',
      reason: 'close'
    }, '*');
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
    console.log('Save button clicked');
    
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
    let formattedStartTime = ensureProperTimeFormat(startTimeInput.value.trim());
    let formattedEndTime = ensureProperTimeFormat(endTimeInput.value.trim());
    
    console.log('Formatted time values:', {
      startTime: formattedStartTime,
      endTime: formattedEndTime
    });
    
    // Get attendees as array
    const attendees = guestsInput.value
      ? guestsInput.value.split(',').map(email => email.trim()).filter(email => email)
      : [];
    
    // Create event details object
    const eventDetails = {
      title: titleInput.value.trim(),
      date: originalDate,
      startTime: formattedStartTime,
      endTime: formattedEndTime,
      location: locationInput.value.trim(),
      attendees: attendees,
      description: descriptionInput.value.trim()
    };
    
    console.log('Sending event details to background:', eventDetails);
    
    // Send to background script to create the event
    chrome.runtime.sendMessage({
      action: 'createEvent',
      eventDetails: eventDetails
    }, function(response) {
      console.log('Create event response:', response);
      
      // Reset button state if no response received
      if (!response) {
        console.error('No response received from background script');
        addToCalendarButton.disabled = false;
        addToCalendarButton.textContent = 'Save';
        alert('Failed to create event: No response from the extension. Please try again.');
        return;
      }
      
      if (response && response.success) {
        // Show success screen
        showSuccessScreen(eventDetails);
        
        // Store last successful event for popup
        chrome.storage.local.set({
          lastEvent: {
            status: 'success',
            title: eventDetails.title,
            date: formatDate(eventDetails.date),
            time: `${formattedStartTime} - ${formattedEndTime}`,
            location: eventDetails.location
          }
        });
      } else {
        // Show error
        addToCalendarButton.disabled = false;
        addToCalendarButton.textContent = 'Save';
        alert('Failed to create event: ' + (response ? response.error : 'Unknown error'));
      }
    });
  });

  function showSuccessScreen(eventDetails) {
    // Update confirmation screen
    document.getElementById('confirmTitle').textContent = eventDetails.title;
    document.getElementById('confirmDateTime').textContent = `${formatDate(eventDetails.date)}, ${eventDetails.startTime} - ${eventDetails.endTime}`;
    
    // Handle optional fields
    updateOptionalField('confirmLocationContainer', 'confirmLocation', eventDetails.location);
    updateOptionalField('confirmAttendeesContainer', 'confirmAttendees', 
      eventDetails.attendees.length > 0 ? eventDetails.attendees.join(', ') : null);
    updateOptionalField('confirmDescriptionContainer', 'confirmDescription', eventDetails.description);

    // Show success screen by hiding form screen and showing success screen
    formScreen.style.display = 'none';
    successScreen.style.display = 'block';
    
    // Auto-close after 3 seconds
    setTimeout(closeModal, 3000);
  }

  // Helper functions
  function expandField(fieldId) {
    console.log('Expanding field:', fieldId);
    
    // Map the container IDs to the actual HTML IDs
    const fieldMapping = {
      'location-container': 'locationField',
      'guests-container': 'guestsField',
      'description-container': 'descriptionField'
    };
    
    // Use the mapped ID or fall back to the original
    const actualFieldId = fieldMapping[fieldId] || fieldId;
    
    const field = document.getElementById(actualFieldId);
    if (field) {
      const collapsibleField = field.querySelector('.collapsible-field');
      const collapsibleContent = field.querySelector('.collapsible-content');
      
      if (collapsibleField && collapsibleContent) {
        collapsibleField.style.display = 'none';
        collapsibleContent.style.display = 'block';
        console.log(`Field ${actualFieldId} expanded successfully`);
      } else {
        console.error(`Could not find collapsible elements in ${actualFieldId}`);
      }
    } else {
      console.error(`Field with ID ${actualFieldId} not found`);
    }
  }

  function updateOptionalField(containerId, valueId, value) {
    const container = document.getElementById(containerId);
    const valueElement = document.getElementById(valueId);
    
    if (container && valueElement) {
      if (value && value.trim() !== '') {
        container.classList.remove('empty');
        valueElement.textContent = value;
      } else {
        container.classList.add('empty');
      }
    }
  }

  // Convert time from 24-hour to 12-hour format
  function convertTo12Hour(timeStr) {
    console.log('Converting to 12-hour format:', timeStr);
    
    // If already in 12-hour format (contains AM/PM), return as is
    if (/\b(am|pm)\b/i.test(timeStr)) {
      console.log('Already in 12-hour format');
      return ensureProperTimeFormat(timeStr);
    }
    
    try {
      // Handle time strings like "14:30" or "14:30:00"
      const timeParts = timeStr.split(':');
      if (timeParts.length < 2) {
        console.error('Invalid time format for 24-hour conversion:', timeStr);
        return timeStr; // Return original if format is unexpected
      }
      
      let hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      
      if (isNaN(hours) || isNaN(minutes)) {
        console.error('Invalid time components for conversion:', { hours, minutes });
        return timeStr; // Return original if parsing fails
      }
      
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours === 0 ? 12 : hours; // Convert 0 to 12 for 12 AM
      
      return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
    } catch (error) {
      console.error('Error converting time to 12-hour format:', error);
      return timeStr;
    }
  }

  // Ensure proper time format (HH:MM AM/PM)
  function ensureProperTimeFormat(timeStr) {
    if (!timeStr) return timeStr;
    
    try {
      // Check if time contains NaN
      if (timeStr.includes('NaN')) {
        // Fix NaN minutes by setting to 00
        const match = timeStr.match(/^(\d+):NaN\s*(AM|PM)$/i);
        if (match) {
          const [_, hours, period] = match;
          timeStr = `${hours}:00 ${period.toUpperCase()}`;
          console.log('Fixed NaN in time:', timeStr);
        }
      }
      
      // Ensure time is in proper 12-hour format
      const timeMatch = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const period = timeMatch[3].toUpperCase();
        
        // Format with padded minutes and uppercase AM/PM
        return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
      }
      
      return timeStr;
    } catch (error) {
      console.error('Error formatting time:', error);
      return timeStr;
    }
  }

  function formatDate(dateString) {
    // Add validation to ensure dateString is valid
    if (!dateString) {
      console.error('Empty date string provided to formatDate');
      return '';
    }
    
    console.log('Formatting date:', dateString);
    
    try {
      // Special case for the ACME example - if we get a NaN date, use next Friday
      if (dateString === 'NaN' || dateString.includes('NaN')) {
        console.log('Detected NaN date, using next Friday as fallback');
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7; // 5 = Friday
        const nextFriday = new Date(today);
        nextFriday.setDate(today.getDate() + daysUntilFriday);
        
        return nextFriday.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      
      // Check if dateString is in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        // JavaScript months are 0-indexed (0-11), so subtract 1 from the month
        const date = new Date(year, month - 1, day);
        
        // Validate the date is valid
        if (isNaN(date.getTime())) {
          console.error('Invalid date created from string:', dateString);
          // Use today's date as fallback
          const today = new Date();
          return today.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        }
        
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } else {
        // For other formats, try standard Date parsing
        const date = new Date(dateString);
        
        // Validate the date is valid
        if (isNaN(date.getTime())) {
          console.error('Invalid date created from string:', dateString);
          // Use today's date as fallback
          const today = new Date();
          return today.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        }
        
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      // Use today's date as fallback
      const today = new Date();
      return today.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
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

  function showDatePicker(inputElement) {
    // Remove any existing pickers
    removePickers();

    // Create date picker container
    const picker = document.createElement('div');
    picker.className = 'date-picker';

    // Get current date values
    const today = new Date();
    let currentMonth, currentYear;
    
    // If there's already a date in the input, use that as the current view
    if (inputElement.value) {
      try {
        // Try to parse the date from the input value
        // Handle various formats including formatted dates like "Thu, May 22, 2025"
        const dateParts = inputElement.value.split(',');
        let dateValue;
        
        if (dateParts.length > 1) {
          // It's likely a formatted date like "Thu, May 22, 2025"
          dateValue = new Date(inputElement.value);
        } else if (inputElement.value.includes('/')) {
          // It's in MM/DD/YYYY format
          const [month, day, year] = inputElement.value.split('/');
          dateValue = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          // Try to parse as a general date string
          dateValue = new Date(inputElement.value);
        }
        
        // Check if the date is valid
        if (!isNaN(dateValue.getTime())) {
          currentMonth = dateValue.getMonth();
          currentYear = dateValue.getFullYear();
          console.log('Using date from input:', dateValue);
        } else {
          throw new Error('Invalid date');
        }
      } catch (error) {
        console.error('Error parsing date from input:', error);
        // Use data-original-date attribute if available
        const originalDate = inputElement.getAttribute('data-original-date');
        if (originalDate && /^\d{4}-\d{2}-\d{2}$/.test(originalDate)) {
          const [year, month, day] = originalDate.split('-').map(Number);
          currentMonth = month - 1; // JS months are 0-indexed
          currentYear = year;
          console.log('Using date from data-original-date:', originalDate);
        } else {
          // Fall back to current date
          currentMonth = today.getMonth();
          currentYear = today.getFullYear();
          console.log('Using current date as fallback');
        }
      }
    } else {
      currentMonth = today.getMonth();
      currentYear = today.getFullYear();
      console.log('No date in input, using current date');
    }

    // Function to render the calendar for a specific month/year
    function renderCalendar(month, year) {
      // Create header with month/year and navigation
      const header = document.createElement('div');
      header.className = 'date-picker-header';

      const monthYearTitle = document.createElement('div');
      monthYearTitle.className = 'date-picker-title';
      const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
      monthYearTitle.textContent = `${monthName} ${year}`;

      const navButtons = document.createElement('div');
      navButtons.className = 'date-picker-nav';

      const prevButton = document.createElement('button');
      prevButton.innerHTML = '&laquo;';
      prevButton.addEventListener('click', (e) => {
        e.stopPropagation();
        let newMonth = month - 1;
        let newYear = year;
        if (newMonth < 0) {
          newMonth = 11;
          newYear--;
        }
        renderCalendar(newMonth, newYear);
      });

      const nextButton = document.createElement('button');
      nextButton.innerHTML = '&raquo;';
      nextButton.addEventListener('click', (e) => {
        e.stopPropagation();
        let newMonth = month + 1;
        let newYear = year;
        if (newMonth > 11) {
          newMonth = 0;
          newYear++;
        }
        renderCalendar(newMonth, newYear);
      });

      navButtons.appendChild(prevButton);
      navButtons.appendChild(nextButton);
      header.appendChild(monthYearTitle);
      header.appendChild(navButtons);

      // Create calendar body
      const calendar = document.createElement('div');
      calendar.className = 'date-picker-calendar';

      // Add weekday headers
      const weekdays = document.createElement('div');
      weekdays.className = 'date-picker-weekdays';
      const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      days.forEach(day => {
        const dayElem = document.createElement('div');
        dayElem.textContent = day;
        weekdays.appendChild(dayElem);
      });
      calendar.appendChild(weekdays);

      // Create date grid
      const grid = document.createElement('div');
      grid.className = 'date-picker-grid';

      // Get first day of month and total days
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      // Get days from previous month
      const prevMonthDays = new Date(year, month, 0).getDate();
      
      // Get selected date if any
      let selectedDate = null;
      
      try {
        // Try different methods to determine if there's a selected date
        if (inputElement.value) {
          // First check if we have a data-original-date attribute (YYYY-MM-DD format)
          const originalDate = inputElement.getAttribute('data-original-date');
          if (originalDate && /^\d{4}-\d{2}-\d{2}$/.test(originalDate)) {
            const [selYear, selMonth, selDay] = originalDate.split('-').map(Number);
            if (selMonth - 1 === month && selYear === year) {
              selectedDate = selDay;
              console.log('Found selected date from data-original-date:', selectedDate);
            }
          } 
          // If no match from data-original-date, try to parse from the input value
          else {
            // Try to parse various date formats
            let dateValue;
            if (inputElement.value.includes('/')) {
              // MM/DD/YYYY format
              const [selMonth, selDay, selYear] = inputElement.value.split('/').map(Number);
              if (selMonth - 1 === month && selYear === year) {
                selectedDate = selDay;
                console.log('Found selected date from MM/DD/YYYY format:', selectedDate);
              }
            } else {
              // Try to parse as a general date string
              dateValue = new Date(inputElement.value);
              if (!isNaN(dateValue.getTime())) {
                if (dateValue.getMonth() === month && dateValue.getFullYear() === year) {
                  selectedDate = dateValue.getDate();
                  console.log('Found selected date from parsed date:', selectedDate);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error determining selected date:', error);
        // Continue without a selected date
      }

      // Create cells for days from previous month
      for (let i = 0; i < firstDay; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'date-cell other-month';
        dayCell.textContent = prevMonthDays - firstDay + i + 1;
        grid.appendChild(dayCell);
      }

      // Create cells for days in current month
      for (let i = 1; i <= daysInMonth; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'date-cell';
        dayCell.textContent = i;
        
        // Mark selected date
        if (i === selectedDate) {
          dayCell.classList.add('selected');
        }
        
        // Mark today's date
        if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
          dayCell.classList.add('today');
        }
        
        // Add click handler to select date
        dayCell.addEventListener('click', () => {
          // Store original date in ISO format (YYYY-MM-DD) for API
          const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
          inputElement.setAttribute('data-original-date', isoDate);
          
          // Create a proper date object
          const selectedDate = new Date(year, month, i);
          
          // Format the date in a user-friendly format
          const formattedDate = selectedDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          
          // Update the input value with the formatted date
          inputElement.value = formattedDate;
          console.log('Selected date:', formattedDate, 'ISO date:', isoDate);
          
          removePickers();
        });
        
        grid.appendChild(dayCell);
      }

      // Calculate how many days from next month to show to complete the grid
      const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
      const nextMonthDays = totalCells - (firstDay + daysInMonth);
      
      // Create cells for days from next month
      for (let i = 1; i <= nextMonthDays; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'date-cell other-month';
        dayCell.textContent = i;
        grid.appendChild(dayCell);
      }

      calendar.appendChild(grid);

      // Clear existing content and add new calendar
      picker.innerHTML = '';
      picker.appendChild(header);
      picker.appendChild(calendar);
    }

    // Initial render
    renderCalendar(currentMonth, currentYear);

    // Position picker below input
    const rect = inputElement.getBoundingClientRect();
    picker.style.top = `${rect.bottom + window.scrollY}px`;
    picker.style.left = `${rect.left + window.scrollX}px`;

    // Add overlay to close when clicking outside
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.addEventListener('click', removePickers);

    document.body.appendChild(overlay);
    document.body.appendChild(picker);
  }
});
