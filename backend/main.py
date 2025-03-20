from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
import json
from datetime import datetime, timedelta
import re
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise Exception("OPENAI_API_KEY not found in environment variables")
openai.api_key = api_key

class EventRequest(BaseModel):
    text: str

class EventResponse(BaseModel):
    title: str
    date: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    location: Optional[str] = None
    attendees: List[str] = []

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_emails(text: str) -> List[str]:
    """Extract email addresses from text."""
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    return list(set(re.findall(email_pattern, text)))

def normalize_date(date_str: str, current_date: datetime) -> str:
    """Convert relative dates to absolute dates."""
    date_str = date_str.lower().strip()
    
    if 'today' in date_str:
        return current_date.strftime('%Y-%m-%d')
    elif 'tomorrow' in date_str:
        return (current_date + timedelta(days=1)).strftime('%Y-%m-%d')
    elif 'next' in date_str:
        if 'week' in date_str:
            return (current_date + timedelta(weeks=1)).strftime('%Y-%m-%d')
        elif 'month' in date_str:
            # Approximate month as 30 days
            return (current_date + timedelta(days=30)).strftime('%Y-%m-%d')
    
    # If it's already a date string, ensure it's not in the past
    try:
        date = datetime.strptime(date_str, '%Y-%m-%d')
        if date.year < current_date.year:
            # If the date is from a previous year, update it to current year
            date = date.replace(year=current_date.year)
        return date.strftime('%Y-%m-%d')
    except:
        return None

@app.post("/process_event")
async def process_event(request: EventRequest):
    try:
        current_date = datetime.now()
        
        # Extract emails first
        attendees = extract_emails(request.text)
        
        # Update system message to handle dates better
        system_message = """Extract event details from the text. Follow these rules:
        1. For dates:
           - If a specific date is mentioned, use it
           - For relative dates (today, tomorrow, next week), mark them as such
           - If no date is mentioned, return null
           - Always use YYYY-MM-DD format
        2. For times:
           - Use 24-hour format (HH:mm)
           - If duration is mentioned, calculate end time
           - If no time is mentioned, return null
        3. Return JSON in this format:
        {
            "title": "Event title",
            "date": "YYYY-MM-DD or null",
            "startTime": "HH:mm or null",
            "endTime": "HH:mm or null",
            "location": "Location or null"
        }"""

        response = await openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": request.text}
            ]
        )

        event_details = json.loads(response.choices[0].message.content)
        
        # Normalize the date if present
        if event_details.get('date'):
            normalized_date = normalize_date(event_details['date'], current_date)
            event_details['date'] = normalized_date

        # Add extracted emails
        event_details['attendees'] = attendees

        return event_details

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "openai_key_set": bool(os.getenv("OPENAI_API_KEY"))}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
