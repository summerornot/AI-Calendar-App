// Create and inject modal HTML
function createModal(state = 'loading') {
  // Prevent duplicate modals
  if (document.getElementById('ai-calendar-modal')) {
    console.log('Modal already exists, updating state');
    updateModal(state);
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'ai-calendar-modal';
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        ${state === 'loading' ? `
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Processing event details...</p>
          </div>
        ` : `
          <iframe src="${chrome.runtime.getURL('confirm.html')}" frameborder="0"></iframe>
        `}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #ai-calendar-modal .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 999999;
    }

    #ai-calendar-modal .modal-content {
      background: white;
      border-radius: 12px;
      box-shadow: 0 24px 38px 3px rgba(0,0,0,0.14), 
                  0 9px 46px 8px rgba(0,0,0,0.12), 
                  0 11px 15px -7px rgba(0,0,0,0.2);
      width: 500px;
      height: 600px;
      max-width: 95vw;
      max-height: 95vh;
      overflow: hidden;
    }

    #ai-calendar-modal .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #5f6368;
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
    }

    #ai-calendar-modal .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #4285f4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    #ai-calendar-modal iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    #ai-calendar-modal .error-icon {
      font-size: 40px;
      color: #f44336;
      margin-bottom: 16px;
    }

    #ai-calendar-modal .error-message {
      color: #f44336;
      font-size: 16px;
      margin-bottom: 16px;
    }

    #ai-calendar-modal .close-button {
      background-color: #f44336;
      color: white;
      border: none;
      padding: 8px 16px;
      font-size: 16px;
      cursor: pointer;
    }

    #ai-calendar-modal .close-button:hover {
      background-color: #e91e63;
    }

    @media (max-width: 480px) {
      #ai-calendar-modal .modal-content {
        width: 100%;
        height: 100%;
        max-width: 100vw;
        max-height: 100vh;
        border-radius: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Handle iframe messages
  window.addEventListener('message', function(event) {
    if (event.data.action === 'closeModal') {
      closeModal();
    }
  });

  // Close modal when clicking outside
  modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  });

  // Close modal on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

// Close modal
function closeModal() {
  const modal = document.getElementById('ai-calendar-modal');
  if (modal) {
    modal.remove();
  }
}

// Update modal state
function updateModal(state, error) {
  const modal = document.getElementById('ai-calendar-modal');
  if (modal) {
    const content = modal.querySelector('.modal-content');
    
    if (state === 'loading') {
      content.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Processing event details...</p>
        </div>
      `;
    } else if (state === 'error') {
      content.innerHTML = `
        <div class="loading-container">
          <div class="error-icon">❌</div>
          <p class="error-message">${error || 'An error occurred'}</p>
          <button class="close-button">Close</button>
        </div>
      `;
      // Add event listener to close button
      setTimeout(() => {
        const closeButton = content.querySelector('.close-button');
        if (closeButton) {
          closeButton.addEventListener('click', closeModal);
        }
      }, 0);
    } else {
      content.innerHTML = `
        <iframe src="${chrome.runtime.getURL('confirm.html')}" frameborder="0"></iframe>
      `;
    }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showModal') {
    createModal(request.state);
    sendResponse({ success: true });
  } else if (request.action === 'updateModal') {
    updateModal(request.state, request.error);
    sendResponse({ success: true });
  } else if (request.action === 'closeModal') {
    closeModal();
    sendResponse({ success: true });
  }
  return true;
});
