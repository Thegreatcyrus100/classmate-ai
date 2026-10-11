import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { MaterialsListPage } from './pages/MaterialsListPage';
import { StudyMaterialDetailPage } from './pages/StudyMaterialDetailPage';
import { StudyRoomsPage } from './pages/StudyRoomsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ChatbotPage } from './pages/ChatbotPage';
import { GraduationCap } from 'lucide-react';

function MainApp() {
  const { currentUser, studentProfile, loading, needsGoogleProfileSetup } = useAuth();

  // Authentication page switch: 'login' | 'register'
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [uploadTargetRoomId, setUploadTargetRoomId] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B19] flex flex-col items-center justify-center space-y-4 text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
          <GraduationCap className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span>Connecting to ClassMate AI...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated: Show Registration or Login
  if (!currentUser || (!studentProfile && !needsGoogleProfileSetup)) {
    if (authView === 'register') {
      return <RegisterPage onGoToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onGoToRegister={() => setAuthView('register')} />;
  }

  // Handle opening a study material detail view
  const handleOpenMaterial = (materialId: string) => {
    setSelectedMaterialId(materialId);
  };

  const handleBackFromDetail = () => {
    setSelectedMaterialId(null);
  };

  const handleUploadFromRoom = (roomId: string) => {
    setUploadTargetRoomId(roomId);
    setSelectedMaterialId(null);
    setActiveTab('upload');
  };

  const handleMaterialCreated = (materialId: string) => {
    setUploadTargetRoomId(undefined);
    setSelectedMaterialId(materialId);
  };

  const handleTabChange = (tab: NavTab) => {
    setSelectedMaterialId(null);
    setUploadTargetRoomId(undefined);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#070B19] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
        onNavigateProfile={() => handleTabChange('profile')}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleTabChange}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {selectedMaterialId ? (
            <StudyMaterialDetailPage
              materialId={selectedMaterialId}
              onBack={handleBackFromDetail}
            />
          ) : activeTab === 'dashboard' ? (
            <DashboardPage
              onNavigateTab={handleTabChange}
              onOpenMaterial={handleOpenMaterial}
            />
          ) : activeTab === 'upload' ? (
            <UploadPage
              onMaterialCreated={handleMaterialCreated}
              defaultRoomId={uploadTargetRoomId}
            />
          ) : activeTab === 'materials' ? (
            <MaterialsListPage
              onOpenMaterial={handleOpenMaterial}
              onNavigateUpload={() => handleTabChange('upload')}
            />
          ) : activeTab === 'rooms' ? (
            <StudyRoomsPage
              onOpenMaterial={handleOpenMaterial}
              onUploadToRoom={handleUploadFromRoom}
            />
          ) : activeTab === 'chatbot' ? (
            <ChatbotPage />
          ) : activeTab === 'profile' ? (
            <ProfilePage />
          ) : (
            <DashboardPage
              onNavigateTab={handleTabChange}
              onOpenMaterial={handleOpenMaterial}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
