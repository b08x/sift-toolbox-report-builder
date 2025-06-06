# sift_backend/db/migrations/001_initial_setup.rb
Sequel.migration do
  up do
    puts 'Running 001_initial_setup.rb: Up'
    puts 'This migration confirms the migration system is working.'
    puts 'It also serves as a point to verify pgvector and hstore extensions.'

    # Optional: You can directly check for extensions if you want the migration to fail if they're not there.
    # However, the init.sql script should handle their creation.
    # This is more for confirmation during migration.
    begin
      db = self # In Sequel.migration blocks, self is the database connection
      vector_exists = db.fetch("SELECT 1 FROM pg_extension WHERE extname = 'vector'").first
      hstore_exists = db.fetch("SELECT 1 FROM pg_extension WHERE extname = 'hstore'").first

      if vector_exists
        puts 'pgvector extension is enabled.'
      else
        puts 'WARNING: pgvector extension does NOT seem to be enabled.'
      end

      if hstore_exists
        puts 'hstore extension is enabled.'
      else
        puts 'WARNING: hstore extension does NOT seem to be enabled.'
      end
    rescue StandardError => e
      puts "Could not query pg_extension table: #{e.message}"
      puts "This might happen if the table doesn't exist yet or due to permissions."
    end

    # Sequel automatically creates its schema_migrations table on the first run
    # if it doesn't exist. No need to create it manually.
  end

  down do
    puts 'Running 001_initial_setup.rb: Down'
    puts 'Reverting initial setup migration. No structural changes were made by this specific migration.'
  end
end
