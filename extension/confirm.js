document.addEventListener('DOMContentLoaded', function() {
  const formScreen = document.getElementById('formScreen');
  const successScreen = document.getElementById('successScreen');
  const closeButton = document.getElementById('closeButton');
  const addToCalendarButton = document.getElementById('addToCalendar');
  const backToHomeButton = document.getElementById('backToHome');

  // Get form elements
  const titleInput = document.getElementById('title');
  const dateInput = document.getElementById('date');
  const startTimeInput = document.getElementById('start-time');
  const endTimeInput = document.getElementById('end-time');
  const locationInput = document.getElementById('location');
  const attendeesInput = document.getElementById('guests');
  const cancelButton = document.getElementById('cancel');
  const descriptionInput = document.getElementById('description');

  // Load initial event details
  chrome.storage.local.get('pendingEvent', function(data) {
    if (data.pendingEvent) {
      const event = data.pendingEvent;
      titleInput.value = event.title || '';
      dateInput.value = formatDate(event.date || new Date());
      startTimeInput.value = event.startTime || formatTime(new Date());
      endTimeInput.value = event.endTime || formatTime(new Date(Date.now() + 3600000)); // 1 hour later
      locationInput.value = event.location || '';
      attendeesInput.value = event.attendees ? event.attendees.join(', ') : '';
      descriptionInput.value = event.description || '';
    }
  });

  // Handle date picker click
  dateInput.addEventListener('click', function(e) {
    e.preventDefault();
    showDatePicker(e.target);
  });

  // Handle time picker clicks
  startTimeInput.addEventListener('click', function(e) {
    e.preventDefault();
    showTimePicker(e.target);
  });

  endTimeInput.addEventListener('click', function(e) {
    e.preventDefault();
    showTimePicker(e.target);
  });

  // Handle close button
  closeButton.addEventListener('click', function() {
    window.parent.postMessage({ action: 'closeModal' }, '*');
  });

  // Handle cancel button
  cancelButton.addEventListener('click', function() {
    window.parent.postMessage({ action: 'closeModal' }, '*');
  });

  // Handle add to calendar
  addToCalendarButton.addEventListener('click', function() {
    const eventDetails = {
      title: titleInput.value,
      date: dateInput.value,
      startTime: startTimeInput.value,
      endTime: endTimeInput.value,
      location: locationInput.value,
      attendees: attendeesInput.value.split(',').map(email => email.trim()).filter(Boolean),
      description: descriptionInput.value
    };

    chrome.runtime.sendMessage({
      action: 'createEvent',
      eventDetails: eventDetails
    }, function(response) {
      if (response.success) {
        showSuccessScreen();
      } else {
        console.error('Failed to create event:', response.error);
      }
    });
  });

  // Handle back to home
  backToHomeButton.addEventListener('click', function() {
    window.parent.postMessage({ action: 'closeModal' }, '*');
  });

  function showSuccessScreen() {
    // Get current form values
    const eventDetails = {
      title: titleInput.value,
      date: dateInput.value,
      startTime: startTimeInput.value,
      endTime: endTimeInput.value,
      location: locationInput.value,
      attendees: attendeesInput.value.split(',').map(email => email.trim()).filter(Boolean),
      description: descriptionInput.value
    };

    // Update confirmation screen
    document.getElementById('confirmTitle').textContent = eventDetails.title;
    document.getElementById('confirmDateTime').textContent = `${eventDetails.date}, ${eventDetails.startTime} - ${eventDetails.endTime}`;
    
    // Handle optional fields
    const locationContainer = document.getElementById('confirmLocationContainer');
    const locationText = document.getElementById('confirmLocation');
    if (eventDetails.location) {
      locationText.textContent = eventDetails.location;
      locationContainer.classList.remove('empty');
    } else {
      locationContainer.classList.add('empty');
    }

    const attendeesContainer = document.getElementById('confirmAttendeesContainer');
    const attendeesText = document.getElementById('confirmAttendees');
    if (eventDetails.attendees.length > 0) {
      attendeesText.textContent = eventDetails.attendees.join(', ');
      attendeesContainer.classList.remove('empty');
    } else {
      attendeesContainer.classList.add('empty');
    }

    const descriptionContainer = document.getElementById('confirmDescriptionContainer');
    const descriptionText = document.getElementById('confirmDescription');
    if (eventDetails.description) {
      descriptionText.textContent = eventDetails.description;
      descriptionContainer.classList.remove('empty');
    } else {
      descriptionContainer.classList.add('empty');
    }

    // Show success screen
    formScreen.classList.add('hidden');
    successScreen.classList.add('active');
    
    // Auto-close after 2 seconds
    setTimeout(() => {
      window.parent.postMessage({ action: 'closeModal' }, '*');
    }, 2000);
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

  function formatTime(date) {
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).toUpperCase();
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
});
