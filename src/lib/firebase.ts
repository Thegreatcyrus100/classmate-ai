import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile as updateAuthProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  StudentProfile,
  StudyMaterial,
  Reviewer,
  Quiz,
  QuizAttempt,
  FlashcardDeck,
  StudyRoom,
  RoomMember,
  RoomMessage,
} from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore (uses default database or custom ID if specified)
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Recursively strips undefined fields to guarantee Firestore compatibility
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => (value === undefined ? null : value))
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Normalize username: lowercase, trimmed
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsernameFormat(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

// Convert username to Firebase Auth email alias
export function usernameToAuthEmail(normalizedUsername: string): string {
  return `${normalizedUsername}@classmate.internal`;
}

// --- STUDENT PROFILE HELPERS ---

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const normalized = normalizeUsername(username);
  if (!isValidUsernameFormat(normalized)) {
    throw new Error('Username must be 3-30 characters with letters, numbers, and underscores only.');
  }
  const usernameDoc = await getDoc(doc(db, 'usernames', normalized));
  return !usernameDoc.exists();
}

export async function registerStudentAccount(params: {
  username: string;
  fullName: string;
  courseSection: string;
  password: string;
}): Promise<StudentProfile> {
  const { username, fullName, courseSection, password } = params;
  const normalized = normalizeUsername(username);

  if (!isValidUsernameFormat(normalized)) {
    throw new Error('Username must be 3-30 characters with letters, numbers, and underscores only.');
  }
  if (!fullName.trim() || fullName.trim().length < 2) {
    throw new Error('Full Name must be at least 2 characters.');
  }
  if (!courseSection.trim()) {
    throw new Error('Course / Section is required (e.g. BSIT-1B).');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  // Pre-check username availability
  const isAvailable = await checkUsernameAvailability(normalized);
  if (!isAvailable) {
    throw new Error(`The username "${username}" is already taken. Please choose another.`);
  }

  const authEmail = usernameToAuthEmail(normalized);

  // Create authentication account in Firebase Auth
  let userCredential;
  try {
    userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
  } catch (authErr: any) {
    if (authErr.code === 'auth/email-already-in-use') {
      throw new Error(`The username "${username}" is already in use.`);
    }
    if (authErr.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use a stronger password.');
    }
    if (authErr.code === 'auth/operation-not-allowed') {
      throw new Error('Email/Password provider is not enabled in Firebase Console. Please enable it in Firebase Authentication or use Google Sign-In.');
    }
    throw new Error(authErr.message || 'Failed to create student account.');
  }

  const uid = userCredential.user.uid;
  const timestamp = new Date().toISOString();

  // Update Auth Profile Display Name
  try {
    await updateAuthProfile(userCredential.user, { displayName: fullName.trim() });
  } catch (e) {
    console.warn('Could not update auth display name:', e);
  }

  const cleanFullName = fullName.trim();
  const cleanCourse = courseSection.trim().toUpperCase();

  const profile: StudentProfile = {
    uid,
    username: username.trim(),
    normalized_username: normalized,
    normalizedUsername: normalized,
    full_name: cleanFullName,
    fullName: cleanFullName,
    course_section: cleanCourse,
    courseSection: cleanCourse,
    email: authEmail,
    created_at: timestamp,
    createdAt: timestamp,
    updated_at: timestamp,
    updatedAt: timestamp,
  };

  // Transactionally reserve username & create student profile
  try {
    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, 'usernames', normalized);
      const userRef = doc(db, 'users', uid);

      const existingUsernameDoc = await transaction.get(usernameRef);
      if (existingUsernameDoc.exists()) {
        throw new Error(`The username "${username}" was just registered by another student.`);
      }

      transaction.set(usernameRef, {
        username: normalized,
        uid,
        createdAt: timestamp,
      });

      transaction.set(userRef, profile);
    });
  } catch (txErr: any) {
    // If saving profile failed, attempt rollback of auth user
    try {
      await userCredential.user.delete();
    } catch (delErr) {
      console.warn('Rollback auth user failed:', delErr);
    }
    throw new Error(txErr.message || 'Failed to complete student profile registration.');
  }

  return profile;
}

