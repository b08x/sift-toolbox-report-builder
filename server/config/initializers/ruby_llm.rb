# config/initializers/ruby_llm.rb
require 'ruby_llm'
require_relative '../config'

RubyLLM.configure do |config|
  begin
    config.gemini_api_key = Config.gemini_api_key
  rescue Config::MissingKeyError => e
    puts "Warning: #{e.message}"
    config.gemini_api_key = nil
  end

  begin
    config.openai_api_key = Config.openai_api_key
  rescue Config::MissingKeyError => e
    puts "Warning: #{e.message}"
    config.openai_api_key = nil
  end

  begin
    config.openrouter_api_key = Config.openrouter_api_key
  rescue Config::MissingKeyError => e
    puts "Warning: #{e.message}"
    config.openrouter_api_key = nil
  end

  # config.openai_api_base = 'https://openrouter.ai/api/v1' # Example for OpenRouter if not using its specific key config
end
