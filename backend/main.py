from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, OpenAIError
from datetime import datetime, timedelta
import os
import json
import pytz
from pydantic import BaseModel, validator
from typing import List, Optional
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Check for API key
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    print("WARNING: OPENAI_API_KEY not found in environment variables.")
    print("Please set your OpenAI API key in the .env file or as an environment variable.")
    print("Using mock response mode for testing.")

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client if API key is available
try:
    client = OpenAI(api_key=api_key) if api_key else None
    # Test the client with a simple request if it exists
    if client:
        # Simple test to validate API key
        client.models.list()
        print("OpenAI API key is valid.")
except OpenAIError as e:
    print(f"OpenAI API key is invalid or there was an error: {str(e)}")
    client = None
    print("Using mock response mode for testing.")

# Time format regex
TIME_FORMAT = re.compile(r'^(1[0-2]|0?[1-9]):([0-5][0-9])\s*(AM|PM)$', re.IGNORECASE)

# Event schema for function calling
CREATE_EVENT_FUNCTION = {
    "name": "createEvent",
    "description": "Extracts a calendar event from user text, resolving times and dates based on current date and timezone.",
    "parameters": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "The event title"
            },
            "date": {
                "type": "string",
                "description": "The date in YYYY-MM-DD format, resolved from the user's text using their current date and timezone"
            },
            "startTime": {
                "type": "string",
                "description": "Start time in 'HH:MM AM/PM' format with two-digit minutes (e.g., '10:00 AM', not '10 AM')"
            },
            "endTime": {
                "type": "string",
                "description": "End time in 'HH:MM AM/PM' format with two-digit minutes. If missing, should be 1 hour after startTime"
            },
            "location": {
                "type": ["string", "null"],
                "description": "Event location (virtual or physical), or null if not specified"
            },
            "attendees": {
                "type": "array",
                "items": {
                    "type": "string",
                    "format": "email"
                },
                "description": "List of email addresses mentioned in the text"
            },
            "description": {
                "type": ["string", "null"],
                "description": "A detailed description of the event extracted from the text, including purpose, agenda, or any other relevant details"
            }
        },
        "required": ["title", "date", "startTime", "endTime", "location", "attendees", "description"]
    }
}

