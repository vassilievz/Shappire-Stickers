import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'android');
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

const result = spawnSync(gradlew, ['assembleDebug', '--console=plain'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
