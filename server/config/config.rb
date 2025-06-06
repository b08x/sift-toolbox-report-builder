# config/config.rb

module Config
  class MissingKeyError < StandardError; end

  def self.gemini_api_key
    ENV['GEMINI_API_KEY'] || raise(MissingKeyError, "GEMINI_API_KEY is not set in the environment.")
  end

  def self.openai_api_key
    ENV['OPENAI_API_KEY'] || raise(MissingKeyError, "OPENAI_API_KEY is not set in the environment.")
  end

  def self.openrouter_api_key
    ENV['OPENROUTER_API_KEY'] || raise(MissingKeyError, "OPENROUTER_API_KEY is not set in the environment.")
  end

  # Example of another configuration value that can be optional with a default
  # def self.app_name
  #   ENV.fetch('APP_NAME', 'My Sinatra App')
  # end

  # Example of a required configuration without a sensible default
  # def self.database_url
  #   ENV['DATABASE_URL'] || raise(MissingKeyError, "DATABASE_URL is not set in the environment.")
  # end
end

# To use this module, require it in your application:
# require_relative 'config/config' # Adjust path as needed
#
# Then access keys like:
# begin
#   api_key = Config.gemini_api_key
# rescue Config::MissingKeyError => e
#   $stderr.puts e.message
#   # Application specific error handling (e.g. exit, disable feature)
# end
