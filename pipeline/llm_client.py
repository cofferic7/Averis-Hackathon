from google import genai
from google.genai import types

client = genai.Client()  # reads GEMINI_API_KEY from environment automatically

def call_llm(prompt: str, model: str = "gemini-3.5-flash-lite", json_mode: bool = False) -> str:
    config = types.GenerateContentConfig(temperature=0)
    if json_mode:
        config.response_mime_type = "application/json"

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=config,
    )
    return response.text