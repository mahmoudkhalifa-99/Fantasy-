import { createFirestoreStorage, serviceAccountFromEnv } from './firestoreStorage.js';
import type { Storage } from './logic.js';

// التخزين كله على Firebase Firestore. محتاج FIREBASE_SERVICE_ACCOUNT في Vercel (ملف مفتاح حساب الخدمة JSON كامل).
const sa = serviceAccountFromEnv();

export const storageKind = 'firestore' as const;

const missing = (): never => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT?.trim())
    throw new Error('FIREBASE_SERVICE_ACCOUNT موجود لكن قيمته مش صالحة: لازم تكون محتوى ملف الـ JSON كامل من أول { لآخر } (من غير علامات تنصيص زيادة).');
  throw new Error('FIREBASE_SERVICE_ACCOUNT مش مضبوط في الـ Environment اللي شغال دلوقتي: ضيفه لـ Production وبعدها Redeploy.');
};

export const storage: Storage = sa
  ? createFirestoreStorage(sa)
  : {
      getMain: async () => missing(),
      setMain: async () => missing(),
      getEntries: async () => missing(),
      getEntry: async () => missing(),
      setEntry: async () => missing(),
      getOwner: async () => missing(),
      setOwner: async () => missing(),
    };
