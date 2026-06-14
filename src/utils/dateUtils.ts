/**
 * Utilitários para tratamento seguro de Fuso Horário e Datas
 * Resolve o problema de datas "voltando 1 dia" ou horas saltando devido ao fuso UTC-3.
 */

/**
 * Exibe a data no formato DD/MM/AAAA de forma segura.
 * Se receber apenas YYYY-MM-DD, exibe o dia exato recebido.
 * Se receber um timestamp, formata localmente.
 */
export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  
  // Se for apenas a data (YYYY-MM-DD), quebra e exibe diretamente para evitar -3h do UTC
  if (dateStr.length === 10 && dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

/**
 * Converte um timestamp UTC que vem do banco para o formato local exigido pelos inputs `datetime-local`
 * Retorna no formato YYYY-MM-DDThh:mm
 */
export function formatUTCtoLocalInput(utcString: string | null | undefined): string {
  if (!utcString) return '';
  try {
    const d = new Date(utcString);
    if (isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000; // Offset em milissegundos
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  } catch {
    return '';
  }
}

/**
 * Retorna a data de "hoje" no fuso local no formato YYYY-MM-DD.
 * Resolve o bug de retornar "amanhã" se a ação for feita muito tarde da noite.
 */
export function getTodayDateString(): string {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
}
