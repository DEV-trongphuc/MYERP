import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backupsDir = path.join(rootDir, 'backups');

function loadEnvMap(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key) map[key] = val;
  }
  return map;
}

const envVars = {
  ...loadEnvMap(path.join(rootDir, '.env')),
  ...loadEnvMap(path.join(rootDir, 'backend/.env')),
  ...loadEnvMap(path.join(rootDir, 'backend/.env.local')),
  ...process.env
};

const CONFIG = {
  sshKey: envVars.BACKUP_SSH_KEY || envVars.SSH_KEY || path.join(os.homedir(), '.ssh', 'id_ed25519'),
  sshUser: envVars.BACKUP_SSH_USER || envVars.SSH_USER || 'vhvxoigh',
  sshHost: envVars.BACKUP_SSH_HOST || envVars.SSH_HOST || 'chiefaiofficer.vn',
  sshPort: envVars.BACKUP_SSH_PORT || envVars.SSH_PORT || '2210',
  dbHost: envVars.DB_HOST || 'localhost',
  dbUser: envVars.DB_USER || '',
  dbPass: envVars.DB_PASS || '',
  dbName: envVars.DB_NAME || 'vhvxoigh_myerp',
  remoteGzFile: envVars.BACKUP_REMOTE_FILE || '/home/vhvxoigh/myerp_backup_latest.sql.gz',
  localGzFile: path.join(backupsDir, 'myerp_backup_latest.sql.gz')
};

if (!CONFIG.dbUser || !CONFIG.dbPass) {
  console.error('\x1b[31m%s\x1b[0m', '❌ Thiếu DB_USER hoặc DB_PASS trong backend/.env hoặc biến môi trường.');
  process.exit(1);
}

async function askConfirmation(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim().toLowerCase());
  }));
}

async function main() {
  console.log('\x1b[31m%s\x1b[0m', '=========================================================');
  console.log('\x1b[31m%s\x1b[0m', '   CẢNH BÁO: TIẾN TRÌNH KHÔI PHỤC DATABASE MYERP');
  console.log('\x1b[31m%s\x1b[0m', '=========================================================');
  console.log('Thao tác này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại trên database: ' + CONFIG.dbName);
  console.log('bằng bản sao lưu: ' + CONFIG.localGzFile);

  const isForce = process.argv.includes('--force') || process.argv.includes('-y');

  if (!isForce) {
    const answer = await askConfirmation('\nBạn có CHẮC CHẮN muốn khôi phục database không? (nhập "yes" để tiếp tục): ');
    if (answer !== 'yes' && answer !== 'y') {
      console.log('\x1b[33m%s\x1b[0m', 'Đã hủy thao tác khôi phục database.');
      process.exit(0);
    }
  }

  // 1. Upload local backup to server if local file exists
  if (fs.existsSync(CONFIG.localGzFile)) {
    console.log('\x1b[33m%s\x1b[0m', '\n[1/2] Đồng bộ file backup từ local lên server...');
    const scpArgs = [
      '-i', CONFIG.sshKey,
      '-4',
      '-B',
      '-P', CONFIG.sshPort,
      '-o', 'StrictHostKeyChecking=no',
      CONFIG.localGzFile,
      `${CONFIG.sshUser}@${CONFIG.sshHost}:${CONFIG.remoteGzFile}`
    ];
    const scpRes = spawnSync('scp', scpArgs, { stdio: 'inherit' });
    if (scpRes.status !== 0) {
      console.error('\x1b[31m%s\x1b[0m', '❌ Lỗi khi tải file backup lên server!');
      process.exit(1);
    }
  }

  // 2. Import into MySQL
  console.log('\x1b[33m%s\x1b[0m', '\n[2/2] Đang giải nén và nạp dữ liệu vào database...');
  const restoreCmd = `gunzip < ${CONFIG.remoteGzFile} | mysql -u ${CONFIG.dbUser} -p'${CONFIG.dbPass}' --default-character-set=utf8mb4 ${CONFIG.dbName}`;
  const sshArgs = [
    '-i', CONFIG.sshKey,
    '-4',
    '-p', CONFIG.sshPort,
    '-o', 'StrictHostKeyChecking=no',
    `${CONFIG.sshUser}@${CONFIG.sshHost}`,
    restoreCmd
  ];

  const restoreRes = spawnSync('ssh', sshArgs, { stdio: 'inherit' });
  if (restoreRes.status !== 0) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Lỗi khi import database!');
    process.exit(1);
  }

  console.log('\n\x1b[32m%s\x1b[0m', '=========================================================');
  console.log('\x1b[32m%s\x1b[0m', '🎉 KHÔI PHỤC DATABASE THÀNH CÔNG 100%!');
  console.log('\x1b[32m%s\x1b[0m', '   Dữ liệu hệ thống đã được hoàn nguyên về bản backup chuẩn.');
  console.log('\x1b[32m%s\x1b[0m', '=========================================================');
}

main().catch(err => {
  console.error('\x1b[31m%s\x1b[0m', 'Lỗi khôi phục database:', err);
  process.exit(1);
});
