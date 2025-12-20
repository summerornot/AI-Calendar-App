document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const formScreen = document.getElementById('formScreen');
  const successScreen = document.getElementById('successScreen');
  const closeButton = document.getElementById('closeButton');
  const saveButton = document.getElementById('addToCalendar');
  const warningBanner = document.getElementById('warningBanner');
  const loadingOverlay = document.getElementById('loadingOverlay');

  // Form elements
  const titleInput = document.getElementById('title');
  const dateInput = document.getElementById('date'); // Hidden input
  const startTimeInput = document.getElementById('startTime'); // Hidden input
  const endTimeInput = document.getElementById('endTime'); // Hidden input
  const locationInput = document.getElementById('location');
  const guestsInput = document.getElementById('guests');
  const descriptionInput = document.getElementById('description');

  // Date/Time display elements
  const datetimeDisplay = document.getElementById('datetimeDisplay');
  const datetimeExpanded = document.getElementById('datetimeExpanded');
  const dateText = document.getElementById('dateText');
  const timeText = document.getElementById('timeText');
  const datePill = document.getElementById('datePill');
  const startTimePill = document.getElementById('startTimePill');
  const endTimePill = document.getElementById('endTimePill');

  // State
  let isDatetimeExpanded = false;
  let extractionAnimationInterval = null;

  // Initialize with default values
  setDefaultDateTime();
  
  // Start extraction animation immediately
  startExtractionAnimation();

  // Close button handler
  closeButton.addEventListener('click', function() {
    window.parent.postMessage({ action: 'closeModal' }, '*');
  });

  // Date/Time toggle between inline and expanded view
  datetimeDisplay.addEventListener('click', function() {
    isDatetimeExpanded = true;
    datetimeDisplay.style.display = 'none';
    datetimeExpanded.classList.add('visible');
  });

  // Date pill click - show date picker
  datePill.addEventListener('click', function(e) {
    e.stopPropagation();
    showDatePicker(datePill);
  });

  // Time pill clicks - show time picker
  startTimePill.addEventListener('click', function(e) {
    e.stopPropagation();
    showTimePicker(startTimePill, true);
  });

  endTimePill.addEventListener('click', function(e) {
    e.stopPropagation();
    showTimePicker(endTimePill, false);
  });

  // Listen for messages from parent window
  window.addEventListener('message', function(event) {
    if (event.data && event.data.action) {
      console.log('Received message in iframe:', event.data);
      
      switch (event.data.action) {
        case 'fillForm':
          fillFormWithEventDetails(event.data.eventDetails);
          break;
        case 'showManualEntryForm':
          showManualEntryForm(event.data.selectedText);
          break;
      }
    }
  });

  // Load from storage as fallback
  chrome.storage.local.get('pendingEvent', function(data) {
    if (data.pendingEvent && typeof data.pendingEvent === 'object') {
      console.log('Loading from storage:', data.pendingEvent);
      fillFormWithEventDetails(data.pendingEvent);
    }
  });

  // Form validation error messages
  const VALIDATION_ERRORS = {
    EMPTY_TITLE: {
      message: 'Please enter a title for your event.',
      field: 'title'
    },
    INVALID_DATE: {
      message: 'Please select a valid date.',
      field: 'date'
    },
    INVALID_TIME: {
      message: 'Please select valid start and end times.',
      field: 'time'
    },
    END_BEFORE_START: {
      message: 'End time must be after start time.',
      field: 'time'
    },
    INVALID_EMAIL: {
      message: 'Please enter valid email addresses for guests.',
      field: 'guests'
    }
  };

  // Validate form and return error code or null if valid
  function validateForm() {
    // Check title
    if (!titleInput.value.trim()) {
      return 'EMPTY_TITLE';
    }

    // Check date
    if (!dateInput.value || !/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) {
      return 'INVALID_DATE';
    }

    // Check times
    const timeRegex = /^(1[0-2]|0?[1-9]):([0-5][0-9])\s*(AM|PM)$/i;
    if (!timeRegex.test(startTimeInput.value) || !timeRegex.test(endTimeInput.value)) {
      return 'INVALID_TIME';
    }

    // Check end time is after start time (on same day)
    const startParts = parseTime(startTimeInput.value);
    const endParts = parseTime(endTimeInput.value);
    if (startParts && endParts) {
      const startMinutes = startParts.hours * 60 + startParts.minutes;
      const endMinutes = endParts.hours * 60 + endParts.minutes;
      if (endMinutes <= startMinutes) {
        return 'END_BEFORE_START';
      }
    }

    // Check email format for guests (if any)
    if (guestsInput.value.trim()) {
      const emails = guestsInput.value.split(',').map(e => e.trim()).filter(e => e);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of emails) {
        if (!emailRegex.test(email)) {
          return 'INVALID_EMAIL';
        }
      }
    }

    return null; // Valid
  }

  // Parse time string to hours/minutes in 24h format
  function parseTime(timeStr) {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return { hours, minutes };
  }

  // Show validation error
  function showValidationError(errorCode) {
    const error = VALIDATION_ERRORS[errorCode];
    if (!error) return;
    
    // Show error in warning banner
    showWarningBanner(error.message);
    
    // Focus the relevant field
    switch (error.field) {
      case 'title':
        titleInput.focus();
        break;
      case 'date':
        datePill.click();
        break;
      case 'time':
        startTimePill.click();
        break;
      case 'guests':
        guestsInput.focus();
        break;
    }
  }

  // Save button handler
  saveButton.addEventListener('click', function() {
    // Validate form
    const validationError = validateForm();
    if (validationError) {
      showValidationError(validationError);
      return;
    }

    // Hide any previous warning
    warningBanner.classList.remove('visible');

    // Show completing animation
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    showCompletingAnimation();

    // Get attendees as array
    const attendees = guestsInput.value
      ? guestsInput.value.split(',').map(email => email.trim()).filter(email => email)
      : [];

    const eventDetails = {
      title: titleInput.value.trim(),
      date: dateInput.value,
      startTime: startTimeInput.value,
      endTime: endTimeInput.value,
      location: locationInput.value.trim(),
      attendees: attendees,
      description: descriptionInput.value.trim()
    };

    console.log('Creating event:', eventDetails);

    chrome.runtime.sendMessage({
      action: 'createEvent',
      eventDetails: eventDetails
    }, function(response) {
      if (response && response.success) {
        // Complete the animation and show success
        completeAnimation();
      } else {
        // Hide animation and show error
        hideCompletingAnimation();
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
        
        // Show user-friendly error message
        const errorMessage = response?.error || 'Failed to save event. Please try again.';
        showWarningBanner(errorMessage);
      }
    });
  });

  // Completing Animation Functions
  function showCompletingAnimation() {
    const extractingContainer = document.getElementById('extractingContainer');
    const completingContainer = document.getElementById('completingContainer');
    const completingChecklist = document.getElementById('completingChecklist');
    const completingSuccess = document.getElementById('completingSuccess');
    
    // Hide extracting, show completing
    extractingContainer.classList.remove('visible');
    completingContainer.classList.add('visible');
    completingSuccess.classList.remove('visible');
    
    // Reset all items
    const items = completingChecklist.querySelectorAll('.completing-item');
    items.forEach(item => item.classList.remove('completed'));
    
    // Show overlay
    loadingOverlay.classList.add('visible');
    
    // Animate items one by one
    animateChecklistItems();
  }
  
  function animateChecklistItems() {
    const items = document.getElementById('completingChecklist').querySelectorAll('.completing-item');
    let delay = 0;
    
    // Animate first 3 items quickly (they're already "done")
    items.forEach((item, index) => {
      if (index < 3) {
        setTimeout(() => {
          item.classList.add('completed');
        }, delay);
        delay += 200; // 200ms between each
      }
    });
    
    // The 4th item (Adding to calendar) will be completed when API responds
  }
  
  function completeAnimation() {
    const completingChecklist = document.getElementById('completingChecklist');
    const items = completingChecklist.querySelectorAll('.completing-item');
    const completingSuccess = document.getElementById('completingSuccess');
    
    // Complete the last item (Adding to calendar)
    const lastItem = items[items.length - 1];
    lastItem.classList.add('completed');
    
    // After a short delay, show success
    setTimeout(() => {
      completingChecklist.style.display = 'none';
      completingSuccess.classList.add('visible');
      
      // Auto-close after showing success
      setTimeout(() => {
        window.parent.postMessage({ action: 'closeModal' }, '*');
      }, 1500);
    }, 500);
  }
  
  function hideCompletingAnimation() {
    const extractingContainer = document.getElementById('extractingContainer');
    const completingContainer = document.getElementById('completingContainer');
    const completingChecklist = document.getElementById('completingChecklist');
    
    loadingOverlay.classList.remove('visible');
    completingContainer.classList.remove('visible');
    extractingContainer.classList.add('visible');
    completingChecklist.style.display = 'flex';
  }

  // Extraction Animation Functions
  function startExtractionAnimation() {
    const extractingChecklist = document.getElementById('extractingChecklist');
    const items = extractingChecklist.querySelectorAll('.completing-item');
    
    // Reset all items
    items.forEach(item => item.classList.remove('completed'));
    
    // Show loading overlay
    loadingOverlay.classList.add('visible');
    
    // Animate items with delays to simulate progress
    // First item: Analyzing text (starts after 300ms)
    setTimeout(() => {
      items[0].classList.add('completed');
    }, 300);
    
    // Second item: Extracting event (starts after 800ms)
    setTimeout(() => {
      items[1].classList.add('completed');
    }, 800);
    
    // Third item will be completed when data arrives (in completeExtractionAnimation)
  }
  
  function completeExtractionAnimation(callback) {
    const extractingChecklist = document.getElementById('extractingChecklist');
    const items = extractingChecklist.querySelectorAll('.completing-item');
    
    // Complete the last item
    items[2].classList.add('completed');
    
    // After a brief moment, hide overlay and show form
    setTimeout(() => {
      loadingOverlay.classList.remove('visible');
      if (callback) callback();
    }, 400);
  }
  
  function hideExtractionAnimation() {
    const extractingContainer = document.getElementById('extractingContainer');
    const extractingChecklist = document.getElementById('extractingChecklist');
    const items = extractingChecklist.querySelectorAll('.completing-item');
    
    // Reset for next time
    items.forEach(item => item.classList.remove('completed'));
    loadingOverlay.classList.remove('visible');
  }

  // Helper Functions

  function setDefaultDateTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const dateStr = formatDateForStorage(tomorrow);
    const startTime = '10:00 AM';
    const endTime = '11:00 AM';

    dateInput.value = dateStr;
    startTimeInput.value = startTime;
    endTimeInput.value = endTime;

    updateDateTimeDisplay();
  }

  function fillFormWithEventDetails(eventDetails) {
    console.log('Filling form:', eventDetails);
    
    // Complete the extraction animation, then fill form
    completeExtractionAnimation(() => {
      // Hide warning banner first
      warningBanner.classList.remove('visible');

      // Check for extraction error
      if (eventDetails.extraction_error) {
        showWarningBanner(eventDetails.extraction_error);
      }

      // Title
      if (eventDetails.title) {
        titleInput.value = eventDetails.title;
      }

      // Date
      if (eventDetails.date) {
        dateInput.value = eventDetails.date;
      }

      // Times
      if (eventDetails.startTime) {
        startTimeInput.value = ensureProperTimeFormat(eventDetails.startTime);
      }
      if (eventDetails.endTime) {
        endTimeInput.value = ensureProperTimeFormat(eventDetails.endTime);
      }

      // Location
      if (eventDetails.location) {
        locationInput.value = eventDetails.location;
      }

      // Guests
      if (eventDetails.attendees && eventDetails.attendees.length > 0) {
        guestsInput.value = eventDetails.attendees.join(', ');
      }

      // Description
      if (eventDetails.description) {
        descriptionInput.value = eventDetails.description;
      }

      updateDateTimeDisplay();
    });
  }

  function showManualEntryForm(selectedText) {
    // Hide extraction animation first
    hideExtractionAnimation();
    showWarningBanner('AI extraction unavailable. Please enter event details manually.');
    
    setDefaultDateTime();
    titleInput.value = '';
    locationInput.value = '';
    guestsInput.value = '';
    descriptionInput.value = selectedText || '';
    
    titleInput.focus();
  }

  function showWarningBanner(message) {
    warningBanner.textContent = message;
    warningBanner.classList.add('visible');
  }

  function updateDateTimeDisplay() {
    const dateStr = dateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;

    // Inline display shows full date with year
    const formattedDateFull = formatDateForDisplay(dateStr, true);
    // Pill shows shorter date without year (like Google Calendar)
    const formattedDateShort = formatDateForDisplay(dateStr, false);
    const formattedTime = `${formatTimeForDisplay(startTime)} - ${formatTimeForDisplay(endTime)}`;

    // Update inline display (with year)
    dateText.textContent = formattedDateFull;
    timeText.textContent = formattedTime;

    // Update pills (without year for shorter text)
    datePill.textContent = formattedDateShort;
    startTimePill.textContent = formatTimeForDisplay(startTime);
    endTimePill.textContent = formatTimeForDisplay(endTime);
  }

  function formatDateForStorage(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateForDisplay(dateStr, includeYear = false) {
    if (!dateStr) return '';
    
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      const options = {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      };
      
      if (includeYear) {
        options.year = 'numeric';
      }
      
      return date.toLocaleDateString('en-US', options);
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateStr;
    }
  }

  function formatTimeForDisplay(timeStr) {
    if (!timeStr) return '';
    
    // Convert to lowercase format like "5:00am"
    const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = match[2];
      const period = match[3].toLowerCase();
      return `${hours}:${minutes}${period}`;
    }
    return timeStr.toLowerCase();
  }

  function ensureProperTimeFormat(timeStr) {
    if (!timeStr) return '12:00 PM';
    
    // Handle NaN
    if (timeStr.includes('NaN')) {
      const match = timeStr.match(/^(\d+):NaN\s*(AM|PM)$/i);
      if (match) {
        return `${match[1]}:00 ${match[2].toUpperCase()}`;
      }
    }
    
    // Ensure proper format
    const timeMatch = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const period = timeMatch[3].toUpperCase();
      return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
    }
    
    return timeStr;
  }

  function showSuccessScreen() {
    formScreen.classList.add('hidden');
    successScreen.classList.add('visible');
    
    // Auto-close after 2 seconds
    setTimeout(function() {
      window.parent.postMessage({ action: 'closeModal' }, '*');
    }, 2000);
  }

  // Date Picker
  function showDatePicker(targetElement) {
    removePickers();

    const currentDate = dateInput.value ? new Date(dateInput.value + 'T00:00:00') : new Date();
    let viewMonth = currentDate.getMonth();
    let viewYear = currentDate.getFullYear();

    const picker = document.createElement('div');
    picker.className = 'date-picker';

    function renderCalendar() {
      picker.innerHTML = '';

      // Header
      const header = document.createElement('div');
      header.className = 'date-picker-header';

      const title = document.createElement('div');
      title.className = 'date-picker-title';
      title.textContent = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const nav = document.createElement('div');
      nav.className = 'date-picker-nav';

      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '<span class="material-icons-outlined" style="font-size:18px">chevron_left</span>';
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        renderCalendar();
      };

      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = '<span class="material-icons-outlined" style="font-size:18px">chevron_right</span>';
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderCalendar();
      };

      nav.appendChild(prevBtn);
      nav.appendChild(nextBtn);
      header.appendChild(title);
      header.appendChild(nav);
      picker.appendChild(header);

      // Calendar
      const calendar = document.createElement('div');
      calendar.className = 'date-picker-calendar';

      // Weekdays
      const weekdays = document.createElement('div');
      weekdays.className = 'date-picker-weekdays';
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
        const span = document.createElement('span');
        span.textContent = d;
        weekdays.appendChild(span);
      });
      calendar.appendChild(weekdays);

      // Grid
      const grid = document.createElement('div');
      grid.className = 'date-picker-grid';

      const firstDay = new Date(viewYear, viewMonth, 1).getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const today = new Date();
      const selectedDate = dateInput.value ? new Date(dateInput.value + 'T00:00:00') : null;

      // Empty cells for days before first day
      for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'date-cell other-month';
        grid.appendChild(cell);
      }

      // Day cells
      for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'date-cell';
        cell.textContent = day;

        const cellDate = new Date(viewYear, viewMonth, day);
        
        if (cellDate.toDateString() === today.toDateString()) {
          cell.classList.add('today');
        }
        
        if (selectedDate && cellDate.toDateString() === selectedDate.toDateString()) {
          cell.classList.add('selected');
        }

        cell.onclick = () => {
          const newDate = formatDateForStorage(new Date(viewYear, viewMonth, day));
          dateInput.value = newDate;
          updateDateTimeDisplay();
          removePickers();
        };

        grid.appendChild(cell);
      }

      calendar.appendChild(grid);
      picker.appendChild(calendar);
    }

    renderCalendar();

    // Position
    const rect = targetElement.getBoundingClientRect();
    picker.style.top = `${rect.bottom + 4}px`;
    picker.style.left = `${rect.left}px`;

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.onclick = removePickers;

    document.body.appendChild(overlay);
    document.body.appendChild(picker);
  }

  // Time Picker
  function showTimePicker(targetElement, isStartTime) {
    removePickers();

    const picker = document.createElement('div');
    picker.className = 'time-picker';

    // Add text input at top
    const inputContainer = document.createElement('div');
    inputContainer.className = 'time-picker-input';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'e.g. 2:25 PM';
    input.value = isStartTime ? formatTimeForDisplay(startTimeInput.value) : formatTimeForDisplay(endTimeInput.value);
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const parsed = parseTimeInput(input.value);
        if (parsed) {
          if (isStartTime) {
            startTimeInput.value = parsed;
            endTimeInput.value = addOneHour(parsed);
          } else {
            endTimeInput.value = parsed;
          }
          updateDateTimeDisplay();
          removePickers();
        }
      }
    });
    
    inputContainer.appendChild(input);
    picker.appendChild(inputContainer);

    // Add time options
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'time-options';
    
    const times = generateTimeOptions();
    const currentValue = isStartTime ? startTimeInput.value : endTimeInput.value;

    times.forEach(time => {
      const option = document.createElement('div');
      option.className = 'time-option';
      option.textContent = formatTimeForDisplay(time);
      
      if (time === currentValue) {
        option.classList.add('selected');
      }

      option.onclick = () => {
        if (isStartTime) {
          startTimeInput.value = time;
          endTimeInput.value = addOneHour(time);
        } else {
          endTimeInput.value = time;
        }
        updateDateTimeDisplay();
        removePickers();
      };

      optionsContainer.appendChild(option);
    });
    
    picker.appendChild(optionsContainer);

    // Position
    const rect = targetElement.getBoundingClientRect();
    picker.style.top = `${rect.bottom + 4}px`;
    picker.style.left = `${rect.left}px`;

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.onclick = removePickers;

    document.body.appendChild(overlay);
    document.body.appendChild(picker);
    
    // Focus input and select text
    setTimeout(() => {
      input.focus();
      input.select();
      
      // Scroll to selected time in options
      const selected = optionsContainer.querySelector('.selected');
      if (selected) {
        selected.scrollIntoView({ block: 'center' });
      }
    }, 0);
  }

  function parseTimeInput(input) {
    const cleaned = input.trim().toUpperCase();
    
    // Match formats: 2:25 PM, 2:25PM, 14:25, 2PM, 2 PM
    let match = cleaned.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i);
    if (!match) return null;
    
    let hours = parseInt(match[1]);
    let minutes = match[2] ? parseInt(match[2]) : 0;
    let period = match[3];
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    
    if (!period) {
      if (hours === 0) {
        hours = 12;
        period = 'AM';
      } else if (hours < 12) {
        period = 'AM';
      } else if (hours === 12) {
        period = 'PM';
      } else {
        period = 'PM';
        hours = hours - 12;
      }
    } else {
      if (hours > 12) hours = hours - 12;
      else if (hours === 0) hours = 12;
    }
    
    return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
  }

  function generateTimeOptions() {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const h = hour % 12 || 12;
        const m = String(minute).padStart(2, '0');
        const period = hour < 12 ? 'AM' : 'PM';
        times.push(`${h}:${m} ${period}`);
      }
    }
    return times;
  }

  function addOneHour(timeStr) {
    const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return timeStr;

    let hours = parseInt(match[1]);
    const minutes = match[2];
    let period = match[3].toUpperCase();

    // Convert to 24-hour
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    // Add one hour
    hours = (hours + 1) % 24;

    // Convert back to 12-hour
    period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${hours}:${minutes} ${period}`;
  }

  function removePickers() {
    document.querySelectorAll('.date-picker, .time-picker, .picker-overlay').forEach(el => el.remove());
  }
});