class EventDetails(BaseModel):
    title: str
    date: str
    startTime: str
    endTime: str
    location: Optional[str] = None
    attendees: List[str] = []
    description: Optional[str] = None

    @validator('startTime', 'endTime')
    def validate_time(cls, v):
        if not TIME_FORMAT.match(v):
            raise ValueError(f"Time must be in 'HH:MM AM/PM' format with two-digit minutes (e.g., '10:00 AM')")
        return v

    @validator('date')
    def validate_date(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format")

def add_one_hour(time_str: str) -> str:
    """Add one hour to a time string in HH:MM AM/PM format"""
    match = TIME_FORMAT.match(time_str)
    if not match:
        raise ValueError(f"Invalid time format: {time_str}")
    
    hour = int(match.group(1))
    minute = int(match.group(2))
    period = match.group(3).upper()
    
    # Convert to 24-hour
    if period == 'PM' and hour != 12:
        hour += 12
    elif period == 'AM' and hour == 12:
        hour = 0
        
    # Add one hour
    hour = (hour + 1) % 24
    
    # Convert back to 12-hour
    if hour == 0:
        hour = 12
        period = 'AM'
    elif hour == 12:
        period = 'PM'
    elif hour > 12:
        hour -= 12
        period = 'PM'
    else:
        period = 'AM'
        
    return f"{hour}:{str(minute).zfill(2)} {period}"

def get_mock_response(text: str, current_time: str):
    """Return a mock response for testing when no API key is available"""
    print(f"Generating mock response for text: '{text}'")
    
    try:
        user_tz = pytz.timezone('Europe/Berlin')
        user_now = datetime.fromisoformat(current_time.replace('Z', '+00:00')).astimezone(user_tz)
        
        # Extract simple meeting info
        title = "Meeting"
        if "dog" in text.lower():
            title = "Dog Meeting"
        elif "cat" in text.lower():
            title = "Cat Meeting"
        elif "lunch" in text.lower():
            title = "Lunch Meeting"
        elif "coffee" in text.lower():
            title = "Coffee Meeting"
        
        # Handle dates
        date = user_now.strftime('%Y-%m-%d')  # Default to today
        if "tomorrow" in text.lower():
            date = (user_now + timedelta(days=1)).strftime('%Y-%m-%d')
        elif "next week" in text.lower():
            date = (user_now + timedelta(weeks=1)).strftime('%Y-%m-%d')
        
        # Handle times
        start_time = "10:00 AM"  # Default
        if "10" in text or "ten" in text.lower():
            start_time = "10:00 AM"
        elif "11" in text or "eleven" in text.lower():
            start_time = "11:00 AM"
        elif "12" in text or "noon" in text.lower():
            start_time = "12:00 PM"
        elif "1" in text or "one" in text.lower():
            start_time = "1:00 PM"
        elif "2" in text or "two" in text.lower():
            start_time = "2:00 PM"
        
        # End time is start time + 1 hour
        end_time = add_one_hour(start_time)
        
        mock_response = {
            "title": title,
            "date": date,
            "startTime": start_time,
            "endTime": end_time,
            "location": "",
            "attendees": [],
            "description": ""
        }
        
        print(f"Generated mock response: {mock_response}")
        return mock_response
    except Exception as e:
        print(f"Error generating mock response: {str(e)}")
        # Return a fallback response
        return {
            "title": "Meeting",
            "date": datetime.now().strftime('%Y-%m-%d'),
            "startTime": "10:00 AM",
            "endTime": "11:00 AM",
            "location": "",
            "attendees": [],
            "description": ""
        }

def process_text(text: str, current_time: str, user_timezone: str = 'UTC'):
    try:
        # If no API key or client is invalid, use mock response
        if not client:
            print("Using mock response (no API key available)")
            mock_result = get_mock_response(text, current_time)
            # Validate using Pydantic model
            event = EventDetails(**mock_result)
            print(f"Validated mock event details: {event.model_dump()}")
            return event.model_dump()
        
        # Parse the current time from ISO string using user's timezone
        try:
            user_tz = pytz.timezone(user_timezone)
        except pytz.UnknownTimeZoneError:
            print(f"Unknown timezone: {user_timezone}, falling back to UTC")
            user_tz = pytz.UTC
        user_now = datetime.fromisoformat(current_time.replace('Z', '+00:00')).astimezone(user_tz)
        current_date = user_now.strftime('%Y-%m-%d')
        
        # Pre-calculate common relative dates
        tomorrow_date = (user_now + timedelta(days=1)).strftime('%Y-%m-%d')
        next_week_date = (user_now + timedelta(weeks=1)).strftime('%Y-%m-%d')
        
        system_prompt = f'''You are an assistant that extracts calendar event details from natural language.

Current date: {current_date}
User timezone: {user_timezone} (UTC{user_now.strftime("%z")})

Use this to resolve relative dates and times:
- "today" = {current_date}
- "tomorrow" = {tomorrow_date}
- "next week" = {next_week_date}

TITLE CREATION RULES:
1. Create a SHORT, CONCISE title (3-5 words) that captures the purpose of the meeting
2. Focus on the meeting TYPE or PURPOSE, not the details of when/where
3. Use action verbs when appropriate (e.g., "Review", "Discuss", "Plan")
4. DO NOT include date/time information in the title
5. DO NOT use quotes in the title
6. DO NOT copy-paste large portions of the text as the title
7. Examples of good titles:
   - "Team Weekly Sync"
   - "Project Planning Meeting"
   - "Interview with Candidate"
   - "Coffee with David"
   - "Doctor Appointment"

Rules:
1. Convert any timezone-specific times to {user_timezone}
2. If no end time given, set it to 1 hour after start time
3. Times MUST be in 'HH:MM AM/PM' format with TWO-DIGIT minutes:
   Correct: "10:00 AM", "2:30 PM", "12:00 PM"
   Wrong: "10 AM", "2:30", "12PM", "24:00"
4. Dates must be in YYYY-MM-DD format
5. Never guess missing information
6. Always use empty string "" instead of null for missing location
7. Extract a detailed description from the text that explains the purpose of the meeting

DESCRIPTION CREATION RULES:
1. DO NOT copy-paste the conversation text into the description
2. Create a concise summary of the meeting purpose and topics
3. Format as a short bullet list (2-5 points) when appropriate
4. Focus on key topics, decisions, or agenda items
5. Include meeting goals (e.g., "finalize scope", "review designs")
6. Extract any mentioned deliverables or expected outcomes
7. If a meeting link is mentioned, include it in the description

CONVERSATION HANDLING:
When processing text that appears to be a conversation (with multiple speakers or message exchanges):
1. Identify the main event details from the conversation context
2. Extract the title based on the main topic being discussed (e.g., "Q2 Roadmap Discussion")
3. Identify all participants mentioned in the conversation and add them as attendees
4. Look for URLs or location information that indicates where the meeting will take place
5. Extract the specific date and time mentioned, not just the first occurrence of a time
6. Create a bullet-point summary of the key topics and purpose of the meeting
7. If a video conferencing link is mentioned (Zoom, Google Meet, etc.), extract it as the location

Example of good description for a conversation:
- Finalize project scope for Q2
- Review design mockups
- Discuss implementation timeline
- Prepare for client presentation

Only respond by calling the createEvent function.'''
        
        # Get completion from OpenAI with function calling
        # Using gpt-3.5-turbo for faster response times (~3x faster than gpt-4)
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            functions=[CREATE_EVENT_FUNCTION],
            function_call={"name": "createEvent"}
        )
        
        # Get the function call
        function_call = completion.choices[0].message.function_call
        print(f"Function call response: {function_call}")
        
        if not function_call or function_call.name != "createEvent":
            raise ValueError("Invalid response from GPT-4")
            
        # Parse the arguments
        event_details = json.loads(function_call.arguments)
        print(f"Parsed event details: {event_details}")
        
        # If no end time, add one hour to start time
        if not event_details.get('endTime'):
            event_details['endTime'] = add_one_hour(event_details['startTime'])
            
        # Convert null location to empty string
        if event_details.get('location') is None:
            event_details['location'] = ""
        
        # Validate using Pydantic model
        event = EventDetails(**event_details)
        
        # Additional validation
        event_date = datetime.strptime(event.date, '%Y-%m-%d').date()
        if event_date < user_now.date():
            raise ValueError(f"Invalid or past date: {event.date}")
        
        # Validate relative date references
        if "today" in text.lower() and event.date != current_date:
            raise ValueError(f"Date must be {current_date} when 'today' is mentioned")
            
        if "tomorrow" in text.lower() and event.date != tomorrow_date:
            raise ValueError(f"Date must be {tomorrow_date} when 'tomorrow' is mentioned")
            
        if "next week" in text.lower() and event.date != next_week_date:
            raise ValueError(f"Date must be {next_week_date} when 'next week' is mentioned")
        
        print(f"Validated event details: {event.model_dump()}")
        return event.model_dump()
            
    except Exception as e:
        print(f"Error processing text: {str(e)}")
        # Re-raise to be handled by the endpoint with partial data preservation
        raise

