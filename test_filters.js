const parseToDate = (dateVal) => {
    if (!dateVal || String(dateVal).trim() === '' || String(dateVal).toLowerCase() === 'null' || String(dateVal) === '0') return null;
    try {
      let s = String(dateVal).trim().toLowerCase();
      if (s.includes(',')) s = s.split(',')[0].trim();
      const slashMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{1,4})/);
      if (slashMatch) {
        const day = parseInt(slashMatch[1]);
        const month = parseInt(slashMatch[2]);
        let year = parseInt(slashMatch[3]);
        if (slashMatch[3].length === 2) year += (year > 70 ? 1900 : 2000);
        else if (slashMatch[3].length === 1) year = 2000 + year;
        return new Date(year, month - 1, day);
      }
      const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) { return null; }
};

const start = parseToDate("2026-06-01");
const end = parseToDate("2026-06-30");
const pDate = parseToDate("25/03/2026,");
console.log({ start, end, pDate, isBefore: pDate < start, isTruthy: !!pDate });
