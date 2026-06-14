import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Update isAdminAuthenticated to use Supabase Auth state instead of sessionStorage
content = content.replace(
  /const \[isAdminAuthenticated, setIsAdminAuthenticated\] = useState\(\(\) => \{\n\s*\/\/ Restaura sessão do admin ao recarregar a página\n\s*try \{ return !!sessionStorage\.getItem\('admin_token'\); \} catch \{ return false; \}\n\s*\}\);/,
  "const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);\n  const [adminToken, setAdminToken] = useState<string | null>(null);\n\n  useEffect(() => {\n    supabase.auth.getSession().then(({ data: { session } }) => {\n      setIsAdminAuthenticated(!!session);\n      setAdminToken(session?.access_token || null);\n    });\n    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {\n      setIsAdminAuthenticated(!!session);\n      setAdminToken(session?.access_token || null);\n    });\n    return () => subscription.unsubscribe();\n  }, []);"
);

// 2. Update handleAdminLogin
const handleAdminLoginOld = `const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');
    setAdminLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminLogin.username, password: adminLogin.password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        sessionStorage.setItem('admin_token', data.token);
        setIsAdminAuthenticated(true);
        setAdminLogin({ username: '', password: '' });
      } else {
        setAdminLoginError(data.error || 'Credenciais inválidas.');
      }
    } catch (err) {
      console.error('Erro no login do admin:', err);
      setAdminLoginError('Erro de conexão com o servidor. Tente novamente.');
    } finally {
      setAdminLoginLoading(false);
    }
  };`;

const handleAdminLoginNew = `const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');
    setAdminLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: adminLogin.username,
        password: adminLogin.password
      });
      if (error) {
        setAdminLoginError('E-mail ou senha inválidos.');
      } else {
        setAdminLogin({ username: '', password: '' });
      }
    } catch (err) {
      console.error('Erro no login do admin:', err);
      setAdminLoginError('Erro de conexão. Tente novamente.');
    } finally {
      setAdminLoginLoading(false);
    }
  };`;

content = content.replace(handleAdminLoginOld, handleAdminLoginNew);

// 3. Update the logout button onClick
content = content.replace(
  /onClick=\{[^{]*\{\s*sessionStorage\.removeItem\('admin_token'\);\s*setIsAdminAuthenticated\(false\);\s*setAdminLogin\(\{ username: '', password: '' \}\);\s*setAdminLoginError\(''\);\s*\}\}/,
  "onClick={async () => {\n                      await supabase.auth.signOut();\n                      setAdminLogin({ username: '', password: '' });\n                      setAdminLoginError('');\n                    }}"
);

// 4. Update fetch calls to pass adminToken
// 4a. handleFileUpload (fetch(endpoint, ...))
content = content.replace(
  /const response = await fetch\(endpoint, \{\n\s*method: 'POST',\n\s*body: formData,\n\s*\}\);/g,
  "const response = await fetch(endpoint, {\n        method: 'POST',\n        headers: {\n          'Authorization': `Bearer ${adminToken}`\n        },\n        body: formData,\n      });"
);

// 4b. fetch('/api/admin/financial-report')
content = content.replace(
  /const response = await fetch\('\/api\/admin\/financial-report'\);/g,
  "const response = await fetch('/api/admin/financial-report', { headers: { 'Authorization': `Bearer ${adminToken}` } });"
);

content = content.replace(
  /const finResponse = await fetch\('\/api\/admin\/financial-report'\);/g,
  "const finResponse = await fetch('/api/admin/financial-report', { headers: { 'Authorization': `Bearer ${adminToken}` } });"
);

// 4c. fetch('/api/admin/sync-payments', { method: 'POST' })
content = content.replace(
  /const response = await fetch\('\/api\/admin\/sync-payments', \{\n\s*method: 'POST'\n\s*\}\);/g,
  "const response = await fetch('/api/admin/sync-payments', {\n        method: 'POST',\n        headers: {\n          'Authorization': `Bearer ${adminToken}`\n        }\n      });"
);

// 4d. fetch('/api/admin/debug-counts')
content = content.replace(
  /const res = await fetch\('\/api\/admin\/debug-counts'\);/g,
  "const res = await fetch('/api/admin/debug-counts', { headers: { 'Authorization': `Bearer ${adminToken}` } });"
);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx updated.');