export async function loginWithUsername(username: string, password: string): Promise<StudentProfile> {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    throw new Error('Please enter your username.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  // Lookup username mapping to ensure existence and fetch student UID
  let targetUid = '';
  try {
    const usernameDoc = await getDoc(doc(db, 'usernames', normalized));
    if (usernameDoc.exists()) {
      targetUid = usernameDoc.data().uid;
    }
  } catch (err) {
    console.warn('Username lookup notice:', err);
  }

  // Authenticate against Firebase Authentication with the mapped email
  const authEmail = usernameToAuthEmail(normalized);

  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, authEmail, password);
  } catch (err: any) {
    if (
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/wrong-password' ||
      err.code === 'auth/invalid-email'
    ) {
      throw new Error('Invalid username or password. Please verify your credentials.');
    }
    if (err.code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Please wait a moment and try again.');
    }
    throw new Error(err.message || 'Unable to sign in. Please try again.');
  }

  const effectiveUid = targetUid || userCredential.user.uid;
  const profile = await getStudentProfile(effectiveUid);
  if (!profile) {
    throw new Error('Student profile record not found. Please contact support.');
  }
  return profile;
}

export async function loginWithGoogleAuth(): Promise<{ user: FirebaseUser; profile: StudentProfile | null }> {
  const result = await signInWithPopup(auth, googleProvider);
  const profile = await getStudentProfile(result.user.uid);
  return { user: result.user, profile };
}

export async function createGoogleStudentProfile(params: {
  uid: string;
  username: string;
  fullName: string;
  courseSection: string;
  email?: string;
}): Promise<StudentProfile> {
  const { uid, username, fullName, courseSection, email } = params;
  const normalized = normalizeUsername(username);

  if (!isValidUsernameFormat(normalized)) {
    throw new Error('Username must be 3-30 characters with letters, numbers, and underscores only.');
  }
  if (!fullName.trim() || fullName.trim().length < 2) {
    throw new Error('Full Name must be at least 2 characters.');
  }
  if (!courseSection.trim()) {
    throw new Error('Course / Section is required.');
  }

  const isAvailable = await checkUsernameAvailability(normalized);
  if (!isAvailable) {
    throw new Error(`The username "${username}" is already taken.`);
  }

  const timestamp = new Date().toISOString();
  const cleanFullName = fullName.trim();
  const cleanCourse = courseSection.trim().toUpperCase();

  const profile: StudentProfile = {
    uid,
    username: username.trim(),
    normalized_username: normalized,
    normalizedUsername: normalized,
    full_name: cleanFullName,
    fullName: cleanFullName,
    course_section: cleanCourse,
    courseSection: cleanCourse,
    email: email || '',
    created_at: timestamp,
    createdAt: timestamp,
    updated_at: timestamp,
    updatedAt: timestamp,
  };

  await runTransaction(db, async (transaction) => {
    const usernameRef = doc(db, 'usernames', normalized);
    const userRef = doc(db, 'users', uid);

    const existingUsername = await transaction.get(usernameRef);
    if (existingUsername.exists()) {
      throw new Error(`The username "${username}" is already taken.`);
    }

    transaction.set(usernameRef, {
      username: normalized,
      uid,
      createdAt: timestamp,
    });
    transaction.set(userRef, profile);
  });

  return profile;
}

