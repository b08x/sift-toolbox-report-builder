require 'minitest/autorun'
require_relative '../../app/models/sift_analysis'
require_relative '../../app/models/chat_message'

class SiftAnalysisTest < Minitest::Test
  def setup
    skip 'Database not available' unless DB
    cleanup_test_data
  end

  def teardown
    cleanup_test_data if DB
  end

  def test_create_from_sift_request
    skip unless DB

    analysis = SiftAnalysis.create_from_sift_request(
      user_query_text: 'Test SIFT analysis request',
      report_type: 'FULL_CHECK',
      model_id_used: 'test-model-123'
    )

    assert analysis
    assert analysis.valid?
    assert_equal 'Test SIFT analysis request', analysis.user_query_text
    assert_equal 'FULL_CHECK', analysis.report_type
    assert_equal 'test-model-123', analysis.model_id_used
    refute_nil analysis.created_at
    refute_nil analysis.updated_at
  end

  def test_validation_requires_report_type
    skip unless DB

    analysis = SiftAnalysis.new(
      user_query_text: 'Test query',
      model_id_used: 'test-model'
      # Missing report_type
    )

    refute analysis.valid?
    assert analysis.errors.key?(:report_type)
  end

  def test_validation_report_type_must_be_valid
    skip unless DB

    analysis = SiftAnalysis.new(
      user_query_text: 'Test query',
      report_type: 'INVALID_TYPE',
      model_id_used: 'test-model'
    )

    refute analysis.valid?
    assert analysis.errors.key?(:report_type)
  end

  def test_update_report
    skip unless DB

    analysis = create_test_analysis
    original_updated_at = analysis.updated_at

    # Wait a moment to ensure timestamp difference
    sleep 0.001

    analysis.update_report('This is the generated SIFT report with analysis results.')

    analysis.refresh
    assert_equal 'This is the generated SIFT report with analysis results.', analysis.generated_report_text
    assert_operator analysis.updated_at, :>, original_updated_at
  end

  def test_add_message
    skip unless DB

    analysis = create_test_analysis
    grounding_sources = { 'url' => 'https://example.com', 'title' => 'Example Source' }

    message_id = analysis.add_message(
      sender_type: 'user',
      message_text: 'This is a test message',
      grounding_sources: grounding_sources
    )

    assert message_id

    # Verify the message was added
    messages = analysis.chat_messages
    assert_equal 1, messages.count

    message = messages.first
    assert_equal 'user', message.sender_type
    assert_equal 'This is a test message', message.message_text
    assert_equal grounding_sources, message.grounding_sources
  end

  def test_conversation_history
    skip unless DB

    analysis = create_test_analysis

    # Add some messages
    analysis.add_message(
      sender_type: 'user',
      message_text: 'First user message'
    )

    analysis.add_message(
      sender_type: 'assistant',
      message_text: 'First AI response',
      model_id_used: 'test-model'
    )

    analysis.add_message(
      sender_type: 'user',
      message_text: 'Follow-up question'
    )

    history = analysis.conversation_history

    assert_equal 3, history.length

    assert_equal 'user', history[0][:role]
    assert_equal 'First user message', history[0][:content]

    assert_equal 'assistant', history[1][:role]
    assert_equal 'First AI response', history[1][:content]
    assert_equal 'test-model', history[1][:model_id]

    assert_equal 'user', history[2][:role]
    assert_equal 'Follow-up question', history[2][:content]
  end

  def test_initial_messages
    skip unless DB

    analysis = create_test_analysis

    # Add messages in a specific order
    analysis.add_message(
      sender_type: 'user',
      message_text: 'First user message'
    )

    analysis.add_message(
      sender_type: 'assistant',
      message_text: 'First AI response'
    )

    analysis.add_message(
      sender_type: 'user',
      message_text: 'Second user message'
    )

    initial_user = analysis.initial_user_message
    initial_ai = analysis.initial_ai_message

    assert initial_user
    assert initial_ai
    assert_equal 'First user message', initial_user.message_text
    assert_equal 'First AI response', initial_ai.message_text
  end

  def test_has_image
    skip unless DB

    analysis_without_image = SiftAnalysis.create_from_sift_request(
      user_query_text: 'Text only query',
      report_type: 'FULL_CHECK',
      model_id_used: 'test-model'
    )

    analysis_with_image = SiftAnalysis.create_from_sift_request(
      user_query_text: 'Query with image',
      report_type: 'IMAGE_ANALYSIS',
      model_id_used: 'test-model',
      user_image_filename: 'test.jpg'
    )

    refute analysis_without_image.has_image?
    assert analysis_with_image.has_image?
  end

  def test_summary
    skip unless DB

    analysis = create_test_analysis
    analysis.add_message(sender_type: 'user', message_text: 'Test message')

    summary = analysis.summary

    assert summary[:id]
    assert_equal 'Test SIFT query', summary[:user_query]
    assert_equal 'FULL_CHECK', summary[:report_type]
    assert_equal 'test-model', summary[:model_used]
    assert_equal false, summary[:has_image]
    assert_equal 1, summary[:message_count]
    assert summary[:created_at]
    assert summary[:updated_at]
  end

  def test_class_methods
    skip unless DB

    # Create a few analyses
    create_test_analysis('Query 1')
    SiftAnalysis.create_from_sift_request(
      user_query_text: 'Query 2',
      report_type: 'SUMMARY',
      model_id_used: 'test-model'
    )

    # Test recent
    recent = SiftAnalysis.recent(10)
    assert_operator recent.count, :>=, 2

    # Test by_report_type
    full_check_analyses = SiftAnalysis.by_report_type('FULL_CHECK')
    summary_analyses = SiftAnalysis.by_report_type('SUMMARY')

    assert_operator full_check_analyses.count, :>=, 1
    assert_operator summary_analyses.count, :>=, 1

    # Verify they contain the right types
    assert(full_check_analyses.all? { |a| a.report_type == 'FULL_CHECK' })
    assert(summary_analyses.all? { |a| a.report_type == 'SUMMARY' })
  end

  def test_associations
    skip unless DB

    analysis = create_test_analysis

    # Add some messages
    3.times do |i|
      analysis.add_message(
        sender_type: i.even? ? 'user' : 'assistant',
        message_text: "Message #{i}"
      )
    end

    # Test association
    messages = analysis.chat_messages
    assert_equal 3, messages.count

    # Messages should be ordered by timestamp
    timestamps = messages.map(&:timestamp)
    assert_equal timestamps.sort, timestamps

    # Test reverse association
    first_message = messages.first
    assert_equal analysis.id, first_message.sift_analysis.id
  end

  private

  def create_test_analysis(query_text = 'Test SIFT query')
    SiftAnalysis.create_from_sift_request(
      user_query_text: query_text,
      report_type: 'FULL_CHECK',
      model_id_used: 'test-model'
    )
  end

  def cleanup_test_data
    return unless DB

    begin
      DB[:chat_messages].where(model_id_used: 'test-model').delete
      DB[:sift_analyses].where(model_id_used: 'test-model').delete
      DB[:sift_analyses].where(model_id_used: 'test-model-123').delete
    rescue StandardError => e
      puts "Warning: Failed to cleanup test data: #{e.message}"
    end
  end
end
