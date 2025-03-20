// Create and inject modal HTML
function createModal() {
  const modal = document.createElement('div');
  modal.id = 'ai-calendar-modal';
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <iframe src="${chrome.runtime.getURL('confirm.html')}" frameborder="0"></iframe>
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
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      width: 500px;
      height: 700px;
      max-width: 95vw;
      max-height: 95vh;
      overflow: hidden;
      position: relative;
    }

    #ai-calendar-modal iframe {
      width: 100%;
      height: 100%;
      border: none;
      overflow-y: auto;
    }
  `;
  document.head.appendChild(style);

  // Close modal when clicking outside
  modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  });
}

function closeModal() {
  const modal = document.getElementById('ai-calendar-modal');
  if (modal) {
    modal.remove();
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showModal') {
    createModal();
    sendResponse({ success: true });
  } else if (request.action === 'closeModal') {
    closeModal();
    sendResponse({ success: true });
  }
  return true;
});
