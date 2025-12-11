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
    height: 500px;
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
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" fill="#EA4335"/>
    </svg>
  `;
  errorIcon.style.cssText = `
    margin-bottom: 16px;
  `;

  const errorMessage = document.createElement('div');
  errorMessage.id = 'ai-calendar-error-message';
  errorMessage.textContent = 'Failed to process event. Please try again.';
  errorMessage.style.cssText = `
    color: #5f6368;
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 16px;
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
  errorContainer.appendChild(errorMessage);
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
  const errorMessage = document.getElementById('ai-calendar-error-message');

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
      if (data.error) {
        errorMessage.textContent = data.error;
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
            iframe.style.height = '500px';
            
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
      iframe.style.height = '500px';
      
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
