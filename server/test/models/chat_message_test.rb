require 'minitest/autorun'
require_relative '../../app/models/chat_message'
require_relative '../../app/models/sift_analysis'

class ChatMessageTest < Minitest::Test
  def setup
    skip 'Database not available' unless DB
    cleanup_test_data
    @test_analysis = create_test_analysis if DB
  end

  def teardown
    cleanup_test_data if DB
  end

  def test_create_user_message
    skip unless DB

    message = ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'This is a user message'
    )

    assert message
    assert message.valid?
    assert_equal @test_analysis.id, message.sift_analysis_id
    assert_equal 'user', message.sender_type
    assert_equal 'This is a user message', message.message_text
    assert message.user_message?
    refute message.assistant_message?
    refute message.system_message?
    refute_nil message.timestamp
  end

  def test_create_assistant_message
    skip unless DB

    grounding_sources = {
      'sources' => [
        { 'url' => 'https://example.com', 'title' => 'Example Source' },
        { 'url' => 'https://test.com', 'title' => 'Test Source' }
      ]
    }

    message = ChatMessage.create_assistant_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'This is an AI assistant response',
      model_id_used: 'gemini-1.5-pro',
      grounding_sources: grounding_sources
    )

    assert message
    assert message.valid?
    assert_equal @test_analysis.id, message.sift_analysis_id
    assert_equal 'assistant', message.sender_type
    assert_equal 'This is an AI assistant response', message.message_text
    assert_equal 'gemini-1.5-pro', message.model_id_used
    assert message.assistant_message?
    refute message.user_message?
    refute message.system_message?
    assert message.has_grounding_sources?
    assert_equal grounding_sources, message.grounding_sources
  end

  def test_validation_requires_fields
    skip unless DB

    # Missing sift_analysis_id
    message = ChatMessage.new(
      sender_type: 'user',
      message_text: 'Test message'
    )
    refute message.valid?
    assert message.errors.key?(:sift_analysis_id)

    # Missing sender_type
    message = ChatMessage.new(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Test message'
    )
    refute message.valid?
    assert message.errors.key?(:sender_type)

    # Missing message_text
    message = ChatMessage.new(
      sift_analysis_id: @test_analysis.id,
      sender_type: 'user'
    )
    refute message.valid?
    assert message.errors.key?(:message_text)
  end

  def test_validation_sender_type
    skip unless DB

    # Valid sender types
    %w[user assistant system].each do |sender_type|
      message = ChatMessage.new(
        sift_analysis_id: @test_analysis.id,
        sender_type: sender_type,
        message_text: 'Test message'
      )
      assert message.valid?, "#{sender_type} should be valid"
    end

    # Invalid sender type
    message = ChatMessage.new(
      sift_analysis_id: @test_analysis.id,
      sender_type: 'invalid',
      message_text: 'Test message'
    )
    refute message.valid?
    assert message.errors.key?(:sender_type)
  end

  def test_grounding_sources_json
    skip unless DB

    # Message without grounding sources
    message = ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Simple message'
    )

    refute message.has_grounding_sources?
    assert_nil message.grounding_sources

    # Message with grounding sources
    sources = { 'urls' => ['http://example.com'], 'confidence' => 0.85 }
    message = ChatMessage.create_assistant_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Response with sources',
      model_id_used: 'test-model',
      grounding_sources: sources
    )

    assert message.has_grounding_sources?
    assert_equal sources, message.grounding_sources
  end

  def test_grounding_sources_malformed_json
    skip unless DB

    message = ChatMessage.create_assistant_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Test message',
      model_id_used: 'test-model'
    )

    # Manually set malformed JSON to test error handling
    message.update(grounding_sources_json: 'invalid json')

    assert message.has_grounding_sources? # Has content but invalid
    assert_nil message.grounding_sources  # Should return nil for malformed JSON
  end

  def test_for_analysis_scope
    skip unless DB

    # Create messages for our test analysis
    msg1 = ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'First message'
    )

    sleep 0.001 # Ensure different timestamps

    msg2 = ChatMessage.create_assistant_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Second message',
      model_id_used: 'test-model'
    )

    # Create a message for a different analysis
    other_analysis = create_test_analysis('Other analysis')
    ChatMessage.create_user_message(
      sift_analysis_id: other_analysis.id,
      message_text: 'Other message'
    )

    messages = ChatMessage.for_analysis(@test_analysis.id)

    assert_equal 2, messages.count
    # Should be ordered by timestamp
    assert_equal msg1.id, messages.first.id
    assert_equal msg2.id, messages.last.id
  end

  def test_by_sender_scope
    skip unless DB

    ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'User message 1'
    )

    ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'User message 2'
    )

    ChatMessage.create_assistant_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Assistant message',
      model_id_used: 'test-model'
    )

    user_messages = ChatMessage.by_sender('user')
    assistant_messages = ChatMessage.by_sender('assistant')

    assert_operator user_messages.count, :>=, 2
    assert_operator assistant_messages.count, :>=, 1

    assert user_messages.all?(&:user_message?)
    assert assistant_messages.all?(&:assistant_message?)
  end

  def test_recent_scope
    skip unless DB

    # Create several messages
    5.times do |i|
      ChatMessage.create_user_message(
        sift_analysis_id: @test_analysis.id,
        message_text: "Message #{i}"
      )
    end

    recent = ChatMessage.recent(3)
    assert_equal 3, recent.count

    # Should be ordered by most recent first
    timestamps = recent.map(&:timestamp)
    assert_equal timestamps.sort.reverse, timestamps
  end

  def test_preview
    skip unless DB

    short_message = ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Short message'
    )

    long_message = ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'This is a very long message that should be truncated when we call the preview method because it exceeds the default length limit of 100 characters and we want to show just a preview with ellipsis at the end.'
    )

    assert_equal 'Short message', short_message.preview

    long_preview = long_message.preview(50)
    assert_equal 53, long_preview.length # 50 + "..."
    assert long_preview.end_with?('...')
    refute long_preview.include?('ellipsis') # Should be truncated before this word
  end

  def test_formatted_timestamp
    skip unless DB

    message = ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Test message'
    )

    formatted = message.formatted_timestamp
    assert_kind_of String, formatted
    assert_match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, formatted)
  end

  def test_to_hash
    skip unless DB

    grounding_sources = { 'confidence' => 0.9 }
    message = ChatMessage.create_assistant_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Test response',
      model_id_used: 'test-model',
      grounding_sources: grounding_sources
    )

    hash = message.to_hash

    assert_equal message.id, hash[:id]
    assert_equal @test_analysis.id, hash[:sift_analysis_id]
    assert_equal 'assistant', hash[:sender_type]
    assert_equal 'Test response', hash[:message_text]
    assert_equal 'test-model', hash[:model_id_used]
    assert_equal grounding_sources, hash[:grounding_sources]
    assert hash[:timestamp]
  end

  def test_to_chat_format
    skip unless DB

    user_message = ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'User question'
    )

    assistant_message = ChatMessage.create_assistant_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Assistant response',
      model_id_used: 'test-model'
    )

    user_format = user_message.to_chat_format
    assistant_format = assistant_message.to_chat_format

    assert_equal({ role: 'user', content: 'User question' }, user_format)
    assert_equal({ role: 'assistant', content: 'Assistant response' }, assistant_format)
  end

  def test_association_with_sift_analysis
    skip unless DB

    message = ChatMessage.create_user_message(
      sift_analysis_id: @test_analysis.id,
      message_text: 'Test message'
    )

    # Test association
    associated_analysis = message.sift_analysis
    assert_equal @test_analysis.id, associated_analysis.id
    assert_equal @test_analysis.user_query_text, associated_analysis.user_query_text
  end

  private

  def create_test_analysis(query_text = 'Test SIFT analysis')
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
    rescue StandardError => e
      puts "Warning: Failed to cleanup test data: #{e.message}"
    end
  end
end
