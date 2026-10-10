import { Publication } from '../models/Publication.js';
import { Follow } from '../models/Follow.js';
import { Like } from '../models/Like.js';
import { Comment } from '../models/Comment.js';
import { CollectionEntry } from '../models/CollectionEntry.js';
import { UserBlock } from '../models/UserBlock.js';
import { Report } from '../models/Report.js';

/**
 * Sincroniza índices declarados nos schemas (idempotente; não remove índices legados).
 * Desative com SYNC_MONGOOSE_INDEXES=false se necessário em ambientes sensíveis.
 */
export async function ensureSocialIndexes() {
  if (process.env.SYNC_MONGOOSE_INDEXES === 'false') return;
  const models = [Publication, Follow, Like, Comment, CollectionEntry, UserBlock, Report];
  for (const model of models) {
    await model.syncIndexes();
  }
  console.log('[mongo] índices sociais sincronizados');
}
