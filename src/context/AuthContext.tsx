import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  getStudentProfile,
  registerStudentAccount,
  loginWithUsername,
  loginWithGoogleAuth,
  createGoogleStudentProfile,
  logoutUser,
  updateStudentProfile,
  updateStudentProfileDocument,
  changeStudentUsername,
  changeStudentPassword,
} from '../lib/firebase';
import { StudentProfile } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  studentProfile: StudentProfile | null;
  loading: boolean;
  needsGoogleProfileSetup: boolean;
  register: (data: {
    username: string;
    fullName: string;
    courseSection: string;
    password: string;
  }) => Promise<StudentProfile>;
  login: (username: string, password: string) => Promise<StudentProfile>;
  loginWithGoogle: () => Promise<void>;
  completeGoogleProfile: (data: {
    username: string;
    courseSection: string;
  }) => Promise<StudentProfile>;
  logout: () => Promise<void>;
  updateProfile: (data: { fullName: string; courseSection: string }) => Promise<void>;
  updateProfileDocument: (data: { full_name: string; course_section: string }) => Promise<StudentProfile>;
  changeUsername: (newUsername: string) => Promise<string>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsGoogleProfileSetup, setNeedsGoogleProfileSetup] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          let profile = await getStudentProfile(user.uid);
          if (!profile && user.email) {
            // Auto-generate profile from Google Account details so the user can enter directly!
            const defaultUsername = (user.email.split('@')[0] || 'student').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 20) || `user_${user.uid.slice(0, 5)}`;
            const timestamp = new Date().toISOString();
            profile = {
              uid: user.uid,
              username: defaultUsername,
              normalized_username: defaultUsername,
              normalizedUsername: defaultUsername,
              full_name: user.displayName || defaultUsername,
              fullName: user.displayName || defaultUsername,
              course_section: 'GENERAL',
              courseSection: 'GENERAL',
              email: user.email,
              created_at: timestamp,
              createdAt: timestamp,
              updated_at: timestamp,
              updatedAt: timestamp,
            };
            // Attempt to save profile in background, don't block if Firestore is restricted
            try {
              const { doc, setDoc } = await import('firebase/firestore');
              const { db } = await import('../lib/firebase');
              await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
            } catch (saveErr) {
              console.warn('Could not persist Google student profile to Firestore:', saveErr);
            }
          }
          if (profile) {
            setStudentProfile(profile);
            setNeedsGoogleProfileSetup(false);
          } else {
            setStudentProfile(null);
            setNeedsGoogleProfileSetup(true);
          }
        } catch (err) {
          console.error('Error fetching profile for authenticated user:', err);
          setStudentProfile(null);
        }
      } else {
        setStudentProfile(null);
        setNeedsGoogleProfileSetup(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const register = async (data: {
    username: string;
    fullName: string;
    courseSection: string;
    password: string;
  }) => {
    setLoading(true);
    try {
      const profile = await registerStudentAccount(data);
      setStudentProfile(profile);
      setNeedsGoogleProfileSetup(false);
      return profile;
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const profile = await loginWithUsername(username, password);
      setStudentProfile(profile);
      setNeedsGoogleProfileSetup(false);
      return profile;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const { user, profile } = await loginWithGoogleAuth();
      setCurrentUser(user);
      if (profile) {
        setStudentProfile(profile);
        setNeedsGoogleProfileSetup(false);
      } else if (user) {
        const defaultUsername = (user.email?.split('@')[0] || 'student').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 20) || `user_${user.uid.slice(0, 5)}`;
        const timestamp = new Date().toISOString();
        const fallbackProfile: StudentProfile = {
          uid: user.uid,
          username: defaultUsername,
          normalized_username: defaultUsername,
          normalizedUsername: defaultUsername,
          full_name: user.displayName || defaultUsername,
          fullName: user.displayName || defaultUsername,
          course_section: 'GENERAL',
          courseSection: 'GENERAL',
          email: user.email || '',
          created_at: timestamp,
          createdAt: timestamp,
          updated_at: timestamp,
          updatedAt: timestamp,
        };
        setStudentProfile(fallbackProfile);
        setNeedsGoogleProfileSetup(false);
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          await setDoc(doc(db, 'users', user.uid), fallbackProfile, { merge: true });
        } catch (e) {
          console.warn('Could not save Google profile to Firestore:', e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const completeGoogleProfile = async (data: {
    username: string;
    courseSection: string;
  }) => {
    if (!currentUser) throw new Error('No user is currently authenticated.');
    setLoading(true);
    try {
      const profile = await createGoogleStudentProfile({
        uid: currentUser.uid,
        username: data.username,
        fullName: currentUser.displayName || data.username,
        courseSection: data.courseSection,
        email: currentUser.email || '',
      });
      setStudentProfile(profile);
      setNeedsGoogleProfileSetup(false);
      return profile;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setStudentProfile(null);
    setNeedsGoogleProfileSetup(false);
  };

  const updateProfile = async (data: { fullName: string; courseSection: string }) => {
    const effectiveUid = currentUser?.uid || auth.currentUser?.uid || studentProfile?.uid;
    if (!effectiveUid) throw new Error('Not authenticated');
    await updateProfileDocument({
      full_name: data.fullName,
      course_section: data.courseSection,
    });
  };

  const updateProfileDocument = async (data: { full_name: string; course_section: string }) => {
    const effectiveUid = currentUser?.uid || auth.currentUser?.uid || studentProfile?.uid;
    if (!effectiveUid) throw new Error('You must be signed in to update your profile.');
    const updated = await updateStudentProfileDocument(effectiveUid, data);
    setStudentProfile((prev) => {
      const merged = {
        ...(prev || {}),
        ...updated,
        full_name: data.full_name.trim(),
        fullName: data.full_name.trim(),
        course_section: data.course_section.trim().toUpperCase(),
        courseSection: data.course_section.trim().toUpperCase(),
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as StudentProfile;
      return merged;
    });
    return updated;
  };

  const changeUsername = async (newUsername: string) => {
    if (!currentUser || !studentProfile) throw new Error('Not authenticated');
    const updatedUsername = await changeStudentUsername(newUsername);
    const updatedProfile = await getStudentProfile(currentUser.uid);
    if (updatedProfile) {
      setStudentProfile(updatedProfile);
    }
    return updatedUsername;
  };

  const changePassword = async (newPassword: string, currentPassword?: string) => {
    if (!currentUser) throw new Error('Not authenticated');
    await changeStudentPassword(newPassword, currentPassword);
  };

  const refreshProfile = async () => {
    if (currentUser) {
      const profile = await getStudentProfile(currentUser.uid);
      if (profile) setStudentProfile(profile);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        studentProfile,
        loading,
        needsGoogleProfileSetup,
        register,
        login,
        loginWithGoogle,
        completeGoogleProfile,
        logout,
        updateProfile,
        updateProfileDocument,
        changeUsername,
        changePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
