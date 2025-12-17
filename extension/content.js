// Create the modal
function createModal(state = 'loading') {
  // Prevent duplicate modals
  if (document.getElementById('ai-calendar-modal')) {
    updateModal(state);
    return;
  }

  console.log('Creating modal with initial state:', state);

  // Create modal container
  const modal = document.createElement('div');
  modal.id = 'ai-calendar-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  `;

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.id = 'ai-calendar-modal-content';
  modalContent.style.cssText = `
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: 448px;
    max-width: 90%;
    max-height: 90vh;
    overflow: hidden;
  `;

  // Create iframe for the form
  const iframe = document.createElement('iframe');
  iframe.id = 'ai-calendar-iframe';
  iframe.src = chrome.runtime.getURL('confirm.html');
  iframe.style.cssText = `
    border: none;
    width: 100%;
    height: 480px;
  `;

  // Create loading spinner
  const loadingSpinner = document.createElement('div');
  loadingSpinner.id = 'ai-calendar-loading';
  loadingSpinner.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
  `;

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  spinner.style.cssText = `
    border: 4px solid rgba(0, 0, 0, 0.1);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border-left-color: #4285F4;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  `;

  const loadingText = document.createElement('div');
  loadingText.textContent = 'Analyzing text...';
  loadingText.style.cssText = `
    color: #5f6368;
    font-size: 16px;
    font-weight: 500;
  `;

  // Create error message container
  const errorContainer = document.createElement('div');
  errorContainer.id = 'ai-calendar-error';
  errorContainer.style.cssText = `
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
  `;

  const errorIcon = document.createElement('div');
  errorIcon.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" fill="#EA4335"/>
    </svg>
  `;
  errorIcon.style.cssText = `
    margin-bottom: 16px;
  `;

  const errorTitle = document.createElement('div');
  errorTitle.id = 'ai-calendar-error-title';
  errorTitle.textContent = 'Something went wrong';
  errorTitle.style.cssText = `
    color: #202124;
    font-size: 18px;
    font-weight: 500;
    margin-bottom: 8px;
  `;

  const errorHint = document.createElement('div');
  errorHint.id = 'ai-calendar-error-hint';
  errorHint.textContent = 'An unexpected error occurred. Please try again.';
  errorHint.style.cssText = `
    color: #5f6368;
    font-size: 14px;
    margin-bottom: 20px;
    max-width: 300px;
    line-height: 1.4;
  `;

  const errorButtonContainer = document.createElement('div');
  errorButtonContainer.id = 'ai-calendar-error-buttons';
  errorButtonContainer.style.cssText = `
    display: flex;
    gap: 12px;
    margin-top: 8px;
  `;

  const errorButton = document.createElement('button');
  errorButton.textContent = 'Close';
  errorButton.style.cssText = `
    background-color: #5f6368;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
    font-weight: 500;
  `;
  errorButton.onclick = closeModal;

  const manualEntryButton = document.createElement('button');
  manualEntryButton.id = 'ai-calendar-manual-entry-btn';
  manualEntryButton.textContent = 'Enter Manually';
  manualEntryButton.style.cssText = `
    background-color: #4285F4;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
    font-weight: 500;
    display: none;
  `;

  errorButtonContainer.appendChild(errorButton);
  errorButtonContainer.appendChild(manualEntryButton);

  // Add animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  // Assemble the modal
  loadingSpinner.appendChild(spinner);
  loadingSpinner.appendChild(loadingText);

  errorContainer.appendChild(errorIcon);
  errorContainer.appendChild(errorTitle);
  errorContainer.appendChild(errorHint);
  errorContainer.appendChild(errorButtonContainer);

  modalContent.appendChild(loadingSpinner);
  modalContent.appendChild(errorContainer);
  modalContent.appendChild(iframe);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  document.head.appendChild(style);

  // Set initial state
  updateModal(state);

  // Close when clicking outside the modal content
  modal.addEventListener('click', function(event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  // Close when pressing Escape
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closeModal();
    }
  });

  return modal;
}

// Error messages mapping (matches backend error codes)
const ERROR_MESSAGES = {
  'BACKEND_TIMEOUT': {
    title: 'Taking too long',
    hint: 'The server is slow to respond. Please try again in a moment.',
    recoverable: true
  },
  'BACKEND_UNREACHABLE': {
    title: "Couldn't connect",
    hint: 'Unable to reach the server. Check your internet connection and try again.',
    recoverable: true
  },
  'BACKEND_ERROR': {
    title: 'Something went wrong',
    hint: 'Our server encountered an error. Please try again.',
    recoverable: true
  },
  'RATE_LIMITED': {
    title: 'Too many requests',
    hint: "You've made too many requests. Please wait a minute and try again.",
    recoverable: true
  },
  'NO_EVENT_FOUND': {
    title: 'No event detected',
    hint: "We couldn't find any event details in the selected text. Try selecting text with a date and time.",
    recoverable: false
  },
  'PAST_DATE': {
    title: 'Date needs attention',
    hint: 'The extracted date appears to be in the past. Please select the correct date manually.',
    recoverable: false
  },
  'MISSING_TIME': {
    title: 'Time not found',
    hint: "We couldn't find a time in the text. Please enter the start and end time manually.",
    recoverable: false
  },
  'EXTRACTION_INCOMPLETE': {
    title: 'Extraction incomplete',
    hint: "Some details couldn't be extracted properly. Please review and complete the form.",
    recoverable: false
  },
  'TEXT_TOO_SHORT': {
    title: 'Not enough text',
    hint: 'Please select more text that includes event details like date, time, and description.',
    recoverable: false
  },
  'TEXT_TOO_LONG': {
    title: 'Too much text',
    hint: 'Please select a shorter portion of text containing just the event details.',
    recoverable: false
  },
  'NOT_SIGNED_IN': {
    title: 'Sign in required',
    hint: 'Please sign in to your Google account to add events to your calendar.',
    recoverable: true
  },
  'AUTH_EXPIRED': {
    title: 'Session expired',
    hint: 'Your session has expired. Please sign in again.',
    recoverable: true
  },
  'PERMISSION_DENIED': {
    title: 'Calendar access needed',
    hint: 'Please grant calendar permissions to add events. Click the extension icon to authorize.',
    recoverable: true
  },
  'CALENDAR_API_ERROR': {
    title: "Couldn't save event",
    hint: 'There was a problem saving to Google Calendar. Please try again.',
    recoverable: true
  },
  'UNKNOWN_ERROR': {
    title: 'Something went wrong',
    hint: 'An unexpected error occurred. Please try again.',
    recoverable: true
  }
};

// Get error message by code
function getErrorMessage(errorCode) {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['UNKNOWN_ERROR'];
}

// Update the modal state
function updateModal(state, data = {}) {
  console.log('Updating modal state to:', state, data);
  
  const modal = document.getElementById('ai-calendar-modal');
  if (!modal) {
    console.error('Modal not found, creating it');
    createModal(state);
    return;
  }

  const loadingSpinner = document.getElementById('ai-calendar-loading');
  const errorContainer = document.getElementById('ai-calendar-error');
  const iframe = document.getElementById('ai-calendar-iframe');
  const errorTitle = document.getElementById('ai-calendar-error-title');
  const errorHint = document.getElementById('ai-calendar-error-hint');

  // Reset all elements
  loadingSpinner.style.display = 'none';
  errorContainer.style.display = 'none';
  iframe.style.display = 'none';

  // Update based on state
  switch (state) {
    case 'loading':
      loadingSpinner.style.display = 'flex';
      break;
    case 'error':
      errorContainer.style.display = 'flex';
      
      // Get error message from code or use provided error
      const errorCode = data.errorCode || data.error_code;
      const errorInfo = errorCode ? getErrorMessage(errorCode) : null;
      
      if (errorInfo) {
        errorTitle.textContent = errorInfo.title;
        errorHint.textContent = errorInfo.hint;
      } else if (data.error) {
        // Fallback to generic error with provided message
        errorTitle.textContent = 'Something went wrong';
        errorHint.textContent = data.error;
      }
      
      // Show manual entry button if allowed
      const manualEntryBtn = document.getElementById('ai-calendar-manual-entry-btn');
      if (manualEntryBtn) {
        if (data.allowManualEntry) {
          manualEntryBtn.style.display = 'block';
          manualEntryBtn.onclick = () => {
            // Hide error, show iframe with blank form for manual entry
            errorContainer.style.display = 'none';
            iframe.style.display = 'block';
            
            // Send message to iframe to show blank form for manual entry
            if (iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                action: 'showManualEntryForm',
                selectedText: data.selectedText || ''
              }, '*');
            }
          };
        } else {
          manualEntryBtn.style.display = 'none';
        }
      }
      break;
    case 'ready':
      iframe.style.display = 'block';
      
      // Send event details to the iframe if available
      if (iframe.contentWindow && data.eventDetails) {
        console.log('Sending event details to iframe:', data.eventDetails);
        iframe.contentWindow.postMessage({
          action: 'fillForm',
          eventDetails: data.eventDetails
        }, '*');
      } else {
        console.log('No event details to send to iframe or iframe not ready');
      }
      break;
    default:
      console.error('Unknown modal state:', state);
      break;
  }
}

// Close the modal
function closeModal() {
  const modal = document.getElementById('ai-calendar-modal');
  if (modal) {
    modal.remove();
  }
  
  // Remove event listener for Escape key
  document.removeEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closeModal();
    }
  });
}

// Show the modal
function showModal(state = 'loading') {
  // First, ensure any existing modal is completely removed
  closeModal();
  
  // Then create a fresh modal
  createModal(state);
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);
  
  if (request.action === 'showModal') {
    showModal(request.state);
    sendResponse({ success: true });
  } else if (request.action === 'updateModal') {
    updateModal(request.state, request);
    sendResponse({ success: true });
  } else if (request.action === 'closeModal') {
    closeModal();
    sendResponse({ success: true });
  }
  
  return true; // Keep the message channel open for async response
});

// Listen for messages from the iframe
window.addEventListener('message', function(event) {
  // Only accept messages from our iframe
  if (event.source !== document.getElementById('ai-calendar-iframe')?.contentWindow) {
    return;
  }
  
  console.log('Content script received message from iframe:', event.data.action);
  
  if (event.data.action === 'closeModal') {
    console.log('Closing modal from iframe request');
    closeModal();
  }
});

console.log('AI Calendar content script loaded');
