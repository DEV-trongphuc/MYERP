import sys
sys.stdout.reconfigure(encoding='utf-8')

phones = ['0931845254', '0988090396', '0866754348', '0932167888', '0397958468', '0928747477', '0969493366', '0346364900', '0948434878']

with open('backups/myerp_backup_latest.sql', 'r', encoding='utf-8', errors='ignore') as f:
    for i, line in enumerate(f):
        for phone in phones:
            if phone in line:
                table = line.split('VALUES')[0][:60] if 'VALUES' in line else line[:60]
                idx = line.find(phone)
                snippet = line[max(0, idx-120):min(len(line), idx+220)]
                print(f"Line {i} [{table.strip()}] - {phone}:\n  {snippet}\n")
