import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Also load .env.local if present
const envLocalPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Middleware for parsing large JSON payloads (for base64 document uploads up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Get GoogleGenAI client with validation
function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY to your .env or .env.local file.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper to robustly parse JSON from Gemini response (handles code fences)
function parseGenAIJson(responseText: string): any {
  if (!responseText) return {};
  const cleaned = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Failed to parse AI response into structured JSON.');
  }
}

// Helper to extract text from various document formats
async function extractDocumentContent(
  fileType: string,
  base64Data: string,
  fileName: string
): Promise<{ textContent?: string; inlinePart?: { inlineData: { mimeType: string; data: string } } }> {
  const buffer = Buffer.from(base64Data, 'base64');

  // Text, Markdown, CSV
  if (
    fileType === 'text/plain' ||
    fileType === 'text/markdown' ||
    fileType.includes('text') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md')
  ) {
    return { textContent: buffer.toString('utf-8') };
  }

  // DOCX format
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return { textContent: result.value };
    } catch (err) {
      console.error('Mammoth extraction error:', err);
      return { textContent: buffer.toString('utf-8') };
    }
  }

  // Excel / CSV Spreadsheets
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileType === 'application/vnd.ms-excel' ||
    fileType === 'text/csv' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.csv')
  ) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let combined = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        combined += `\n--- Sheet: ${sheetName} ---\n`;
        combined += XLSX.utils.sheet_to_csv(sheet);
      }
      return { textContent: combined };
    } catch (err) {
      console.error('XLSX extraction error:', err);
    }
  }

  // PDF
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return {
      inlinePart: {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data,
        },
      },
    };
  }

  // Images (JPEG, PNG, WEBP)
  if (
    fileType.startsWith('image/') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.webp')
  ) {
    const mime = fileType.startsWith('image/') ? fileType : 'image/jpeg';
    return {
      inlinePart: {
        inlineData: {
          mimeType: mime,
          data: base64Data,
        },
      },
    };
  }

  // Fallback as UTF-8 text
  return { textContent: buffer.toString('utf-8') };
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Server-side username uniqueness validation endpoint
app.post('/api/auth/check-username', async (req: Request, res: Response) => {
  try {
    const { username, currentUid } = req.body;
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ available: false, error: 'Username is required.' });
    }
    const normalized = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalized)) {
      return res.status(400).json({
        available: false,
        error: 'Username must be 3-30 characters with letters, numbers, and underscores only.',
      });
    }

    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      return res.json({ available: true, normalized });
    }

    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const { projectId, apiKey, firestoreDatabaseId } = firebaseConfig;

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/usernames/${encodeURIComponent(
      normalized
    )}?key=${apiKey}`;

    const checkRes = await fetch(url);

    if (checkRes.status === 404) {
      return res.json({ available: true, normalized });
    } else if (checkRes.status === 200) {
      const data = await checkRes.json();
      const existingUid = data.fields?.uid?.stringValue;
      if (currentUid && existingUid === currentUid) {
        return res.json({ available: true, normalized, isCurrentUser: true });
      }
      return res.json({
        available: false,
        normalized,
        error: `The username "${username}" is already taken by another student.`,
      });
    } else {
      // Fallback
      return res.json({ available: true, normalized });
    }
  } catch (error: any) {
    console.error('Check username error:', error);
    res.status(500).json({ available: false, error: error.message || 'Server error checking username' });
  }
});

// Update student profile in Firestore (fallback server endpoint)
app.post('/api/auth/update-profile', async (req: Request, res: Response) => {
  try {
    const { uid, fullName, courseSection } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    const cleanFullName = String(fullName || '').trim();
    const cleanCourse = String(courseSection || '').trim().toUpperCase();

    if (!cleanFullName || cleanFullName.length < 2) {
      return res.status(400).json({ error: 'Full Name must be at least 2 characters long' });
    }
    if (!cleanCourse) {
      return res.status(400).json({ error: 'Course & Section is required' });
    }

    const timestamp = new Date().toISOString();
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const { projectId, apiKey, firestoreDatabaseId } = firebaseConfig;

      const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId || '(default)'}/documents/users/${encodeURIComponent(
        uid
      )}?updateMask.fieldPaths=full_name&updateMask.fieldPaths=fullName&updateMask.fieldPaths=course_section&updateMask.fieldPaths=courseSection&updateMask.fieldPaths=updated_at&updateMask.fieldPaths=updatedAt&key=${apiKey}`;

      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            full_name: { stringValue: cleanFullName },
            fullName: { stringValue: cleanFullName },
            course_section: { stringValue: cleanCourse },
            courseSection: { stringValue: cleanCourse },
            updated_at: { stringValue: timestamp },
            updatedAt: { stringValue: timestamp },
          },
        }),
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        console.warn('Firestore REST update notice:', errText);
      }
    }

    return res.json({
      success: true,
      full_name: cleanFullName,
      fullName: cleanFullName,
      course_section: cleanCourse,
      courseSection: cleanCourse,
      updated_at: timestamp,
      updatedAt: timestamp,
    });
  } catch (error: any) {
    console.error('Update profile server error:', error);
    res.status(500).json({ error: error.message || 'Server error updating profile' });
  }
});

