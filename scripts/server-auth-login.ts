import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const loginRoutes = `
// API Routes
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }
    return res.json({ token: data.session.access_token });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno no login.' });
  }
});

app.post('/api/admin/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ valid: false });
    }
    return res.json({ valid: true });
  } catch (err) {
    return res.status(500).json({ valid: false });
  }
});

app.use('/api/admin', requireAdminAuth);
`;

content = content.replace(/\/\/ API Routes\napp\.use\('\/api\/admin', requireAdminAuth\);/, loginRoutes);

fs.writeFileSync('server.ts', content);
console.log('Login routes added to server.ts');
