-- init.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS hstore;

-- You can add other database initialization commands here if needed.
-- For example, creating specific roles or other extensions.

-- Print a message to the PostgreSQL logs to confirm execution (optional)
DO $$
BEGIN
  RAISE NOTICE 'Database initialized with pgvector and hstore extensions.';
END $$;
