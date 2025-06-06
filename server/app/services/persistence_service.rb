# frozen_string_literal: true

require_relative '../models/sift_analysis'
require_relative '../models/chat_message'
require_relative '../models/processed_url'

# PersistenceService handles saving SIFT analyses and messages to the database
module PersistenceService
  class PersistenceError < StandardError; end
  class AnalysisNotFoundError < StandardError; end

  class << self
    # Create a new SIFT analysis record
    #
    # @param user_query_text [String] The user's input text
    # @param report_type [String] The type of SIFT report (e.g., 'FULL_CHECK')
    # @param model_id_used [String] The AI model used for analysis
    # @param user_image_filename [String, nil] Optional image filename
    # @return [SiftAnalysis] The created analysis record
    def create_sift_analysis(user_query_text:, report_type:, model_id_used:, user_image_filename: nil)
      return nil unless DB # Guard against missing database connection
      
      begin
        analysis = SiftAnalysis.create_from_sift_request(
          user_query_text: user_query_text,
          report_type: report_type,
          model_id_used: model_id_used,
          user_image_filename: user_image_filename
        )
        
        puts "PersistenceService: Created SIFT analysis with ID: #{analysis.id}"
        analysis
      rescue Sequel::ValidationFailed => e
        raise PersistenceError, "Failed to create SIFT analysis: #{e.message}"
      rescue StandardError => e
        puts "PersistenceService: Error creating SIFT analysis: #{e.message}"
        raise PersistenceError, "Database error: #{e.message}"
      end
    end

    # Update a SIFT analysis with the generated report text
    #
    # @param analysis_id [String] The UUID of the analysis
    # @param generated_report_text [String] The completed SIFT report
    # @return [Boolean] True if successful
    def update_analysis_report(analysis_id:, generated_report_text:)
      return false unless DB
      
      begin
        analysis = SiftAnalysis[analysis_id]
        if analysis.nil?
          raise AnalysisNotFoundError, "Analysis not found: #{analysis_id}"
        end
        
        analysis.update_report(generated_report_text)
        puts "PersistenceService: Updated analysis #{analysis_id} with report (#{generated_report_text.length} chars)"
        true
      rescue AnalysisNotFoundError
        raise  # Re-raise as-is
      rescue Sequel::ValidationFailed => e
        raise PersistenceError, "Failed to update analysis report: #{e.message}"
      rescue StandardError => e
        puts "PersistenceService: Error updating analysis report: #{e.message}"
        raise PersistenceError, "Database error: #{e.message}"
      end
    end

    # Save a user message to the database
    #
    # @param analysis_id [String] The UUID of the associated analysis
    # @param message_text [String] The message content
    # @return [ChatMessage] The created message record
    def save_user_message(analysis_id:, message_text:)
      return nil unless DB
      
      begin
        message = ChatMessage.create_user_message(
          sift_analysis_id: analysis_id,
          message_text: message_text
        )
        
        puts "PersistenceService: Saved user message for analysis #{analysis_id}"
        message
      rescue Sequel::ValidationFailed => e
        raise PersistenceError, "Failed to save user message: #{e.message}"
      rescue StandardError => e
        puts "PersistenceService: Error saving user message: #{e.message}"
        raise PersistenceError, "Database error: #{e.message}"
      end
    end

    # Save an AI assistant message to the database
    #
    # @param analysis_id [String] The UUID of the associated analysis
    # @param message_text [String] The message content
    # @param model_id_used [String] The AI model used
    # @param grounding_sources [Hash, nil] Optional sources used for grounding
    # @return [ChatMessage] The created message record
    def save_assistant_message(analysis_id:, message_text:, model_id_used:, grounding_sources: nil)
      return nil unless DB
      
      begin
        message = ChatMessage.create_assistant_message(
          sift_analysis_id: analysis_id,
          message_text: message_text,
          model_id_used: model_id_used,
          grounding_sources: grounding_sources
        )
        
        puts "PersistenceService: Saved assistant message for analysis #{analysis_id} (#{message_text.length} chars)"
        message
      rescue Sequel::ValidationFailed => e
        raise PersistenceError, "Failed to save assistant message: #{e.message}"
      rescue StandardError => e
        puts "PersistenceService: Error saving assistant message: #{e.message}"
        raise PersistenceError, "Database error: #{e.message}"
      end
    end

    # Save initial SIFT analysis with user and AI messages
    #
    # @param user_query_text [String] The user's input
    # @param report_type [String] The SIFT report type
    # @param model_id_used [String] The AI model used
    # @param generated_report_text [String] The AI's response
    # @param user_image_filename [String, nil] Optional image filename
    # @param grounding_sources [Hash, nil] Optional sources
    # @return [Hash] Analysis and message IDs
    def save_initial_sift_analysis(user_query_text:, report_type:, model_id_used:, 
                                   generated_report_text:, user_image_filename: nil, 
                                   grounding_sources: nil)
      return nil unless DB
      
      begin
        DB.transaction do
          # Create the analysis
          analysis = create_sift_analysis(
            user_query_text: user_query_text,
            report_type: report_type,
            model_id_used: model_id_used,
            user_image_filename: user_image_filename
          )

          # Save the user's initial message
          user_message = save_user_message(
            analysis_id: analysis.id,
            message_text: user_query_text
          )

          # Save the AI's response
          ai_message = save_assistant_message(
            analysis_id: analysis.id,
            message_text: generated_report_text,
            model_id_used: model_id_used,
            grounding_sources: grounding_sources
          )

          # Update the analysis with the report text
          update_analysis_report(
            analysis_id: analysis.id,
            generated_report_text: generated_report_text
          )

          puts "PersistenceService: Successfully saved complete SIFT analysis #{analysis.id}"
          
          {
            analysis_id: analysis.id,
            user_message_id: user_message.id,
            ai_message_id: ai_message.id
          }
        end
      rescue StandardError => e
        puts "PersistenceService: Error in transaction: #{e.message}"
        raise PersistenceError, "Failed to save initial SIFT analysis: #{e.message}"
      end
    end

    # Save a follow-up conversation message
    #
    # @param analysis_id [String] The UUID of the analysis
    # @param user_message_text [String] The user's follow-up message
    # @param ai_response_text [String] The AI's response
    # @param model_id_used [String] The AI model used
    # @param grounding_sources [Hash, nil] Optional sources
    # @return [Hash] Message IDs
    def save_followup_conversation(analysis_id:, user_message_text:, ai_response_text:, 
                                   model_id_used:, grounding_sources: nil)
      return nil unless DB
      
      begin
        DB.transaction do
          # Save user's follow-up message
          user_message = save_user_message(
            analysis_id: analysis_id,
            message_text: user_message_text
          )

          # Save AI's response
          ai_message = save_assistant_message(
            analysis_id: analysis_id,
            message_text: ai_response_text,
            model_id_used: model_id_used,
            grounding_sources: grounding_sources
          )

          puts "PersistenceService: Saved follow-up conversation for analysis #{analysis_id}"
          
          {
            user_message_id: user_message.id,
            ai_message_id: ai_message.id
          }
        end
      rescue StandardError => e
        puts "PersistenceService: Error saving follow-up conversation: #{e.message}"
        raise PersistenceError, "Failed to save follow-up conversation: #{e.message}"
      end
    end

    # Retrieve a SIFT analysis with its conversation history
    #
    # @param analysis_id [String] The UUID of the analysis
    # @return [Hash, nil] Analysis data with messages
    def get_analysis_with_history(analysis_id)
      return nil unless DB
      
      begin
        analysis = SiftAnalysis[analysis_id]
        return nil unless analysis
        
        {
          analysis: analysis.summary,
          conversation_history: analysis.conversation_history
        }
      rescue StandardError => e
        puts "PersistenceService: Error retrieving analysis: #{e.message}"
        nil
      end
    end

    # Get recent SIFT analyses
    #
    # @param limit [Integer] Number of analyses to retrieve
    # @return [Array<Hash>] Array of analysis summaries
    def get_recent_analyses(limit = 50)
      return [] unless DB
      
      begin
        SiftAnalysis.recent(limit).map(&:summary)
      rescue StandardError => e
        puts "PersistenceService: Error retrieving recent analyses: #{e.message}"
        []
      end
    end

    # Check if database is available
    #
    # @return [Boolean] True if database connection exists
    def database_available?
      !DB.nil?
    end
  end
end