def create_fallback_response(text: str, current_time: str, error_message: str, user_timezone: str = 'UTC'):
    """
    Create a fallback response that preserves any extractable information.
    Returns partial data with an extraction_error flag for the frontend.
    """
    print(f"Creating fallback response for error: {error_message}")
    
    # Get current date as fallback using user's timezone
    try:
        user_tz = pytz.timezone(user_timezone)
    except:
        user_tz = pytz.UTC
    try:
        user_now = datetime.fromisoformat(current_time.replace('Z', '+00:00')).astimezone(user_tz)
        default_date = user_now.strftime('%Y-%m-%d')
    except:
        default_date = datetime.now().strftime('%Y-%m-%d')
    
    # Try to extract a meaningful title from the text
    title = ""
    text_lower = text.lower()
    
    # Look for common meeting-related keywords to create a title
    if "meeting" in text_lower:
        title = "Meeting"
    elif "call" in text_lower:
        title = "Call"
    elif "appointment" in text_lower:
        title = "Appointment"
    elif "lunch" in text_lower:
        title = "Lunch"
    elif "coffee" in text_lower:
        title = "Coffee"
    elif "interview" in text_lower:
        title = "Interview"
    elif "review" in text_lower:
        title = "Review"
    elif "sync" in text_lower:
        title = "Sync"
    elif "discussion" in text_lower:
        title = "Discussion"
    
    # Use first few words as title if nothing found
    if not title:
        words = text.split()[:5]
        title = " ".join(words)
        if len(title) > 40:
            title = title[:40] + "..."
    
    fallback_response = {
        "title": title,
        "date": default_date,
        "startTime": "12:00 PM",
        "endTime": "1:00 PM",
        "location": "",
        "attendees": [],
        "description": text,  # Preserve original text as description
        "extraction_error": "Sorry, the event could not be extracted correctly. Please fill out remaining details manually."
    }
    
    print(f"Fallback response: {fallback_response}")
    return fallback_response


@app.post("/process_event")
async def process_event(request: Request):
    text = ''
    current_time = None
    user_timezone = 'UTC'
    
    try:
        data = await request.json()
        text = data.get('text', '')
        current_time = data.get('current_time')  # ISO string from frontend
        user_timezone = data.get('user_timezone', 'UTC')  # User's timezone from browser
        
        if not text:
            print("Error: No text provided")
            raise HTTPException(status_code=400, detail="No text provided")
            
        if not current_time:
            print("Error: No current time provided")
            raise HTTPException(status_code=400, detail="No current time provided")
        
        print(f"Processing text: '{text}', current_time: '{current_time}', timezone: '{user_timezone}'")
        return process_text(text, current_time, user_timezone)
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
        
    except Exception as e:
        print(f"Error in process_event: {str(e)}")
        # Return partial extraction with error flag - preserve any extracted info
        return create_fallback_response(text, current_time, str(e), user_timezone)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/")
async def root():
    return {"message": "AI Calendar Extension API is running. Use /process_event endpoint to process text."}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
