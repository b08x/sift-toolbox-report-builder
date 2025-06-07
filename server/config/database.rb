# config/database.rb
require 'sequel'
require 'logger'

# Define database connection parameters
# Uses environment variables, falling back to defaults matching docker-compose.yml
db_host = ENV.fetch('DB_HOST', 'localhost')
db_port = ENV.fetch('DB_PORT', '5432')
db_name = ENV.fetch('DB_NAME', 'sift')
db_user = ENV.fetch('DB_USER', 'postgres')
db_password = ENV.fetch('DB_PASSWORD', '')

# Construct the database URL
DATABASE_URL = ENV.fetch('DATABASE_URL', "postgres://#{db_user}:#{db_password}@#{db_host}:#{db_port}/#{db_name}")

# Establish the database connection
# The global constant DB is a common practice in Sequel apps
begin
  DB = Sequel.connect(DATABASE_URL)

  # Load Sequel extensions for PostgreSQL specific types
  DB.extension :pg_json
  
  # Only enable pgvector if the extension is available
  begin
    DB.run "CREATE EXTENSION IF NOT EXISTS vector"
  rescue Sequel::DatabaseError => e
    puts "Warning: Could not enable vector extension: #{e.message}"
  end

  # Test connection
  DB.test_connection
  puts "Successfully connected to database: #{db_name} on #{db_host}:#{db_port}"
rescue Sequel::DatabaseConnectionError => e
  puts "Warning: Failed to connect to database: #{e.message}"
  # For development without database, create a mock DB constant
  DB = nil
end
