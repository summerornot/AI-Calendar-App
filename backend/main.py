from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import os
from datetime import datetime
import pytz
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise Exception("OPENAI_API_KEY not found in environment variables")
client = OpenAI(api_key=api_key)

class EventData(BaseModel):
    text: str
    title: Optional[str] = None
    date: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    location: Optional[str] = None

def extract_event_details(text: str) -> dict:
    """Extract event details using OpenAI's GPT model"""
    try:
        print(f"Processing text: {text}")  # Debug log
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """Extract event details from the text. Return a JSON object with:
                - title: Event title/description
                - date: Date in YYYY-MM-DD format (assume current year if not specified)
                - startTime: Start time in HH:MM format (24-hour)
                - endTime: End time in HH:MM format (24-hour), if not specified assume 1 hour after start time
                - location: Location if specified (or null)
                
                If a detail is not found or unclear, return null for that field."""},
                {"role": "user", "content": text}
            ],
            response_format={ "type": "json_object" }
        )
        
        result = json.loads(response.choices[0].message.content)
        print(f"Extracted details: {result}")  # Debug log
        return result
    except Exception as e:
        print(f"Error in extract_event_details: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=f"Error processing text: {str(e)}")

@app.post("/process_event")
async def process_event(event: EventData):
    """Process text and extract event details"""
    try:
        print(f"Received event data: {event.dict()}")  # Debug log
        details = extract_event_details(event.text)
        print(f"Returning details: {details}")  # Debug log
        return details
    except Exception as e:
        print(f"Error in process_event: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "openai_key_set": bool(os.getenv("OPENAI_API_KEY"))}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
