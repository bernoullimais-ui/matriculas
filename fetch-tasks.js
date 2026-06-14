async function fetchTarefas() {
  try {
    const res = await fetch('http://localhost:3000/api/test-tarefas');
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
fetchTarefas();
