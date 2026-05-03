#!/usr/bin/env python3
"""
LangSmith Evaluator for Calendar Event Extraction

Evaluates _process_text_core directly against the dataset.
"""

import os
from datetime import datetime
from dotenv import load_dotenv
from langsmith.evaluation import evaluate

# Load environment variables
load_dotenv()

# Import the actual extraction function from main.py
from main import _process_text_core

def run_evaluation(dataset_name: str, experiment_prefix: str = "calendar-extractor"):
    """
    Run LangSmith evaluation on the calendar extraction function.
    
    Args:
        dataset_name: Name of the dataset in LangSmith
        experiment_prefix: Prefix for experiment naming
    """
    print(f"Starting evaluation on dataset: {dataset_name}")
    
    results = evaluate(
        _process_text_core,  # Evaluate the function directly
        data=dataset_name,
        experiment_prefix=experiment_prefix,
        # The dataset should provide the required arguments:
        # - text (from highlighted_text)
        # - current_time 
        # - user_timezone
    )
    
    print(f"Evaluation completed. Results: {results}")
    return results

if __name__ == "__main__":
    # Configuration
    DATASET_NAME = os.getenv("LANGSMITH_DATASET_NAME", "calendar-extraction-dataset")
    EXPERIMENT_PREFIX = os.getenv("LANGSMITH_EXPERIMENT_PREFIX", "calendar-extractor-baseline")
    
    # Run the evaluation
    run_evaluation(DATASET_NAME, EXPERIMENT_PREFIX)
