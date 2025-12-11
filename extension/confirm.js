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

  // Initialize with default values
  setDefaultDateTime();

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

  // Save button handler
  saveButton.addEventListener('click', function() {
    // Validate
    if (!titleInput.value.trim()) {
      alert('Please enter a title for the event');
      titleInput.focus();
      return;
    }

    // Show loading
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

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
        showSuccessScreen();
      } else {
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
        alert('Failed to create event: ' + (response ? response.error : 'Unknown error'));
      }
    });
  });

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
  }

  function showManualEntryForm(selectedText) {
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
          // Auto-update end time to 1 hour later
          const endTime = addOneHour(time);
          endTimeInput.value = endTime;
        } else {
          endTimeInput.value = time;
        }
        updateDateTimeDisplay();
        removePickers();
      };

      picker.appendChild(option);
    });

    // Position
    const rect = targetElement.getBoundingClientRect();
    picker.style.top = `${rect.bottom + 4}px`;
    picker.style.left = `${rect.left}px`;

    // Scroll to selected time
    setTimeout(() => {
      const selected = picker.querySelector('.selected');
      if (selected) {
        selected.scrollIntoView({ block: 'center' });
      }
    }, 0);

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.onclick = removePickers;

    document.body.appendChild(overlay);
    document.body.appendChild(picker);
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
