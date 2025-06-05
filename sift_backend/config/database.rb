# sift_backend/config/database.rb
require 'sequel'
require 'logger' # Optional: for logging SQL queries

# Define database connection parameters
# Uses environment variables, falling back to defaults for Dockerized local development
db_host = ENV.fetch('DB_HOST', 'localhost') # Use 'postgres_db' if your app service links to it by that name
db_port = ENV.fetch('DB_PORT', '5432')
db_name = ENV.fetch('DB_NAME', 'app_db')
db_user = ENV.fetch('DB_USER', 'app_user')
db_password = ENV.fetch('DB_PASSWORD', 'app_password')

# Construct the database URL
DATABASE_URL = ENV.fetch('DATABASE_URL', "postgres://#{db_user}:#{db_password}@#{db_host}:#{db_port}/#{db_name}")

# Establish the database connection
# The global constant DB is a common practice in Sequel apps
DB = Sequel.connect(DATABASE_URL)

# Optional: Log SQL queries to STDOUT (useful for development)
# DB.loggers << Logger.new($stdout)

# Load Sequel extensions for PostgreSQL specific types
# These are good to have for enhanced functionality with JSON and HStore
DB.extension :pg_json
DB.extension :pg_hstore
# For pgvector, direct type registration with Sequel might be complex or require a plugin.
# Operations involving the 'vector' type are often done using raw SQL (DB.run, DB.fetch)
# or specific methods provided by pgvector-ruby gem if you were to use it (not requested here).
# For now, we ensure the extension is created at the DB level.

# Verify connection (optional, but good for immediate feedback)
begin
  DB.test_connection
  puts "Successfully connected to database: #{db_name} on #{db_host}:#{db_port}"
rescue Sequel::DatabaseConnectionError => e
  warn "Failed to connect to database: #{e.message}"
  # Depending on the application, you might want to exit or handle this differently
end

# You might want to load your models here if you have them in separate files, e.g.:
# Dir[File.join(__dir__, '..', 'models', '*.rb')].each { |file| require file }
