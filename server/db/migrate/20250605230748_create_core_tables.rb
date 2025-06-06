Sequel.migration do
  up do
    # Enable uuid-ossp extension if not already enabled by init.sql, for gen_random_uuid()
    # DB.run('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";') # Prefer init.sql for this

    DB.run %{
      CREATE TABLE sift_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_query_text TEXT,
        user_image_filename VARCHAR(255),
        report_type VARCHAR(100),
        model_id_used VARCHAR(255),
        generated_report_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    }

    DB.run %{
      CREATE TABLE chat_messages (
        id SERIAL PRIMARY KEY,
        sift_analysis_id UUID NOT NULL REFERENCES sift_analyses(id) ON DELETE CASCADE,
        sender_type VARCHAR(50) NOT NULL,
        message_text TEXT NOT NULL,
        model_id_used VARCHAR(255),
        "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        grounding_sources_json JSONB
      );
    }

    DB.run %{
      CREATE TABLE processed_urls (
        id SERIAL PRIMARY KEY,
        url_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256 produces 64 hex characters
        original_url TEXT NOT NULL,
        extracted_title TEXT,
        extracted_content TEXT,
        content_embedding vector(1536), -- pgvector type
        processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_fetched_at TIMESTAMP WITH TIME ZONE
      );
    }
  end

  down do
    DB.run %{ DROP TABLE IF EXISTS processed_urls; }
    DB.run %{ DROP TABLE IF EXISTS chat_messages; }
    DB.run %{ DROP TABLE IF EXISTS sift_analyses; }
    # If you had enabled any extensions like "uuid-ossp" specifically in the up method
    # and not in init.sql, you might consider dropping them here,
    # but typically extensions are managed at a database level, not per-migration.
    # DB.run('DROP EXTENSION IF EXISTS "uuid-ossp";')
  end
end
