import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Loader2,
  Users,
  Shield,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  saveStudyMaterial,
  saveReviewer,
  saveFlashcardDeck,
  saveQuiz,
  getUserStudyRooms,
} from '../lib/firebase';
import { StudyMaterial, Reviewer, StudyRoom } from '../types';

interface UploadPageProps {
  onMaterialCreated: (materialId: string) => void;
  defaultRoomId?: string;
}

export const UploadPage: React.FC<UploadPageProps> = ({
  onMaterialCreated,
  defaultRoomId,
}) => {
  const { studentProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(defaultRoomId || '');
  const [studyRooms, setStudyRooms] = useState<StudyRoom[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Upload & generation pipeline states
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const [stepProgress, setStepProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadRooms() {
      if (!studentProfile) return;
      try {
        const rooms = await getUserStudyRooms(studentProfile.uid);
        setStudyRooms(rooms);
      } catch (err) {
        console.warn('Failed to load study rooms for upload dropdown:', err);
      }
    }
    loadRooms();
  }, [studentProfile]);

  const handleFileSelect = (file: File) => {
    setErrorMessage('');
    // Max 25MB limit
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 25MB limit. Please upload a smaller document.');
      return;
    }

    setSelectedFile(file);
    if (!customTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setCustomTitle(nameWithoutExt);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Convert file to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime;base64, prefix
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleProcessDocument = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select or upload a study document first.');
      return;
    }
    if (!studentProfile) {
      setErrorMessage('You must be signed in to analyze study documents.');
      return;
    }
    setIsProcessing(true);
    setErrorMessage('');
    setStepProgress(10);
    setStepMessage('Reading and preparing document bytes...');

    try {
      const base64Data = await fileToBase64(selectedFile);
      setStepProgress(30);
      setStepMessage('Analyzing document structure with Gemini Flash AI...');

      // 1. Send to server for Gemini analysis
      const reviewerRes = await fetch('/api/gemini/generate-reviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          base64Data,
          title: customTitle.trim() || selectedFile.name,
        }),
      });

      if (!reviewerRes.ok) {
        const errJson = await reviewerRes.json();
        throw new Error(errJson.error || 'Failed to analyze academic file with Gemini API.');
      }

      const { reviewer: generatedReviewer } = await reviewerRes.json();
      setStepProgress(65);
      setStepMessage('Synthesizing structured reviewer, mnemonics, and exam tips...');

      const materialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const reviewerId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      const studyMaterialRecord: StudyMaterial = {
        id: materialId,
        ownerUid: studentProfile.uid,
        roomId: selectedRoomId || '',
        title: customTitle.trim() || generatedReviewer.title || selectedFile.name,
        fileType: selectedFile.type || 'application/octet-stream',
        originalFileName: selectedFile.name,
        fileSize: selectedFile.size,
        processingStatus: 'ready',
        extractedTextSnippet: generatedReviewer.extractedTextSnippet || '',
        reviewerId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const reviewerRecord: Reviewer = {
        id: reviewerId,
        ownerUid: studentProfile.uid,
        materialId,
        roomId: selectedRoomId || '',
        title: studyMaterialRecord.title,
        content: generatedReviewer,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setStepProgress(80);
      setStepMessage('Generating starter practice quiz and flashcard deck...');

      // Generate flashcards in background / parallel
      try {
        const flashRes = await fetch('/api/gemini/generate-flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentContext: generatedReviewer.lessonSummary + '\n' + JSON.stringify(generatedReviewer.keyTerms),
            title: studyMaterialRecord.title,
            count: 10,
          }),
        });
        if (flashRes.ok) {
          const { deck } = await flashRes.json();
          await saveFlashcardDeck({
            id: `deck_${Date.now()}`,
            ownerUid: studentProfile.uid,
            materialId,
            roomId: selectedRoomId || '',
            title: studyMaterialRecord.title,
            cards: (deck.cards || []).map((c: any, idx: number) => ({
              id: `c_${idx}`,
              front: c.front,
              back: c.back,
              category: c.category || 'General',
              hint: c.hint,
              mastered: false,
            })),
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
      } catch (fErr) {
        console.warn('Initial flashcard generation error:', fErr);
      }

      // Generate initial practice quiz
      try {
        const quizRes = await fetch('/api/gemini/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentContext: generatedReviewer.lessonSummary + '\n' + JSON.stringify(generatedReviewer.keyTerms),
            title: studyMaterialRecord.title,
            count: 8,
            difficulty: 'medium',
            questionTypes: ['multiple_choice', 'true_false', 'identification'],
          }),
        });
        if (quizRes.ok) {
          const { quiz } = await quizRes.json();
          await saveQuiz({
            id: `quiz_${Date.now()}`,
            ownerUid: studentProfile.uid,
            materialId,
            roomId: selectedRoomId || '',
            title: studyMaterialRecord.title,
            difficulty: 'medium',
            questions: quiz.questions || [],
            createdAt: nowIso,
          });
        }
      } catch (qErr) {
        console.warn('Initial quiz generation error:', qErr);
      }

      setStepProgress(95);
      setStepMessage('Saving to academic database...');

      // Save to Firestore
      await saveStudyMaterial(studyMaterialRecord);
      await saveReviewer(reviewerRecord);

      setStepProgress(100);
      setStepMessage('Study materials generated successfully!');

      setTimeout(() => {
        onMaterialCreated(materialId);
      }, 500);
    } catch (err: any) {
      console.error('Document analysis failed:', err);
      let msg = err.message || 'Failed to process document. Please try again.';
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error) msg = parsed.error;
      } catch {}
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Instructions */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-indigo-400" />
          Upload Academic Study Material
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Upload lectures, textbook chapters, slide presentations, or notes. Gemini will extract formulas, generate an interactive reviewer, flashcards, quizzes, and ground an AI tutor.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Upload Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-6">
        {/* Drop Zone */}
        {!selectedFile ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-400 bg-indigo-950/30'
                : 'border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/60 hover:bg-slate-900'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
              <UploadCloud className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-semibold text-white">
              Drag & drop your academic file here, or{' '}
              <span className="text-indigo-400 underline underline-offset-2">browse files</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              PDF, Word (DOC/DOCX), PowerPoint (PPT/PPTX), Spreadsheets (XLSX/CSV), Text (TXT/MD), and Scanned Notes / Images (JPG/PNG).
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4 text-[11px] text-slate-500">
              <span className="px-2 py-0.5 rounded bg-slate-800/80">Max 25MB</span>
              <span className="px-2 py-0.5 rounded bg-slate-800/80">OCR Enabled</span>
              <span className="px-2 py-0.5 rounded bg-slate-800/80">Formula Extraction</span>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {selectedFile.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Document'}
                </div>
              </div>
            </div>

            {!isProcessing && (
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setCustomTitle('');
                }}
                className="text-xs text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Change File
              </button>
            )}
          </div>
        )}

        {/* Configuration Options (When File Selected) */}
        {selectedFile && !isProcessing && (
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Reviewer / Document Title
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms - Trees & Graphs"
                className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Target Destination
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Personal Study Library (Private to you)</option>
                {studyRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    Share to Study Room: {room.roomName} ({room.code})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                If shared in a study room, authorized classmates can access the reviewer without repeating analysis.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleProcessDocument}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analyze Document & Generate Study Reviewer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Live Processing Indicator */}
        {isProcessing && (
          <div className="p-6 rounded-2xl bg-indigo-950/20 border border-indigo-900/40 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white tracking-tight">
                AI Analysis in Progress
              </h4>
              <p className="text-xs text-indigo-300">{stepMessage}</p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800 max-w-md mx-auto">
              <div
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${stepProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Extracting summaries, tables, mnemonics, quizzes, and vocabulary cards...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
