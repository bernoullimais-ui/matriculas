const superNormalize = (t) => String(t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();

const p_unidade = ""; // Blank unit
const filtroUnidade = "Escola Dom Pedrinho";

const s1 = superNormalize(p_unidade);
const s2 = superNormalize(filtroUnidade);

console.log("s1:", s1);
console.log("s2:", s2);
console.log("s2.includes(s1):", s2.includes(s1));
console.log("!s2.includes(s1):", !s2.includes(s1));

if (s1 && s2 && s1 !== s2 && !s1.includes(s2) && !s2.includes(s1)) {
    console.log("Current: returned false (filtered out)");
} else {
    console.log("Current: bypassed (KEPT in array)");
}

if (!s1) {
    console.log("Fixed: returned false (filtered out)");
} else if (s1 !== s2 && !s1.includes(s2) && !s2.includes(s1)) {
    console.log("Fixed: returned false (filtered out)");
} else {
    console.log("Fixed: bypassed (KEPT in array)");
}
