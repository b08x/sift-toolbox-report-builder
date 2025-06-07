# frozen_string_literal: true

require 'minitest/autorun'
require_relative '../../app/services/prompt_manager'
require_relative '../../app/services/agent_manager'

class AIServicePromptIntegrationTest < Minitest::Test
  def setup
    # Reset any cached data in AgentManager before each test
    AgentManager.instance_variable_set(:@agent_configs, {}) if AgentManager.instance_variable_defined?(:@agent_configs)
  end

  def test_prompt_manager_integration_with_system_prompt
    # Test that we can get the system prompt used by AIService
    system_prompt = PromptManager.get_sift_chat_system_prompt(user_query: "Test query")
    
    refute_nil system_prompt
    assert_kind_of String, system_prompt
    assert system_prompt.length > 100 # Should be substantial
    assert_includes system_prompt, "Test query"
    assert_includes system_prompt, "SIFT"
    assert_includes system_prompt, "fact-checking"
  end

  def test_prompt_manager_integration_with_analysis_prompts
    test_cases = [
      { report_type: 'FULL_CHECK', expected_content: 'comprehensive' },
      { report_type: 'SUMMARY', expected_content: 'concise' },
      { report_type: 'IMAGE_ANALYSIS', expected_content: 'image' }
    ]
    
    test_cases.each do |test_case|
      prompt = PromptManager.get_sift_analysis_prompt(
        report_type: test_case[:report_type],
        user_input: "Test content for #{test_case[:report_type]}"
      )
      
      refute_nil prompt, "Prompt should not be nil for #{test_case[:report_type]}"
      assert_kind_of String, prompt
      assert prompt.length > 50, "Prompt should be substantial for #{test_case[:report_type]}"
      assert_includes prompt, "Test content for #{test_case[:report_type]}"
      assert_includes prompt.downcase, test_case[:expected_content].downcase
    end
  end

  def test_erb_context_variable_substitution
    # Test that current_date is properly substituted
    prompt = PromptManager.get_sift_chat_system_prompt
    
    # Should contain a valid date
    assert_match(/\d{4}-\d{2}-\d{2}/, prompt)
    
    # Should not contain ERB syntax
    refute_includes prompt, '<%'
    refute_includes prompt, '%>'
    refute_includes prompt, 'current_date'
  end

  def test_prompt_consistency_with_legacy_keys
    # Test that the new system produces similar results to what we'd expect
    # from the old prompts.ts structure
    
    full_check_prompt = PromptManager.get_sift_analysis_prompt(
      report_type: 'FULL_CHECK',
      user_input: 'Test claim to verify'
    )
    
    # Should contain key SIFT methodology elements
    assert_includes full_check_prompt, 'Verified Facts'
    assert_includes full_check_prompt, 'Errors and Corrections'
    assert_includes full_check_prompt, 'Source'
    assert_includes full_check_prompt, 'Test claim to verify'
  end

  def test_image_analysis_specific_content
    image_prompt = PromptManager.get_sift_analysis_prompt(
      report_type: 'IMAGE_ANALYSIS',
      user_input: 'Suspicious historical photo'
    )
    
    # Should contain image-specific analysis instructions
    assert_includes image_prompt.downcase, 'image'
    assert_includes image_prompt.downcase, 'visual'
    assert_includes image_prompt, 'Suspicious historical photo'
    assert_includes image_prompt.downcase, 'manipulation'
    assert_includes image_prompt.downcase, 'provenance'
  end

  def test_summary_analysis_conciseness
    summary_prompt = PromptManager.get_sift_analysis_prompt(
      report_type: 'SUMMARY',
      user_input: 'Quick fact check needed'
    )
    
    # Should emphasize conciseness and quick analysis
    assert_includes summary_prompt.downcase, 'concise'
    assert_includes summary_prompt, 'Quick fact check needed'
    # Should mention word/response limits
    assert_match(/\d+\s+words?/i, summary_prompt)
  end

  def test_specialized_prompts
    # Test context report prompt
    context_prompt = PromptManager.get_context_report_prompt(subject: 'Viral misinformation')
    assert_includes context_prompt, 'Viral misinformation'
    assert_includes context_prompt, 'Core Context'
    assert_includes context_prompt, 'Expanded Context'
    
    # Test community note prompt
    note_prompt = PromptManager.get_community_note_prompt(artifact: 'Misleading tweet')
    assert_includes note_prompt, 'Misleading tweet'
    assert_includes note_prompt, 'Community Note'
    assert_includes note_prompt, '700 characters'
  end

  def test_error_handling_for_invalid_prompts
    assert_raises(PromptManager::PromptNotFoundError) do
      PromptManager.get_prompt(:invalid_prompt_key)
    end
  end

  def test_dynamic_context_merging
    # Test that custom context variables are properly merged
    custom_context = {
      custom_variable: 'Custom value',
      another_var: 'Another value'
    }
    
    prompt = PromptManager.get_sift_analysis_prompt(
      report_type: 'FULL_CHECK',
      user_input: 'Test with custom context',
      **custom_context
    )
    
    # Should still work and include the user input
    assert_includes prompt, 'Test with custom context'
    
    # The prompt should be properly formatted regardless of extra context
    refute_includes prompt, '<%'
    refute_includes prompt, '%>'
  end
end