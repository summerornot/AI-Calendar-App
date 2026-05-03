import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from langsmith.evaluation import evaluate
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from main import _process_text_core

load_dotenv()


def _to_dict(result):
    if isinstance(result, dict):
        return result
    if hasattr(result, "model_dump"):
        return result.model_dump()
    if hasattr(result, "dict"):
        return result.dict()
    return {
        "title": getattr(result, "title", None),
        "date": getattr(result, "date", None),
        "start_time": getattr(result, "start_time", None),
        "end_time": getattr(result, "end_time", None),
        "timezone": getattr(result, "timezone", None),
        "location": getattr(result, "location", None),
        "description": getattr(result, "description", None),
        "emails": getattr(result, "emails", []),
    }


def predict(inputs: dict) -> dict:
    text = inputs["highlighted_text"]
    current_time = inputs.get("current_time") or datetime.now(timezone.utc).isoformat()
    user_timezone = inputs.get("user_timezone") or "UTC"

    result = _process_text_core(text, current_time, user_timezone)
    result_dict = _to_dict(result)

    return {
        "title": result_dict.get("title"),
        "date": result_dict.get("date"),
        "start_time": result_dict.get("start_time"),
        "end_time": result_dict.get("end_time"),
        "timezone": result_dict.get("timezone"),
        "location": result_dict.get("location"),
        "description": result_dict.get("description"),
        "emails": result_dict.get("emails", []),
    }


def field_match_evaluator(run, example):
    predicted = run.outputs or {}
    expected = example.outputs or {}

    fields = [
        "title",
        "date",
        "start_time",
        "end_time",
        "timezone",
        "location",
        "description",
        "emails",
    ]

    matches = 0
    total = 0

    for field in fields:
        if field in expected and expected[field] is not None:
            total += 1
            if predicted.get(field) == expected.get(field):
                matches += 1

    score = matches / total if total else 0

    return {
        "key": "field_match_score",
        "score": score,
        "comment": f"{matches}/{total} fields matched",
    }


def run_evaluation(dataset_name: str, experiment_prefix: str = "calendar-extractor"):
    return evaluate(
        predict,
        data=dataset_name,
        evaluators=[field_match_evaluator],
        experiment_prefix=experiment_prefix,
    )


if __name__ == "__main__":
    dataset_name = os.getenv("LANGSMITH_DATASET_NAME", "calendar-extraction-dataset")
    experiment_prefix = os.getenv("LANGSMITH_EXPERIMENT_PREFIX", "calendar-extractor-baseline")

    try:
        results = run_evaluation(dataset_name, experiment_prefix)
        print(results)
    except Exception as e:
        if "not found" in str(e).lower():
            print(f"Dataset '{dataset_name}' not found in LangSmith.")
            print("Please create the dataset first with your examples:")
            print("Example format:")
            print('{"input": {"highlighted_text": "Let\'s meet Friday at 1pm at Cafe Nora"}, "reference_output": {"title": "Meet at Cafe Nora", "date": "2026-05-08", "start_time": "13:00", "end_time": null, "timezone": null, "location": "Cafe Nora", "description": null, "emails": []}, "fields_present_in_text": ["date", "start_time", "location"]}')
            print("\nThen run: python evaluate.py")
        else:
            print(f"Error running evaluation: {e}")
            raise