import admin from 'firebase-admin';
import { env } from './env.js';

/**
 * Inicialização única do Firebase Admin SDK. As credenciais de conta de
 * serviço ficam SOMENTE no backend — nunca no app, no APK ou no Git.
 */
let firebaseAuth = null;

export function getFirebaseAuth() {
  if (firebaseAuth === null) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.firebase.projectId,
          clientEmail: env.firebase.clientEmail,
          privateKey: env.firebase.privateKey,
        }),
      });
    }
    firebaseAuth = admin.auth();
  }
  return firebaseAuth;
}
