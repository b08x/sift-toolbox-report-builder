# frozen_string_literal: true

require 'sequel'
require_relative '../../config/database'

# ChatMessage model for storing individual chat messages in SIFT conversations
class ChatMessage < Sequel::Model(:chat_messages)
  # Associations
  many_to_one :sift_analysis, key: :sift_analysis_id

  # Validations
  plugin :validation_helpers
  
  def validate
    super
    validates_presence [:sift_analysis_id, :sender_type, :message_text]
    validates_includes %w[user assistant system], :sender_type, message: 'must be user, assistant, or system'
    validates_max_length 50, :sender_type
    validates_max_length 255, :model_id_used if model_id_used
  end

  # Hooks
  def before_create
    super
    self.timestamp ||= Time.now
  end

  # Class methods
  def self.create_user_message(sift_analysis_id:, message_text:)
    create(
      sift_analysis_id: sift_analysis_id,
      sender_type: 'user',
      message_text: message_text,
      timestamp: Time.now
    )
  end

  def self.create_assistant_message(sift_analysis_id:, message_text:, model_id_used:, grounding_sources: nil)
    create(
      sift_analysis_id: sift_analysis_id,
      sender_type: 'assistant',
      message_text: message_text,
      model_id_used: model_id_used,
      grounding_sources_json: grounding_sources&.to_json,
      timestamp: Time.now
    )
  end

  def self.for_analysis(sift_analysis_id)
    where(sift_analysis_id: sift_analysis_id).order(:timestamp)
  end

  def self.recent(limit = 100)
    order(Sequel.desc(:timestamp)).limit(limit)
  end

  def self.by_sender(sender_type)
    where(sender_type: sender_type.downcase)
  end

  # Instance methods
  def user_message?
    sender_type == 'user'
  end

  def assistant_message?
    sender_type == 'assistant'
  end

  def system_message?
    sender_type == 'system'
  end

  def has_grounding_sources?
    !grounding_sources_json.nil? && !grounding_sources_json.empty?
  end

  def grounding_sources
    return nil unless has_grounding_sources?
    
    # Handle both JSON string and JSONB types from PostgreSQL
    case grounding_sources_json
    when String
      JSON.parse(grounding_sources_json)
    when Hash, Sequel::Postgres::JSONBHash, Sequel::Postgres::JSONBObject
      # Convert JSONB objects to regular hash for consistency
      grounding_sources_json.to_hash
    else
      nil
    end
  rescue JSON::ParserError
    nil
  end

  def formatted_timestamp
    timestamp.strftime('%Y-%m-%d %H:%M:%S %Z')
  end

  def preview(length = 100)
    message_text.length > length ? "#{message_text[0...length]}..." : message_text
  end

  def to_hash
    {
      id: id,
      sift_analysis_id: sift_analysis_id,
      sender_type: sender_type,
      message_text: message_text,
      model_id_used: model_id_used,
      timestamp: timestamp,
      grounding_sources: grounding_sources
    }
  end

  # For ruby_llm chat history format
  def to_chat_format
    {
      role: sender_type == 'user' ? 'user' : 'assistant',
      content: message_text
    }
  end
end