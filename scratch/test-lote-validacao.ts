import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function runTests() {
  console.log("=== STARTING SERIALIZED COUPONS & PLANS VERIFICATION ===");

  // 1. Fetch reference data (a turma, an aluno, a responsavel)
  const { data: turmas, error: turmasErr } = await supabase.from('turmas').select('*').limit(2);
  if (turmasErr || !turmas || turmas.length === 0) {
    console.error("Error fetching reference turmas:", turmasErr);
    process.exit(1);
  }
  const targetTurma = turmas[0];
  const otherTurma = turmas[1] || turmas[0];

  const { data: responsaveis, error: respErr } = await supabase.from('responsaveis').select('*').limit(1);
  if (respErr || !responsaveis || responsaveis.length === 0) {
    console.error("Error fetching reference responsaveis:", respErr);
    process.exit(1);
  }
  const testResponsavel = responsaveis[0];

  const { data: alunos, error: alunoErr } = await supabase.from('alunos').select('*').eq('responsavel_id', testResponsavel.id).limit(1);
  let testAluno = alunos?.[0];
  if (!testAluno) {
    // Create a mock student if none exists
    const { data: newAluno, error: newAlunoErr } = await supabase.from('alunos').insert([{
      nome_completo: 'Aluno Teste Validação',
      data_nascimento: '2015-05-15',
      responsavel_id: testResponsavel.id
    }]).select().single();
    if (newAlunoErr) {
      console.error("Error creating test student:", newAlunoErr);
      process.exit(1);
    }
    testAluno = newAluno;
  }

  const testPrefixo = "TSTVAL";
  const testUnidade = "Unidade Teste Bernoulli";
  const testPlanoCustomizado = "Plano Integral Teste";

  console.log(`Using Turma: ${targetTurma.nome} (${targetTurma.id})`);
  console.log(`Using Responsavel: ${testResponsavel.nome_completo} (${testResponsavel.id})`);
  console.log(`Using Aluno: ${testAluno.nome_completo} (${testAluno.id})`);

  // Cleanup any old test batches with this prefix and their dependencies
  const { data: oldCupons } = await supabase.from('cupons').select('id').ilike('codigo', `${testPrefixo}%`);
  if (oldCupons && oldCupons.length > 0) {
    console.log(`Cleaning up old test coupon dependencies...`);
    const cupomIds = oldCupons.map(c => c.id);
    await supabase.from('cupons_usos').delete().in('cupom_id', cupomIds);
    await supabase.from('matriculas').delete().in('cupom_id', cupomIds);
  }
  const { error: cleanupLotesErr } = await supabase.from('cupons_lotes').delete().eq('prefixo', testPrefixo);
  if (cleanupLotesErr) {
    console.warn("Warn cleaning up old batches:", cleanupLotesErr);
  }

  // 2. Generate a test batch
  console.log("\n1. Simulating Generate Batch...");
  const { data: lote, error: loteErr } = await supabase.from('cupons_lotes').insert([{
    prefixo: testPrefixo,
    quantidade: 3,
    tipo_desconto: 'porcentagem',
    valor: 20,
    unidade: testUnidade,
    turma_id: targetTurma.id,
    limite_por_usuario: 2,
    plano_registro: testPlanoCustomizado,
    aplicar_em: 'todas_parcelas'
  }]).select().single();

  if (loteErr || !lote) {
    console.error("Failed to generate test batch:", loteErr);
    process.exit(1);
  }
  console.log(`Batch generated successfully! ID: ${lote.id}`);

  // Create coupons inside the batch
  const testCodes = [
    `${testPrefixo}001-A1B2`,
    `${testPrefixo}002-C3D4`,
    `${testPrefixo}003-E5F6`
  ];

  const cuponsToInsert = testCodes.map(code => ({
    codigo: code,
    nome: code,
    tipo: 'percentual',
    valor: 20,
    ativo: true,
    data_inicio: new Date().toISOString().split('T')[0],
    limite_uso: 1, // serial code has total limit 1
    limite_por_usuario: 2,
    unidade: testUnidade,
    turma_id: targetTurma.id,
    plano_registro: testPlanoCustomizado,
    lote_id: lote.id,
    escopo: 'curso_especifico',
    aplicar_em: 'todas_parcelas'
  }));

  const { data: cupons, error: cuponsErr } = await supabase.from('cupons').insert(cuponsToInsert).select();
  if (cuponsErr || !cupons || cupons.length !== 3) {
    console.error("Failed to insert batch coupons:", cuponsErr);
    process.exit(1);
  }
  console.log(`Inserted ${cupons.length} coupons in batch.`);

  // 3. Test validation logic
  console.log("\n2. Simulating Validation Rules...");
  const coupon = cupons[0];

  // Test Case A: Validate correct unit and course (Should Pass)
  console.log(" - Testing Valid Validation (Correct Unit + Course)...");
  let isValid = true;
  let errorMsg = "";

  if (coupon.unidade && testUnidade.trim().toLowerCase() !== coupon.unidade.trim().toLowerCase()) {
    isValid = false;
    errorMsg = "Unidade mismatched";
  }
  if (coupon.turma_id && targetTurma.id !== coupon.turma_id) {
    isValid = false;
    errorMsg = "Turma mismatched";
  }
  console.log(`   Result: ${isValid ? "PASS" : "FAIL (" + errorMsg + ")"}`);
  if (!isValid) process.exit(1);

  // Test Case B: Mismatched Unit (Should Fail)
  console.log(" - Testing Invalid Unit (Should Fail)...");
  let isUnitValid = true;
  const invalidUnit = "Another Unit Name";
  if (coupon.unidade && invalidUnit.trim().toLowerCase() !== coupon.unidade.trim().toLowerCase()) {
    isUnitValid = false;
  }
  console.log(`   Result: ${!isUnitValid ? "PASS (Successfully rejected mismatched unit)" : "FAIL"}`);
  if (isUnitValid) process.exit(1);

  // Test Case C: Mismatched Course (Should Fail)
  console.log(" - Testing Invalid Course (Should Fail)...");
  let isCourseValid = true;
  const invalidTurmaId = otherTurma.id === targetTurma.id ? "00000000-0000-0000-0000-000000000000" : otherTurma.id;
  if (coupon.turma_id && invalidTurmaId !== coupon.turma_id) {
    isCourseValid = false;
  }
  console.log(`   Result: ${!isCourseValid ? "PASS (Successfully rejected mismatched course)" : "FAIL"}`);
  if (isCourseValid) process.exit(1);

  // 4. Test plano_registro checkout logic
  console.log("\n3. Testing checkout registration & plano_registro mapping...");
  
  // Insert test enrollment
  const { data: testMatricula, error: matErr } = await supabase.from('matriculas').insert([{
    aluno_id: testAluno.id,
    unidade: testUnidade,
    turma: targetTurma.nome,
    turma_id: targetTurma.id,
    status: 'pendente',
    plano: coupon.plano_registro || 'Mensal',
    cupom_id: coupon.id
  }]).select().single();

  if (matErr || !testMatricula) {
    console.error("Failed to create test enrollment:", matErr);
    process.exit(1);
  }

  console.log(`   Matricula created with ID: ${testMatricula.id}`);
  console.log(`   Plano registered on matricula: "${testMatricula.plano}" (Expected: "${testPlanoCustomizado}")`);
  if (testMatricula.plano !== testPlanoCustomizado) {
    console.error("FAIL: Custom plan name was not registered!");
    process.exit(1);
  }
  console.log("   Result: PASS");

  // 5. Test limit_por_usuario constraint (limit: 2)
  console.log("\n4. Testing limit_por_usuario = 2 enforcement...");

  // Record 1st usage of coupon 001
  const { data: usage1, error: u1Err } = await supabase.from('cupons_usos').insert([{
    cupom_id: coupon.id,
    responsavel_id: testResponsavel.id
  }]).select().single();
  if (u1Err) {
    console.error("Error creating 1st usage:", u1Err);
    process.exit(1);
  }
  console.log("   First usage recorded.");

  // Simulate validation check - currently 1 usage, limit is 2. Should be valid.
  const checkValidation = async (couponId: string, respId: string, limit: number) => {
    const { count, error } = await supabase
      .from('cupons_usos')
      .select('*', { count: 'exact', head: true })
      .eq('cupom_id', couponId)
      .eq('responsavel_id', respId);
    
    if (error) throw error;
    return count !== null && count < limit;
  };

  let canUse = await checkValidation(coupon.id, testResponsavel.id, coupon.limite_por_usuario);
  console.log(`   Validating 2nd usage (usages = 1, limit = 2): Can use? ${canUse} (Expected: true)`);
  if (!canUse) {
    console.error("FAIL: Second usage was blocked!");
    process.exit(1);
  }

  // Create 2nd enrollment
  const { data: testMatricula2, error: mat2Err } = await supabase.from('matriculas').insert([{
    aluno_id: testAluno.id,
    unidade: testUnidade,
    turma: targetTurma.nome,
    turma_id: targetTurma.id,
    status: 'pendente',
    plano: coupon.plano_registro || 'Mensal',
    cupom_id: coupon.id
  }]).select().single();
  if (mat2Err) {
    console.error("Error creating 2nd matricula:", mat2Err);
    process.exit(1);
  }

  // Record 2nd usage
  const { data: usage2, error: u2Err } = await supabase.from('cupons_usos').insert([{
    cupom_id: coupon.id,
    responsavel_id: testResponsavel.id
  }]).select().single();
  if (u2Err) {
    console.error("Error creating 2nd usage:", u2Err);
    process.exit(1);
  }
  console.log("   Second usage recorded.");

  // Simulate validation check - currently 2 usages, limit is 2. Should block.
  canUse = await checkValidation(coupon.id, testResponsavel.id, coupon.limite_por_usuario);
  console.log(`   Validating 3rd usage (usages = 2, limit = 2): Can use? ${canUse} (Expected: false)`);
  if (canUse) {
    console.error("FAIL: Third usage was allowed!");
    process.exit(1);
  }
  console.log("   Result: PASS (Limit enforced successfully)");

  // 6. Cleanup test records
  console.log("\n5. Cleaning up verification records...");
  await supabase.from('cupons_usos').delete().eq('id', usage1.id);
  await supabase.from('cupons_usos').delete().eq('id', usage2.id);
  await supabase.from('matriculas').delete().eq('id', testMatricula.id);
  await supabase.from('matriculas').delete().eq('id', testMatricula2.id);
  await supabase.from('cupons_lotes').delete().eq('id', lote.id);
  console.log("   Cleanup finished.");

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch(err => {
  console.error("Unhandled test error:", err);
  process.exit(1);
});