export async function getStudentProfile(uid: string): Promise<StudentProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const fullName = data.full_name || data.fullName || '';
      const courseSection = data.course_section || data.courseSection || '';
      const username = data.username || '';
      const normalizedUsername = data.normalized_username || data.normalizedUsername || username.toLowerCase();
      const createdAt = data.created_at || data.createdAt || new Date().toISOString();
      const updatedAt = data.updated_at || data.updatedAt || createdAt;

      return {
        uid,
        username,
        normalized_username: normalizedUsername,
        normalizedUsername,
        full_name: fullName,
        fullName,
        course_section: courseSection,
        courseSection,
        email: data.email || '',
        created_at: createdAt,
        createdAt,
        updated_at: updatedAt,
        updatedAt,
      };
    }
    return null;
  } catch (error) {
    console.warn(`Profile for user ${uid} not found or not yet created:`, error);
    return null;
  }
}

// Update full_name and course_section fields in Firestore profile document
export async function updateStudentProfileDocument(
  uid: string,
  fields: { full_name: string; course_section: string }
): Promise<StudentProfile> {
  const cleanFullName = fields.full_name.trim();
  const cleanCourse = fields.course_section.trim().toUpperCase();

  if (!cleanFullName || cleanFullName.length < 2) {
    throw new Error('Full Name must be at least 2 characters.');
  }
  if (!cleanCourse) {
    throw new Error('Course / Section is required (e.g. BSIT-1B).');
  }

  const timestamp = new Date().toISOString();
  let clientUpdateSuccess = false;

  // 1. Try client-side Firestore setDoc
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        uid,
        full_name: cleanFullName,
        fullName: cleanFullName,
        course_section: cleanCourse,
        courseSection: cleanCourse,
        updated_at: timestamp,
        updatedAt: timestamp,
      },
      { merge: true }
    );
    clientUpdateSuccess = true;
  } catch (clientErr) {
    console.warn('Client-side Firestore profile update notice:', clientErr);
  }

  // 2. Always trigger server-side REST update as well or as fallback for guaranteed persistence
  try {
    await fetch('/api/auth/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        fullName: cleanFullName,
        courseSection: cleanCourse,
      }),
    });
  } catch (serverErr) {
    console.warn('Server fallback update notice:', serverErr);
  }

  // 3. Update auth display name if matching current user
  if (auth.currentUser && auth.currentUser.uid === uid) {
    try {
      await updateAuthProfile(auth.currentUser, { displayName: cleanFullName });
    } catch (e) {
      console.warn('Could not update auth display name:', e);
    }
  }

  // 4. Retrieve fresh profile or assemble updated object
  try {
    const updated = await getStudentProfile(uid);
    if (updated) return updated;
  } catch (getErr) {
    console.warn('Could not re-fetch profile after update:', getErr);
  }

  return {
    uid,
    username: auth.currentUser?.displayName || '',
    normalized_username: (auth.currentUser?.displayName || '').toLowerCase(),
    normalizedUsername: (auth.currentUser?.displayName || '').toLowerCase(),
    full_name: cleanFullName,
    fullName: cleanFullName,
    course_section: cleanCourse,
    courseSection: cleanCourse,
    email: auth.currentUser?.email || '',
    created_at: timestamp,
    createdAt: timestamp,
    updated_at: timestamp,
    updatedAt: timestamp,
  };
}

