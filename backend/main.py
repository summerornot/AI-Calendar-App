from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
import json
import openai
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pickle
from pathlib import Path
import pytz
from zoneinfo import available_timezones

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Configure CORS - Allow specific origins
ALLOWED_ORIGINS = [
    "chrome-extension://*/",  # Allow any Chrome extension
    "http://localhost:8000",  # Local development
    "https://*.render.com",   # Render.com domains
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

# Google Calendar credentials
GOOGLE_CREDENTIALS = os.getenv("GOOGLE_CREDENTIALS")
if GOOGLE_CREDENTIALS:
    # For production: use environment variable
    credentials_dict = json.loads(GOOGLE_CREDENTIALS)
    with open("credentials.json", "w") as f:
        json.dump(credentials_dict, f)
else:
    # For local development: use file
    if not os.path.exists("credentials.json"):
        raise Exception("credentials.json not found")

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/calendar']

class EventText(BaseModel):
    text: str

class EventData(BaseModel):
    title: str
    date: str
    startTime: str
    endTime: str
    description: Optional[str] = None
    timezone: Optional[str] = None
    location: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "Calendar API is running"}

@app.post("/process_event")
async def process_event(event: EventText):
    """Process the selected text and extract event details"""
    try:
        print(f"Received text: {event.text}")  # Debug log
        event_details = extract_event_details(event.text)
        print(f"Extracted details: {event_details}")  # Debug log
        return event_details
    except Exception as e:
        print(f"Process event error: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create_event")
async def create_event(event: EventData):
    """Create an event in Google Calendar"""
    try:
        print(f"Creating event with details: {event}")  # Debug log
        service = get_calendar_service()
        print("Got calendar service")  # Debug log
        
        # Use provided timezone or get user's local timezone
        try:
            if event.timezone:
                local_tz = pytz.timezone(event.timezone)
            else:
                # Get the user's actual timezone instead of defaulting to London
                local_tz = pytz.timezone(get_user_timezone())
            print(f"Using timezone: {local_tz}")  # Debug log
        except pytz.exceptions.UnknownTimeZoneError as e:
            print(f"Timezone error: {e}")  # Debug log
            local_tz = pytz.timezone(get_user_timezone())
        
        # Parse the date and time with timezone
        start_dt = datetime.strptime(f"{event.date} {event.startTime}", "%Y-%m-%d %H:%M")
        end_dt = datetime.strptime(f"{event.date} {event.endTime}", "%Y-%m-%d %H:%M")
        
        # Localize the datetime objects
        start_dt = local_tz.localize(start_dt)
        end_dt = local_tz.localize(end_dt)
        
        print(f"Localized start: {start_dt}, end: {end_dt}")  # Debug log
        
        calendar_event = {
            'summary': event.title,
            'description': event.description or "",
            'start': {
                'dateTime': start_dt.isoformat(),
                'timeZone': str(local_tz),
            },
            'end': {
                'dateTime': end_dt.isoformat(),
                'timeZone': str(local_tz),
            }
        }

        # Add location if provided
        if event.location:
            calendar_event['location'] = event.location
        
        print(f"Calendar event: {calendar_event}")  # Debug log
        event = service.events().insert(calendarId='primary', body=calendar_event).execute()
        print(f"Event created: {event.get('htmlLink')}")
        return {"message": "Event created successfully", "link": event.get('htmlLink')}
        
    except Exception as e:
        print(f"Error creating event: {e}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/authorize")
async def authorize():
    """Authorize the application to access Google Calendar."""
    flow = InstalledAppFlow.from_client_secrets_file(
        'credentials.json', SCOPES)
    # Run the local server on port 8080 for the authorization flow
    flow.run_local_server(port=8080)
    
    # Save the credentials for future use
    with open('token.pickle', 'wb') as token:
        pickle.dump(flow.credentials, token)
    
    return {"message": "Authorization successful! You can close this window."}

@app.get("/auth_status")
async def check_auth_status():
    """Check if we have valid Google Calendar authentication"""
    try:
        service = get_calendar_service()
        # Try to list a single event to verify access
        service.events().list(calendarId='primary', maxResults=1).execute()
        return {"status": "authenticated"}
    except Exception as e:
        return {"status": "not_authenticated", "error": str(e)}

# Default event duration in minutes
DEFAULT_EVENT_DURATION = 45

