export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDateTime(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function matchGradeOrSeries(classSeries: string, studentGrade: string): boolean {
  if (!classSeries || !studentGrade) return false;

  const sNorm = classSeries.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const gNorm = studentGrade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  // 1. Exact or direct substring match
  if (sNorm === gNorm || sNorm.includes(gNorm) || gNorm.includes(sNorm)) return true;

  // 2. Extract numeric indicator (e.g. 3 from "Grupo 3", "G3", "EI-G3", "3º Ano", "3")
  const extractNum = (str: string) => {
    const match = str.match(/(?:g|grupo|ano|serie|infantil|maternal|\b)(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  };

  const cNum = extractNum(sNorm);
  const gNum = extractNum(gNorm);

  if (cNum === null || gNum === null) return false;

  // 3. Check level compatibility (EI / Infantil / Grupo vs EF / Fundamental / Ano vs EM / Médio)
  const isEI = (str: string) => str.includes('ei') || str.includes('infantil') || str.includes('maternal') || str.includes('grupo') || str.includes('bercario') || str.includes('g');
  const isEF = (str: string) => str.includes('ef') || str.includes('fundamental') || str.includes('ano');
  const isEM = (str: string) => str.includes('em') || str.includes('medio') || str.includes('serie');

  const cEI = isEI(sNorm);
  const gEI = isEI(gNorm);

  const cEF = isEF(sNorm);
  const gEF = isEF(gNorm);

  const cEM = isEM(sNorm);
  const gEM = isEM(gNorm);

  if (cNum === gNum) {
    if (cEI && gEI) return true;
    if (cEF && gEF) return true;
    if (cEM && gEM) return true;
    if (!cEI && !gEI && !cEF && !gEF && !cEM && !gEM) return true;
  }

  return false;
}

