/**
 * Uso local (com apps/api/.env apontando ao MongoDB desejado):
 *   node scripts/grant-account-benefits.mjs <publicId>
 *
 * Concede Apoiador Inicial + Doador Mensal com expiração distante (benefício permanente de operação).
 */
import dotenv from 'dotenv';
import dns from 'node:dns';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { INITIAL_SUPPORTER_BADGE } from '@shappire/contracts';
import { User } from '../src/models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PERMANENT_DONOR_EXPIRY = new Date('2099-12-31T23:59:59.000Z');

async function main() {
  const publicId = process.argv[2]?.trim();
  if (!publicId) {
    console.error('Informe o publicId: node scripts/grant-account-benefits.mjs <publicId>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI ausente em apps/api/.env');
    process.exit(1);
  }

  const dnsServers = (process.env.DNS_SERVERS ?? '8.8.8.8,8.8.4.4,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (dnsServers.length > 0) {
    dns.setServers(dnsServers);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20_000 });

  const doc = await User.findOne({ publicId });
  if (!doc) {
    console.error(`Nenhum usuário com publicId=${publicId}`);
    process.exit(1);
  }

  doc.monthlyDonorExpiresAt = PERMANENT_DONOR_EXPIRY;
  if (!Array.isArray(doc.badges)) {
    doc.badges = [];
  }
  if (!doc.badges.includes(INITIAL_SUPPORTER_BADGE)) {
    doc.badges.push(INITIAL_SUPPORTER_BADGE);
  }
  await doc.save();

  console.log(
    JSON.stringify(
      {
        ok: true,
        firebaseUid: doc.firebaseUid,
        publicId: doc.publicId,
        email: doc.email,
        badges: doc.badges,
        monthlyDonorExpiresAt: doc.monthlyDonorExpiresAt.toISOString(),
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
