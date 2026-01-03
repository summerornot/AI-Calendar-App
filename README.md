# Toki – AI Calendar Assistant

🚀 **Highlight text and let Toki create precise Google Calendar events using AI**

Toki is a Chrome extension that converts selected text from emails, chats, or webpages into structured Google Calendar events. Fast, multilingual (English & German), and timezone-aware.

## ✨ Features

- **AI-Powered Extraction**: Uses GPT-3.5-turbo to extract event details from natural language
- **Highlight to Calendar**: Select any text and right-click to create an event
- **Smart Parsing**: Automatically detects date, time, location, attendees, and description
- **Timezone Aware**: Detects your browser timezone for accurate scheduling
- **Multilingual**: Supports English and German
- **Editable Preview**: Review and adjust all details before saving
- **Privacy First**: PII anonymization for quality monitoring
- **Minimal Permissions**: Only requests `calendar.events` scope (no full calendar access)
- **Performance Optimized**: Event caching and instant UI feedback

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

### Extension Structure

```
extension/
├── manifest.json          # Extension configuration (v1.2.0)
├── background.js          # Service worker (16KB)
│   ├── Context menu management
│   ├── Backend API communication
│   ├── Google Calendar integration
│   ├── OAuth authentication
│   └── Event caching system
├── content.js             # Content script (13KB)
│   ├── Modal injection
│   ├── User interaction handling
│   └── Message passing
├── confirm.js             # Event form logic (26KB)
│   ├── Form validation
│   ├── Date/time handling
│   └── Calendar event creation
├── confirm.html           # Event confirmation modal (19KB)
├── confirm.css            # Modal styling (2KB)
├── popup.html             # Extension popup (2KB)
├── popup.js               # Popup logic (3KB)
├── fonts/                 # Custom fonts (Inter)
└── icons/                 # Extension icons (16, 48, 128px)
```

**Total Extension Size**: ~80KB (compressed)

## 🚀 Performance & Privacy

### Performance Optimizations
- **Event Caching**: Stores up to 20 recently processed events for 1 hour
- **Backend Warmup**: Pings backend every 10 minutes to prevent cold starts
- **Instant UI**: Modal appears immediately while AI processes in background
- **Service Worker Keep-Alive**: Maintains context menu availability

### Privacy & Security
- **PII Anonymization**: User input is anonymized before logging (emails, phone numbers, names, addresses)
- **Minimal OAuth Scope**: Only requests `calendar.events` (not full calendar access)
- **No Permanent Storage**: Selected text is processed in real-time and discarded
- **Local Browser Storage**: Authentication tokens stored securely in browser only
- **HTTPS Only**: All communication encrypted
- **Quality Monitoring**: AI-extracted event details (not raw text) used for accuracy improvement

## Time Format Handling

The extension supports both 12-hour and 24-hour time formats:
- Automatically detects and preserves the original format
- Handles edge cases with proper validation
- Prevents NaN issues in time strings
- Ensures consistent formatting throughout the application

## 📦 Building & Deployment

### Create Clean Build

```bash
cd extension
zip -r ../toki-v1.2.0.zip . -x "*.DS_Store" -x "*-test.js" -x "*-old.js" -x "client_secret.json"
```

### Backend Deployment (Render)

1. Fork this repository
2. Create a new Web Service on Render
3. Connect to your forked repository
4. Set environment variables:
   - `OPENAI_API_KEY`
   - `LANGSMITH_API_KEY` (optional, for monitoring)
5. Deploy
6. Update `background.js` with your backend URL

### Chrome Web Store Submission

1. Create clean build (see above)
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Upload `toki-v1.2.0.zip`
4. Fill in store listing:
   - **Name**: Toki – AI Calendar Assistant
   - **Description**: Use the SEO-optimized copy from manifest.json
   - **Category**: Productivity
   - **Privacy Policy**: Link to your landing page privacy policy
5. Submit for review (typically 1-3 days)

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

## 🔒 Security & Compliance

- **OAuth 2.0**: Secure Google Calendar authentication
- **Minimal Permissions**: Only `calendar.events` scope (principle of least privilege)
- **Environment Variables**: Sensitive keys never hardcoded
- **CORS Protection**: Backend API endpoints secured
- **No Permanent Storage**: User text processed in real-time, not stored
- **PII Anonymization**: Personal information redacted before quality monitoring
- **HTTPS Only**: All communication encrypted
- **Chrome Web Store Compliant**: Follows all privacy and security guidelines

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 Version History

### v1.2.0 (January 2026)
- 🎨 Rebranded to "Toki"
- 🧹 Major code cleanup (removed 6 unused files, saved 35KB)
- 🔒 Enhanced privacy with PII anonymization
- 📝 Updated manifest with SEO-optimized description
- ✅ Verified all functions are necessary and optimized

### v1.1.4 (December 2025)
- 🔐 Restricted OAuth scope to `calendar.events` only
- 🛡️ Added LangSmith PII anonymization
- 📊 Quality monitoring for AI accuracy improvement

## 📧 Contact

For questions or support, please contact via the developer information on the Chrome Web Store page.

## 📜 License

MIT License
