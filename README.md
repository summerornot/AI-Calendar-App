# AI Calendar Assistant

A Chrome extension that uses AI to automatically add events to Google Calendar from selected text.

## Features

- Extract event details from any text using GPT-4
- Automatically detect date, time, and location
- One-click calendar event creation
- Smart timezone handling
- Visual feedback for event creation status

## Installation

### From Chrome Web Store

1. Visit [Chrome Web Store Link]
2. Click "Add to Chrome"
3. Follow the authorization steps for Google Calendar

### For Development

1. Clone this repository
2. Install backend dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
3. Set up environment variables in `backend/.env`:
   ```
   OPENAI_API_KEY=your_openai_key
   GOOGLE_CREDENTIALS=your_google_credentials_json
   ```
4. Run the backend server:
   ```bash
   cd backend
   python main.py
   ```
5. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder

## Usage

1. Select text containing event details (e.g., "Meeting tomorrow at 3pm at Starbucks")
2. Right-click and select "Add to Calendar"
3. Watch the extension icon for status:
   - Yellow "..." while processing
   - Green "✓" when successful
   - Red "!" if there's an error
4. Click the extension icon to see event details

## Development

### Backend (Python/FastAPI)

- `main.py`: FastAPI server with event processing and calendar integration
- `requirements.txt`: Python dependencies

### Frontend (Chrome Extension)

- `manifest.json`: Extension configuration
- `background.js`: Event handling and API calls
- `popup.html`: Extension popup UI

## Deployment

### Backend (Render)

1. Fork this repository
2. Create a new Web Service on Render
3. Connect to your forked repository
4. Set environment variables:
   - `OPENAI_API_KEY`
   - `GOOGLE_CREDENTIALS`
5. Deploy

### Extension

1. Update `background.js` with your deployed backend URL
2. Zip the `extension` folder
3. Submit to Chrome Web Store

## Security

- Uses OAuth 2.0 for Google Calendar authentication
- Environment variables for sensitive keys
- CORS protection for API endpoints
- No storage of user data

## License

MIT License
