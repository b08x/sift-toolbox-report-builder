require 'sinatra'
require 'logger'
require 'json'
require 'sinatra/cross_origin'
require 'dotenv/load' # Loads environment variables from .env
require_relative 'config/database' # Load database configuration

class MyCustomError < StandardError; end

configure do
  enable :cross_origin

  # Logger configuration
  environment = ENV['RACK_ENV'] || 'development'
  set :environment, environment.to_sym

  if settings.environment == :production
    Dir.mkdir('log') unless File.exist?('log')
    # Log Rotation:
    # In a production environment, log files can grow very large over time.
    # Log rotation is a process that automatically archives or deletes old log
    # files and starts new ones. This prevents disk space issues and makes
    # logs easier to manage.
    # Log rotation is typically handled by external utilities like 'logrotate'
    # on Linux systems or other platform-specific logging services. It's an
    # important operational consideration for production deployments.
    set :logger, Logger.new('log/production.log')
    settings.logger.level = Logger::INFO
  else
    set :logger, Logger.new(STDOUT)
    settings.logger.level = Logger::DEBUG
  end

  settings.logger.info "Logger initialized for #{settings.environment} environment"
end

# CORS Configuration
# For development, allow requests from the frontend development server.
# In production, this should be set to the actual frontend domain.
set :allow_origin, ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
set :allow_methods, [:get, :post, :put, :delete, :options]
set :allow_headers, ['Content-Type', 'Authorization', 'X-Requested-With']
set :expose_headers, ['Content-Type'] # Optional: Add any other headers you want to expose

# Centralized Error Handling
# Provides consistent JSON error responses and logs issues.

# Explanation: Sinatra's `error` blocks allow you to define specific handlers
# for different types of exceptions that occur during request processing.
# When an exception is raised, Sinatra searches for an `error` block that
# matches the exception's class. If a match is found, the block is executed.
# If no specific handler is found, Sinatra falls back to more generic handlers
# (like `StandardError`) or its default error page.

# Custom Application Error
error MyCustomError do |e|
  status 400 # Bad Request (or a more specific code like 422 if appropriate)
  content_type :json

  error_details = { type: e.class.name, message: e.message }
  settings.logger.error "MyCustomError: #{e.message}"
  settings.logger.debug e.backtrace.join("\n") if settings.development? # Log backtrace in development

  { error: error_details }.to_json
end

# Sinatra::NotFound (404) Handler
# This handler catches errors raised when a route is not found.
error Sinatra::NotFound do
  status 404
  content_type :json

  error_details = { type: 'Sinatra::NotFound', message: "Endpoint not found: #{request.path_info}" }
  settings.logger.warn "404 Not Found: #{request.path_info}" # Log as warning, less severe than an error

  { error: error_details }.to_json
end

# Generic StandardError Handler (Catch-all)
# This should generally be the last error handler defined, to catch any
# exceptions not handled by more specific blocks.
error StandardError do |e|
  status 500 # Internal Server Error
  content_type :json

  error_message = if settings.development?
                    "Internal Server Error: #{e.message}"
                  else
                    "An unexpected error occurred. Please try again later."
                  end
  error_details = { type: e.class.name, message: error_message }

  settings.logger.error "StandardError: #{e.message}"
  settings.logger.error e.backtrace.join("\n") # Log full backtrace for StandardError

  { error: error_details }.to_json
end

# Support for preflight requests
# The OPTIONS method is used by browsers to send a "preflight" request to the server
# to determine if the actual request (e.g., a POST with a JSON body) is safe to send.
# This is a crucial part of the CORS mechanism.
options '*' do
  response.headers['Allow'] = 'GET, POST, PUT, DELETE, OPTIONS'
  response.headers['Access-Control-Allow-Origin'] = settings.allow_origin
  response.headers['Access-Control-Allow-Headers'] = settings.allow_headers.join(', ')
  response.headers['Access-Control-Allow-Methods'] = settings.allow_methods.map(&:to_s).map(&:upcase).join(', ')
  200 # HTTP 200 OK
end

#
# Security Note on CORS Configuration:
# It is crucial to be very careful with CORS settings in a production environment.
# - Avoid using `*` (wildcard) for `Access-Control-Allow-Origin` if your application handles sensitive data or credentials.
#   Allowing any origin to make requests can expose your application to cross-site request forgery (CSRF) like attacks
#   if combined with `Access-Control-Allow-Credentials: true`.
# - Always specify the exact, trusted domains that should be allowed to access your API.
#   For example: `set :allow_origin, 'https://your-trusted-frontend.com'`
#   Or manage a list of allowed origins dynamically based on your application's needs.
#

# In a more complex application, you would require route files here:
# Dir[File.join(__dir__, 'app', 'routes', '*.rb')].each { |file| require file }

# Placeholder for global configurations or helpers
# configure do
#   # Example: set :public_folder, File.expand_path('../public', __FILE__)
# end

# Basic health check route
get '/api/health' do
  settings.logger.info "Received #{request.request_method} request for #{request.path_info}"
  content_type :json
  { message: 'OK', timestamp: Time.now.iso8601 }.to_json
end

# New route for testing logging
get '/api/test_log' do
  settings.logger.info "Received #{request.request_method} request for #{request.path_info}"
  settings.logger.warn "This is a test warning message."
  settings.logger.error "This is a test error message."
  content_type :json
  { message: "Test log messages created. Check your logs." }.to_json
end

# --- Example Routes for Error Handling Testing ---

# Route to test MyCustomError handler
get '/api/test_custom_error' do
  settings.logger.info "Triggering MyCustomError..."
  raise MyCustomError, "This is a test of the custom error handling."
end

# Route to test StandardError handler
get '/api/test_standard_error' do
  settings.logger.info "Triggering a StandardError..."
  raise StandardError, "This is a test of the generic StandardError handling."
end

# Note: To test Sinatra::NotFound, simply try to access any undefined route,
# for example: /api/this-route-does-not-exist

# Placeholder for future API routes
# namespace '/api/v1' do
#   before do
#     content_type 'application/json'
#   end
#
#   # Example route
#   get '/items' do
#     { message: 'This will be a list of items' }.to_json
#   end
# end

# You can also define routes directly without a class:
# get '/' do
#   'Hello SIFT Toolbox API!'
# end

#
# Manual CORS Configuration (Alternative to using sinatra-cross_origin gem)
#
# before do
#   headers['Access-Control-Allow-Origin'] = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
#   headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
#   headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
# end
#
# options '*' do
#   response.headers['Allow'] = 'GET, POST, PUT, DELETE, OPTIONS'
#   response.headers['Access-Control-Allow-Origin'] = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
#   response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
#   response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
#   halt 200
# end
#

# If you prefer a modular (classic) style Sinatra app:
# class App < Sinatra::Base
#   configure do
#     # settings
#   end
#
#   get '/' do
#     'Hello from modular app!'
#   end
#
#   # more routes...
# end