# Common timezone mappings
TIMEZONE_MAPPINGS = {
    # US & Canada
    'EST': 'America/New_York',
    'EDT': 'America/New_York',
    'CST': 'America/Chicago',
    'CDT': 'America/Chicago',
    'MST': 'America/Denver',
    'MDT': 'America/Denver',
    'PST': 'America/Los_Angeles',
    'PDT': 'America/Los_Angeles',
    'AST': 'America/Halifax',
    
    # Europe
    'GMT': 'Europe/London',
    'BST': 'Europe/London',
    'CET': 'Europe/Paris',
    'CEST': 'Europe/Paris',
    'EET': 'Europe/Helsinki',
    'EEST': 'Europe/Helsinki',
    
    # Asia
    'IST': 'Asia/Kolkata',
    'JST': 'Asia/Tokyo',
    'CST': 'Asia/Shanghai',
    
    # Australia
    'AEST': 'Australia/Sydney',
    'AEDT': 'Australia/Sydney',
    'AWST': 'Australia/Perth',
    
    # New Zealand
    'NZST': 'Pacific/Auckland',
    'NZDT': 'Pacific/Auckland'
}

def get_user_timezone():
    """Get the user's timezone. Default to Europe/London if not determinable."""
    try:
        # Try to get system timezone
        return str(datetime.now().astimezone().tzinfo)
    except:
        return 'Europe/London'

def normalize_timezone(timezone_str):
    """Convert timezone abbreviation to IANA timezone name."""
    if not timezone_str:
        return get_user_timezone()
        
    # If it's already a valid IANA timezone, verify and return it
    try:
        pytz.timezone(timezone_str)
        return timezone_str
    except pytz.exceptions.UnknownTimeZoneError:
        pass
    
    # Try to map common abbreviations
    normalized = TIMEZONE_MAPPINGS.get(timezone_str.upper())
    if normalized:
        return normalized
        
    # If we can't recognize the timezone, use the user's timezone
    return get_user_timezone()

def get_calendar_service():
    """Get Google Calendar service with improved token handling"""
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=8080)
            with open('token.pickle', 'wb') as token:
                pickle.dump(creds, token)
    
    try:
        service = build('calendar', 'v3', credentials=creds)
        return service
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build calendar service: {str(e)}")

def extract_event_details(text: str) -> dict:
    """Extract event details using OpenAI's GPT model"""
    try:
        # Get tomorrow's date in YYYY-MM-DD format
        tomorrow = datetime.now().date() + timedelta(days=1)
        tomorrow_str = tomorrow.strftime('%Y-%m-%d')

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"""Extract event details from the text. 
                For relative dates like 'tomorrow', use {tomorrow_str}.
                For relative dates like 'next week', add 7 days to today's date.
                
                Return a JSON object with these keys:
                - title (string): Event title
                - date (string): YYYY-MM-DD format
                - startTime (string): HH:MM format in 24-hour time
                - endTime (string): HH:MM format in 24-hour time. If duration is mentioned (e.g., "for 2 hours"), calculate it. Otherwise, leave empty.
                - description (string): Event description
                - timezone (string, optional): Timezone if specified in the text. Use standard abbreviations (EST, PST, etc.) or IANA names.
                - location (string, optional): Physical location or venue if mentioned in the text. Include full address if available."""},
                {"role": "user", "content": text}
            ],
            temperature=0.3,
        )
        
        # Parse the response
        content = response.choices[0].message.content
        try:
            # Try to parse as JSON
            event_details = json.loads(content)
            required_keys = ['title', 'date', 'startTime']
            if not all(key in event_details for key in required_keys):
                raise ValueError("Missing required fields in event details")
            
            # Validate date format
            try:
                datetime.strptime(event_details['date'], '%Y-%m-%d')
            except ValueError:
                # If date is not in correct format, it might be 'tomorrow'
                if event_details['date'].lower() == 'tomorrow':
                    event_details['date'] = tomorrow_str
                else:
                    raise ValueError("Invalid date format")
            
            # Handle end time
            if 'endTime' not in event_details or not event_details['endTime']:
                try:
                    start_time = datetime.strptime(event_details['startTime'], '%H:%M')
                    end_time = start_time + timedelta(minutes=DEFAULT_EVENT_DURATION)
                    event_details['endTime'] = end_time.strftime('%H:%M')
                except ValueError:
                    raise ValueError("Invalid start time format")
            
            # Handle timezone
            event_details['timezone'] = normalize_timezone(event_details.get('timezone'))
            
            # Ensure location is present (even if None)
            if 'location' not in event_details:
                event_details['location'] = None
                
            return event_details
        except json.JSONDecodeError:
            raise ValueError("Failed to parse event details from AI response")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing text: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
