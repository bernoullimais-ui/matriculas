const ano_escolar = "2º ano do Ensino Fundamental";
let searchNorm = ano_escolar.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/ ensino /g, " ")
  .replace(/do /g, "")
  .replace(/da /g, "")
  .replace(/º/g, "o")
  .replace(/ª/g, "a")
  .trim();
console.log("searchNorm:", searchNorm);

const s = "2º ANO FUNDAMENTAL";
let sNorm = s.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/ ensino /g, " ")
  .replace(/do /g, "")
  .replace(/da /g, "")
  .replace(/º/g, "o")
  .replace(/ª/g, "a")
  .trim();
console.log("sNorm:", sNorm);

console.log("match?", sNorm.includes(searchNorm) || searchNorm.includes(sNorm));
