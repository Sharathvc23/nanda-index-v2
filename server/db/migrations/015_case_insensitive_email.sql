-- 015: account emails are case-insensitive.
--
-- Emails were stored as typed and matched exactly, so Name@x.com could not log
-- in as name@x.com, and the two could even be separate accounts. Store them
-- trimmed and lowercased, and enforce uniqueness on lower(email).

-- 1. Normalise stored emails, except where that would merge two accounts
--    (those stay as-is and are left for an operator; lookups still match
--    case-insensitively).
UPDATE users u
   SET email = lower(btrim(u.email)), updated_at = NOW()
 WHERE u.email <> lower(btrim(u.email))
   AND NOT EXISTS (
     SELECT 1 FROM users o
      WHERE o.id <> u.id AND lower(btrim(o.email)) = lower(btrim(u.email))
   );

-- Email/password accounts use the email as provider_id; keep the two in step.
UPDATE users SET provider_id = email WHERE provider = 'email' AND provider_id <> email;

-- 2. Unique on lower(email), unless legacy case-only duplicates remain.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users GROUP BY lower(email) HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email));
  ELSE
    RAISE NOTICE 'users has emails differing only in case; uq_users_email_lower not created';
  END IF;
END $$;