// 1. GENERATE COMPREHENSIVE STUDY REVIEWER
app.post('/api/gemini/generate-reviewer', async (req: Request, res: Response) => {
  try {
    const { fileName, fileType, base64Data, title } = req.body;

    if (!base64Data && !req.body.textContent) {
      return res.status(400).json({ error: 'Missing document data' });
    }

    const extraction: {
      textContent?: string;
      inlinePart?: { inlineData: { mimeType: string; data: string } };
    } = base64Data
      ? await extractDocumentContent(fileType || '', base64Data, fileName || 'document')
      : { textContent: req.body.textContent };

    const reviewerPrompt = `You are ClassMate AI, an expert college academic reviewer generator and professor.
Analyze this academic material thoroughly and produce an exceptionally structured, comprehensive study reviewer.

Return ONLY a valid JSON object strictly matching this format:
{
  "title": "Title of the lesson or subject",
  "tableOfContents": ["1. Topic A", "2. Topic B", "3. Topic C"],
  "lessonSummary": "A thorough, well-written executive summary of the entire lesson or chapter, highlighting the main themes.",
  "simplifiedExplanations": [
    {
      "concept": "Name of difficult concept",
      "simpleExplanation": "Clear, accessible explanation in simple language",
      "analogy": "Memorable real-life analogy that makes it click"
    }
  ],
  "keyTerms": [
    {
      "term": "Term Name",
      "definition": "Precise academic definition based strictly on the material",
      "importance": "Why this term matters for understanding or exams"
    }
  ],
  "importantPrinciples": [
    {
      "title": "Law, Principle, or Core Rule",
      "description": "Explanation of how it functions",
      "formulaOrRule": "Mathematical formula, code snippet, or theoretical rule if applicable",
      "example": "Demonstrative example"
    }
  ],
  "practicalExamples": [
    {
      "topic": "Topic covered",
      "scenario": "Real-world context or case study",
      "solutionOrTakeaway": "How the theory applies to this scenario"
    }
  ],
  "stepByStepGuides": [
    {
      "processName": "Procedure, solving method, or workflow",
      "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."]
    }
  ],
  "comparisonTables": [
    {
      "title": "Comparison between X and Y",
      "headers": ["Aspect", "Concept A", "Concept B"],
      "rows": [
        ["Definition", "...", "..."],
        ["Advantage", "...", "..."],
        ["Limitation", "...", "..."]
      ]
    }
  ],
  "mnemonics": [
    {
      "targetConcept": "Items or order to remember",
      "mnemonicText": "Catchy acronym or sentence (e.g. PEMDAS)",
      "explanation": "What each letter or part represents"
    }
  ],
  "examTips": [
    {
      "tip": "High-yield concept likely to appear in examinations",
      "keyFocus": "What examiners look for",
      "commonMistake": "Frequent pitfall or misconception students make"
    }
  ],
  "vocabularyGlossary": [
    {
      "word": "Academic term",
      "definition": "Clear concise definition",
      "pronunciationOrContext": "Context or usage note"
    }
  ],
  "sourceReferences": [
    {
      "section": "Section or heading name",
      "keyTakeaway": "Core takeaway from this section",
      "pageOrHeading": "Page number or section header from source"
    }
  ],
  "extractedTextSnippet": "First 500 characters of source material for context"
}

Preserve the original meaning faithfully. Do not invent false citations. If mathematical or technical principles exist, explain them step by step.`;

    let contentsPayload: any;

    if (extraction.inlinePart) {
      contentsPayload = {
        parts: [
          extraction.inlinePart,
          { text: `${reviewerPrompt}\nDocument Title: ${title || fileName || 'Uploaded Document'}` },
        ],
      };
    } else {
      contentsPayload = {
        parts: [
          {
            text: `${reviewerPrompt}\n\n=== SOURCE DOCUMENT CONTENT ===\n${(extraction.textContent || '').slice(0, 100000)}`,
          },
        ],
      };
    }

    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: contentsPayload,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = response.text || '{}';
    const parsedReviewer = parseGenAIJson(responseText);

    // Attach extracted snippet if missing
    if (!parsedReviewer.extractedTextSnippet && extraction.textContent) {
      parsedReviewer.extractedTextSnippet = extraction.textContent.slice(0, 1000);
    }

    res.json({ success: true, reviewer: parsedReviewer });
  } catch (error: any) {
    console.error('Error generating reviewer:', error);
    res.status(500).json({ error: error.message || 'Failed to generate study reviewer' });
  }
});

