# AI Calendar Assistant

A Chrome extension that uses AI to automatically add events to Google Calendar from selected text.

## Features

- Extract event details from any text using GPT-4-Turbo
- Automatically detect date, time, location, and description
- One-click calendar event creation with editable fields
- Smart timezone handling and date recognition
- Immediate visual feedback with loading states
- Caching system for improved performance
- Detailed descriptions extracted from conversation context
- Support for both 12-hour and 24-hour time formats

## Installation

### From Chrome Web Store

1. Visit [Chrome Web Store Link]
2. Click "Add to Chrome"
3. Follow the authorization steps for Google Calendar

### For Development

1. Clone this repository
   ```bash
   git clone https://github.com/summerornot/AI-Calendar-App.git
   cd AI-Calendar-App
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. Set up environment variables in `backend/.env`:
   ```
   OPENAI_API_KEY=your_openai_key
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
3. Review and edit the extracted event details in the modal
4. Click "Save" to add the event to your calendar
5. See confirmation with event details
6. Click the extension icon anytime to see your last added event

## Development

### Backend (Python/FastAPI)

- `main.py`: FastAPI server with event processing and OpenAI integration
- `requirements.txt`: Python dependencies

### Frontend (Chrome Extension)

- `manifest.json`: Extension configuration
- `background.js`: Event handling, caching, and API calls
- `content.js`: Modal UI and user interaction
- `confirm.html` & `confirm.js`: Event details form and validation
- `popup.html`: Extension popup UI showing last event status

## Performance Optimizations

- **Caching System**: Stores previously processed events to reduce API calls
- **Local Event Extraction**: Basic pattern recognition for common formats
- **Preloaded Resources**: Confirm.html is preloaded on extension installation
- **Immediate Feedback**: Modal appears instantly while processing happens in background

## Time Format Handling

The extension supports both 12-hour and 24-hour time formats:
- Automatically detects and preserves the original format
- Handles edge cases with proper validation
- Prevents NaN issues in time strings
- Ensures consistent formatting throughout the application

## Deployment

### Backend (Render)

1. Fork this repository
2. Create a new Web Service on Render
3. Connect to your forked repository
4. Set environment variables:
   - `OPENAI_API_KEY`
5. Deploy

### Extension

1. Update `background.js` with your deployed backend URL
2. Zip the `extension` folder
3. Submit to Chrome Web Store

## Troubleshooting

### Common Issues

- **Event Not Adding**: Check that you've granted calendar permissions
- **Incorrect Time**: Make sure your browser timezone matches your calendar
- **Processing Errors**: Try selecting more specific text with clear date/time information
- **Extension Not Responding**: Reload the extension from chrome://extensions

### Debug Mode

For developers, enable console logging:
1. Open Chrome DevTools
2. Go to the Console tab
3. Filter for "AI Calendar" to see extension logs

## Security

- Uses OAuth 2.0 for Google Calendar authentication
- Environment variables for sensitive keys
- CORS protection for API endpoints
- No permanent storage of user data
- All communication over HTTPS

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License
