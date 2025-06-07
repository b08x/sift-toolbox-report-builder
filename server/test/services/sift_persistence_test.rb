require 'minitest/autorun'
require 'minitest/spec'
require_relative '../../config/database'
require_relative '../../app/services/persistence_service'
require_relative '../../app/models/sift_analysis'
require_relative '../../app/models/chat_message'

describe 'SIFT Persistence Integration' do
  before do
    # Clean up test data before each test
    ChatMessage.where(Sequel.like(:message_text, 'TEST_%')).delete
    SiftAnalysis.where(Sequel.like(:user_query_text, 'TEST_%')).delete
  end

  after do
    # Clean up test data after each test
    ChatMessage.where(Sequel.like(:message_text, 'TEST_%')).delete
    SiftAnalysis.where(Sequel.like(:user_query_text, 'TEST_%')).delete
  end

  it 'saves initial SIFT analysis with user and AI messages' do
    skip 'Skipping database tests - no DB connection' unless PersistenceService.database_available?

    result = PersistenceService.save_initial_sift_analysis(
      user_query_text: 'TEST_USER_QUERY: Is this claim true?',
      report_type: 'FULL_CHECK',
      model_id_used: 'gemini-1.5-pro-latest',
      generated_report_text: 'TEST_AI_RESPONSE: Here is the SIFT analysis...',
      user_image_filename: nil
    )

    _(result).wont_be_nil
    _(result[:analysis_id]).wont_be_nil
    _(result[:user_message_id]).wont_be_nil
    _(result[:ai_message_id]).wont_be_nil

    # Verify analysis was created
    analysis = SiftAnalysis[result[:analysis_id]]
    _(analysis).wont_be_nil
    _(analysis.user_query_text).must_equal 'TEST_USER_QUERY: Is this claim true?'
    _(analysis.report_type).must_equal 'FULL_CHECK'
    _(analysis.model_id_used).must_equal 'gemini-1.5-pro-latest'

    # Verify messages were created
    _(analysis.chat_messages.count).must_equal 2
    user_msg = analysis.chat_messages.find { |msg| msg.sender_type == 'user' }
    ai_msg = analysis.chat_messages.find { |msg| msg.sender_type == 'assistant' }

    _(user_msg.message_text).must_equal 'TEST_USER_QUERY: Is this claim true?'
    _(ai_msg.message_text).must_equal 'TEST_AI_RESPONSE: Here is the SIFT analysis...'
    _(ai_msg.model_id_used).must_equal 'gemini-1.5-pro-latest'
  end

  it 'saves follow-up conversation messages' do
    skip 'Skipping database tests - no DB connection' unless PersistenceService.database_available?

    # First create an initial analysis
    initial_result = PersistenceService.save_initial_sift_analysis(
      user_query_text: 'TEST_INITIAL: What about this?',
      report_type: 'SUMMARY',
      model_id_used: 'gpt-4',
      generated_report_text: 'TEST_INITIAL_RESPONSE: Initial analysis...'
    )

    analysis_id = initial_result[:analysis_id]

    # Add follow-up conversation
    followup_result = PersistenceService.save_followup_conversation(
      analysis_id: analysis_id,
      user_message_text: 'TEST_FOLLOWUP: Can you explain more?',
      ai_response_text: 'TEST_FOLLOWUP_RESPONSE: Sure, here are more details...',
      model_id_used: 'gpt-4'
    )

    _(followup_result).wont_be_nil
    _(followup_result[:user_message_id]).wont_be_nil
    _(followup_result[:ai_message_id]).wont_be_nil

    # Verify conversation history
    analysis = SiftAnalysis[analysis_id]
    _(analysis.chat_messages.count).must_equal 4 # 2 initial + 2 follow-up

    conversation = analysis.conversation_history
    _(conversation.length).must_equal 4

    # Check message order
    _(conversation[0][:content]).must_equal 'TEST_INITIAL: What about this?'
    _(conversation[1][:content]).must_equal 'TEST_INITIAL_RESPONSE: Initial analysis...'
    _(conversation[2][:content]).must_equal 'TEST_FOLLOWUP: Can you explain more?'
    _(conversation[3][:content]).must_equal 'TEST_FOLLOWUP_RESPONSE: Sure, here are more details...'
  end

  it 'retrieves analysis with conversation history' do
    skip 'Skipping database tests - no DB connection' unless PersistenceService.database_available?

    # Create test analysis
    result = PersistenceService.save_initial_sift_analysis(
      user_query_text: 'TEST_RETRIEVE: Test query',
      report_type: 'IMAGE_ANALYSIS',
      model_id_used: 'claude-3-sonnet',
      generated_report_text: 'TEST_RETRIEVE_RESPONSE: Test response',
      user_image_filename: 'test_image.jpg'
    )

    analysis_id = result[:analysis_id]

    # Retrieve the analysis
    retrieved = PersistenceService.get_analysis_with_history(analysis_id)

    _(retrieved).wont_be_nil
    _(retrieved[:analysis]).wont_be_nil
    _(retrieved[:conversation_history]).wont_be_nil

    analysis_summary = retrieved[:analysis]
    _(analysis_summary[:user_query]).must_equal 'TEST_RETRIEVE: Test query'
    _(analysis_summary[:report_type]).must_equal 'IMAGE_ANALYSIS'
    _(analysis_summary[:model_used]).must_equal 'claude-3-sonnet'
    _(analysis_summary[:has_image]).must_equal true
    _(analysis_summary[:message_count]).must_equal 2

    conversation = retrieved[:conversation_history]
    _(conversation.length).must_equal 2
    _(conversation[0][:role]).must_equal 'user'
    _(conversation[1][:role]).must_equal 'assistant'
  end

  it 'gets recent analyses list' do
    skip 'Skipping database tests - no DB connection' unless PersistenceService.database_available?

    # Create multiple test analyses
    3.times do |i|
      PersistenceService.save_initial_sift_analysis(
        user_query_text: "TEST_RECENT_#{i}: Query #{i}",
        report_type: 'FULL_CHECK',
        model_id_used: 'gpt-4',
        generated_report_text: "TEST_RECENT_RESPONSE_#{i}: Response #{i}"
      )
    end

    recent = PersistenceService.get_recent_analyses(10)
    _(recent).must_be_kind_of Array

    # Should have at least our 3 test analyses
    test_analyses = recent.select { |a| a[:user_query].start_with?('TEST_RECENT_') }
    _(test_analyses.length).must_equal 3

    # Should be ordered by most recent first
    test_analyses.each_cons(2) do |newer, older|
      _(newer[:created_at]).must_be :>=, older[:created_at]
    end
  end
end