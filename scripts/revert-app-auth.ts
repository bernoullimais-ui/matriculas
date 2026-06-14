import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Revert the supabase session useEffect
content = content.replace(
  /const \[isAdminAuthenticated, setIsAdminAuthenticated\] = useState\(false\);\n\s*const \[adminToken, setAdminToken\] = useState<string \| null>\(null\);\n\n\s*useEffect\(\(\) => \{\n\s*supabase\.auth\.getSession[\s\S]*?subscription\.unsubscribe\(\);\n\s*\}, \[\]\);/,
  "const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {\n    try { return !!sessionStorage.getItem('admin_token'); } catch { return false; }\n  });\n  const adminToken = sessionStorage.getItem('admin_token');"
);

// Revert handleAdminLogin
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

const handleAdminLoginOld = `const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');
    setAdminLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminLogin.username, password: adminLogin.password })
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

content = content.replace(handleAdminLoginNew, handleAdminLoginOld);

// Revert the logout button
content = content.replace(
  /onClick=\{async \(\) => \{\n\s*await supabase\.auth\.signOut\(\);\n\s*setAdminLogin\(\{ username: '', password: '' \}\);\n\s*setAdminLoginError\(''\);\n\s*\}\}/,
  "onClick={() => {\n                      sessionStorage.removeItem('admin_token');\n                      setIsAdminAuthenticated(false);\n                      setAdminLogin({ username: '', password: '' });\n                      setAdminLoginError('');\n                    }}"
);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx reverted.');
