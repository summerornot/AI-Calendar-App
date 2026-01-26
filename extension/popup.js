// Debug function to log info to the popup
function debugLog(message) {
  const debugDiv = document.getElementById('debug-info');
  debugDiv.innerHTML += message + '<br>';
  console.log(message);
}

// Check authentication status on popup open
function checkAuthStatus() {
  debugLog('Checking auth status...');
  chrome.runtime.sendMessage({action: 'checkAuthStatus'}, function(response) {
    const authStatusDiv = document.getElementById('auth-status');
    const authButton = document.getElementById('auth-button');
    
    debugLog('Auth status response: ' + JSON.stringify(response));
    
    if (response && response.isAuthenticated) {
      authStatusDiv.textContent = 'Connected to Google Calendar';
      authStatusDiv.style.color = '#1e8e3e';
      authButton.style.display = 'none';
      debugLog('User is authenticated, hiding button');
    } else {
      authStatusDiv.textContent = 'Not connected to Google Calendar';
      authStatusDiv.style.color = '#EA4335';
      authButton.style.display = 'block';
      debugLog('User is not authenticated, showing button');
    }
  });
}

// Initialize authentication
document.getElementById('auth-button').addEventListener('click', function() {
  debugLog('Auth button clicked, sending authenticate message');
  const authStatusDiv = document.getElementById('auth-status');
  authStatusDiv.textContent = 'Connecting...';
  authStatusDiv.style.color = '#5f6368';
  
  chrome.runtime.sendMessage({action: 'authenticate'}, function(response) {
    debugLog('Auth response: ' + JSON.stringify(response));
    if (response && response.success) {
      checkAuthStatus();
    } else {
      const errorMsg = response?.error || 'Unknown error';
      authStatusDiv.textContent = 'Authentication failed: ' + errorMsg;
      authStatusDiv.style.color = '#EA4335';
      debugLog('Authentication failed: ' + errorMsg);
    }
  });
});

// Check for last event status
chrome.storage.local.get(['lastEvent'], function(result) {
  const statusDiv = document.getElementById('status');
  const detailsDiv = document.getElementById('details');
  
  if (result.lastEvent) {
    const event = result.lastEvent;
    if (event.success) {
      statusDiv.textContent = 'Event created successfully!';
      statusDiv.className = 'status success';
      
      // Format event details
      let details = `${event.title}<br>`;
      details += `Date: ${event.date}<br>`;
      if (event.startTime) details += `Time: ${event.startTime}`;
      if (event.endTime) details += ` - ${event.endTime}`;
      
      detailsDiv.innerHTML = details;
    } else {
      statusDiv.textContent = 'Failed to create event';
      statusDiv.className = 'status error';
      detailsDiv.textContent = event.error || 'Unknown error occurred';
    }
  }
});

// Run auth check when popup opens
document.addEventListener('DOMContentLoaded', function() {
  debugLog('Popup opened, DOM loaded');
  checkAuthStatus();
});
