@"
#!/bin/bash
set -e

cd /app/backend
uvicorn main:app --host 0.0.0.0 --port 8000 &

cd /app
npx next start -p 3000 &

wait -n
exit $?
"@ | Out-File -FilePath start.sh -Encoding utf8 -NoNewline