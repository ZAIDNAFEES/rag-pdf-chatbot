/**
 * LLM Service Module for OpenRouter Chat Completions
 * ==================================================
 * Interfacing with free OpenRouter chat models (Gemini 2.5 Flash, Llama 3.3 70B) under strict non-hallucination prompts.
 */

export const SYSTEM_PROMPT = `You are an AI assistant that answers questions ONLY using the provided context.

Rules:

- Never use outside knowledge.
- Never hallucinate.
- If the answer cannot be found in the provided context, respond exactly:

"The information is not available in the provided documents."

Answer clearly and professionally.`;

export interface LLMLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface StructuredExtractionResult {
  extracted: boolean;
  questionType: string;
  regex: string;
  value: string | null;
}

export class LLMService {
  private apiKey: string;
  private primaryModel: string;
  private fallbackModel: string;
  private timeoutMs: number;
  private maxRetries: number;
  private logs: LLMLog[] = [];

  constructor(
    primaryModel: string = 'google/gemini-2.5-flash:free',
    fallbackModel: string = 'meta-llama/llama-3.3-70b-instruct:free',
    timeoutMs: number = 25000,
    maxRetries: number = 2
  ) {
    this.apiKey =
      ((import.meta as any).env?.VITE_OPENROUTER_API_KEY as string) ||
      ((import.meta as any).env?.OPENROUTER_API_KEY as string) ||
      '';
    this.primaryModel = primaryModel;
    this.fallbackModel = fallbackModel;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, level, message });
    console.log(`[LLMService] [${level}] ${message}`);
  }

  public getLogs(): LLMLog[] {
    return [...this.logs];
  }

  /**
   * Helper to clean up extracted values (removes orphaned colons/dashes/whitespace).
   */
  private cleanExtractedValue(rawVal: string): string {
    if (!rawVal) return '';
    return rawVal
      .trim()
      .replace(/^[:\-=]+\s*/, '')
      .replace(/[:\-=]+$/, '')
      .trim();
  }

  /**
   * Parses continuous context to extract structured field values directly
   * for simple structured questions (name, id, father's name, programme, etc.).
   */
  public extractStructuredValue(userPrompt: string): StructuredExtractionResult {
    if (!userPrompt || !userPrompt.includes('Context:') || !userPrompt.includes('Question:')) {
      return { extracted: false, questionType: 'Unknown', regex: 'None', value: null };
    }

    try {
      const parts = userPrompt.split('Context:')[1].split('Question:');
      const rawContext = parts[0];
      const rawQuestion = parts[1].split('Answer:')[0].trim();
      const qLower = rawQuestion.toLowerCase();

      // Combine and normalize full context into a single continuous string
      const normalizedContext = rawContext
        .replace(/\[Chunk \d+ \| Document: .*? \| Page: \d+\]/g, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!normalizedContext) {
        return { extracted: false, questionType: 'Empty Context', regex: 'None', value: null };
      }

      // Reusable lookahead boundary for next field headers in OCR card text
      const nextFieldBoundary = `(?=\\s*(?:Father'?s?\\s*Name|Mother'?s?\\s*Name|Student'?s?\\s*Name|Candidate'?s?\\s*Name|Full\\s*Name|\\bName\\s*[:\\-=]|\\bID\\.?\\s*(?:No\\.?|Num(?:ber)?)?\\s*[:\\-=]|\\bID\\.?\\s*No\\.?|\\bEnrollment|\\bRegistration|\\bRoll\\s*No\\.?|\\bProgramme?|\\bCourse|\\bDegree|\\bBranch|\\bDepartment|\\bDept|\\bSemester|\\bSem|\\bMajor|\\bDOB|\\bDate\\s*of\\s*Birth|\\bValid|\\bExpiry|\\bAddress|\\bMobile|\\bPhone|\\bBlood|\\bGender|\\bSex|\\n|$))`;

      // 1. Father's Name
      if (/father/i.test(qLower)) {
        const regex = new RegExp(
          `(?:Father'?s?\\s*Name|Father\\s*Name|\\bFather\\b)\\s*[:\\-=]?\\s*(.*?)${nextFieldBoundary}`,
          'i'
        );
        const match = normalizedContext.match(regex);
        if (match) {
          const val = this.cleanExtractedValue(match[1]);
          if (val) {
            return {
              extracted: true,
              questionType: "Father's Name",
              regex: regex.toString(),
              value: val,
            };
          }
        }
      }

      // 2. Student / Candidate / General Name (excluding father/mother queries)
      if (
        /(?:^|\b)(?:name|student|candidate|who is|full name)(?:\b|$)/i.test(qLower) &&
        !/father|mother/i.test(qLower)
      ) {
        const regex = new RegExp(
          `(?:Student'?s?\\s*Name|Candidate'?s?\\s*Name|Full\\s*Name|\\bName\\b)\\s*[:\\-=]?\\s*(.*?)${nextFieldBoundary}`,
          'i'
        );
        const match = normalizedContext.match(regex);
        if (match) {
          const val = this.cleanExtractedValue(match[1]);
          if (val) {
            return {
              extracted: true,
              questionType: 'Student Name',
              regex: regex.toString(),
              value: val,
            };
          }
        }
      }

      // 3. ID / Roll / Registration / Enrollment Number
      if (/(?:^|\b)(?:id|id\s*number|id\s*no|roll|registration|enrollment)(?:\b|$)/i.test(qLower)) {
        const regex = new RegExp(
          `(?:ID\\.?\\s*(?:No\\.?|Num(?:ber)?)?|Enrollment\\s*(?:No\\.?)?|Registration\\s*(?:No\\.?)?|Roll\\s*(?:No\\.?)?)\\s*[:\\-=]?\\s*(.*?)${nextFieldBoundary}`,
          'i'
        );
        const match = normalizedContext.match(regex);
        if (match) {
          const val = this.cleanExtractedValue(match[1]);
          if (val) {
            return {
              extracted: true,
              questionType: 'ID Number',
              regex: regex.toString(),
              value: val,
            };
          }
        }
      }

      // 4. Programme / Program / Course / Degree / Branch / Department / Major
      if (/(?:^|\b)(?:programme?|course|degree|branch|department|dept|major)(?:\b|$)/i.test(qLower)) {
        const regex = new RegExp(
          `(?:Programme?|Course|Degree|Branch|Department|Dept|Major)\\s*[:\\-=]?\\s*(.*?)${nextFieldBoundary}`,
          'i'
        );
        const match = normalizedContext.match(regex);
        if (match) {
          const val = this.cleanExtractedValue(match[1]);
          if (val) {
            return {
              extracted: true,
              questionType: 'Programme / Course',
              regex: regex.toString(),
              value: val,
            };
          }
        }
      }

      // 5. Semester
      if (/(?:^|\b)(?:semester|sem)(?:\b|$)/i.test(qLower)) {
        const regex = new RegExp(
          `(?:Semester|Sem)\\s*[:\\-=]?\\s*(.*?)${nextFieldBoundary}`,
          'i'
        );
        const match = normalizedContext.match(regex);
        if (match) {
          const val = this.cleanExtractedValue(match[1]);
          if (val) {
            return {
              extracted: true,
              questionType: 'Semester',
              regex: regex.toString(),
              value: val,
            };
          }
        }
      }

      // 6. Date of Birth / DOB
      if (/(?:^|\b)(?:dob|date of birth|birth date)(?:\b|$)/i.test(qLower)) {
        const regex = new RegExp(
          `(?:DOB|Date\\s*of\\s*Birth|Birth\\s*Date)\\s*[:\\-=]?\\s*(.*?)${nextFieldBoundary}`,
          'i'
        );
        const match = normalizedContext.match(regex);
        if (match) {
          const val = this.cleanExtractedValue(match[1]);
          if (val) {
            return {
              extracted: true,
              questionType: 'Date of Birth',
              regex: regex.toString(),
              value: val,
            };
          }
        }
      }
    } catch (err: any) {
      console.error('[LLMService] Error during structured value extraction:', err);
    }

    return { extracted: false, questionType: 'Descriptive / Unmatched', regex: 'None', value: null };
  }

  /**
   * Generates completion text from OpenRouter API using provided prompt.
   * Intercepts simple structured queries for deterministic fast path.
   */
  public async generateCompletion(userPrompt: string): Promise<string> {
    this.logs = [];

    if (!userPrompt || !userPrompt.trim()) {
      return "The information is not available in the provided documents.";
    }

    console.log('================ LLM PROMPT DEBUG START ================');
    console.log(userPrompt);
    console.log('================ LLM PROMPT DEBUG END ==================');
    this.log('INFO', `Complete prompt sent to LLM:\n${userPrompt}`);

    // Step 1: Detect structured question and extract value directly
    const structured = this.extractStructuredValue(userPrompt);

    if (structured.extracted && structured.value) {
      this.log('INFO', `[Structured Extraction] Detected Question Type: "${structured.questionType}"`);
      this.log('INFO', `[Structured Extraction] Matched Regex: ${structured.regex}`);
      this.log('INFO', `[Structured Extraction] Extracted Value: "${structured.value}"`);
      this.log('INFO', `[Structured Extraction] Method Used: Structured Regex Extraction (LLM call bypassed)`);
      return structured.value;
    }

    this.log(
      'INFO',
      `[Structured Extraction] Method Used: OpenRouter LLM Path (Question Type: "${structured.questionType}")`
    );

    // Step 2: OpenRouter LLM Path for descriptive or unhandled queries
    if (!this.apiKey) {
      this.log('INFO', 'OpenRouter API key not configured. Utilizing offline grounded factual extraction engine.');
      return this.generateOfflineFallback(userPrompt);
    }

    const modelsToTry = [this.primaryModel, this.fallbackModel];

    for (const model of modelsToTry) {
      let delay = 1000;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          this.log('INFO', 'Generating response...');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://ai.studio/build',
              'X-Title': 'Production RAG Application',
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.1,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`OpenRouter HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
            const answerText = data.choices[0].message.content.trim();
            this.log('INFO', 'Response completed.');
            return answerText;
          }

          throw new Error('Invalid JSON structure returned by OpenRouter API.');
        } catch (err: any) {
          this.log('WARN', `Attempt ${attempt}/${this.maxRetries} with model '${model}' failed: ${err.message || err}`);
          if (attempt < this.maxRetries) {
            await new Promise((r) => setTimeout(r, delay));
            delay *= 2;
          }
        }
      }
    }

    this.log('ERROR', 'All OpenRouter chat attempts failed. Utilizing grounded fallback response.');
    return this.generateOfflineFallback(userPrompt);
  }

  /**
   * Deterministic offline fallback engine extracting relevant facts directly from prompt context.
   */
  private generateOfflineFallback(userPrompt: string): string {
    const structured = this.extractStructuredValue(userPrompt);
    if (structured.extracted && structured.value) {
      return structured.value;
    }

    if (!userPrompt || !userPrompt.includes('Context:') || !userPrompt.includes('Question:')) {
      return "The information is not available in the provided documents.";
    }

    try {
      const parts = userPrompt.split('Context:')[1].split('Question:');
      const rawContext = parts[0];
      const rawQuestion = parts[1].split('Answer:')[0].trim();

      const normalizedContext = rawContext
        .replace(/\[Chunk \d+ \| Document: .*? \| Page: \d+\]/g, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const stopWords = new Set(['what', 'where', 'when', 'which', 'how', 'who', 'this', 'that', 'with', 'from', 'explain', 'show', 'tell', 'does', 'student', 'the', 'is', 'a', 'an', 'of', 'in', 'for']);
      const queryTerms = rawQuestion
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 2 && !stopWords.has(t));

      for (const term of queryTerms) {
        if (normalizedContext.toLowerCase().includes(term)) {
          const sentences = normalizedContext.split(/(?<=\.|\!|\?)\s+/);
          for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(term)) {
              return sentence.trim();
            }
          }
          return normalizedContext;
        }
      }
    } catch (err) {
      console.error('[LLMService] Offline fallback extraction error:', err);
    }

    return "The information is not available in the provided documents.";
  }
}

export const defaultLLMService = new LLMService();
