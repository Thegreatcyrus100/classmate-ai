import React from 'react';
import { ShieldCheck, X, FileText, CheckCircle2, AlertTriangle, BookOpen, Lock } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const TermsModal: React.FC<TermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  showAcceptButton = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0B132B] border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Terms & Conditions
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v2.0 Academic
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">ClassMate AI Academic Integrity & User Agreement</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-indigo-200 text-xs flex items-start gap-2.5">
            <BookOpen className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
            <span>
              ClassMate AI is built specifically to foster deeper learning, active recall, and collegiate collaboration. By using our platform, you commit to honest, ethical academic practice.
            </span>
          </div>

          {/* Section 1 */}
          <div className="space-y-1.5">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-slate-800 text-indigo-400 flex items-center justify-center text-[10px] font-bold">1</span>
              Academic Integrity & Non-Cheating Policy
            </h4>
            <p className="pl-7 text-slate-300">
              ClassMate AI is designed exclusively as an educational study aid, reviewer generator, and active recall examination assistant. Users agree not to use AI-generated answers, solvers, or tutors during live, proctored examinations or in violation of their institution's academic honesty policy.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-1.5">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-slate-800 text-indigo-400 flex items-center justify-center text-[10px] font-bold">2</span>
              Multimodal Document Processing
            </h4>
            <p className="pl-7 text-slate-300">
              Uploaded academic materials (PDFs, Word documents, slide decks, spreadsheets, notes, and photos) are analyzed by Google Gemini multimodal models strictly to synthesize summaries, study reviewers, and quiz questions. Documents are never sold, redistributed, or used for commercial advertising.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-1.5">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-slate-800 text-indigo-400 flex items-center justify-center text-[10px] font-bold">3</span>
              Data Privacy & Account Protection
            </h4>
            <p className="pl-7 text-slate-300">
              Your student password is secure and handled via Firebase Authentication. Your study materials remain private to your personal library unless you deliberately publish or share them within a Classmate Study Room.
            </p>
          </div>

          {/* Section 4 */}
          <div className="space-y-1.5">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-slate-800 text-indigo-400 flex items-center justify-center text-[10px] font-bold">4</span>
              Classmate Study Rooms & Collaboration
            </h4>
            <p className="pl-7 text-slate-300">
              When collaborating in study rooms, students agree to maintain respectful, constructive, and collegiate communication. Harassment, inappropriate language, and unauthorized distribution of confidential examination papers are strictly prohibited.
            </p>
          </div>

          {/* Section 5 */}
          <div className="space-y-1.5">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-slate-800 text-indigo-400 flex items-center justify-center text-[10px] font-bold">5</span>
              Content Ownership & Profile Control
            </h4>
            <p className="pl-7 text-slate-300">
              You retain ownership of your uploaded notes. You may update your full name, course/section, or username at any time through the Edit Profile page, and delete materials or sign out whenever desired.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/70 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>

          {showAcceptButton && onAccept && (
            <button
              type="button"
              onClick={() => {
                onAccept();
                onClose();
              }}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>I Agree & Accept Terms</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
