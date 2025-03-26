# Privacy Policy for Add to Google Calendar

This privacy policy describes how Add to Google Calendar ("we", "our", or "the extension") handles your information.

## Information Collection and Use

The extension collects and processes the following information:

1. **Selected Text**: When you select text and use the "Add to Calendar" feature, the selected text is processed to extract event details.

2. **Google Calendar Access**: The extension requires access to your Google Calendar to create events.

3. **Browser Storage**: The extension uses Chrome's local storage to cache event details temporarily for improved performance.

## Data Processing

- Selected text is sent to our server for AI processing using OpenAI's GPT-4-Turbo
- Event details are extracted and used to create calendar events
- No user data is permanently stored on our servers
- All processing is done in real-time
- We implement caching to reduce the need for repeated API calls

## Data Storage

- The extension stores minimal data locally in your browser:
  - Latest event status
  - Event details for display purposes
  - Cached event extraction results for improved performance
- This data is temporary and is stored only in your browser's local storage
- No data is shared with third parties except as described below

## Third-Party Services

We use the following third-party services:

1. **OpenAI GPT-4-Turbo**
   - Used for processing text and extracting event details
   - Only the selected text is sent to OpenAI
   - No personal information is shared
   - OpenAI's privacy policy applies to this processing: https://openai.com/policies/privacy-policy

2. **Google Calendar API**
   - Used to create calendar events
   - Access is through OAuth 2.0
   - Only creates events; doesn't read existing calendar data
   - Google's privacy policy applies to this integration: https://policies.google.com/privacy

## Security

- All communication with our servers uses HTTPS encryption
- Google Calendar authentication uses OAuth 2.0 for secure authorization
- No passwords or sensitive data are stored
- We implement best practices for secure data handling

## Your Rights

You have the right to:
- Access the data we process about you
- Request deletion of your data
- Opt out of future updates
- Uninstall the extension at any time

## Updates

We may update this privacy policy. Any changes will be reflected in the extension's Chrome Web Store listing and in this document.

## Contact

For questions about this privacy policy, contact us at:
- Email: aicalendarteam@gmail.com
- GitHub: https://github.com/summerornot/AI-Calendar-App/issues

Last updated: March 26, 2025
