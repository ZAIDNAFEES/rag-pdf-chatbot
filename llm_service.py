"""
LLM Service Module for Production RAG Application
=================================================

This module handles calling OpenRouter API's free chat models with strict non-hallucination
system prompts, timeout controls, and structured output formatting.

Default Free Chat Model:
- meta-llama/llama-3.3-70b-instruct:free
- google/gemini-2.5-flash:free
"""

import os
import re
import json
import time
import logging
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

logger = logging.getLogger("LLMService")
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
)

# OpenRouter Free Chat Model Default
DEFAULT_CHAT_MODEL = os.getenv("CHAT_MODEL", "google/gemini-2.5-flash:free")
FALLBACK_CHAT_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

SYSTEM_PROMPT = """You are an AI assistant that answers questions ONLY using the provided context.

Rules:

- Never use outside knowledge.
- Never hallucinate.
- If the answer cannot be found in the provided context, respond exactly:

"The information is not available in the provided documents."

Answer clearly and professionally."""


class OpenRouterLLMService:
    """
    LLM Service wrapping OpenRouter chat completions API with retries and timeout handling.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: float = 25.0,
        max_retries: int = 2
    ) -> None:
        """
        Initialize OpenRouter LLM Service.

        Args:
            api_key (str, optional): OpenRouter API key.
            model (str, optional): Target free chat model identifier.
            timeout_seconds (float): Timeout for completion request.
            max_retries (int): Retry attempts for transient failures.
        """
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.model = model or os.getenv("CHAT_MODEL", DEFAULT_CHAT_MODEL)
        self.timeout = timeout_seconds
        self.max_retries = max_retries

    def generate_completion(self, user_prompt: str, system_prompt: str = SYSTEM_PROMPT) -> str:
        """
        Generate text completion from OpenRouter API.

        Args:
            user_prompt (str): Formatted user prompt containing context + question.
            system_prompt (str): Mandatory system prompt enforcing strict context grounding.

        Returns:
            str: Generated completion response text.
        """
        if not user_prompt or not user_prompt.strip():
            return "The information is not available in the provided documents."

        logger.info("Calling OpenRouter...")
        logger.info(f"=== EXACT LLM USER PROMPT SENT TO LLM ===\n{user_prompt}\n=======================================")

        if not self.api_key:
            logger.info("OPENROUTER_API_KEY not set. Utilizing offline deterministic grounding engine.")
            return self._generate_offline_response(user_prompt)

        models_to_try = [self.model, FALLBACK_CHAT_MODEL]

        for model_name in models_to_try:
            delay = 1.0
            for attempt in range(1, self.max_retries + 1):
                try:
                    logger.info("Generating response...")
                    url = "https://openrouter.ai/api/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://ai.studio/build",
                        "X-Title": "Production RAG System"
                    }
                    payload = json.dumps({
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.1
                    }).encode("utf-8")

                    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
                    with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                        res_json = json.loads(resp.read().decode("utf-8"))
                        if "choices" in res_json and len(res_json["choices"]) > 0:
                            content = res_json["choices"][0]["message"]["content"].strip()
                            logger.info("Response completed.")
                            return content
                except Exception as e:
                    logger.warning(
                        f"Attempt {attempt}/{self.max_retries} with model '{model_name}' failed: {str(e)}"
                    )
                    if attempt < self.max_retries:
                        time.sleep(delay)
                        delay *= 2.0

        logger.error("All OpenRouter chat attempts failed. Returning grounded fallback.")
        return self._generate_offline_response(user_prompt)

    def _generate_offline_response(self, user_prompt: str) -> str:
        """
        Offline fallback to extract structured factual facts (Name, ID No, Father's Name, Program)
        or keyword matching lines directly from context.
        """
        if not user_prompt or "Context:" not in user_prompt or "Question:" not in user_prompt:
            return "The information is not available in the provided documents."

        try:
            parts = user_prompt.split("Context:")[1].split("Question:")
            context_part = parts[0].strip()
            question_part = parts[1].split("Answer:")[0].strip()
            q_lower = question_part.lower()

            context_lines = [
                line.strip() for line in context_part.splitlines()
                if line.strip() and not line.strip().startswith("[Chunk ")
            ]

            # 1. Father's Name query
            if "father" in q_lower:
                father_pattern = re.compile(r"(?:father'?s?\s*name|father\s*name|father)\s*[:\-=]\s*([^\n\r\|;]+)", re.IGNORECASE)
                for line in context_lines:
                    match = father_pattern.search(line)
                    if match:
                        val = match.group(1).strip()
                        return f"Father's Name : {val}"

            # 2. Student / Candidate / Name query
            if "name" in q_lower or "student" in q_lower or "candidate" in q_lower or "who is" in q_lower:
                name_pattern = re.compile(r"(?:student'?s?\s*name|candidate'?s?\s*name|full\s*name|^name|student\s*name)\s*[:\-=]\s*([^\n\r\|;]+)", re.IGNORECASE)
                for line in context_lines:
                    if "father" in line.lower():
                        continue
                    match = name_pattern.search(line)
                    if match:
                        val = match.group(1).strip()
                        return f"Name : {val}"

            # 3. ID / ID Number query
            if any(k in q_lower for k in ["id", "number", "roll", "registration", "enrollment"]):
                id_pattern = re.compile(r"(?:id\s*(?:no\.?|num(?:ber)?)?|enrollment\s*(?:no\.?|num(?:ber)?)?|registration\s*(?:no\.?|num(?:ber)?)?|roll\s*(?:no\.?|num(?:ber)?)?)\s*[:\-=]\s*([^\n\r\|;]+)", re.IGNORECASE)
                for line in context_lines:
                    match = id_pattern.search(line)
                    if match:
                        val = match.group(1).strip()
                        return f"ID No. : {val}"

            # 4. Program / Course / Degree query
            if any(k in q_lower for k in ["program", "programme", "course", "degree", "branch", "department", "major"]):
                prog_pattern = re.compile(r"(?:program(?:me)?|course|degree|branch|department|major)\s*[:\-=]\s*([^\n\r\|;]+)", re.IGNORECASE)
                for line in context_lines:
                    match = prog_pattern.search(line)
                    if match:
                        val = match.group(1).strip()
                        return f"Program : {val}"

            # 5. Generic Key-Value Extraction based on query terms
            stop_words = {"what", "where", "when", "which", "how", "who", "this", "that", "with", "from", "explain", "show", "tell", "does", "student", "the", "is", "a", "an", "of", "in", "for"}
            query_terms = [
                t for t in re.sub(r"[^\w\s]", "", q_lower).split()
                if len(t) > 2 and t not in stop_words
            ]

            for line in context_lines:
                if any(delim in line for delim in [":", "-", "="]):
                    line_lower = line.lower()
                    if any(term in line_lower for term in query_terms):
                        return line

            # 6. Fallback line matching
            for line in context_lines:
                line_lower = line.lower()
                if any(term in line_lower for term in query_terms):
                    return line

        except Exception as e:
            logger.error(f"Offline response extraction error: {e}")

        return "The information is not available in the provided documents."


# Module level convenience function
def call_openrouter_llm(user_prompt: str) -> str:
    """Convenience function to call OpenRouter LLM."""
    svc = OpenRouterLLMService()
    return svc.generate_completion(user_prompt)
