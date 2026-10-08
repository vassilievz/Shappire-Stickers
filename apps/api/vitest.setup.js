// Variáveis mínimas para os testes rodarem sem .env real.
// Nenhum valor aqui é secreto; V0X e MongoDB nunca são chamados de verdade
// (todos os testes usam mocks — §30 da diretiva).
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shappirestickers-test';
process.env.V0X_API = process.env.V0X_API || 'v0x_live_test_key';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'shappiresticker-test';
process.env.FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || 'test@shappiresticker-test.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY || 'test-private-key';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173,https://localhost';
