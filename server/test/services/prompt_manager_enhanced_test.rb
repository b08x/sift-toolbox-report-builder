# frozen_string_literal: true

require 'minitest/autorun'
require_relative '../../app/services/prompt_manager'
require_relative '../../app/services/agent_manager'

class PromptManagerEnhancedTest < Minitest::Test
  def setup
    # Reset any cached data in AgentManager before each test
    AgentManager.instance_variable_set(:@agent_configs, {}) if AgentManager.instance_variable_defined?(:@agent_configs)
  end

  def test_available_prompts
    prompts = PromptManager.available_prompts
    assert_includes prompts, :sift_chat_system_prompt
    assert_includes prompts, :sift_full_check_prompt
    assert_includes prompts, :sift_summary_prompt
    assert_includes prompts, :sift_image_analysis_prompt
  end

  def test_prompt_exists
    assert PromptManager.prompt_exists?(:sift_chat_system_prompt)
    assert PromptManager.prompt_exists?(:sift_full_check_prompt)
    refute PromptManager.prompt_exists?(:nonexistent_prompt)
  end

  def test_validate_prompt
    # Test with existing prompt
    assert PromptManager.validate_prompt(:sift_chat_system_prompt)
    
    # Test with non-existent prompt
    refute PromptManager.validate_prompt(:nonexistent_prompt)
  end

  def test_get_sift_chat_system_prompt
    prompt = PromptManager.get_sift_chat_system_prompt
    refute_nil prompt
    assert_kind_of String, prompt
    assert prompt.length > 0
    
    # Test with user query
    prompt_with_query = PromptManager.get_sift_chat_system_prompt(user_query: "Test query")
    assert_includes prompt_with_query, "Test query"
  end

  def test_get_sift_analysis_prompt_full_check
    prompt = PromptManager.get_sift_analysis_prompt(
      report_type: 'FULL_CHECK',
      user_input: 'Test content to analyze'
    )
    refute_nil prompt
    assert_kind_of String, prompt
    assert_includes prompt, 'Test content to analyze'
  end

  def test_get_sift_analysis_prompt_summary
    prompt = PromptManager.get_sift_analysis_prompt(
      report_type: 'SUMMARY',
      user_input: 'Test content for summary'
    )
    refute_nil prompt
    assert_kind_of String, prompt
    assert_includes prompt, 'Test content for summary'
  end

  def test_get_sift_analysis_prompt_image_analysis
    prompt = PromptManager.get_sift_analysis_prompt(
      report_type: 'IMAGE_ANALYSIS',
      user_input: 'Test image description'
    )
    refute_nil prompt
    assert_kind_of String, prompt
    assert_includes prompt, 'Test image description'
  end

  def test_get_sift_analysis_prompt_unknown_type
    # Should default to FULL_CHECK
    prompt = PromptManager.get_sift_analysis_prompt(
      report_type: 'UNKNOWN_TYPE',
      user_input: 'Test content'
    )
    refute_nil prompt
    assert_kind_of String, prompt
  end

  def test_get_context_report_prompt
    prompt = PromptManager.get_context_report_prompt(subject: 'Test subject')
    refute_nil prompt
    assert_kind_of String, prompt
    assert_includes prompt, 'Test subject'
  end

  def test_get_community_note_prompt
    prompt = PromptManager.get_community_note_prompt(artifact: 'Test artifact')
    refute_nil prompt
    assert_kind_of String, prompt
    assert_includes prompt, 'Test artifact'
  end

  def test_default_context_vars
    context = PromptManager.default_context_vars
    assert_kind_of Hash, context
    assert_includes context.keys, :current_date
    assert_includes context.keys, :current_time
    assert_includes context.keys, :application_name
    assert_includes context.keys, :sift_version
    assert_includes context.keys, :methodology
    
    # Test date formatting
    assert_match(/\d{4}-\d{2}-\d{2}/, context[:current_date])
    assert_equal 'SIFT-Toolbox', context[:application_name]
    assert_equal 'SIFT (Stop, Investigate, Find, Trace)', context[:methodology]
  end

  def test_get_prompt_config
    config = PromptManager.get_prompt_config(:sift_chat_system_prompt)
    assert_kind_of Hash, config
    assert_equal 'sift_full_check_enhanced', config[:agent]
    assert_equal :interaction, config[:behavior]
    assert_equal :directive, config[:key]
  end

  def test_get_prompt_config_nonexistent
    assert_raises(PromptManager::PromptNotFoundError) do
      PromptManager.get_prompt_config(:nonexistent_prompt)
    end
  end

  def test_get_all_prompt_info
    info = PromptManager.get_all_prompt_info
    assert_kind_of Hash, info
    assert_includes info.keys, :sift_chat_system_prompt
    assert_includes info.keys, :sift_full_check_prompt
    
    # Each prompt should have config and validity info
    info.each_value do |prompt_info|
      assert_includes prompt_info.keys, :config
      assert_includes prompt_info.keys, :valid
    end
  end

  def test_erb_template_processing
    # Test that ERB variables are properly substituted
    prompt = PromptManager.get_sift_chat_system_prompt
    
    # Should contain processed date
    assert_match(/\d{4}-\d{2}-\d{2}/, prompt)
    
    # Should not contain ERB tags
    refute_includes prompt, '<%'
    refute_includes prompt, '%>'
  end

  def test_custom_context_variables
    custom_context = {
      user_input: 'Custom test input',
      report_type: 'CUSTOM',
      custom_var: 'Custom value'
    }
    
    prompt = PromptManager.get_sift_analysis_prompt(
      report_type: 'FULL_CHECK',
      user_input: custom_context[:user_input],
      **custom_context
    )
    
    assert_includes prompt, 'Custom test input'
  end

  def test_prompt_not_found_error
    assert_raises(PromptManager::PromptNotFoundError) do
      PromptManager.get_prompt(:completely_invalid_prompt_key)
    end
  end

  def test_agent_metadata_retrieval
    metadata = PromptManager.get_agent_metadata('sift_full_check_enhanced')
    assert_kind_of Hash, metadata
    assert_includes metadata.keys, :name
    assert_includes metadata.keys, :version
    assert_includes metadata.keys, :description
  end

  def test_available_agents
    agents = PromptManager.available_agents
    assert_kind_of Array, agents
    assert_includes agents, 'sift_full_check_enhanced'
    assert_includes agents, 'sift_summary'
    assert_includes agents, 'sift_image_analysis'
  end

  def test_available_behaviors
    behaviors = PromptManager.available_behaviors('sift_full_check_enhanced')
    assert_kind_of Array, behaviors
    assert_includes behaviors, :interaction
    assert_includes behaviors, :boot
    assert_includes behaviors, :context_report
    assert_includes behaviors, :community_note
  end

  def test_template_helpers
    context = PromptManager.default_context_vars
    
    # Test confidence formatter
    confidence_formatter = context[:format_confidence]
    assert_equal "4/5", confidence_formatter.call(4)
    
    # Test status formatter  
    status_formatter = context[:format_status]
    assert_equal "✅", status_formatter.call('verified')
    assert_equal "❌", status_formatter.call('error')
    assert_equal "❓", status_formatter.call('unknown')
  end
end