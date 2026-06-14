import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const requireAdminAuthOld = `async function requireAdminAuth(req: any, res: any, next: any) {
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

const requireAdminAuthNew = `async function requireAdminAuth(req: any, res: any, next: any) {
  try {
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
  } catch (err) {
    console.error('requireAdminAuth error:', err);
    return res.status(500).json({ error: 'Erro interno na validação de token.' });
  }
}`;

content = content.replace(requireAdminAuthOld, requireAdminAuthNew);
fs.writeFileSync('server.ts', content);
