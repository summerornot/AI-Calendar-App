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
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": """You are a helpful assistant that extracts event details from text. 
                Extract the following details and format them exactly as shown in the example:
                {
                    "title": "Event title/description",
                    "date": "YYYY-MM-DD",
                    "startTime": "HH:MM",
                    "endTime": "HH:MM",
                    "location": "location or null"
                }
                
                Rules:
                - For date, use YYYY-MM-DD format. If no year specified, use current year
                - For times, use 24-hour HH:MM format
                - If end time not specified, set it to 1 hour after start time
                - If a detail is not found, use null
                - Return ONLY the JSON object, no other text"""},
                {"role": "user", "content": text}
            ]
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
