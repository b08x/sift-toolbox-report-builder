# config/initializers/ruby_llm.rb
RubyLLM.configure do |config|
  config.gemini_api_key = ENV.fetch('GEMINI_API_KEY', nil)
  config.openai_api_key = ENV.fetch('OPENAI_API_KEY', nil)
  config.openrouter_api_key = ENV.fetch('OPENROUTER_API_KEY', nil)
  # config.openai_api_base = 'https://openrouter.ai/api/v1' # Example for OpenRouter if not using its specific key config
end
