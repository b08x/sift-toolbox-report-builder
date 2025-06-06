# frozen_string_literal: true

require 'sequel'
require_relative '../../config/database'

# SiftAnalysis model for storing SIFT fact-checking analysis reports
class SiftAnalysis < Sequel::Model(:sift_analyses)
  # Enable timestamps plugin for automatic created_at/updated_at management
  plugin :timestamps, update_on_create: true

  # Associations
  one_to_many :chat_messages, key: :sift_analysis_id, order: :timestamp

  # Validations
  plugin :validation_helpers

  def validate
    super
    validates_presence [:report_type]
    validates_includes %w[FULL_CHECK SUMMARY IMAGE_ANALYSIS], :report_type, message: 'must be a valid report type'
    validates_max_length 100, :report_type
    validates_max_length 255, :model_id_used
    validates_max_length 255, :user_image_filename if user_image_filename
  end

  # Hooks
  def before_create
    super
    self.created_at ||= Time.now
    self.updated_at ||= Time.now
  end

  def before_update
    super
    self.updated_at = Time.now
  end

  # Class methods
  def self.create_from_sift_request(user_query_text:, report_type:, model_id_used:, user_image_filename: nil)
    create(
      user_query_text: user_query_text,
      user_image_filename: user_image_filename,
      report_type: report_type.upcase,
      model_id_used: model_id_used
    )
  end

  def self.recent(limit = 50)
    order(Sequel.desc(:created_at)).limit(limit)
  end

  def self.by_report_type(report_type)
    where(report_type: report_type.upcase)
  end

  # Instance methods
  def update_report(generated_text)
    update(
      generated_report_text: generated_text,
      updated_at: Time.now
    )
  end

  def add_message(sender_type:, message_text:, model_id_used: nil, grounding_sources: nil)
    chat_messages_dataset.insert(
      sender_type: sender_type.downcase,
      message_text: message_text,
      model_id_used: model_id_used,
      grounding_sources_json: grounding_sources&.to_json,
      timestamp: Time.now
    )
  end

  def initial_user_message
    chat_messages_dataset.where(sender_type: 'user').order(:timestamp).first
  end

  def initial_ai_message
    chat_messages_dataset.where(sender_type: 'assistant').order(:timestamp).first
  end

  def conversation_history
    chat_messages.map do |msg|
      {
        role: msg.sender_type == 'user' ? 'user' : 'assistant',
        content: msg.message_text,
        timestamp: msg.timestamp,
        model_id: msg.model_id_used,
        grounding_sources: msg.grounding_sources_json
      }
    end
  end

  def has_image?
    !user_image_filename.nil? && !user_image_filename.empty?
  end

  def summary
    {
      id: id,
      user_query: user_query_text,
      report_type: report_type,
      model_used: model_id_used,
      has_image: has_image?,
      message_count: chat_messages.count,
      created_at: created_at,
      updated_at: updated_at
    }
  end
end