// Check username uniqueness using server-side mechanism and update atomically
export async function changeStudentUsername(newUsername: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('User is not authenticated.');

  const trimmed = newUsername.trim();
  const newNormalized = normalizeUsername(trimmed);

  if (!isValidUsernameFormat(newNormalized)) {
    throw new Error('Username must be 3-30 characters with letters, numbers, and underscores only.');
  }

  // 1. Check uniqueness using the server-side endpoint
  const checkRes = await fetch('/api/auth/check-username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: trimmed, currentUid: user.uid }),
  });

  if (!checkRes.ok) {
    const err = await checkRes.json();
    throw new Error(err.error || 'Server error checking username availability.');
  }

  const checkData = await checkRes.json();
  if (!checkData.available) {
    throw new Error(checkData.error || `Username "${trimmed}" is already taken.`);
  }

  const currentProfile = await getStudentProfile(user.uid);
  const oldNormalized = currentProfile?.normalized_username || currentProfile?.normalizedUsername || '';

  if (oldNormalized === newNormalized) {
    return trimmed; // No change needed
  }

  const timestamp = new Date().toISOString();

  // 2. Transactionally update usernames registry and user document
  await runTransaction(db, async (tx) => {
    const newUsernameRef = doc(db, 'usernames', newNormalized);
    const existingNew = await tx.get(newUsernameRef);
    if (existingNew.exists() && existingNew.data()?.uid !== user.uid) {
      throw new Error(`The username "${trimmed}" is already registered by another student.`);
    }

    if (oldNormalized && oldNormalized !== newNormalized) {
      const oldUsernameRef = doc(db, 'usernames', oldNormalized);
      tx.delete(oldUsernameRef);
    }

    tx.set(newUsernameRef, {
      username: newNormalized,
      uid: user.uid,
      createdAt: timestamp,
    });

    const userRef = doc(db, 'users', user.uid);
    tx.set(
      userRef,
      {
        username: trimmed,
        normalized_username: newNormalized,
        normalizedUsername: newNormalized,
        updated_at: timestamp,
        updatedAt: timestamp,
      },
      { merge: true }
    );
  });

  // 3. Update auth email alias if applicable
  try {
    const newEmail = usernameToAuthEmail(newNormalized);
    await updateEmail(user, newEmail);
  } catch (emailErr) {
    console.warn('Could not update auth email alias during username change:', emailErr);
  }

  return trimmed;
}

// Update password using Firebase Authentication SDK
export async function changeStudentPassword(newPassword: string, currentPassword?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('User is not authenticated.');

  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }

  // If current password provided, re-authenticate with Firebase Auth
  if (currentPassword && user.email) {
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
    } catch (authErr: any) {
      if (
        authErr.code === 'auth/wrong-password' ||
        authErr.code === 'auth/invalid-credential'
      ) {
        throw new Error('Current password is incorrect. Please check and try again.');
      }
      throw new Error(authErr.message || 'Re-authentication failed.');
    }
  }

  // Call Firebase Authentication SDK's updatePassword
  try {
    await updatePassword(user, newPassword);
  } catch (err: any) {
    if (err.code === 'auth/requires-recent-login') {
      throw new Error('For security, please enter your current password to verify your identity.');
    }
    if (err.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please choose a stronger password.');
    }
    throw new Error(err.message || 'Failed to update password.');
  }
}

export async function updateStudentProfile(uid: string, updates: Partial<StudentProfile>): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        uid,
        ...updates,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// --- STUDY MATERIALS HELPERS ---

export async function saveStudyMaterial(material: StudyMaterial): Promise<void> {
  try {
    await setDoc(doc(db, 'studyMaterials', material.id), cleanFirestoreData(material));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `studyMaterials/${material.id}`);
  }
}

export async function getStudyMaterial(id: string): Promise<StudyMaterial | null> {
  try {
    const docSnap = await getDoc(doc(db, 'studyMaterials', id));
    if (docSnap.exists()) {
      return docSnap.data() as StudyMaterial;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `studyMaterials/${id}`);
    return null;
  }
}

export async function deleteStudyMaterial(id: string, uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'studyMaterials', id));
    // Also cleanup associated reviewers if existing
    const revQuery = query(collection(db, 'reviewers'), where('materialId', '==', id));
    const revSnaps = await getDocs(revQuery);
    revSnaps.forEach((d) => deleteDoc(d.ref));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `studyMaterials/${id}`);
  }
}

export async function getUserStudyMaterials(uid: string): Promise<StudyMaterial[]> {
  try {
    const q = query(collection(db, 'studyMaterials'), where('ownerUid', '==', uid));
    const querySnapshot = await getDocs(q);
    const materials: StudyMaterial[] = [];
    querySnapshot.forEach((doc) => {
      materials.push(doc.data() as StudyMaterial);
    });
    return materials.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'studyMaterials');
    return [];
  }
}

