# frozen_string_literal: true

require 'tty-config'
require 'erb'
require 'date'
require 'ostruct'

# AgentManager provides enhanced YAML configuration loading and ERB processing
# for AI agent configurations with rich context variables and utility helpers
module AgentManager
  class AgentNotFoundError < StandardError; end
  class BehaviorNotFoundError < StandardError; end
  class ErbRenderingError < StandardError; end

  def self.config_path
    File.expand_path('../../config/agents', __dir__)
  end

  def self.load_agent_config(agent_name)
    config_file = File.join(config_path, "#{agent_name}.yml")
    raise AgentNotFoundError, "Agent configuration file not found: #{config_file}" unless File.exist?(config_file)

    config = TTY::Config.new
    config.read(config_file) # Directly read the specific file
    config
  rescue TTY::Config::ReadError => e # This should catch errors if the file is unreadable by tty-config
    raise AgentNotFoundError, "Error reading agent configuration file: #{e.message}"
  end

  def self.get_processed_behavior(agent_name:, behavior_key: :interaction, context_vars: {})
    config = load_agent_config(agent_name)
    # Fetch the 'behaviors' block first, then the specific behavior from it.
    behaviors_block = config.fetch('behaviors')
    raise BehaviorNotFoundError, "Top-level 'behaviors' key not found for agent '#{agent_name}'" if behaviors_block.nil?

    raw_behavior = behaviors_block[behavior_key.to_s]

    raise BehaviorNotFoundError, "Behavior '#{behavior_key}' not found for agent '#{agent_name}'" if raw_behavior.nil?

    # Enhanced context with agent metadata and additional helper methods
    enhanced_context = build_enhanced_context(config, context_vars)

    processed_behavior = {}
    raw_behavior.each do |key, value|
      if value.is_a?(String)
        begin
          erb_template = ERB.new(value, trim_mode: '-')
          processed_behavior[key.to_sym] = erb_template.result_with_hash(enhanced_context)
        rescue StandardError => e
          raise ErbRenderingError, "Error rendering ERB for key '#{key}' in behavior '#{behavior_key}': #{e.message}"
        end
      else
        processed_behavior[key.to_sym] = value # Keep non-string values as is
      end
    end
    processed_behavior
  rescue KeyError => e # Standard Ruby error for Hash#fetch when key not found
    raise BehaviorNotFoundError, "Missing key in agent configuration: #{e.message}"
  end

  # Build enhanced context for ERB templates with metadata and helper methods
  #
  # @param config [TTY::Config] The loaded agent configuration
  # @param context_vars [Hash] User-provided context variables
  # @return [Hash] Enhanced context hash for ERB processing
  def self.build_enhanced_context(config, context_vars)
    meta = config.fetch('meta') || {}

    enhanced_context = {
      # Agent metadata
      agent_name: meta['name'] || 'Unknown Agent',
      agent_version: meta['version'] || '1.0',
      agent_author: meta['author'] || 'Unknown',
      agent_symbol: meta['symbol'] || '🤖',
      agent_description: meta['description'] || '',

      # Utility methods
      format_date: ->(date, format = '%Y-%m-%d') { date.strftime(format) },
      format_time: ->(time, format = '%H:%M:%S') { time.strftime(format) },
      capitalize_first: ->(str) { str.to_s.gsub(/\b\w/, &:upcase) },
      truncate: ->(str, length = 100) { str.to_s.length > length ? "#{str[0..length - 4]}..." : str.to_s },

      # Environment helpers
      env: ->(key, default = nil) { ENV[key] || default },
      is_development: ENV['RACK_ENV'] == 'development',
      is_production: ENV['RACK_ENV'] == 'production',

      # Template helpers
      include_if: ->(condition, content) { condition ? content : '' },
      repeat: ->(str, times) { str.to_s * times.to_i },
      join_with: ->(array, separator = ', ') { Array(array).join(separator) }
    }

    # Merge user context vars (they take precedence)
    enhanced_context.merge(context_vars)
  end

  # Validate ERB template syntax without executing it
  #
  # @param template_string [String] The ERB template string to validate
  # @return [Boolean] True if template syntax is valid
  def self.validate_erb_syntax(template_string)
    ERB.new(template_string, trim_mode: '-')
    true
  rescue SyntaxError, NameError
    false
  end

  # Get all available agents from the config directory
  #
  # @return [Array<String>] Array of available agent names
  def self.available_agents
    agents_dir = config_path
    return [] unless Dir.exist?(agents_dir)

    Dir.glob(File.join(agents_dir, '*.yml')).map do |file|
      File.basename(file, '.yml')
    end
  end

  # Get configuration summary for an agent
  #
  # @param agent_name [String] The name of the agent
  # @return [Hash] Summary of agent configuration
  def self.get_agent_summary(agent_name)
    config = load_agent_config(agent_name)

    {
      meta: config.fetch('meta') || {},
      behaviors: (config.fetch('behaviors') || {}).keys,
      interfaces: config.fetch('interfaces') || {},
      provider: config.fetch('provider') || {}
    }
  rescue AgentNotFoundError => e
    { error: e.message }
  end

  def self.get_interaction_directive(agent_name:, context_vars: {})
    behavior = get_processed_behavior(agent_name: agent_name, behavior_key: :interaction, context_vars: context_vars)
    behavior[:directive]
  end

  def self.get_boot_directive(agent_name:, context_vars: {})
    behavior = get_processed_behavior(agent_name: agent_name, behavior_key: :boot, context_vars: context_vars)
    behavior[:directive]
  end
end