// 2. INTERACTIVE GEMINI AI TUTOR
app.post('/api/gemini/tutor', async (req: Request, res: Response) => {
  try {
    const { documentContext, messages, prompt, languagePreference } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const systemInstruction = `You are the ClassMate AI Interactive Academic Tutor.
Your goal is to guide and tutor college students based on their uploaded academic materials.
Rules:
1. Use the provided document context as your primary truth source.
2. If the user asks in Filipino/Tagalog or Cebuano/Bisaya, or requests explanations in those languages, reply fluently and naturally in that language while preserving technical terms.
3. If the user requests "simple English", use clear analogies, friendly tone, and simple vocabulary.
4. Break down complex mathematical or technical derivations step-by-step.
5. If the source material does not contain enough information to answer a question, acknowledge that explicitly rather than making up facts.
6. Use clear Markdown with headings, bullet points, and code blocks for formulas where helpful.`;

    const formattedHistory = (messages || []).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content || m.text }],
    }));

    const userMessage = `Document Context:
${documentContext ? documentContext.slice(0, 30000) : 'General Academic Subject'}

${languagePreference ? `Language Preference: ${languagePreference}` : ''}
Student Question:
${prompt}`;

    formattedHistory.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: formattedHistory,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Error in tutor chat:', error);
    res.status(500).json({ error: error.message || 'Tutor request failed' });
  }
});

// 2b. MULTI-TURN GENERAL GEMINI STUDY CHATBOT
app.post('/api/gemini/chatbot', async (req: Request, res: Response) => {
  try {
    const { messages, prompt, role = 'study_buddy', speed = 'general' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Role-specific system instructions
    const roleInstructions: Record<string, string> = {
      professor: `You are Professor Maxwell, a distinguished college professor on ClassMate AI.
Provide comprehensive, intellectually rigorous, and well-structured explanations suitable for university students.
Use clear academic structure with headings, key takeaways, and references to core theories.`,
      study_buddy: `You are Alex, an enthusiastic, friendly college study buddy on ClassMate AI.
Explain tricky concepts in simple, accessible language with fun analogies and relatable everyday examples.
Break down intimidating jargon, keep student morale high, and ask thoughtful questions to test their understanding.`,
      math_solver: `You are Dr. Euler, an expert mathematics and STEM problem solver on ClassMate AI.
Break down algebraic, calculus, algorithmic, and engineering problems step-by-step.
Explicitly show every step of the derivation or solution with formulas clearly formatted in code blocks or bold text.`,
      language_tutor: `You are Bayani, a multilingual academic tutor on ClassMate AI fluent in English, Filipino (Tagalog), and Cebuano (Bisaya).
When the user speaks or asks for explanations in Filipino/Tagalog or Cebuano/Bisaya, reply fluently and naturally in that dialect while maintaining rigorous technical accuracy.`,
      exam_coach: `You are Coach Rivera, an examination and review strategist on ClassMate AI.
Focus on high-yield exam topics, active recall questions, mnemonics, common multiple-choice traps, and memory retention techniques.`,
    };

    const systemInstruction =
      roleInstructions[role] ||
      roleInstructions.study_buddy +
        ` Maintain conversation context and answer student questions clearly and helpfully.`;

    // Model selection based on requested speed/task
    const selectedModel = speed === 'fast' ? 'gemini-2.0-flash-lite' : DEFAULT_GEMINI_MODEL;

    const formattedHistory = (messages || []).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content || m.text }],
    }));

    formattedHistory.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: formattedHistory,
      config: {
        systemInstruction,
        temperature: 0.5,
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Error in chatbot:', error);
    res.status(500).json({ error: error.message || 'Chatbot request failed' });
  }
});

