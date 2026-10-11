import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  UploadCloud,
  Search,
  ArrowRight,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserStudyMaterials, deleteStudyMaterial } from '../lib/firebase';
import { StudyMaterial } from '../types';

interface MaterialsListPageProps {
  onOpenMaterial: (materialId: string) => void;
  onNavigateUpload: () => void;
}

export const MaterialsListPage: React.FC<MaterialsListPageProps> = ({
  onOpenMaterial,
  onNavigateUpload,
}) => {
  const { studentProfile } = useAuth();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!studentProfile) return;
      try {
        setLoading(true);
        const data = await getUserStudyMaterials(studentProfile.uid);
        setMaterials(data);
      } catch (err) {
        console.error('Error fetching study materials:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentProfile]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this study material?')) return;
    if (studentProfile) {
      await deleteStudyMaterial(id, studentProfile.uid);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.originalFileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            Study Materials & Reviewers
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access your analyzed lecture notes, generated reviewers, quizzes, and flashcards.
          </p>
        </div>

        <button
          onClick={onNavigateUpload}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search materials by title or filename..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0B132B] border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Materials List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 rounded-xl bg-[#0B132B] border border-slate-800">
          Loading study materials...
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0B132B] border border-slate-800 space-y-3">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-white">
            {searchQuery ? 'No materials match your search' : 'No study materials yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? 'Try searching with different keywords.'
              : 'Upload your first document to generate structured reviewers, flashcards, and exams.'}
          </p>
          {!searchQuery && (
            <button
              onClick={onNavigateUpload}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl"
            >
              Upload First Document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMaterials.map((mat) => (
            <div
              key={mat.id}
              onClick={() => onOpenMaterial(mat.id)}
              className="p-5 rounded-2xl bg-[#0B132B] hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer flex flex-col justify-between group space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                      {mat.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {mat.originalFileName}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDelete(e, mat.id)}
                  title="Delete"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-mono uppercase text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                    {mat.fileType.split('/')[1] || 'DOC'}
                  </span>
                  <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                  {mat.roomId && (
                    <span className="text-amber-400 text-[10px] bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-900/40">
                      Room
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                  <span>Open Reviewer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
