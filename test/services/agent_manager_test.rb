require 'minitest/autorun'
require_relative '../../server/app/services/agent_manager' # Adjust path as necessary
require 'fileutils' # For creating temp files/dirs

class TestAgentManager < Minitest::Test
  AGENT_CONFIG_DIR = File.expand_path('../../../config/agents', __FILE__)
  TEMP_AGENT_DIR = File.join(AGENT_CONFIG_DIR, 'temp_test_agents')

  def setup
    # Create a temporary directory for test agent files
    FileUtils.mkdir_p(TEMP_AGENT_DIR)

    # Create a dummy valid agent file
    @valid_agent_name = :test_agent_valid
    valid_agent_content = <<~YAML
      meta:
        name: Test Valid Agent
      behaviors:
        interaction:
          directive: "Hello <%= name %>! Today is <%= date %>."
          instruction: "Follow the directive."
        boot:
          directive: "Booting up with <%= setting %>."
    YAML
    File.write(File.join(TEMP_AGENT_DIR, "#{@valid_agent_name}.yml"), valid_agent_content)

    # Create a dummy agent file with ERB error
    @erb_error_agent_name = :test_agent_erb_error
    erb_error_agent_content = <<~YAML
      behaviors:
        interaction:
          directive: "Hello <%= name.this_should_really_fail %>!" # More robust ERB syntax error
    YAML
    File.write(File.join(TEMP_AGENT_DIR, "#{@erb_error_agent_name}.yml"), erb_error_agent_content)

    # Override config_path in AgentManager to point to our temp directory for isolation
    AgentManager.define_singleton_method(:config_path) do
      TEMP_AGENT_DIR
    end
  end

  def teardown
    # Clean up the temporary directory
    FileUtils.rm_rf(TEMP_AGENT_DIR)

    # Restore original config_path method by removing the singleton method
    # This is a bit of a hack for testing; in a real app, dependency injection or
    # a configurable path would be better.
    AgentManager.singleton_class.send(:remove_method, :config_path)
    # Redefine it to original if needed for other tests, or ensure AgentManager is reloaded
    AgentManager.define_singleton_method(:config_path) do
      File.expand_path('../../../config/agents', __FILE__)
    end

  end

  def test_load_agent_config_success
    config = AgentManager.load_agent_config(@valid_agent_name)
    assert_instance_of TTY::Config, config
    assert_equal "Test Valid Agent", config.fetch('meta.name')
  end

  def test_load_agent_config_file_not_found
    assert_raises AgentManager::AgentNotFoundError do
      AgentManager.load_agent_config(:non_existent_agent)
    end
  end

  def test_get_processed_behavior_success
    context = { name: "World", date: "2023-10-27" }
    behavior = AgentManager.get_processed_behavior(
      agent_name: @valid_agent_name,
      behavior_key: :interaction,
      context_vars: context
    )
    assert_equal "Hello World! Today is 2023-10-27.", behavior[:directive]
    assert_equal "Follow the directive.", behavior[:instruction]
  end

  def test_get_processed_behavior_missing_behavior_key
    assert_raises AgentManager::BehaviorNotFoundError do
      AgentManager.get_processed_behavior(agent_name: @valid_agent_name, behavior_key: :non_existent_behavior)
    end
  end

  def test_get_processed_behavior_erb_rendering_error
    context = { name: "Test" }
    assert_raises AgentManager::ErbRenderingError do
      AgentManager.get_processed_behavior(
        agent_name: @erb_error_agent_name,
        behavior_key: :interaction,
        context_vars: context
      )
    end
  end

  def test_get_interaction_directive_success
    context = { name: "Jules", date: "2024-01-01" }
    directive = AgentManager.get_interaction_directive(
      agent_name: @valid_agent_name,
      context_vars: context
    )
    assert_equal "Hello Jules! Today is 2024-01-01.", directive
  end

  def test_get_boot_directive_success
    context = { setting: "Default Setting" }
    directive = AgentManager.get_processed_behavior(
      agent_name: @valid_agent_name,
      behavior_key: :boot,
      context_vars: context
    )[:directive] # Accessing directly for this specific test structure
    assert_equal "Booting up with Default Setting.", directive
  end

  def test_get_interaction_directive_agent_not_found
    assert_raises AgentManager::AgentNotFoundError do
      AgentManager.get_interaction_directive(agent_name: :ghost_agent, context_vars: {})
    end
  end
end

# Create a dummy sift_full_check.yml in the actual config/agents path for one test
# This is to ensure the original config path works as expected for the provided example
# It's a bit of a workaround due to the dynamic path change in tests.
# A more robust solution would involve a test-specific configuration for AgentManager.

# Setup main sift_full_check.yml for the example test
sift_full_check_content = <<~YAML
meta:
  name: SIFT Full Check
behaviors:
  interaction:
    directive: "Generated <%= current_date %>. User query: <%= user_query %>."
YAML
sift_config_path = File.expand_path('../../../config/agents', __FILE__)
FileUtils.mkdir_p(sift_config_path)
File.write(File.join(sift_config_path, "sift_full_check.yml"), sift_full_check_content)

# Adding a test case that uses the actual sift_full_check.yml
# This requires AgentManager to use its original config_path logic.
class TestAgentManagerWithActualConfig < Minitest::Test
  def test_sift_full_check_example_usage
    # Ensure AgentManager uses its original config_path
    # This might involve ensuring no singleton overrides from other test classes affect this one,
    # or by re-instantiating/re-requiring AgentManager if necessary and possible.
    # For simplicity here, we rely on the teardown of the previous class and order of execution,
    # or that this test runs in a separate context where the override is not present.
    # A better way is to pass the config path to AgentManager methods if possible.

    # Due to the test structure and singleton method manipulation,
    # it's safer to explicitly restore and use the original path logic.
    original_config_path_method = AgentManager.method(:config_path)
    AgentManager.define_singleton_method(:config_path) do
      File.expand_path('../../../config/agents', __FILE__)
    end

    context = { current_date: "2023-11-01", user_query: "Is this real?" }
    directive = AgentManager.get_interaction_directive(
      agent_name: :sift_full_check, # This should match the actual file name
      context_vars: context
    )
    assert_equal "Generated 2023-11-01. User query: Is this real?.", directive
  ensure
    # Restore the original method whatever it was to avoid interference
    AgentManager.define_singleton_method(:config_path, original_config_path_method)
  end

  # Clean up the dummy sift_full_check.yml if it was created by this test class
  Minitest.after_run do
    sift_file_path = File.join(File.expand_path('../../../config/agents', __FILE__), "sift_full_check.yml")
    #FileUtils.rm_f(sift_file_path) # Commented out to keep the example file
  end
end
