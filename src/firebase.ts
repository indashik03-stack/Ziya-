import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: Required for named database */
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
    }
  };
  console.warn('Firestore Error Context:', JSON.stringify(errInfo));
}

// Connection validation
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface VoiceLogRecord {
  id?: string;
  command: string;
  response: string;
  language: string;
  action?: string;
  createdAt: string;
}

export async function saveVoiceLog(record: Omit<VoiceLogRecord, 'createdAt'>) {
  const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const data: VoiceLogRecord = {
    ...record,
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'voice_logs', logId), data);
    console.log('[Firebase] Voice interaction logged to Firestore:', logId);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'voice_logs/' + logId);
  }
}

export interface SystemSettingsRecord {
  isWifiOn: boolean;
  isBluetoothOn: boolean;
  isMobileDataOn: boolean;
  isFlashlightOn?: boolean;
  brightness: number;
  volume: number;
  activeLanguage: string;
  liquidGlassStyle?: 'clear' | 'tinted';
  backgroundScanActive?: boolean;
  updatedAt?: string;
}

export async function syncSystemSettings(settings: SystemSettingsRecord) {
  const settingId = 'default_controls';
  const payload = {
    ...settings,
    updatedAt: new Date().toISOString()
  };
  try {
    await setDoc(doc(db, 'system_settings', settingId), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'system_settings/' + settingId);
  }
}

export async function fetchSystemSettings(): Promise<SystemSettingsRecord | null> {
  const settingId = 'default_controls';
  try {
    const snap = await getDoc(doc(db, 'system_settings', settingId));
    if (snap.exists()) {
      return snap.data() as SystemSettingsRecord;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'system_settings/' + settingId);
  }
  return null;
}

export function subscribeToRecentVoiceLogs(callback: (logs: VoiceLogRecord[]) => void) {
  const q = query(collection(db, 'voice_logs'), orderBy('createdAt', 'desc'), limit(15));
  return onSnapshot(q, (snapshot) => {
    const logs: VoiceLogRecord[] = [];
    snapshot.forEach(docSnap => {
      logs.push({ id: docSnap.id, ...(docSnap.data() as VoiceLogRecord) });
    });
    callback(logs);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'voice_logs');
  });
}
