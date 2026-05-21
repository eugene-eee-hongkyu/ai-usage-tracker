-- 사용자 제안 (Feedback / Feature Request).
-- /suggest 페이지 → API insert + Resend send.
-- 메일 발송 실패해도 row 는 남김 (emailed_at=NULL, email_error 채워짐).

CREATE TABLE IF NOT EXISTS suggestions (
  id              serial PRIMARY KEY,
  user_id         integer NOT NULL REFERENCES users(id),
  team_id         integer REFERENCES teams(id),
  category        text NOT NULL,
  context_screen  text,
  context_entry   text,
  body            text NOT NULL,
  emailed_at      timestamp,
  email_error     text,
  created_at      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suggestions_user_idx ON suggestions(user_id);
CREATE INDEX IF NOT EXISTS suggestions_created_at_idx ON suggestions(created_at);
