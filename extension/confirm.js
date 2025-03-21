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
      
      // Set title
      titleInput.value = event.title || '';
      
      // Set date
      dateInput.value = formatDate(event.date || new Date());
      
      // Handle time conversion and setting
      if (event.startTime) {
        startTimeInput.value = convertTo12Hour(event.startTime);
      }
      
      // Set end time (1 hour after start time if not provided)
      if (event.endTime) {
        endTimeInput.value = convertTo12Hour(event.endTime);
      } else if (event.startTime) {
        const endTime = addOneHour(event.startTime);
        endTimeInput.value = convertTo12Hour(endTime);
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
    showTimePicker(e.target);
  });

  endTimeInput.addEventListener('click', function(e) {
    e.preventDefault();
    showTimePicker(e.target);
  });

  // Add to calendar
  addToCalendarButton.addEventListener('click', function() {
    const eventDetails = {
      title: titleInput.value,
      date: dateInput.value,
      startTime: convertTo24Hour(startTimeInput.value),
      endTime: convertTo24Hour(endTimeInput.value),
      location: locationInput.value,
      attendees: guestsInput.value.split(',').map(email => email.trim()).filter(Boolean),
      description: descriptionInput.value
    };

    chrome.runtime.sendMessage({
      action: 'createEvent',
      eventDetails: eventDetails
    }, function(response) {
      if (response.success) {
        showSuccessScreen(eventDetails);
      } else {
        console.error('Failed to create event:', response.error);
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

  function convertTo12Hour(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }

  function convertTo24Hour(time12) {
    if (!time12) return '';
    const [time, period] = time12.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  function addOneHour(time24) {
    const [hours, minutes] = time24.split(':');
    let hour = parseInt(hours);
    hour = (hour + 1) % 24;
    return `${String(hour).padStart(2, '0')}:${minutes}`;
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

  function showDatePicker(inputElement) {
    // Remove any existing picker
    removePickers();

    const rect = inputElement.getBoundingClientRect();
    const datePicker = document.createElement('div');
    datePicker.className = 'date-picker';
    datePicker.style.top = `${rect.bottom + 8}px`;
    datePicker.style.left = `${rect.left}px`;

    const date = inputElement.value ? new Date(inputElement.value) : new Date();
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();

    datePicker.innerHTML = `
      <div class="date-picker-header">
        <div class="month-nav">
          <button class="prev-month">←</button>
          <span>${date.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
          <button class="next-month">→</button>
        </div>
      </div>
      <div class="calendar-grid">
        <div class="weekdays">
          ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => `<div>${day}</div>`).join('')}
        </div>
        <div class="days">
          ${generateCalendarDays(date)}
        </div>
      </div>
    `;

    // Add overlay
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    document.body.appendChild(overlay);
    document.body.appendChild(datePicker);

    // Handle day selection
    datePicker.addEventListener('click', function(e) {
      if (e.target.classList.contains('day') && !e.target.classList.contains('empty')) {
        const selectedDate = new Date(currentYear, currentMonth, parseInt(e.target.textContent));
        inputElement.value = formatDate(selectedDate);
        removePickers();
      }
    });

    // Handle month navigation
    datePicker.querySelector('.prev-month').addEventListener('click', function(e) {
      e.stopPropagation();
      date.setMonth(date.getMonth() - 1);
      updateDatePicker(datePicker, date);
    });

    datePicker.querySelector('.next-month').addEventListener('click', function(e) {
      e.stopPropagation();
      date.setMonth(date.getMonth() + 1);
      updateDatePicker(datePicker, date);
    });

    // Close picker when clicking outside
    overlay.addEventListener('click', removePickers);
  }

  function showTimePicker(inputElement) {
    // Remove any existing picker
    removePickers();

    const rect = inputElement.getBoundingClientRect();
    const timePicker = document.createElement('div');
    timePicker.className = 'time-picker';
    timePicker.style.top = `${rect.bottom + 8}px`;
    timePicker.style.left = `${rect.left}px`;

    const timeList = document.createElement('div');
    timeList.className = 'time-list';

    // Generate time options in 30-minute intervals
    const times = generateTimeOptions();
    timeList.innerHTML = times.map(time => `
      <div class="time-option${time === inputElement.value ? ' selected' : ''}">${time}</div>
    `).join('');

    timePicker.appendChild(timeList);

    // Add overlay
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    document.body.appendChild(overlay);
    document.body.appendChild(timePicker);

    // Handle time selection
    timePicker.addEventListener('click', function(e) {
      if (e.target.classList.contains('time-option')) {
        const selectedTime = e.target.textContent;
        inputElement.value = selectedTime;

        // If this is the start time, automatically set end time to 1 hour later
        if (inputElement === startTimeInput) {
          const startDate = parseTime(selectedTime);
          const endDate = new Date(startDate.getTime() + 3600000);
          endTimeInput.value = formatTime(endDate);
        }

        removePickers();
      }
    });

    // Close picker when clicking outside
    overlay.addEventListener('click', removePickers);
  }

  function generateCalendarDays(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const selectedDate = new Date(dateInput.value);
    
    let days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push('<div class="day empty"></div>');
    }
    
    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const isToday = year === today.getFullYear() && month === today.getMonth() && i === today.getDate();
      const isSelected = year === selectedDate.getFullYear() && month === selectedDate.getMonth() && i === selectedDate.getDate();
      days.push(`<div class="day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}">${i}</div>`);
    }
    
    return days.join('');
  }

  function generateTimeOptions() {
    const times = [];
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 48; i++) {
      times.push(formatTime(date));
      date.setMinutes(date.getMinutes() + 30);
    }
    
    return times;
  }

  function updateDatePicker(datePicker, date) {
    const headerSpan = datePicker.querySelector('.month-nav span');
    headerSpan.textContent = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    const daysGrid = datePicker.querySelector('.days');
    daysGrid.innerHTML = generateCalendarDays(date);
  }

  function parseTime(timeString) {
    const [time, period] = timeString.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    const date = new Date();
    date.setHours(hours, parseInt(minutes), 0, 0);
    return date;
  }

  function removePickers() {
    const pickers = document.querySelectorAll('.date-picker, .time-picker, .picker-overlay');
    pickers.forEach(picker => picker.remove());
  }

  function formatTime(date) {
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).toUpperCase();
  }
});
