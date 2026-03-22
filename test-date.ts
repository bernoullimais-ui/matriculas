const formatDate = (dateStr: any) => {
  if (!dateStr) return null;
  let s = String(dateStr).trim();
  if (!s) return null;
  
  // Remove time part if present
  s = s.split(/\s+/)[0];
  
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  
  // Try DD/MM/YYYY or MM/DD/YYYY or YYYY/MM/DD
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    let day, month, year;
    if (parts[0].length === 4) { // YYYY/MM/DD
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else if (parts[2].length === 4 || parts[2].length === 2) { // DD/MM/YYYY or MM/DD/YYYY
      day = parts[0];
      month = parts[1];
      year = parts[2];
      if (year && year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      
      // Basic heuristic for DD/MM vs MM/DD
      if (month && day && parseInt(month) > 12 && parseInt(day) <= 12) {
        [day, month] = [month, day];
      }
    }
    
    if (day && month && year) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return null;
};

const formatTimestamp = (tsStr: any) => {
  if (!tsStr) return null;
  const s = String(tsStr).trim();
  if (!s) return null;

  // If it's already in YYYY-MM-DD HH:MM:SS or ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    if (s.length === 10) return `${s} 00:00:00`;
    return s.replace('T', ' ').substring(0, 19);
  }
  
  // Try DD/MM/YYYY HH:MM:SS
  const parts = s.split(/\s+/);
  const datePart = formatDate(parts[0]);
  if (datePart) {
    let timePart = parts[1] || '00:00:00';
    // Ensure timePart is HH:MM:SS
    const timeParts = timePart.split(':');
    if (timeParts.length === 2) timePart += ':00';
    return `${datePart} ${timePart}`;
  }
  
  return null;
};

console.log(formatTimestamp("06/02/2026, 13:48:20"));
