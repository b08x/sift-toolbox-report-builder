require 'minitest/autorun'
require_relative '../../app/services/prompt_manager'

class PromptManagerTest < Minitest::Test
  def setup
    # Reset any cached configurations before each test
  end

  def test_get_prompt_with_valid_key
    prompt = PromptManager.get_prompt(:sift_chat_system_prompt)
    refute_empty prompt
    assert_kind_of String, prompt
  end

  def test_get_prompt_with_invalid_key
    assert_raises(PromptManager::PromptNotFoundError) do
      PromptManager.get_prompt(:nonexistent_prompt)
    end
  end

  def test_get_prompt_with_context_vars
    context_vars = { user_query: 'Test query', custom_var: 'Custom value' }
    prompt = PromptManager.get_prompt(:sift_chat_system_prompt, context_vars)

    # The prompt should include the current date (from default context)
    assert_includes prompt, Date.today.strftime('%Y-%m-%d')

    # If the prompt template uses user_query, it should be substituted
    # Note: This depends on the actual template content
  end

  def test_get_prompt_with_user_input
    user_input = 'This is a test claim to analyze'
    prompt = PromptManager.get_prompt_with_user_input(
      :sift_full_check_prompt,
      user_input: user_input
    )

    refute_empty prompt
    assert_kind_of String, prompt
  end

  def test_default_context_vars_included
    context = PromptManager.default_context_vars

    assert_includes context.keys, :current_date
    assert_includes context.keys, :current_time
    assert_includes context.keys, :application_name

    assert_equal 'SIFT-Toolbox', context[:application_name]
    assert_match(/\d{4}-\d{2}-\d{2}/, context[:current_date])
  end

  def test_available_prompts_returns_array
    prompts = PromptManager.available_prompts
    assert_kind_of Array, prompts
    refute_empty prompts

    assert_includes prompts, :sift_chat_system_prompt
    assert_includes prompts, :sift_full_check_prompt
  end

  def test_prompt_exists_with_valid_key
    assert PromptManager.prompt_exists?(:sift_chat_system_prompt)
    assert PromptManager.prompt_exists?(:sift_full_check_prompt)
  end

  def test_prompt_exists_with_invalid_key
    refute PromptManager.prompt_exists?(:nonexistent_prompt)
  end

  def test_get_prompt_config_returns_configuration
    config = PromptManager.get_prompt_config(:sift_chat_system_prompt)

    assert_kind_of Hash, config
    assert_includes config.keys, :agent
    assert_includes config.keys, :behavior
    assert_includes config.keys, :key

    assert_equal 'sift_full_check', config[:agent]
    assert_equal :interaction, config[:behavior]
    assert_equal :directive, config[:key]
  end

  def test_get_prompt_config_with_invalid_key
    assert_raises(PromptManager::PromptNotFoundError) do
      PromptManager.get_prompt_config(:nonexistent_prompt)
    end
  end

  def test_erb_processing_with_special_variables
    # Test that ERB variables are properly processed
    context_vars = {
      user_input: 'Sample input with <special> characters',
      user_query: 'What about this query?'
    }

    # This should not raise an error even with special characters
    prompt = PromptManager.get_prompt(:sift_full_check_prompt, context_vars)
    refute_empty prompt
  end

  def test_backward_compatibility_with_additional_context
    # Test the get_prompt_with_user_input method with additional context
    prompt = PromptManager.get_prompt_with_user_input(
      :sift_chat_system_prompt,
      user_input: 'Test input',
      custom_context: 'Additional context'
    )

    refute_empty prompt
    assert_kind_of String, prompt
  end

  def test_error_handling_for_missing_agent_config
    # This tests the error propagation from AgentManager
    # We'll simulate this by trying a prompt that should fail at the AgentManager level

    # First, let's verify our error handling works with a completely invalid configuration
    invalid_mapping = { invalid_prompt: { agent: 'nonexistent_agent', behavior: :boot, key: :directive } }

    # Temporarily modify the mapping to test error handling
    original_mapping = PromptManager.prompt_type_mapping
    PromptManager.const_set(:PROMPT_TYPE_MAPPING, invalid_mapping)

    begin
      assert_raises(PromptManager::PromptNotFoundError) do
        PromptManager.get_prompt(:invalid_prompt)
      end
    ensure
      # Restore original mapping
      PromptManager.const_set(:PROMPT_TYPE_MAPPING, original_mapping)
    end
  end
end
