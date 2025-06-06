# frozen_string_literal: true

require_relative 'agent_manager'
require 'date'

# PromptManager provides a unified interface for managing YAML-based prompts with ERB templating
# Integrates with AgentManager to provide structured prompt management for the SIFT application
module PromptManager
  class PromptNotFoundError < StandardError; end
  class InvalidPromptTypeError < StandardError; end

  class << self
    PROMPT_TYPE_MAPPING = {
      # System prompts
      sift_chat_system_prompt: { agent: 'sift_full_check', behavior: :interaction, key: :directive },

      # Report type prompts
      sift_full_check_prompt: { agent: 'sift_full_check', behavior: :boot, key: :directive }

      # Future extensibility - these can be added as new agent configs are created
      # sift_summary_prompt: { agent: 'sift_summary', behavior: :boot, key: :directive },
      # sift_image_analysis_prompt: { agent: 'sift_image_analysis', behavior: :boot, key: :directive }
    }.freeze

    # Standard context variables that can be used in ERB templates
    def default_context_vars
      {
        current_date: Date.today.strftime('%Y-%m-%d'),
        current_time: Time.now.strftime('%Y-%m-%d %H:%M:%S'),
        application_name: 'SIFT-Toolbox'
      }
    end

    # Main method for retrieving processed prompts with ERB templating
    #
    # @param prompt_key [Symbol] The key for the prompt template (e.g., :sift_full_check_prompt)
    # @param context_vars [Hash] Variables to pass to ERB for template processing
    # @return [String] The processed prompt string with ERB variables substituted
    def get_prompt(prompt_key, context_vars = {})
      prompt_config = PROMPT_TYPE_MAPPING[prompt_key]

      unless prompt_config
        # Fallback for backward compatibility - check if it's a direct agent/behavior reference
        return get_direct_prompt(prompt_key, context_vars) if direct_prompt_exists?(prompt_key)

        raise PromptNotFoundError,
              "Prompt configuration not found for key: #{prompt_key}. " \
              "Available keys: #{PROMPT_TYPE_MAPPING.keys.join(', ')}"
      end

      agent_name = prompt_config[:agent]
      behavior_key = prompt_config[:behavior]
      content_key = prompt_config[:key]

      # Merge default context with provided context
      merged_context = default_context_vars.merge(context_vars)

      begin
        behavior_data = AgentManager.get_processed_behavior(
          agent_name: agent_name,
          behavior_key: behavior_key,
          context_vars: merged_context
        )

        content = behavior_data[content_key]

        unless content
          raise PromptNotFoundError,
                "Content key '#{content_key}' not found in behavior '#{behavior_key}' for agent '#{agent_name}'"
        end

        content
      rescue AgentManager::AgentNotFoundError, AgentManager::BehaviorNotFoundError => e
        raise PromptNotFoundError, "Error loading prompt '#{prompt_key}': #{e.message}"
      rescue AgentManager::ErbRenderingError => e
        raise PromptNotFoundError, "ERB processing error for prompt '#{prompt_key}': #{e.message}"
      end
    end

    # Method for getting prompts with user input interpolation (backward compatibility)
    #
    # @param prompt_key [Symbol] The key for the prompt template
    # @param user_input [String] User input to be included in the prompt
    # @param additional_context [Hash] Additional context variables for ERB processing
    # @return [String] The processed prompt string
    def get_prompt_with_user_input(prompt_key, user_input: nil, **additional_context)
      context_vars = additional_context.dup
      context_vars[:user_input] = user_input if user_input
      context_vars[:user_query] = user_input if user_input # Alternative key name for compatibility

      get_prompt(prompt_key, context_vars)
    end

    # List all available prompt keys
    #
    # @return [Array<Symbol>] Array of available prompt keys
    def available_prompts
      PROMPT_TYPE_MAPPING.keys
    end

    # Check if a prompt key is available
    #
    # @param prompt_key [Symbol] The prompt key to check
    # @return [Boolean] True if the prompt exists
    def prompt_exists?(prompt_key)
      PROMPT_TYPE_MAPPING.key?(prompt_key) || direct_prompt_exists?(prompt_key)
    end

    # Get agent configuration for a specific prompt (useful for debugging)
    #
    # @param prompt_key [Symbol] The prompt key
    # @return [Hash] Configuration details for the prompt
    def get_prompt_config(prompt_key)
      config = PROMPT_TYPE_MAPPING[prompt_key]
      raise PromptNotFoundError, "Prompt configuration not found for key: #{prompt_key}" unless config

      config.dup
    end

    # Get the prompt type mapping (for testing purposes)
    #
    # @return [Hash] The current prompt type mapping
    def prompt_type_mapping
      PROMPT_TYPE_MAPPING
    end

    private

    # Check if a direct agent/behavior prompt exists (for extensibility)
    #
    # @param prompt_key [Symbol] The prompt key to check
    # @return [Boolean] True if a direct prompt mapping exists
    def direct_prompt_exists?(_prompt_key)
      # This method allows for dynamic agent discovery
      # For now, we'll return false but this could be extended to check the config/agents directory
      false
    end

    # Get a direct prompt (for extensibility and backward compatibility)
    #
    # @param prompt_key [Symbol] The prompt key
    # @param context_vars [Hash] Context variables for ERB processing
    # @return [String] The processed prompt
    def get_direct_prompt(prompt_key, _context_vars = {})
      # This could be implemented to dynamically discover agent configurations
      # based on naming conventions (e.g., prompt_key could map to agent_name)
      raise PromptNotFoundError, "Direct prompt lookup not implemented for: #{prompt_key}"
    end
  end
end
