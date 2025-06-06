# config/database.rb
require 'sequel'
require 'logger'

# Define database connection parameters
# Uses environment variables, falling back to defaults for development
db_host = ENV.fetch('DB_HOST', 'localhost')
db_port = ENV.fetch('DB_PORT', '5432')
db_name = ENV.fetch('DB_NAME', 'app_db')
db_user = ENV.fetch('DB_USER', 'app_user')
db_password = ENV.fetch('DB_PASSWORD', 'app_password')

# Construct the database URL
DATABASE_URL = ENV.fetch('DATABASE_URL', "postgres://#{db_user}:#{db_password}@#{db_host}:#{db_port}/#{db_name}")

# Establish the database connection
# The global constant DB is a common practice in Sequel apps
begin
  DB = Sequel.connect(DATABASE_URL)

  # Load Sequel extensions for PostgreSQL specific types
  DB.extension :pg_json
  DB.extension :pg_hstore

  # Test connection
  DB.test_connection
  puts "Successfully connected to database: #{db_name} on #{db_host}:#{db_port}"
rescue Sequel::DatabaseConnectionError => e
  puts "Warning: Failed to connect to database: #{e.message}"
  # For development without database, create a mock DB constant
  DB = nil
end
