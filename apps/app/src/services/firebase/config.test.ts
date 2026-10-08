import { describe, it, expect } from 'vitest';
import { firebaseConfig, getFirebaseApp, getFirebaseAuth } from './config';

describe('Firebase Configuration & Initializers', () => {
  it('contém os parâmetros oficiais do projeto shappiresticker', () => {
    expect(firebaseConfig.projectId).toBe('shappiresticker');
    expect(firebaseConfig.authDomain).toBe('shappiresticker.firebaseapp.com');
    expect(firebaseConfig.messagingSenderId).toBe('510767186684');
    expect(firebaseConfig.appId).toBe('1:510767186684:web:76a22b3fbed9cf4f024d79');
    expect(firebaseConfig.measurementId).toBe('G-XBFJ5K92XC');
  });

  it('inicializa e retorna a mesma instância de FirebaseApp como singleton', () => {
    const app1 = getFirebaseApp();
    const app2 = getFirebaseApp();
    expect(app1).toBe(app2);
    expect(app1.name).toBe('[DEFAULT]');
  });

  it('inicializa a instância de Auth vinculada ao app', () => {
    const auth = getFirebaseAuth();
    expect(auth.app).toBe(getFirebaseApp());
  });
});
