import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  MessageSquare,
  Award,
  Layers,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Send,
  HelpCircle,
  Lightbulb,
  Table,
  Bookmark,
  Share2,
  Trash2,
  Printer,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import {
  getStudyMaterial,
  getReviewerByMaterial,
  getQuizzesByMaterial,
  saveQuiz,
  saveQuizAttempt,
  getFlashcardsByMaterial,
  saveFlashcardDeck,
  updateFlashcardDeck,
  deleteStudyMaterial,
} from '../lib/firebase';
import {
  StudyMaterial,
  Reviewer,
  Quiz,
  QuizQuestion,
  QuizAttempt,
  FlashcardDeck,
  Flashcard,
} from '../types';

interface StudyMaterialDetailPageProps {
  materialId: string;
  onBack: () => void;
}

type StudyTab = 'reviewer' | 'tutor' | 'quiz' | 'flashcards';

export const StudyMaterialDetailPage: React.FC<StudyMaterialDetailPageProps> = ({
  materialId,
  onBack,
}) => {
  const { studentProfile } = useAuth();

  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [reviewer, setReviewer] = useState<Reviewer | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeck[]>([]);
  const [activeTab, setActiveTab] = useState<StudyTab>('reviewer');
  const [loading, setLoading] = useState(true);

  // Active section in Reviewer for Table of Contents
  const [activeSection, setActiveSection] = useState<string>('summary');

  // AI Tutor State
  const [tutorMessages, setTutorMessages] = useState<
    { role: 'user' | 'model'; content: string; timestamp?: string }[]
  >([]);
  const [tutorInput, setTutorInput] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);
  const tutorChatEndRef = useRef<HTMLDivElement>(null);

  // Tutor Voice Chat States
  const [tutorListening, setTutorListening] = useState(false);
  const [tutorSpeakingIdx, setTutorSpeakingIdx] = useState<number | null>(null);
  const tutorRecognitionRef = useRef<any>(null);

  const toggleTutorMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (tutorListening) {
      tutorRecognitionRef.current?.stop();
      setTutorListening(false);
    } else {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setTutorSpeakingIdx(null);

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setTutorListening(true);
      recognition.onresult = (e: any) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        setTutorInput(text);
      };
      recognition.onerror = () => setTutorListening(false);
      recognition.onend = () => setTutorListening(false);
      tutorRecognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (e) {
        console.warn('Tutor speech error:', e);
      }
    }
  };

  const speakTutorMsg = (idx: number, text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (tutorSpeakingIdx === idx) {
      setTutorSpeakingIdx(null);
      return;
    }

    const clean = text.replace(/[*_#`~>]/g, '').trim();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.onstart = () => setTutorSpeakingIdx(idx);
    utt.onend = () => setTutorSpeakingIdx(null);
    utt.onerror = () => setTutorSpeakingIdx(null);
    window.speechSynthesis.speak(utt);
  };

  // Quiz Player State
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizAttempt | null>(null);
  const [quizTimerSeconds, setQuizTimerSeconds] = useState(0);
  const [isQuizTimed, setIsQuizTimed] = useState(false);
  const [quizGenerating, setQuizGenerating] = useState(false);

  // Flashcards State
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Load material data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [mat, rev, qList, fList] = await Promise.all([
          getStudyMaterial(materialId),
          getReviewerByMaterial(materialId),
          getQuizzesByMaterial(materialId),
          getFlashcardsByMaterial(materialId),
        ]);

        setMaterial(mat);
        setReviewer(rev);
        setQuizzes(qList);
        if (qList.length > 0) setActiveQuiz(qList[0]);

        setFlashcardDecks(fList);
        if (fList.length > 0) setActiveDeck(fList[0]);

        // Initial welcome message in Tutor
        if (mat) {
          setTutorMessages([
            {
              role: 'model',
              content: `Hello ${studentProfile?.fullName || 'student'}! I'm your interactive AI tutor for **"${mat.title}"**. Ask me anything about this lesson — whether you need step-by-step math breakdowns, practical examples, or explanations in simple English, Tagalog, or Cebuano!`,
            },
          ]);
        }
      } catch (err) {
        console.error('Error loading study material details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [materialId, studentProfile]);

  // Scroll tutor chat to bottom
  useEffect(() => {
    if (activeTab === 'tutor') {
      tutorChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tutorMessages, activeTab]);

  // Quiz Timer Effect
  useEffect(() => {
    let interval: any;
    if (activeTab === 'quiz' && activeQuiz && !quizSubmitted && isQuizTimed) {
      interval = setInterval(() => {
        setQuizTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, activeQuiz, quizSubmitted, isQuizTimed]);

  // Send Tutor Prompt
  const handleSendTutorMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || tutorInput.trim();
    if (!textToSend || tutorLoading) return;

    if (!customPrompt) setTutorInput('');

    const newHistory = [
      ...tutorMessages,
      { role: 'user' as const, content: textToSend, timestamp: new Date().toLocaleTimeString() },
    ];
    setTutorMessages(newHistory);
    setTutorLoading(true);

    try {
      const docContext = reviewer
        ? `${reviewer.content.lessonSummary}\nKey Terms: ${reviewer.content.keyTerms.map((t) => t.term + ': ' + t.definition).join('; ')}`
        : material?.extractedTextSnippet || '';

      const res = await fetch('/api/gemini/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentContext: docContext,
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          prompt: textToSend,
        }),
      });

      if (!res.ok) throw new Error('Tutor response failed');
      const data = await res.json();

      setTutorMessages((prev) => [
        ...prev,
        { role: 'model', content: data.reply, timestamp: new Date().toLocaleTimeString() },
      ]);
    } catch (err: any) {
      setTutorMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: 'Sorry, I encountered an issue connecting to the academic model. Please try again.',
        },
      ]);
    } finally {
      setTutorLoading(false);
    }
  };

  // Generate New Quiz
  const handleGenerateNewQuiz = async (difficulty: 'easy' | 'medium' | 'hard' | 'comprehensive') => {
    if (!reviewer) return;
    setQuizGenerating(true);
    try {
      const docContext = `${reviewer.content.lessonSummary}\nKey Terms: ${reviewer.content.keyTerms.map((t) => t.term + ': ' + t.definition).join('; ')}`;
      const res = await fetch('/api/gemini/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentContext: docContext,
          title: reviewer.title,
          count: 10,
          difficulty,
          questionTypes: ['multiple_choice', 'true_false', 'identification', 'fill_in_the_blank'],
        }),
      });

      if (!res.ok) throw new Error('Failed to generate quiz');
      const { quiz } = await res.json();

      const newQuiz: Quiz = {
        id: `quiz_${Date.now()}`,
        ownerUid: studentProfile!.uid,
        materialId,
        title: reviewer.title + ` (${difficulty.toUpperCase()})`,
        difficulty,
        questions: quiz.questions || [],
        createdAt: new Date().toISOString(),
      };

      await saveQuiz(newQuiz);
      setQuizzes((prev) => [newQuiz, ...prev]);
      setActiveQuiz(newQuiz);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setQuizResult(null);
      setQuizTimerSeconds(0);
    } catch (err) {
      console.error('Quiz creation error:', err);
    } finally {
      setQuizGenerating(false);
    }
  };

  // Submit Quiz
  const handleSubmitQuiz = async () => {
    if (!activeQuiz || !studentProfile) return;

    let score = 0;
    const results: Record<string, boolean> = {};
    const weakTopics: string[] = [];

    activeQuiz.questions.forEach((q) => {
      const studentAns = (quizAnswers[q.id] || '').trim().toLowerCase();
      let isCorrect = false;

      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        isCorrect = studentAns === q.correctAnswer.trim().toLowerCase();
      } else {
        // Identification or Fill in the blank
        const validAnswers = [
          q.correctAnswer.trim().toLowerCase(),
          ...(q.acceptableAnswers || []).map((a) => a.trim().toLowerCase()),
        ];
        isCorrect = validAnswers.includes(studentAns);
      }

      results[q.id] = isCorrect;
      if (isCorrect) {
        score++;
      } else if (q.sourceRef && !weakTopics.includes(q.sourceRef)) {
        weakTopics.push(q.sourceRef);
      }
    });

    const totalQuestions = activeQuiz.questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    const attempt: QuizAttempt = {
      id: `attempt_${Date.now()}`,
      quizId: activeQuiz.id,
      studentUid: studentProfile.uid,
      materialId,
      materialTitle: material?.title || 'Lesson Quiz',
      score,
      totalQuestions,
      percentage,
      timeSpentSeconds: quizTimerSeconds,
      answers: quizAnswers,
      results,
      weakTopics,
      completedAt: new Date().toISOString(),
    };

    try {
      await saveQuizAttempt(attempt);
      setQuizResult(attempt);
      setQuizSubmitted(true);

      // Trigger confetti on celebratory score!
      if (percentage >= 80) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch (err) {
      console.error('Failed to record quiz attempt:', err);
    }
  };

  // Flashcard Mastery Toggle
  const handleToggleCardMastery = async (mastered: boolean) => {
    if (!activeDeck) return;
    const currentCard = activeDeck.cards[currentCardIndex];
    if (!currentCard) return;

    const updatedCards = [...activeDeck.cards];
    updatedCards[currentCardIndex] = {
      ...currentCard,
      mastered,
      lastReviewedAt: new Date().toISOString(),
    };

    const updatedDeck = { ...activeDeck, cards: updatedCards };
    setActiveDeck(updatedDeck);
    await updateFlashcardDeck(activeDeck.id, updatedCards);

    // Auto advance to next card
    if (currentCardIndex < activeDeck.cards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      setIsCardFlipped(false);
      setShowHint(false);
    }
  };

  // Shuffle Deck
  const handleShuffleDeck = () => {
    if (!activeDeck) return;
    const shuffled = [...activeDeck.cards].sort(() => Math.random() - 0.5);
    setActiveDeck({ ...activeDeck, cards: shuffled });
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
    setShowHint(false);
  };

  // Delete Material
  const handleDeleteMaterial = async () => {
    if (!confirm('Are you sure you want to delete this study material and all its generated notes?')) {
      return;
    }
    if (material && studentProfile) {
      await deleteStudyMaterial(material.id, studentProfile.uid);
      onBack();
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading comprehensive study reviewer...</p>
      </div>
    );
  }

  if (!material || !reviewer) {
    return (
      <div className="p-12 text-center space-y-4 rounded-2xl bg-[#0B132B] border border-slate-800">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">Study Material Not Found</h3>
        <p className="text-xs text-slate-400">The requested material may have been deleted.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { content } = reviewer;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {material.title}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {material.fileType.split('/')[1] || 'DOC'}
            </span>
            {material.roomId && (
              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950/40 text-amber-300 border border-amber-900/40">
                Shared Study Room
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Source: {material.originalFileName} • Analyzed on{' '}
            {new Date(material.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            title="Print or Save Reviewer as PDF"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={handleDeleteMaterial}
            title="Delete this study material"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex overflow-x-auto border-b border-slate-800 gap-2 pb-1">
        <button
          onClick={() => setActiveTab('reviewer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'reviewer'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Structured Reviewer</span>
        </button>

        <button
          onClick={() => setActiveTab('tutor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'tutor'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Gemini AI Tutor</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveTab('quiz')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'quiz'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Practice Quizzes ({quizzes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('flashcards')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'flashcards'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Flashcard Decks ({activeDeck?.cards?.length || 0})</span>
        </button>
      </div>

      {/* --- TAB 1: STRUCTURED REVIEWER --- */}
      {activeTab === 'reviewer' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Table of Contents */}
          <div className="hidden lg:block lg:col-span-1 sticky top-24 p-4 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
              Table of Contents
            </h3>
            <nav className="space-y-1 text-xs">
              <a
                href="#summary"
                onClick={() => setActiveSection('summary')}
                className={`block px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeSection === 'summary'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                1. Lesson Summary
              </a>
              <a
                href="#simplified"
                onClick={() => setActiveSection('simplified')}
                className={`block px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeSection === 'simplified'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                2. Simple Explanations & Analogies
              </a>
              <a
                href="#terms"
                onClick={() => setActiveSection('terms')}
                className={`block px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeSection === 'terms'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                3. Key Terms & Definitions
              </a>
              <a
                href="#principles"
                onClick={() => setActiveSection('principles')}
                className={`block px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeSection === 'principles'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                4. Formulas & Principles
              </a>
              <a
                href="#examples"
                onClick={() => setActiveSection('examples')}
                className={`block px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeSection === 'examples'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                5. Practical Examples
              </a>
              <a
                href="#tables"
                onClick={() => setActiveSection('tables')}
                className={`block px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeSection === 'tables'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                6. Comparison Tables
              </a>
              <a
                href="#mnemonics"
                onClick={() => setActiveSection('mnemonics')}
                className={`block px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeSection === 'mnemonics'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                7. Mnemonics & Memory Aids
              </a>
              <a
                href="#exam-tips"
                onClick={() => setActiveSection('exam-tips')}
                className={`block px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeSection === 'exam-tips'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                8. High-Yield Exam Tips
              </a>
              <a
                href="#glossary"
                onClick={() => setActiveSection('glossary')}
                className={`block px-2.5 py-1.5 rounded-lg transition-colors ${
                  activeSection === 'glossary'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                9. Vocabulary Glossary
              </a>
            </nav>
          </div>

          {/* Right Main Reviewer Content (3 cols) */}
          <div className="lg:col-span-3 space-y-8">
            {/* 1. Lesson Summary */}
            <section id="summary" className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>1. Complete Lesson Summary</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {content.title || material.title}
              </h2>
              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line space-y-2">
                {content.lessonSummary}
              </div>
            </section>

            {/* 2. Simple Explanations & Analogies */}
            {content.simplifiedExplanations && content.simplifiedExplanations.length > 0 && (
              <section id="simplified" className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4" />
                  <span>2. Simple Explanations of Difficult Concepts</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {content.simplifiedExplanations.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
                    >
                      <h4 className="text-xs font-bold text-white tracking-tight">
                        {item.concept}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {item.simpleExplanation}
                      </p>
                      {item.analogy && (
                        <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-900/40 text-[11px] text-indigo-300 italic">
                          💡 <span className="font-semibold text-indigo-200">Analogy:</span> {item.analogy}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Key Terms & Definitions */}
            {content.keyTerms && content.keyTerms.length > 0 && (
              <section id="terms" className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <Bookmark className="w-4 h-4" />
                  <span>3. Key Terms and Definitions</span>
                </div>
                <div className="space-y-3">
                  {content.keyTerms.map((termItem, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-indigo-300">
                          {termItem.term}
                        </div>
                        <div className="text-xs text-slate-300 leading-relaxed">
                          {termItem.definition}
                        </div>
                      </div>
                      {termItem.importance && (
                        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {termItem.importance}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. Formulas & Core Principles */}
            {content.importantPrinciples && content.importantPrinciples.length > 0 && (
              <section id="principles" className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>4. Core Formulas, Laws, & Principles</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {content.importantPrinciples.map((principle, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5"
                    >
                      <h4 className="text-xs font-bold text-white tracking-tight">
                        {principle.title}
                      </h4>
                      {principle.formulaOrRule && (
                        <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto">
                          {principle.formulaOrRule}
                        </div>
                      )}
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {principle.description}
                      </p>
                      {principle.example && (
                        <p className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                          <span className="font-semibold text-slate-300">Example:</span> {principle.example}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5. Practical Examples */}
            {content.practicalExamples && content.practicalExamples.length > 0 && (
              <section id="examples" className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <FileText className="w-4 h-4" />
                  <span>5. Practical Examples & Applications</span>
                </div>
                <div className="space-y-3">
                  {content.practicalExamples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
                    >
                      <div className="text-xs font-semibold text-white">{ex.topic}</div>
                      <div className="text-xs text-slate-300">
                        <span className="font-medium text-slate-400">Scenario:</span> {ex.scenario}
                      </div>
                      <div className="text-xs text-indigo-300 bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-900/30">
                        <span className="font-semibold">Application/Takeaway:</span> {ex.solutionOrTakeaway}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 6. Comparison Tables */}
            {content.comparisonTables && content.comparisonTables.length > 0 && (
              <section id="tables" className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <Table className="w-4 h-4" />
                  <span>6. Comparison Tables</span>
                </div>
                <div className="space-y-4">
                  {content.comparisonTables.map((comp, idx) => (
                    <div key={idx} className="space-y-2">
                      <h4 className="text-xs font-bold text-white">{comp.title}</h4>
                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-900 text-slate-200 font-semibold border-b border-slate-800">
                            <tr>
                              {comp.headers.map((h, hIdx) => (
                                <th key={hIdx} className="p-2.5">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {comp.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-900/40">
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="p-2.5">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 7. Mnemonics & Memory Techniques */}
            {content.mnemonics && content.mnemonics.length > 0 && (
              <section id="mnemonics" className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4" />
                  <span>7. Memory Techniques & Mnemonics</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {content.mnemonics.map((mnem, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/40 space-y-2"
                    >
                      <div className="text-xs font-bold text-white">{mnem.targetConcept}</div>
                      <div className="px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-200 font-mono text-xs font-bold border border-indigo-500/40 inline-block">
                        {mnem.mnemonicText}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{mnem.explanation}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 8. Exam Tips & High-Yield Pitfalls */}
            {content.examTips && content.examTips.length > 0 && (
              <section id="exam-tips" className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <Award className="w-4 h-4" />
                  <span>8. Concepts to Remember for Examinations</span>
                </div>
                <div className="space-y-3">
                  {content.examTips.map((tip, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5"
                    >
                      <div className="text-xs font-bold text-emerald-400">{tip.tip}</div>
                      <div className="text-xs text-slate-300">
                        <span className="font-medium text-slate-400">Examiner Focus:</span> {tip.keyFocus}
                      </div>
                      {tip.commonMistake && (
                        <div className="text-xs text-rose-300 bg-rose-950/20 p-2 rounded-lg border border-rose-900/30">
                          <span className="font-semibold text-rose-400">Common Mistake:</span> {tip.commonMistake}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 9. Vocabulary Glossary */}
            {content.vocabularyGlossary && content.vocabularyGlossary.length > 0 && (
              <section id="glossary" className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <BookOpen className="w-4 h-4" />
                  <span>9. Vocabulary Glossary</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {content.vocabularyGlossary.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-xs font-bold text-white">{item.word}</div>
                      <div className="text-[11px] text-slate-300 mt-1">{item.definition}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: INTERACTIVE AI TUTOR --- */}
      {activeTab === 'tutor' && (
        <div className="max-w-4xl mx-auto rounded-2xl bg-[#0B132B] border border-slate-800 overflow-hidden flex flex-col h-[700px]">
          {/* Tutor Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-300 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Grounded AI Tutor</h3>
                <p className="text-[10px] text-slate-400">Trained strictly on "{material.title}"</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Ready to Help
              </span>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/40 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-slate-500 text-[11px] shrink-0">Quick ask:</span>
            <button
              onClick={() => handleSendTutorMessage('Explain this entire lesson in simple English')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-[11px] shrink-0 transition-colors cursor-pointer"
            >
              Simple English
            </button>
            <button
              onClick={() => handleSendTutorMessage('Teach me the main topic step by step')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-[11px] shrink-0 transition-colors cursor-pointer"
            >
              Step by Step
            </button>
            <button
              onClick={() => handleSendTutorMessage('I-explain ang aralin na ito sa Tagalog / Filipino nang malinaw')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-[11px] shrink-0 transition-colors cursor-pointer"
            >
              🇵🇭 Filipino / Tagalog
            </button>
            <button
              onClick={() => handleSendTutorMessage('I-explain ni nga leksyon sa Bisaya / Cebuano')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-[11px] shrink-0 transition-colors cursor-pointer"
            >
              🇵🇭 Cebuano / Bisaya
            </button>
            <button
              onClick={() => handleSendTutorMessage('Give me 2 practical real-world examples')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-[11px] shrink-0 transition-colors cursor-pointer"
            >
              Practical Examples
            </button>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {tutorMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 flex items-center justify-center shrink-0 mt-1">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="space-y-1 max-w-xl">
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                    } ${tutorSpeakingIdx === idx ? 'ring-2 ring-indigo-400' : ''}`}
                  >
                    {msg.content}

                    {/* Listen to response button */}
                    {msg.role === 'model' && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => speakTutorMsg(idx, msg.content)}
                          className={`text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                            tutorSpeakingIdx === idx
                              ? 'bg-indigo-600 text-white animate-pulse'
                              : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800'
                          }`}
                        >
                          {tutorSpeakingIdx === idx ? (
                            <>
                              <VolumeX className="w-3 h-3" />
                              <span>Stop Audio</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>Listen to Answer</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {tutorLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-indigo-300 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-400 animate-ping" />
                  <span>Consulting lesson material...</span>
                </div>
              </div>
            )}
            <div ref={tutorChatEndRef} />
          </div>

          {/* Active Listening Banner */}
          {tutorListening && (
            <div className="px-4 py-2 bg-indigo-950/60 border-t border-indigo-800/60 text-indigo-200 text-xs flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span>Listening to your voice... Speak your question into the microphone.</span>
              </div>
              <button
                type="button"
                onClick={toggleTutorMic}
                className="px-2 py-0.5 rounded bg-indigo-800 text-white text-[11px]"
              >
                Stop
              </button>
            </div>
          )}

          {/* Input Box */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/60">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendTutorMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* Mic Voice Button */}
              <button
                type="button"
                onClick={toggleTutorMic}
                title={tutorListening ? 'Stop listening' : 'Speak to AI Tutor'}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                  tutorListening
                    ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-md shadow-rose-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700'
                }`}
              >
                {tutorListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={tutorInput}
                onChange={(e) => setTutorInput(e.target.value)}
                placeholder={
                  tutorListening
                    ? 'Listening to speech...'
                    : 'Ask your tutor anything or tap mic to speak...'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!tutorInput.trim() || tutorLoading}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ask</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB 3: PRACTICE QUIZZES --- */}
      {activeTab === 'quiz' && (
        <div className="space-y-6">
          {/* Quiz Controls Header */}
          <div className="p-5 rounded-2xl bg-[#0B132B] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                Practice Examination Center
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate practice exams with multiple choice, true/false, identification, and fill in the blanks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleGenerateNewQuiz('medium')}
                disabled={quizGenerating}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{quizGenerating ? 'Generating...' : 'Generate Standard Quiz'}</span>
              </button>

              <button
                onClick={() => handleGenerateNewQuiz('hard')}
                disabled={quizGenerating}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Hard / Exam-Level
              </button>
            </div>
          </div>

          {/* Active Quiz Player */}
          {activeQuiz ? (
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-6">
              {/* Quiz Info Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">{activeQuiz.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span className="capitalize px-2 py-0.2 rounded bg-slate-800 font-mono text-[10px]">
                      {activeQuiz.difficulty} difficulty
                    </span>
                    <span>•</span>
                    <span>{activeQuiz.questions.length} questions</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsQuizTimed(!isQuizTimed)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isQuizTimed
                        ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {isQuizTimed
                        ? `Timer: ${Math.floor(quizTimerSeconds / 60)}:${String(
                            quizTimerSeconds % 60
                          ).padStart(2, '0')}`
                        : 'Enable Timer'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Post-Submission Results Banner */}
              {quizSubmitted && quizResult && (
                <div
                  className={`p-6 rounded-2xl border space-y-4 ${
                    quizResult.percentage >= 75
                      ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-200'
                      : 'bg-amber-950/20 border-amber-800/60 text-amber-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase font-bold tracking-wider">
                        Quiz Completed
                      </div>
                      <div className="text-2xl font-bold font-mono mt-1">
                        Score: {quizResult.score} / {quizResult.totalQuestions} ({quizResult.percentage}%)
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {quizResult.percentage >= 75
                          ? 'Excellent mastery of this academic lesson!'
                          : 'Review the detailed explanations below to reinforce your weaker areas.'}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setQuizSubmitted(false);
                        setQuizAnswers({});
                        setQuizResult(null);
                        setQuizTimerSeconds(0);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake Quiz</span>
                    </button>
                  </div>

                  {/* Weak Topics */}
                  {quizResult.weakTopics.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/60">
                      <div className="text-xs font-semibold text-rose-300 mb-1">
                        Topics to Review:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {quizResult.weakTopics.map((top, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[11px] bg-rose-950/60 text-rose-300 border border-rose-900/40"
                          >
                            {top}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Question List */}
              <div className="space-y-6">
                {activeQuiz.questions.map((q, idx) => {
                  const studentAns = quizAnswers[q.id] || '';
                  const isAnswered = Boolean(studentAns);
                  const isCorrect = quizResult?.results[q.id];

                  return (
                    <div
                      key={q.id}
                      className={`p-5 rounded-xl border transition-colors space-y-3 ${
                        quizSubmitted
                          ? isCorrect
                            ? 'bg-emerald-950/10 border-emerald-900/40'
                            : 'bg-rose-950/10 border-rose-900/40'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-semibold text-white leading-relaxed">
                          <span className="text-indigo-400 font-mono mr-2">Q{idx + 1}.</span>
                          {q.question}
                        </div>
                        {quizSubmitted && (
                          <div className="shrink-0">
                            {isCorrect ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-rose-400" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Multiple Choice Options */}
                      {q.options && q.options.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          {q.options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className={`flex items-center gap-3 p-2.5 rounded-lg text-xs cursor-pointer border transition-colors ${
                                studentAns === opt
                                  ? 'bg-indigo-600/30 border-indigo-500/60 text-white font-medium'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                              } ${
                                quizSubmitted && opt === q.correctAnswer
                                  ? '!border-emerald-500 !bg-emerald-950/40 !text-emerald-200'
                                  : ''
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                disabled={quizSubmitted}
                                checked={studentAns === opt}
                                onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                                className="text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        /* Text Identification / Fill in blank */
                        <div className="pt-1">
                          <input
                            type="text"
                            disabled={quizSubmitted}
                            value={studentAns}
                            onChange={(e) =>
                              setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })
                            }
                            placeholder="Type your answer here..."
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Detailed Post-Submission Explanation */}
                      {quizSubmitted && (
                        <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs space-y-1">
                          <div className="font-semibold text-emerald-400">
                            Correct Answer: {q.correctAnswer}
                          </div>
                          <p className="text-slate-300 leading-relaxed">{q.explanation}</p>
                          {q.sourceRef && (
                            <div className="text-[11px] text-indigo-300 pt-1">
                              Source Concept: {q.sourceRef}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Quiz Action */}
              {!quizSubmitted && (
                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={Object.keys(quizAnswers).length === 0}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Submit Examination ({Object.keys(quizAnswers).length}/{activeQuiz.questions.length} answered)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-[#0B132B] border border-slate-800 space-y-3">
              <Award className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No practice quizzes generated yet.</p>
              <button
                onClick={() => handleGenerateNewQuiz('medium')}
                disabled={quizGenerating}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl"
              >
                Generate First Quiz
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: FLASHCARDS --- */}
      {activeTab === 'flashcards' && activeDeck && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Deck Controls Header */}
          <div className="p-4 rounded-xl bg-[#0B132B] border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white">{activeDeck.title}</h3>
              <p className="text-[10px] text-slate-400">
                Card {currentCardIndex + 1} of {activeDeck.cards.length} •{' '}
                {activeDeck.cards.filter((c) => c.mastered).length} Mastered
              </p>
            </div>
            <button
              onClick={handleShuffleDeck}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </button>
          </div>

          {/* Flashcard Progress Bar */}
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{
                width: `${((currentCardIndex + 1) / activeDeck.cards.length) * 100}%`,
              }}
            />
          </div>

          {/* 3D Flip Card */}
          {activeDeck.cards[currentCardIndex] ? (
            <div
              onClick={() => setIsCardFlipped(!isCardFlipped)}
              className="h-72 sm:h-80 w-full cursor-pointer perspective-1000 group"
            >
              <div
                className={`w-full h-full rounded-2xl p-6 sm:p-8 flex flex-col justify-between text-center border transition-all duration-300 select-none shadow-xl ${
                  isCardFlipped
                    ? 'bg-[#121c38] border-indigo-500/50 text-white'
                    : 'bg-[#0B132B] border-slate-800 text-slate-100 hover:border-slate-700'
                }`}
              >
                {/* Card Top Category */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono uppercase text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    {activeDeck.cards[currentCardIndex].category || 'Key Concept'}
                  </span>
                  <span>{isCardFlipped ? 'Back (Answer/Definition)' : 'Front (Prompt)'}</span>
                </div>

                {/* Card Main Body */}
                <div className="my-auto space-y-2">
                  <div
                    className={`font-semibold tracking-tight leading-relaxed ${
                      isCardFlipped ? 'text-sm sm:text-base text-slate-200' : 'text-base sm:text-xl text-white'
                    }`}
                  >
                    {isCardFlipped
                      ? activeDeck.cards[currentCardIndex].back
                      : activeDeck.cards[currentCardIndex].front}
                  </div>

                  {showHint && activeDeck.cards[currentCardIndex].hint && (
                    <div className="text-xs text-amber-300 italic pt-2">
                      💡 Hint: {activeDeck.cards[currentCardIndex].hint}
                    </div>
                  )}
                </div>

                {/* Card Bottom Hint Action */}
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="text-[10px]">Click to flip card</span>
                  {activeDeck.cards[currentCardIndex].hint && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHint(!showHint);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 underline"
                    >
                      {showHint ? 'Hide hint' : 'Show hint'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">Deck empty</div>
          )}

          {/* Card Navigation & Mastery Controls */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => {
                if (currentCardIndex > 0) {
                  setCurrentCardIndex((prev) => prev - 1);
                  setIsCardFlipped(false);
                  setShowHint(false);
                }
              }}
              disabled={currentCardIndex === 0}
              className="p-3 rounded-xl bg-[#0B132B] hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleCardMastery(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 border border-rose-900/50 transition-colors cursor-pointer"
              >
                Still Learning
              </button>
              <button
                onClick={() => handleToggleCardMastery(true)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-300 border border-emerald-900/50 transition-colors cursor-pointer"
              >
                Mark Mastered ✓
              </button>
            </div>

            <button
              onClick={() => {
                if (currentCardIndex < activeDeck.cards.length - 1) {
                  setCurrentCardIndex((prev) => prev + 1);
                  setIsCardFlipped(false);
                  setShowHint(false);
                }
              }}
              disabled={currentCardIndex === activeDeck.cards.length - 1}
              className="p-3 rounded-xl bg-[#0B132B] hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
