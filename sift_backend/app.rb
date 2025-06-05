require 'sinatra'
require 'json'
require 'dotenv/load' # Loads environment variables from .env

# In a more complex application, you would require route files here:
# Dir[File.join(__dir__, 'app', 'routes', '*.rb')].each { |file| require file }

# Placeholder for global configurations or helpers
# configure do
#   # Example: set :public_folder, File.expand_path('../public', __FILE__)
# end

# Basic health check route
get '/health' do
  content_type :json
  { status: 'ok' }.to_json
end

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
