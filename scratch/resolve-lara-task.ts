import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const enrollmentId = '4e3547e8-86a7-4aad-b569-e84a472dd2a3';
  const taskId = '7bb4f78c-f81c-4558-97be-a0b66c286bc0';
  const cancellationDate = '2026-05-19';
  const justification = 'Cancelamento via Wix: Futsal Feminino';

  console.log('Resolving Lara Monaco da Rocha Reis task...');

  // 1. Update enrollment status to 'cancelado'
  const { data: matricula, error: mError } = await supabase
    .from('matriculas')
    .update({
      status: 'cancelado',
      data_cancelamento: cancellationDate,
      justificativa_cancelamento: justification
    })
    .eq('id', enrollmentId)
    .select();

  if (mError) {
    console.error('Error updating matricula:', mError);
    return;
  }
  console.log('Matricula updated successfully:', matricula);

  // 2. Update task status to 'concluido'
  const { data: task, error: tError } = await supabase
    .from('tarefas')
    .update({
      status: 'concluido'
    })
    .eq('id', taskId)
    .select();

  if (tError) {
    console.error('Error updating task:', tError);
    return;
  }
  console.log('Task updated successfully:', task);
}
run();
