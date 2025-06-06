require 'minitest/autorun'
require_relative '../../app/services/persistence_service'
require_relative '../../config/database'

class PersistenceServiceTest < Minitest::Test
  def setup
    # Skip all tests if no database connection
    skip 'Database not available' unless DB

    # Clean up test data before each test
    cleanup_test_data
    @test_analysis_id = nil
  end

  def teardown
    # Clean up test data after each test
    cleanup_test_data if DB
  end

  def test_database_available
    # This test should pass if database is connected
    if DB
      assert PersistenceService.database_available?
    else
      refute PersistenceService.database_available?
    end
  end

  def test_create_sift_analysis
    skip unless DB

    analysis = PersistenceService.create_sift_analysis(
      user_query_text: 'Test query for fact checking',
      report_type: 'FULL_CHECK',
      model_id_used: 'test-model-1',
      user_image_filename: nil
    )

    assert analysis
    assert_kind_of SiftAnalysis, analysis
    assert_equal 'Test query for fact checking', analysis.user_query_text
    assert_equal 'FULL_CHECK', analysis.report_type
    assert_equal 'test-model-1', analysis.model_id_used
    refute_nil analysis.id
    @test_analysis_id = analysis.id
  end

  def test_create_sift_analysis_with_image
    skip unless DB

    analysis = PersistenceService.create_sift_analysis(
      user_query_text: 'Analyze this image',
      report_type: 'IMAGE_ANALYSIS',
      model_id_used: 'vision-model',
      user_image_filename: 'test_image.jpg'
    )

    assert analysis
    assert_equal 'test_image.jpg', analysis.user_image_filename
    assert analysis.has_image?
    @test_analysis_id = analysis.id
  end

  def test_create_sift_analysis_validation_error
    skip unless DB

    assert_raises(PersistenceService::PersistenceError) do
      PersistenceService.create_sift_analysis(
        user_query_text: 'Test query',
        report_type: 'INVALID_TYPE', # Invalid report type
        model_id_used: 'test-model'
      )
    end
  end

  def test_update_analysis_report
    skip unless DB

    analysis = create_test_analysis

    result = PersistenceService.update_analysis_report(
      analysis_id: analysis.id,
      generated_report_text: 'This is the complete SIFT analysis report with findings and conclusions.'
    )

    assert result

    # Reload and verify
    analysis.refresh
    assert_equal 'This is the complete SIFT analysis report with findings and conclusions.',
                 analysis.generated_report_text
  end

  def test_update_analysis_report_not_found
    skip unless DB

    fake_id = '00000000-0000-0000-0000-000000000000'

    assert_raises(PersistenceService::AnalysisNotFoundError) do
      PersistenceService.update_analysis_report(
        analysis_id: fake_id,
        generated_report_text: 'Test report'
      )
    end
  end

  def test_save_user_message
    skip unless DB

    analysis = create_test_analysis

    message = PersistenceService.save_user_message(
      analysis_id: analysis.id,
      message_text: 'This is my follow-up question'
    )

    assert message
    assert_kind_of ChatMessage, message
    assert_equal analysis.id, message.sift_analysis_id
    assert_equal 'user', message.sender_type
    assert_equal 'This is my follow-up question', message.message_text
    assert message.user_message?
  end

  def test_save_assistant_message
    skip unless DB

    analysis = create_test_analysis
    grounding_sources = { 'sources' => %w[source1 source2] }

    message = PersistenceService.save_assistant_message(
      analysis_id: analysis.id,
      message_text: "Here's my response to your question",
      model_id_used: 'test-model',
      grounding_sources: grounding_sources
    )

    assert message
    assert_kind_of ChatMessage, message
    assert_equal analysis.id, message.sift_analysis_id
    assert_equal 'assistant', message.sender_type
    assert_equal 'test-model', message.model_id_used
    assert message.assistant_message?
    assert message.has_grounding_sources?
    assert_equal grounding_sources, message.grounding_sources
  end

  def test_save_initial_sift_analysis_complete
    skip unless DB

    result = PersistenceService.save_initial_sift_analysis(
      user_query_text: 'Check this claim about vaccines',
      report_type: 'FULL_CHECK',
      model_id_used: 'gemini-pro',
      generated_report_text: 'Complete SIFT analysis with fact-checking results',
      user_image_filename: nil
    )

    assert result
    assert result[:analysis_id]
    assert result[:user_message_id]
    assert result[:ai_message_id]

    @test_analysis_id = result[:analysis_id]

    # Verify the analysis was created
    analysis = SiftAnalysis[result[:analysis_id]]
    assert analysis
    assert_equal 'Check this claim about vaccines', analysis.user_query_text
    assert_equal 'Complete SIFT analysis with fact-checking results', analysis.generated_report_text

    # Verify messages were created
    messages = analysis.chat_messages
    assert_equal 2, messages.count

    user_message = messages.find { |m| m.user_message? }
    ai_message = messages.find { |m| m.assistant_message? }

    assert user_message
    assert ai_message
    assert_equal 'Check this claim about vaccines', user_message.message_text
    assert_equal 'Complete SIFT analysis with fact-checking results', ai_message.message_text
  end

  def test_save_followup_conversation
    skip unless DB

    analysis = create_test_analysis

    result = PersistenceService.save_followup_conversation(
      analysis_id: analysis.id,
      user_message_text: 'Can you clarify that point?',
      ai_response_text: 'Certainly, let me explain in more detail...',
      model_id_used: 'gemini-pro'
    )

    assert result
    assert result[:user_message_id]
    assert result[:ai_message_id]

    # Verify messages were added
    analysis.refresh
    messages = analysis.chat_messages
    assert_equal 2, messages.count

    user_msg = ChatMessage[result[:user_message_id]]
    ai_msg = ChatMessage[result[:ai_message_id]]

    assert_equal 'Can you clarify that point?', user_msg.message_text
    assert_equal 'Certainly, let me explain in more detail...', ai_msg.message_text
  end

  def test_get_analysis_with_history
    skip unless DB

    # Create analysis with some messages
    analysis = create_test_analysis
    PersistenceService.save_user_message(
      analysis_id: analysis.id,
      message_text: 'First message'
    )
    PersistenceService.save_assistant_message(
      analysis_id: analysis.id,
      message_text: 'First response',
      model_id_used: 'test-model'
    )

    result = PersistenceService.get_analysis_with_history(analysis.id)

    assert result
    assert result[:analysis]
    assert result[:conversation_history]

    assert_equal analysis.id, result[:analysis][:id]
    assert_equal 2, result[:conversation_history].count

    history = result[:conversation_history]
    assert_equal 'user', history[0][:role]
    assert_equal 'First message', history[0][:content]
    assert_equal 'assistant', history[1][:role]
    assert_equal 'First response', history[1][:content]
  end

  def test_get_recent_analyses
    skip unless DB

    # Create a few test analyses
    3.times do |i|
      create_test_analysis("Test query #{i}")
    end

    analyses = PersistenceService.get_recent_analyses(5)

    assert analyses
    assert_kind_of Array, analyses
    assert_operator analyses.length, :>=, 3

    # Should be sorted by most recent first
    first_analysis = analyses.first
    assert first_analysis[:id]
    assert first_analysis[:user_query]
    assert first_analysis[:report_type]
    assert first_analysis[:created_at]
  end

  def test_transaction_rollback_on_error
    skip unless DB

    # This test would require mocking to simulate a failure partway through
    # For now, we'll just verify that invalid data doesn't get saved

    assert_raises(PersistenceService::PersistenceError) do
      PersistenceService.save_initial_sift_analysis(
        user_query_text: '', # Empty query should cause validation error
        report_type: 'INVALID', # Invalid type
        model_id_used: 'test-model',
        generated_report_text: 'Test report'
      )
    end

    # Verify no partial data was saved
    analyses = SiftAnalysis.where(model_id_used: 'test-model').all
    assert_equal 0, analyses.count
  end

  private

  def create_test_analysis(query_text = 'Test query for SIFT analysis')
    analysis = PersistenceService.create_sift_analysis(
      user_query_text: query_text,
      report_type: 'FULL_CHECK',
      model_id_used: 'test-model'
    )
    @test_analysis_id = analysis.id
    analysis
  end

  def cleanup_test_data
    return unless DB

    begin
      # Clean up any test data - be careful to only delete test data
      DB[:chat_messages].where(model_id_used: 'test-model').delete
      DB[:sift_analyses].where(model_id_used: 'test-model').delete
      DB[:sift_analyses].where(model_id_used: 'vision-model').delete
      DB[:sift_analyses].where(model_id_used: 'gemini-pro').delete

      # Also clean up by test analysis ID if we have one
      if @test_analysis_id
        DB[:chat_messages].where(sift_analysis_id: @test_analysis_id).delete
        DB[:sift_analyses].where(id: @test_analysis_id).delete
      end
    rescue StandardError => e
      puts "Warning: Failed to cleanup test data: #{e.message}"
    end
  end
end