export async function getRoomStudyMaterials(roomId: string): Promise<StudyMaterial[]> {
  try {
    const q = query(collection(db, 'studyMaterials'), where('roomId', '==', roomId));
    const querySnapshot = await getDocs(q);
    const materials: StudyMaterial[] = [];
    querySnapshot.forEach((doc) => {
      materials.push(doc.data() as StudyMaterial);
    });
    return materials.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'studyMaterials');
    return [];
  }
}

// --- REVIEWERS HELPERS ---

export async function saveReviewer(reviewer: Reviewer): Promise<void> {
  try {
    await setDoc(doc(db, 'reviewers', reviewer.id), cleanFirestoreData(reviewer));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reviewers/${reviewer.id}`);
  }
}

export async function getReviewerByMaterial(materialId: string): Promise<Reviewer | null> {
  try {
    const q = query(collection(db, 'reviewers'), where('materialId', '==', materialId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as Reviewer;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'reviewers');
    return null;
  }
}

export async function getReviewer(id: string): Promise<Reviewer | null> {
  try {
    const docSnap = await getDoc(doc(db, 'reviewers', id));
    if (docSnap.exists()) {
      return docSnap.data() as Reviewer;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `reviewers/${id}`);
    return null;
  }
}

export async function getUserReviewers(uid: string): Promise<Reviewer[]> {
  try {
    const q = query(collection(db, 'reviewers'), where('ownerUid', '==', uid));
    const querySnapshot = await getDocs(q);
    const reviewers: Reviewer[] = [];
    querySnapshot.forEach((doc) => {
      reviewers.push(doc.data() as Reviewer);
    });
    return reviewers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'reviewers');
    return [];
  }
}

// --- QUIZZES & ATTEMPTS HELPERS ---

export async function saveQuiz(quiz: Quiz): Promise<void> {
  try {
    await setDoc(doc(db, 'quizzes', quiz.id), cleanFirestoreData(quiz));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `quizzes/${quiz.id}`);
  }
}

export async function getQuizzesByMaterial(materialId: string): Promise<Quiz[]> {
  try {
    const q = query(collection(db, 'quizzes'), where('materialId', '==', materialId));
    const querySnapshot = await getDocs(q);
    const quizzes: Quiz[] = [];
    querySnapshot.forEach((doc) => {
      quizzes.push(doc.data() as Quiz);
    });
    return quizzes;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'quizzes');
    return [];
  }
}

export async function saveQuizAttempt(attempt: QuizAttempt): Promise<void> {
  try {
    await setDoc(doc(db, 'quizAttempts', attempt.id), attempt);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `quizAttempts/${attempt.id}`);
  }
}

export async function getUserQuizAttempts(uid: string): Promise<QuizAttempt[]> {
  try {
    const q = query(collection(db, 'quizAttempts'), where('studentUid', '==', uid));
    const querySnapshot = await getDocs(q);
    const attempts: QuizAttempt[] = [];
    querySnapshot.forEach((doc) => {
      attempts.push(doc.data() as QuizAttempt);
    });
    return attempts.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'quizAttempts');
    return [];
  }
}

// --- FLASHCARD DECKS HELPERS ---

export async function saveFlashcardDeck(deck: FlashcardDeck): Promise<void> {
  try {
    await setDoc(doc(db, 'flashcardDecks', deck.id), cleanFirestoreData(deck));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `flashcardDecks/${deck.id}`);
  }
}

export async function updateFlashcardDeck(deckId: string, cards: FlashcardDeck['cards']): Promise<void> {
  try {
    await updateDoc(doc(db, 'flashcardDecks', deckId), {
      cards,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `flashcardDecks/${deckId}`);
  }
}

export async function getFlashcardsByMaterial(materialId: string): Promise<FlashcardDeck[]> {
  try {
    const q = query(collection(db, 'flashcardDecks'), where('materialId', '==', materialId));
    const querySnapshot = await getDocs(q);
    const decks: FlashcardDeck[] = [];
    querySnapshot.forEach((doc) => {
      decks.push(doc.data() as FlashcardDeck);
    });
    return decks;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'flashcardDecks');
    return [];
  }
}

export async function getUserFlashcardDecks(uid: string): Promise<FlashcardDeck[]> {
  try {
    const q = query(collection(db, 'flashcardDecks'), where('ownerUid', '==', uid));
    const querySnapshot = await getDocs(q);
    const decks: FlashcardDeck[] = [];
    querySnapshot.forEach((doc) => {
      decks.push(doc.data() as FlashcardDeck);
    });
    return decks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'flashcardDecks');
    return [];
  }
}

// --- STUDY ROOMS HELPERS ---

export async function createStudyRoom(room: StudyRoom, member: RoomMember): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'studyRooms', room.id), cleanFirestoreData(room));
    batch.set(doc(db, 'roomMembers', member.id), cleanFirestoreData(member));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `studyRooms/${room.id}`);
  }
}

export async function joinStudyRoomByCode(code: string, student: StudentProfile): Promise<StudyRoom> {
  const cleanCode = code.trim().toUpperCase();
  const q = query(collection(db, 'studyRooms'), where('code', '==', cleanCode));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Study room not found with invitation code: ' + cleanCode);
  }

  const room = querySnapshot.docs[0].data() as StudyRoom;
  const memberId = `${room.id}_${student.uid}`;

  // Check if already member
  const memberDoc = await getDoc(doc(db, 'roomMembers', memberId));
  if (memberDoc.exists()) {
    return room;
  }

  const newMember: RoomMember = {
    id: memberId,
    roomId: room.id,
    studentUid: student.uid,
    studentName: student.fullName,
    courseSection: student.courseSection,
    role: 'member',
    joinedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'roomMembers', memberId), newMember);
  await updateDoc(doc(db, 'studyRooms', room.id), {
    memberCount: (room.memberCount || 1) + 1,
  });

  return room;
}

export async function getUserStudyRooms(uid: string): Promise<StudyRoom[]> {
  try {
    const memberQuery = query(collection(db, 'roomMembers'), where('studentUid', '==', uid));
    const memberSnaps = await getDocs(memberQuery);
    const roomIds: string[] = [];
    memberSnaps.forEach((doc) => {
      roomIds.push((doc.data() as RoomMember).roomId);
    });

    if (roomIds.length === 0) return [];

    const rooms: StudyRoom[] = [];
    for (const rId of roomIds) {
      const roomSnap = await getDoc(doc(db, 'studyRooms', rId));
      if (roomSnap.exists()) {
        rooms.push(roomSnap.data() as StudyRoom);
      }
    }
    return rooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'studyRooms');
    return [];
  }
}

export async function getRoomDetails(roomId: string): Promise<StudyRoom | null> {
  try {
    const roomSnap = await getDoc(doc(db, 'studyRooms', roomId));
    if (roomSnap.exists()) {
      return roomSnap.data() as StudyRoom;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `studyRooms/${roomId}`);
    return null;
  }
}

export async function getRoomMembers(roomId: string): Promise<RoomMember[]> {
  try {
    const q = query(collection(db, 'roomMembers'), where('roomId', '==', roomId));
    const snaps = await getDocs(q);
    const members: RoomMember[] = [];
    snaps.forEach((d) => members.push(d.data() as RoomMember));
    return members;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'roomMembers');
    return [];
  }
}

export async function postRoomMessage(message: RoomMessage): Promise<void> {
  try {
    await setDoc(doc(db, 'roomMessages', message.id), message);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `roomMessages/${message.id}`);
  }
}

export function subscribeRoomMessages(roomId: string, callback: (messages: RoomMessage[]) => void) {
  const q = query(collection(db, 'roomMessages'), where('roomId', '==', roomId));
  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: RoomMessage[] = [];
      snapshot.forEach((d) => msgs.push(d.data() as RoomMessage));
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      callback(msgs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'roomMessages');
    }
  );
}
