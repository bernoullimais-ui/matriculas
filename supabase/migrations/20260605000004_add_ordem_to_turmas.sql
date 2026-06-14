-- Add ordem column to turmas for custom drag-and-drop sorting
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;
