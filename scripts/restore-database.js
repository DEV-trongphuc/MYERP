import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backupsDir = path.join(rootDir, 'backups');

const CONFIG = {
  sshKey: 'C:\\Users\\LENOVO\\.ssh\\id_ed25519',
  sshUser: 'vhvxoigh',
  sshHost: 'chiefaiofficer.vn',
  sshPort: '2210',
  dbHost: 'localhost',
  dbUser: 'vhvxoigh_mail_auto',
  dbPass: 'Ideas@812',
  dbName: 'vhvxoigh_myerp',
  remoteGzFile: '/home/vhvxoigh/myerp_backup_latest.sql.gz',
  localGzFile: path.join(backupsDir, 'myerp_backup_latest.sql.gz')
};

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
