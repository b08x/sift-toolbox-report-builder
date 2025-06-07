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
        application_name: 'SIFT-Toolbox',
        version: '1.0',
        environment: ENV['RACK_ENV'] || 'development'
      }
    end

    # Get all available agent configurations from the config/agents directory
    #
    # @return [Array<String>] Array of available agent names
    def available_agents
      AgentManager.available_agents
    end

    # Get all behaviors for a specific agent
    #
    # @param agent_name [String] The name of the agent
    # @return [Array<Symbol>] Array of available behavior keys
    def available_behaviors(agent_name)
      config = AgentManager.load_agent_config(agent_name)
      behaviors = config.fetch('behaviors') || {}
      behaviors.keys.map(&:to_sym)
    rescue AgentManager::AgentNotFoundError
      []
    end

    # Validate that a prompt configuration is valid
    #
    # @param prompt_key [Symbol] The prompt key to validate
    # @return [Boolean] True if the prompt configuration is valid
    def validate_prompt(prompt_key)
      return false unless prompt_exists?(prompt_key)

      config = PROMPT_TYPE_MAPPING[prompt_key]
      return validate_direct_prompt(prompt_key) unless config

      begin
        AgentManager.load_agent_config(config[:agent])
        behavior_data = AgentManager.get_processed_behavior(
          agent_name: config[:agent],
          behavior_key: config[:behavior],
          context_vars: default_context_vars
        )
        behavior_data.key?(config[:key])
      rescue AgentManager::AgentNotFoundError, AgentManager::BehaviorNotFoundError
        false
      end
    end

    # Get metadata for a specific agent
    #
    # @param agent_name [String] The name of the agent
    # @return [Hash] Metadata hash with symbol keys
    def get_agent_metadata(agent_name)
      config = AgentManager.load_agent_config(agent_name)
      metadata = config.fetch('meta') || {}
      metadata.transform_keys(&:to_sym)
    rescue AgentManager::AgentNotFoundError
      {}
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

    # Create a new prompt mapping dynamically
    #
    # @param prompt_key [Symbol] The new prompt key
    # @param agent_name [String] The agent name
    # @param behavior_key [Symbol] The behavior key
    # @param content_key [Symbol] The content key within the behavior
    def add_prompt_mapping(_prompt_key, agent_name:, behavior_key:, content_key:)
      unless available_agents.include?(agent_name)
        raise PromptNotFoundError, "Agent '#{agent_name}' not found in available agents"
      end

      unless available_behaviors(agent_name).include?(behavior_key)
        raise PromptNotFoundError, "Behavior '#{behavior_key}' not found for agent '#{agent_name}'"
      end

      # Since PROMPT_TYPE_MAPPING is frozen, we need to work around this
      # In practice, this would require modifying the constant or using a different approach
      raise StandardError, 'Cannot modify frozen PROMPT_TYPE_MAPPING. Consider using configuration files instead.'
    end

    # Get all prompt metadata for debugging and introspection
    #
    # @return [Hash] Complete mapping of prompts to their configurations and metadata
    def get_all_prompt_info
      info = {}

      PROMPT_TYPE_MAPPING.each do |prompt_key, config|
        agent_metadata = get_agent_metadata(config[:agent])
        info[prompt_key] = {
          config: config,
          agent_metadata: agent_metadata,
          valid: validate_prompt(prompt_key)
        }
      rescue StandardError => e
        info[prompt_key] = {
          config: config,
          error: e.message,
          valid: false
        }
      end

      info
    end

    private

    # Check if a direct agent/behavior prompt exists (for extensibility)
    #
    # @param prompt_key [Symbol] The prompt key to check
    # @return [Boolean] True if a direct prompt mapping exists
    def direct_prompt_exists?(prompt_key)
      # Enhanced to actually check if the prompt_key could map to an agent
      agent_name = prompt_key.to_s.gsub(/_prompt$/, '')
      available_agents.include?(agent_name)
    end

    # Get a direct prompt (for extensibility and backward compatibility)
    #
    # @param prompt_key [Symbol] The prompt key
    # @param context_vars [Hash] Context variables for ERB processing
    # @return [String] The processed prompt
    def get_direct_prompt(prompt_key, context_vars = {})
      # Enhanced implementation for dynamic agent discovery
      agent_name = prompt_key.to_s.gsub(/_prompt$/, '')

      unless available_agents.include?(agent_name)
        raise PromptNotFoundError, "No agent found for prompt key: #{prompt_key}"
      end

      # Default to 'interaction' behavior and 'directive' key
      merged_context = default_context_vars.merge(context_vars)

      begin
        behavior_data = AgentManager.get_processed_behavior(
          agent_name: agent_name,
          behavior_key: :interaction,
          context_vars: merged_context
        )

        content = behavior_data[:directive]
        unless content
          raise PromptNotFoundError, "No 'directive' content found in 'interaction' behavior for agent '#{agent_name}'"
        end

        content
      rescue AgentManager::AgentNotFoundError, AgentManager::BehaviorNotFoundError => e
        raise PromptNotFoundError, "Error loading direct prompt '#{prompt_key}': #{e.message}"
      end
    end

    # Validate a direct prompt mapping
    #
    # @param prompt_key [Symbol] The prompt key to validate
    # @return [Boolean] True if the direct prompt is valid
    def validate_direct_prompt(prompt_key)
      agent_name = prompt_key.to_s.gsub(/_prompt$/, '')
      return false unless available_agents.include?(agent_name)

      begin
        behavior_data = AgentManager.get_processed_behavior(
          agent_name: agent_name,
          behavior_key: :interaction,
          context_vars: default_context_vars
        )
        behavior_data.key?(:directive)
      rescue AgentManager::AgentNotFoundError, AgentManager::BehaviorNotFoundError
        false
      end
    end
  end
end
