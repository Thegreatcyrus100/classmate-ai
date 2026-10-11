import React, { useEffect, useState } from 'react';
import {
  UploadCloud,
  BookOpen,
  Award,
  Layers,
  Users,
  ArrowRight,
  Clock,
  Sparkles,
  FileText,
  Calendar,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getUserStudyMaterials,
  getUserReviewers,
  getUserQuizAttempts,
  getUserFlashcardDecks,
  getUserStudyRooms,
} from '../lib/firebase';
import { StudyMaterial, Reviewer, QuizAttempt, FlashcardDeck, StudyRoom } from '../types';

interface DashboardPageProps {
  onNavigateTab: (tab: any) => void;
  onOpenMaterial: (materialId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateTab,
  onOpenMaterial,
}) => {
  const { studentProfile } = useAuth();

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeck[]>([]);
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!studentProfile) return;
      try {
        setLoading(true);
        const [mats, revs, quizzes, decks, studyRooms] = await Promise.all([
          getUserStudyMaterials(studentProfile.uid),
          getUserReviewers(studentProfile.uid),
          getUserQuizAttempts(studentProfile.uid),
          getUserFlashcardDecks(studentProfile.uid),
          getUserStudyRooms(studentProfile.uid),
        ]);

        setMaterials(mats);
        setReviewers(revs);
        setQuizAttempts(quizzes);
        setFlashcardDecks(decks);
        setRooms(studyRooms);
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [studentProfile]);

  // Derived real statistics
  const totalMaterials = materials.length;
  const totalQuizzesTaken = quizAttempts.length;
  const averageScore =
    quizAttempts.length > 0
      ? Math.round(
          quizAttempts.reduce((acc, curr) => acc + curr.percentage, 0) / quizAttempts.length
        )
      : 0;

  const totalFlashcardCount = flashcardDecks.reduce(
    (acc, deck) => acc + (deck.cards?.length || 0),
    0
  );
  const totalMasteredCards = flashcardDecks.reduce(
    (acc, deck) => acc + (deck.cards?.filter((c) => c.mastered).length || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-[#131d38] to-[#0f172a] border border-slate-800 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Academic Dashboard
              </span>
              <span className="text-xs text-slate-400">
                {studentProfile?.courseSection}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome back, {studentProfile?.fullName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Upload your lecture notes, presentations, or handouts. Gemini will instantly generate an in-depth reviewer, flashcards, practice quizzes, and prepare you for your exams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigateTab('upload')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Document</span>
            </button>
            <button
              onClick={() => onNavigateTab('rooms')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Study Rooms</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0B132B] border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Study Materials</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalMaterials}</div>
          <div className="text-[11px] text-slate-400 mt-1">Uploaded & analyzed</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B132B] border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Quizzes Taken</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalQuizzesTaken}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalQuizzesTaken > 0 ? `Avg score: ${averageScore}%` : 'No attempts yet'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B132B] border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Flashcards</span>
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalFlashcardCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalMasteredCards} mastered
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B132B] border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Study Rooms</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{rooms.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Active class groups</div>
        </div>
      </div>

      {/* Main Content Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Study Materials (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Recent Academic Documents & Reviewers
            </h2>
            {materials.length > 0 && (
              <button
                onClick={() => onNavigateTab('materials')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-8 rounded-xl bg-[#0B132B] border border-slate-800 text-center">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400">Loading your academic records...</p>
            </div>
          ) : materials.length === 0 ? (
            /* Proper Empty State Required By Prompt */
            <div className="p-8 sm:p-12 rounded-xl bg-[#0B132B] border border-slate-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">No study materials yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Upload your first document to begin. We support PDF, DOCX, PPTX, TXT, CSV, and image notes.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('upload')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload First Document</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {materials.slice(0, 5).map((mat) => (
                <div
                  key={mat.id}
                  onClick={() => onOpenMaterial(mat.id)}
                  className="p-4 rounded-xl bg-[#0B132B] hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                        {mat.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono uppercase text-[10px] bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                          {mat.fileType.split('/')[1] || 'DOC'}
                        </span>
                        <span>•</span>
                        <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                        {mat.roomId && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400 text-[10px] bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-900/40">
                              Shared in Room
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Reviewer Ready
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Quiz Performance & Joined Rooms */}
        <div className="space-y-6">
          {/* Quiz Performance Widget */}
          <div className="p-5 rounded-xl bg-[#0B132B] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Recent Practice Examinations
              </h3>
            </div>

            {quizAttempts.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No quiz results yet. Take a quiz from any analyzed reviewer!
              </div>
            ) : (
              <div className="space-y-2.5">
                {quizAttempts.slice(0, 3).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-semibold text-white truncate">
                        {attempt.materialTitle}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(attempt.completedAt).toLocaleDateString()} • {attempt.score}/{attempt.totalQuestions} items
                      </div>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                        attempt.percentage >= 75
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                          : 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                      }`}
                    >
                      {attempt.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Study Rooms Widget */}
          <div className="p-5 rounded-xl bg-[#0B132B] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Your Study Rooms
              </h3>
              <button
                onClick={() => onNavigateTab('rooms')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Join / Create
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No study rooms joined. Connect with classmates to collaborate!
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.slice(0, 3).map((room) => (
                  <div
                    key={room.id}
                    onClick={() => onNavigateTab('rooms')}
                    className="p-3 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-slate-800 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {room.roomName}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Code: <span className="font-mono text-indigo-300">{room.code}</span> • {room.memberCount || 1} members
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
