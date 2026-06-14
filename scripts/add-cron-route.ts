import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const routeCode = `
// Rota para disparar o cron job manualmente ou via Vercel Cron
app.get('/api/cron/wix-sync', async (req, res) => {
  try {
    // You could add a secret check here if needed, but for now we let it run
    await syncWixRecurringPayments();
    res.json({ success: true, message: 'Wix sync executed' });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});
`;

content = content.replace(/\/\/ Global API error handler/, `${routeCode}\n\n  // Global API error handler`);

fs.writeFileSync('server.ts', content);
console.log('Cron route added');
