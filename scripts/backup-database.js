import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

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
  localGzFile: path.join(backupsDir, 'myerp_backup_latest.sql.gz'),
  localSqlFile: path.join(backupsDir, 'myerp_backup_latest.sql')
};

if (!CONFIG.dbUser || !CONFIG.dbPass) {
  console.error('\x1b[31m%s\x1b[0m', '❌ Thiếu DB_USER hoặc DB_PASS trong backend/.env hoặc biến môi trường.');
  process.exit(1);
}

async function main() {
  console.log('\x1b[36m%s\x1b[0m', '=========================================================');
  console.log('\x1b[36m%s\x1b[0m', '   MYERP AUTOMATED DATABASE BACKUP PIPELINE');
  console.log('\x1b[36m%s\x1b[0m', '=========================================================');

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // 1. Trigger mysqldump and gzip on server (replaces previous backup on server to save disk space)
  console.log('\x1b[33m%s\x1b[0m', '\n[1/3] Trích xuất & nén database trên server (tự động thay thế bản cũ)...');
  const dumpCmd = `mysqldump -u ${CONFIG.dbUser} -p'${CONFIG.dbPass}' ` +
    `--single-transaction --quick --max_allowed_packet=512M ` +
    `--routines --triggers --default-character-set=utf8mb4 --add-drop-table ` +
    `${CONFIG.dbName} | gzip > ${CONFIG.remoteGzFile}`;

  const sshDumpArgs = [
    '-i', CONFIG.sshKey,
    '-4',
    '-p', CONFIG.sshPort,
    '-o', 'StrictHostKeyChecking=no',
    `${CONFIG.sshUser}@${CONFIG.sshHost}`,
    dumpCmd
  ];

  const dumpResult = spawnSync('ssh', sshDumpArgs, { stdio: 'inherit' });
  if (dumpResult.status !== 0) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Lỗi khi thực hiện mysqldump trên remote server!');
    process.exit(1);
  }
  console.log('\x1b[32m%s\x1b[0m', '  ✔ Đã tạo bản nén gzip mới và ghi đè bản cũ trên server thành công.');

  // 2. Download gzip backup directly via SSH stream with real-time progress
  console.log('\x1b[33m%s\x1b[0m', '\n[2/3] Đang tải bản backup nén về thư mục local backups/...');
  const catProcess = spawn('ssh', [
    '-i', CONFIG.sshKey,
    '-4',
    '-p', CONFIG.sshPort,
    '-o', 'StrictHostKeyChecking=no',
    `${CONFIG.sshUser}@${CONFIG.sshHost}`,
    `cat ${CONFIG.remoteGzFile}`
  ]);

  let downloadedBytes = 0;
  catProcess.stdout.on('data', chunk => {
    downloadedBytes += chunk.length;
    const mb = (downloadedBytes / (1024 * 1024)).toFixed(2);
    process.stdout.write(`\r  -> Đã tải: ${mb} MB...`);
  });

  const fileWriteStream = fs.createWriteStream(CONFIG.localGzFile);
  await pipeline(catProcess.stdout, fileWriteStream);
  process.stdout.write('\n');

  const gzStats = fs.statSync(CONFIG.localGzFile);
  const gzSizeMB = (gzStats.size / (1024 * 1024)).toFixed(2);
  console.log('\x1b[32m%s\x1b[0m', `  ✔ Tải về hoàn tất: ${CONFIG.localGzFile} (${gzSizeMB} MB)`);

  // 3. Decompress to local .sql for instant verification & inspection
  console.log('\x1b[33m%s\x1b[0m', '\n[3/3] Đang giải nén ra file .sql hoàn chỉnh để sẵn sàng khôi phục...');
  const readStream = fs.createReadStream(CONFIG.localGzFile);
  const gunzip = zlib.createGunzip();
  const writeStream = fs.createWriteStream(CONFIG.localSqlFile);

  await pipeline(readStream, gunzip, writeStream);

  const sqlStats = fs.statSync(CONFIG.localSqlFile);
  const sqlSizeMB = (sqlStats.size / (1024 * 1024)).toFixed(2);
  console.log('\x1b[32m%s\x1b[0m', `  ✔ Giải nén thành công: ${CONFIG.localSqlFile} (${sqlSizeMB} MB)`);

  console.log('\n\x1b[36m%s\x1b[0m', '=========================================================');
  console.log('\x1b[32m%s\x1b[0m', '🎉 BACKUP DATABASE THÀNH CÔNG VÀ SẴN SÀNG KHÔI PHỤC!');
  console.log('   - File nén server: ' + CONFIG.remoteGzFile);
  console.log('   - File nén local:  ' + CONFIG.localGzFile + ` (${gzSizeMB} MB)`);
  console.log('   - File SQL local:  ' + CONFIG.localSqlFile + ` (${sqlSizeMB} MB)`);
  console.log('   - Khi cần khôi phục, chỉ cần chạy: \x1b[33mnpm run restore:db\x1b[0m');
  console.log('\x1b[36m%s\x1b[0m', '=========================================================');
}

main().catch(err => {
  console.error('\x1b[31m%s\x1b[0m', 'Fatal error during backup:', err);
  process.exit(1);
});
