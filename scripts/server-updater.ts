import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// 1. Remove createAdminToken and verifyAdminToken if they exist
content = content.replace(/function createAdminToken[\s\S]*?return jwt\.sign[\s\S]*?\n\}/g, '');
content = content.replace(/function verifyAdminToken[\s\S]*?\n\}/g, '');
content = content.replace(/const JWT_SECRET[\s\S]*?;/g, ''); // just in case there's a standalone secret var

// 2. Remove /api/admin/login and /api/admin/verify endpoints
content = content.replace(/\/\/ Admin Login[\s\S]*?app\.post\('\/api\/admin\/login'[\s\S]*?\}\);/g, '');
content = content.replace(/\/\/ Admin Token Verify[\s\S]*?app\.post\('\/api\/admin\/verify'[\s\S]*?\}\);/g, '');

// 3. Rewrite requireAdminAuth
const requireAdminAuthOld = `function requireAdminAuth(req: any, res: any, next: any) {
  const token = req.headers['x-admin-token'] as string;
  if (!token || !verifyAdminToken(token)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login no painel admin.' });
  }
  next();
}`;

const requireAdminAuthNew = `async function requireAdminAuth(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Faça login no painel admin.' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
  next();
}`;

// If requireAdminAuthOld is not exactly matched, let's just do a generic replace
if (content.includes('function requireAdminAuth(req: any, res: any, next: any) {')) {
  content = content.replace(/function requireAdminAuth\(req: any, res: any, next: any\) \{[\s\S]*?next\(\);\n\}/, requireAdminAuthNew);
} else {
  // if not found, just append it
  content += '\n' + requireAdminAuthNew + '\n';
}

// 4. Apply requireAdminAuth to all /api/admin/* endpoints
// For example: app.post('/api/admin/import' ...
// We can replace `app.post('/api/admin/` with `app.post('/api/admin/', requireAdminAuth, `
// And `app.get('/api/admin/` with `app.get('/api/admin/', requireAdminAuth, `
content = content.replace(/app\.post\('\/api\/admin\/(?!login|verify)/g, "app.post('/api/admin/");
// Wait, a better approach is to use app.use('/api/admin', requireAdminAuth) right before defining the endpoints!
// But there might be other endpoints that were added. Let's see if we can just insert app.use('/api/admin', requireAdminAuth); 

// Find where API Routes start
content = content.replace(/\/\/ API Routes\n/, "// API Routes\napp.use('/api/admin', requireAdminAuth);\n");

fs.writeFileSync('server.ts', content);
console.log('server.ts updated.');
