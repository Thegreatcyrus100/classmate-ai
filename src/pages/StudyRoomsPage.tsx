import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  LogIn,
  Copy,
  Check,
  MessageSquare,
  BookOpen,
  Send,
  FileText,
  Shield,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Crown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getUserStudyRooms,
  createStudyRoom,
  joinStudyRoomByCode,
  getRoomStudyMaterials,
  getRoomMembers,
  subscribeRoomMessages,
  postRoomMessage,
} from '../lib/firebase';
import { StudyRoom, StudyMaterial, RoomMember, RoomMessage } from '../types';

interface StudyRoomsPageProps {
  onOpenMaterial: (materialId: string) => void;
  onUploadToRoom: (roomId: string) => void;
}

export const StudyRoomsPage: React.FC<StudyRoomsPageProps> = ({
  onOpenMaterial,
  onUploadToRoom,
}) => {
  const { studentProfile } = useAuth();

  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<StudyRoom | null>(null);
  const [roomMaterials, setRoomMaterials] = useState<StudyMaterial[]>([]);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Form states
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Copy code indicator
  const [copiedCode, setCopiedCode] = useState(false);

  // Active view inside room
  const [roomViewTab, setRoomViewTab] = useState<'materials' | 'chat' | 'members'>('materials');

  // Load user rooms
  useEffect(() => {
    async function loadRooms() {
      if (!studentProfile) return;
      try {
        setLoading(true);
        const userRooms = await getUserStudyRooms(studentProfile.uid);
        setRooms(userRooms);
        if (userRooms.length > 0 && !selectedRoom) {
          setSelectedRoom(userRooms[0]);
        }
      } catch (err) {
        console.error('Failed to load study rooms:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRooms();
  }, [studentProfile]);

  // Load room details when selected
  useEffect(() => {
    if (!selectedRoom) return;

    let unsubscribeMessages: (() => void) | undefined;

    async function loadRoomContent() {
      try {
        const [mats, members] = await Promise.all([
          getRoomStudyMaterials(selectedRoom!.id),
          getRoomMembers(selectedRoom!.id),
        ]);
        setRoomMaterials(mats);
        setRoomMembers(members);

        // Real-time messages listener
        unsubscribeMessages = subscribeRoomMessages(selectedRoom!.id, (msgs) => {
          setMessages(msgs);
        });
      } catch (err) {
        console.error('Failed to load room content:', err);
      }
    }

    loadRoomContent();

    return () => {
      if (unsubscribeMessages) unsubscribeMessages();
    };
  }, [selectedRoom]);

  // Create Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      setActionError('Please enter a study room name.');
      return;
    }
    if (!studentProfile) {
      setActionError('You must be signed in to create a study room.');
      return;
    }
    setActionError('');
    setActionLoading(true);

    try {
      const roomId = `room_${Date.now()}`;
      // Generate clean 6-char alphanumeric code (e.g. "CS101A")
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const nowIso = new Date().toISOString();
      const studentDisplayName = studentProfile.fullName || studentProfile.full_name || studentProfile.username || 'Student';
      const studentCourse = studentProfile.courseSection || studentProfile.course_section || 'General';

      const newRoom: StudyRoom = {
        id: roomId,
        roomName: newRoomName.trim(),
        code,
        ownerUid: studentProfile.uid,
        ownerName: studentDisplayName,
        description: newRoomDesc.trim() || '',
        memberCount: 1,
        createdAt: nowIso,
      };

      const ownerMember: RoomMember = {
        id: `${roomId}_${studentProfile.uid}`,
        roomId,
        studentUid: studentProfile.uid,
        studentName: studentDisplayName,
        courseSection: studentCourse,
        role: 'owner',
        joinedAt: nowIso,
      };

      await createStudyRoom(newRoom, ownerMember);

      setRooms((prev) => [newRoom, ...prev]);
      setSelectedRoom(newRoom);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomDesc('');
    } catch (err: any) {
      let msg = err.message || 'Failed to create room.';
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error) msg = parsed.error;
      } catch {}
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Join Room by Code
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) {
      setActionError('Please enter an invitation code.');
      return;
    }
    if (!studentProfile) {
      setActionError('You must be signed in to join a study room.');
      return;
    }
    setActionError('');
    setActionLoading(true);

    try {
      const joined = await joinStudyRoomByCode(joinCodeInput, studentProfile);
      setRooms((prev) => {
        const exists = prev.some((r) => r.id === joined.id);
        return exists ? prev : [joined, ...prev];
      });
      setSelectedRoom(joined);
      setShowJoinModal(false);
      setJoinCodeInput('');
    } catch (err: any) {
      let msg = err.message || 'Failed to join room.';
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error) msg = parsed.error;
      } catch {}
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedRoom || !studentProfile) return;

    const msg: RoomMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      roomId: selectedRoom.id,
      senderUid: studentProfile.uid,
      senderName: studentProfile.fullName,
      senderCourse: studentProfile.courseSection,
      content: messageInput.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessageInput('');
    await postRoomMessage(msg);
  };

  const copyInviteCode = () => {
    if (selectedRoom) {
      navigator.clipboard.writeText(selectedRoom.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            Classmate Study Rooms
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create or join collaborative course rooms. Share uploaded files and AI reviewers with classmates instantly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActionError('');
              setShowJoinModal(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Join with Code</span>
          </button>
          <button
            onClick={() => {
              setActionError('');
              setShowCreateModal(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Study Room</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Room List, Right Room Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Joined Rooms List */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Your Study Rooms ({rooms.length})
          </h3>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 rounded-xl bg-[#0B132B] border border-slate-800">
              Loading study rooms...
            </div>
          ) : rooms.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#0B132B] border border-slate-800 space-y-3">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                You haven't joined any study rooms yet.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg"
                >
                  Create Room
                </button>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 rounded-lg"
                >
                  Join Code
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => {
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-950/20'
                        : 'bg-[#0B132B] hover:bg-slate-850 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs text-white truncate">
                        {room.roomName}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                        {room.code}
                      </span>
                    </div>
                    {room.description && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {room.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-2">
                      <span>{room.memberCount || 1} classmates</span>
                      {room.ownerUid === studentProfile?.uid && (
                        <span className="text-amber-400 flex items-center gap-0.5 font-medium">
                          <Crown className="w-3 h-3" /> Owner
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Room Workspace (2 cols) */}
        <div className="lg:col-span-2">
          {selectedRoom ? (
            <div className="rounded-2xl bg-[#0B132B] border border-slate-800 overflow-hidden space-y-4">
              {/* Room Top Header Banner */}
              <div className="p-6 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      {selectedRoom.roomName}
                    </h2>
                    {selectedRoom.ownerUid === studentProfile?.uid && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Owner
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedRoom.description || 'Collaborative study space for coursework'}
                  </p>
                </div>

                {/* Invite Code Badge with 1-Click Copy */}
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Invite Code:</span>
                    <span className="font-mono font-bold text-xs text-indigo-300">
                      {selectedRoom.code}
                    </span>
                    <button
                      onClick={copyInviteCode}
                      title="Copy invite code to share with classmates"
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedCode ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => onUploadToRoom(selectedRoom.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Note</span>
                  </button>
                </div>
              </div>

              {/* Subtabs: Materials vs Chat vs Members */}
              <div className="px-6 flex border-b border-slate-800 gap-4 text-xs font-semibold">
                <button
                  onClick={() => setRoomViewTab('materials')}
                  className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    roomViewTab === 'materials'
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Shared Materials ({roomMaterials.length})</span>
                </button>
                <button
                  onClick={() => setRoomViewTab('chat')}
                  className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    roomViewTab === 'chat'
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Class Discussion ({messages.length})</span>
                </button>
                <button
                  onClick={() => setRoomViewTab('members')}
                  className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    roomViewTab === 'members'
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Classmates ({roomMembers.length})</span>
                </button>
              </div>

              {/* Content Panel */}
              <div className="p-6">
                {/* 1. Shared Materials */}
                {roomViewTab === 'materials' && (
                  <div className="space-y-3">
                    {roomMaterials.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <FileText className="w-6 h-6 mx-auto text-slate-600" />
                        <p>No study materials shared in this room yet.</p>
                        <button
                          onClick={() => onUploadToRoom(selectedRoom.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 inline-block"
                        >
                          Upload First Shared Note
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {roomMaterials.map((mat) => (
                          <div
                            key={mat.id}
                            onClick={() => onOpenMaterial(mat.id)}
                            className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 transition-colors cursor-pointer flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-semibold text-white truncate group-hover:text-indigo-300">
                                  {mat.title}
                                </h4>
                                <p className="text-[10px] text-slate-400">
                                  Uploaded on {new Date(mat.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Class Discussion Board */}
                {roomViewTab === 'chat' && (
                  <div className="space-y-4">
                    <div className="h-80 overflow-y-auto space-y-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                      {messages.length === 0 ? (
                        <div className="text-center py-12 text-xs text-slate-500">
                          No messages yet. Start the study conversation with your classmates!
                        </div>
                      ) : (
                        messages.map((m) => (
                          <div key={m.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-indigo-300">
                                {m.senderName} ({m.senderCourse})
                              </span>
                              <span className="text-slate-500">
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                              {m.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Post a question or comment to the room..."
                        className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!messageInput.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. Classmates List */}
                {roomViewTab === 'members' && (
                  <div className="space-y-2">
                    {roomMembers.map((member) => (
                      <div
                        key={member.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center">
                            {member.studentName[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-white">
                              {member.studentName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {member.courseSection}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${
                            member.role === 'owner'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-slate-500 rounded-2xl bg-[#0B132B] border border-slate-800">
              Select or create a study room to view shared documents and discussions.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Create Room */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Create Study Room</h3>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Room Name</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. BSIT 1-B Software Engineering Study Group"
                  className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="Share notes, reviewers, and exam tips for upcoming midterms."
                  className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newRoomName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Join Room */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Join Study Room</h3>
            <p className="text-xs text-slate-400">
              Enter the 6-character room invitation code provided by your classmate.
            </p>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleJoinRoom} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Invitation Code</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="e.g. AB12CD"
                  className="mt-1 block w-full px-3 py-2.5 text-sm font-mono text-center tracking-widest uppercase rounded-xl bg-slate-900 border border-slate-800 text-indigo-300 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !joinCodeInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {actionLoading ? 'Joining...' : 'Join Study Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
