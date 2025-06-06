# services/ai_service.rb

# Make sure the Config module is loaded.
# This might be handled in a central place like app.rb or config/environment.rb
# If not, you might need: require_relative '../config/config'

module AIServices
  class Gemini
    def initialize
      @api_key = Config.gemini_api_key
      raise "Gemini API Key not configured!" unless @api_key
    end

    def call_api(prompt)
      puts "Gemini Service: Calling API with key #{@api_key.gsub(/.(?=.{4})/, '*')}" # Mask key for logging
      # Simulate API call
      # response = HTTParty.post("https://api.gemini.example.com/v1/complete",
      #   headers: { "Authorization" => "Bearer #{@api_key}" },
      #   body: { prompt: prompt }.to_json
      # )
      # return response.parsed_response
      "Gemini Service: Received response for prompt '#{prompt}'"
    end
  end

  class OpenAI
    def initialize
      @api_key = Config.openai_api_key
      raise "OpenAI API Key not configured!" unless @api_key
    end

    def call_api(prompt)
      puts "OpenAI Service: Calling API with key #{@api_key.gsub(/.(?=.{4})/, '*')}" # Mask key for logging
      # Simulate API call
      "OpenAI Service: Received response for prompt '#{prompt}'"
    end
  end

  # Example of a generic service that could be configured to use any provider
  class GenericAIService
    def initialize(provider_name)
      @provider_name = provider_name
      @api_key = case provider_name.downcase.to_sym
                 when :gemini
                   Config.gemini_api_key
                 when :openai
                   Config.openai_api_key
                 when :openrouter
                   Config.openrouter_api_key
                 else
                   raise "Unknown AI provider: #{provider_name}"
                 end
      raise "#{provider_name} API Key not configured!" unless @api_key
    end

    def query(prompt)
      puts "#{@provider_name} Service: Querying with key #{@api_key.gsub(/.(?=.{4})/, '*')}" # Mask key for logging
      "Provider #{@provider_name}: Received response for prompt '#{prompt}'"
    end
  end
end

# Example Usage (conceptual, would be part of your app logic):
#
# require_relative '../config/config' # Ensure Config is loaded
# require_relative 'ai_service'      # Ensure AIService is loaded
#
# begin
#   gemini_service = AIServices::Gemini.new
#   puts gemini_service.call_api("Hello Gemini!")
#
#   openai_service = AIServices::OpenAI.new
#   puts openai_service.call_api("Hello OpenAI!")
#
#   open_router_service = AIServices::GenericAIService.new("OpenRouter")
#   puts open_router_service.query("Hello OpenRouter!")
# rescue => e
#   puts "Error: #{e.message}"
# end

# Ensure AgentManager is loaded.
# This might be handled in a central place like app.rb or config/environment.rb
# If not, you might need: require_relative '../app/services/agent_manager'

# Example of an AIService using AgentManager
module AIServices
  class AgentBasedAIService
    def initialize(agent_name, provider_service)
      @agent_name = agent_name
      @provider_service = provider_service # e.g., an instance of AIServices::Gemini
    end

    def perform_interaction(user_query)
      context_vars = {
        current_date: Date.today.to_s,
        user_query: user_query
      }

      # Using AgentManager to get the processed directive
      directive = nil
      begin
        directive = AgentManager.get_interaction_directive(
          agent_name: @agent_name,
          context_vars: context_vars
        )
      rescue AgentManager::AgentNotFoundError => e
        puts "Error: #{e.message}"
        return "Failed to load agent configuration."
      rescue AgentManager::BehaviorNotFoundError => e
        puts "Error: #{e.message}"
        return "Failed to find behavior in agent configuration."
      rescue AgentManager::ErbRenderingError => e
        puts "Error: #{e.message}"
        return "Failed to render directive template."
      end

      puts "Agent '#{@agent_name}' using directive: \n#{directive}"

      # Now, use this directive with the actual AI provider
      # @provider_service.call_api(directive)
      "Simulated call to AI with processed directive for agent '#{@agent_name}' and query '#{user_query}'"
    end
  end
end

# Example Usage for AgentBasedAIService (conceptual):
#
# require_relative '../config/config' # Ensure Config is loaded
# require_relative '../app/services/agent_manager' # Ensure AgentManager is loaded
# require_relative 'ai_service'      # Ensure AIServices are loaded
#
# begin
#   # Assuming you have a configured AI provider service
#   # For example, using the existing Gemini service
#   gemini_provider = AIServices::Gemini.new
#
#   # Create an instance of the agent-based service
#   sift_checker_service = AIServices::AgentBasedAIService.new(:sift_full_check, gemini_provider)
#
#   # Perform an interaction
#   user_input = "Is the sky blue?"
#   response = sift_checker_service.perform_interaction(user_input)
#   puts response
#
#   # Example with a non-existent agent
#   # non_existent_agent_service = AIServices::AgentBasedAIService.new(:non_existent_agent, gemini_provider)
#   # response_non_existent = non_existent_agent_service.perform_interaction("Test query")
#   # puts response_non_existent
#
# rescue StandardError => e
#   puts "An unexpected error occurred: #{e.message}"
#   puts e.backtrace.join("\n")
# end
