-- 0016_reminders_and_templates.sql
-- Follow-up reminders (date field on the note) + doctor-saved note templates.

ALTER TABLE clinical_notes ADD COLUMN follow_up_date DATE;

-- Reminders panel queries "final sessions with a near/overdue follow_up_date"
-- for one doctor; this index covers that lookup.
CREATE INDEX idx_clinical_notes_follow_up_date
  ON clinical_notes (follow_up_date)
  WHERE follow_up_date IS NOT NULL;

CREATE TABLE note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  name TEXT NOT NULL,
  chief_complaint TEXT,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  follow_up TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_note_templates_doctor ON note_templates (doctor_id);

-- Server uses the service-role key (bypasses RLS); enable + lock down anyway,
-- matching the convention set in 0015 for defence-in-depth.
ALTER TABLE note_templates ENABLE ROW LEVEL SECURITY;