// 3. GENERATE PRACTICE QUIZ
app.post('/api/gemini/generate-quiz', async (req: Request, res: Response) => {
  try {
    const { documentContext, title, count = 10, difficulty = 'medium', questionTypes = ['all'] } = req.body;

    const quizPrompt = `You are ClassMate AI examination architect.
Generate a high quality practice quiz based on the provided lesson material.

Parameters:
- Number of questions: ${count}
- Difficulty: ${difficulty}
- Allowed types: ${JSON.stringify(questionTypes)} (Can include: "multiple_choice", "true_false", "identification", "fill_in_the_blank", "matching")

Return ONLY a valid JSON object matching:
{
  "title": "Practice Quiz: ${title || 'Lesson Review'}",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "Clear, rigorous question stem",
      "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correctAnswer": "A. Option 1",
      "explanation": "Detailed explanation of why this answer is correct and why other distractors are wrong",
      "sourceRef": "Relevant concept or section in the lesson"
    },
    {
      "id": "q2",
      "type": "true_false",
      "question": "Statement to evaluate",
      "options": ["True", "False"],
      "correctAnswer": "True",
      "explanation": "Why this statement is true or false based on the lesson",
      "sourceRef": "Relevant principle"
    },
    {
      "id": "q3",
      "type": "identification",
      "question": "What is the term for...?",
      "correctAnswer": "Exact term",
      "acceptableAnswers": ["Exact term", "Alternate capitalization", "Synonym"],
      "explanation": "Context and definition",
      "sourceRef": "Key terms"
    },
    {
      "id": "q4",
      "type": "fill_in_the_blank",
      "question": "In the process of X, the ___ acts as the primary catalyst.",
      "correctAnswer": "enzyme",
      "acceptableAnswers": ["enzyme", "enzymes"],
      "explanation": "Explanation of the blank",
      "sourceRef": "Source section"
    }
  ]
}

Ensure all questions are grounded strictly in the lesson material. Distribute across different concepts.`;

    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: [
        {
          text: `${quizPrompt}\n\n=== LESSON MATERIAL ===\n${(documentContext || '').slice(0, 50000)}`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const parsed = parseGenAIJson(response.text || '{}');
    res.json({ success: true, quiz: parsed });
  } catch (error: any) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: error.message || 'Failed to generate quiz' });
  }
});

// 4. GENERATE FLASHCARDS
app.post('/api/gemini/generate-flashcards', async (req: Request, res: Response) => {
  try {
    const { documentContext, title, count = 15 } = req.body;

    const flashcardPrompt = `You are ClassMate AI Flashcard Engine.
Create a set of ${count} high-yield study flashcards from the provided lesson material.

Return ONLY a valid JSON object matching:
{
  "title": "Flashcards: ${title || 'Lesson Decks'}",
  "cards": [
    {
      "id": "c1",
      "front": "Front of card (Term, Question, Formula prompt, or Concept)",
      "back": "Back of card (Precise definition, breakdown, or solution)",
      "category": "Topic category",
      "hint": "Optional memory trigger or mnemonic"
    }
  ]
}

Focus on key terms, essential formulas, historical milestones/dates, and core principles.`;

    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: [
        {
          text: `${flashcardPrompt}\n\n=== LESSON MATERIAL ===\n${(documentContext || '').slice(0, 50000)}`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const parsed = parseGenAIJson(response.text || '{}');
    res.json({ success: true, deck: parsed });
  } catch (error: any) {
    console.error('Error generating flashcards:', error);
    res.status(500).json({ error: error.message || 'Failed to generate flashcards' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Only listen when running standalone (not imported by Vercel serverless)
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`ClassMate AI server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
