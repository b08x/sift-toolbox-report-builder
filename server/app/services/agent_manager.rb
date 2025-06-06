require 'tty-config'
require 'erb'
require 'date' # Required for Date.today

module AgentManager
  class AgentNotFoundError < StandardError; end
  class BehaviorNotFoundError < StandardError; end
  class ErbRenderingError < StandardError; end

  def self.config_path
    File.expand_path('../../../config/agents', __FILE__)
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
    behaviors_block = config.fetch("behaviors")
    raise BehaviorNotFoundError, "Top-level 'behaviors' key not found for agent '#{agent_name}'" if behaviors_block.nil?
    raw_behavior = behaviors_block.fetch(behavior_key.to_s)

    raise BehaviorNotFoundError, "Behavior '#{behavior_key}' not found for agent '#{agent_name}'" if raw_behavior.nil?

    processed_behavior = {}
    raw_behavior.each do |key, value|
      if value.is_a?(String)
        begin
          erb_template = ERB.new(value)
          processed_behavior[key.to_sym] = erb_template.result_with_hash(context_vars)
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

  def self.get_interaction_directive(agent_name:, context_vars: {})
    behavior = get_processed_behavior(agent_name: agent_name, behavior_key: :interaction, context_vars: context_vars)
    behavior[:directive]
  end

  def self.get_boot_directive(agent_name:, context_vars: {})
    behavior = get_processed_behavior(agent_name: agent_name, behavior_key: :boot, context_vars: context_vars)
    behavior[:directive]
  end
end
