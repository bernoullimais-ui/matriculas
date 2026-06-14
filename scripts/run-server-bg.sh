npx tsx server.ts &
SERVER_PID=$!
sleep 5
curl http://localhost:3000/api/cron/wix-sync
kill $SERVER_PID
