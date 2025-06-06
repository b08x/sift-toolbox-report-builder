# sift_backend/services/sift_service.rb
require 'json'
require_relative '../lib/image_handler' # For ImageHandler.process_uploaded_image
require_relative './ai_service'     # For AIService.generate_sift_stream

# It's good practice to have a logger available in services
# For now, we'll use puts for simplicity if no logger is passed or configured.
# require 'logger'
# LOGGER = Logger.new(STDOUT) # Example

module SiftService
  # Initiates the analysis by processing text and/or image input,
  # then calls the AIService to generate a streamed response.
  #
  # @param text [String, nil] User-provided text.
  # @param image_file [Hash, nil] Sinatra's file upload hash for an image.
  # @param report_type [String] The type of report to generate.
  # @param selected_model_id [String] The ID of the AI model to use.
  # @param model_config_params [Hash] Configuration parameters for the AI model.
  # @param block [Proc] The block to yield SSE chunks to, passed from Sinatra stream.
  def self.initiate_analysis(text: nil, image_file: nil, report_type:, selected_model_id:, model_config_params:, &block)
    unless block_given?
      # LOGGER.error "SiftService: No block provided for streaming."
      puts "SiftService: No block provided for streaming."
      # In a real app, you might raise an error or handle this more gracefully.
      return
    end

    # LOGGER.info "SiftService: Initiating analysis with report_type: #{report_type}, model: #{selected_model_id}"
    # LOGGER.debug "SiftService: Text provided: #{!text.nil? && !text.empty?}"
    # LOGGER.debug "SiftService: Image file provided: #{!image_file.nil?}"

    service_args = {
      user_input_text: text, # AIService expects :user_input_text
      report_type: report_type,
      selected_model_id: selected_model_id,
      model_config_params: model_config_params,
      # chat_history could be another parameter if needed
    }

    begin
      if image_file && image_file[:tempfile]
        # LOGGER.info "SiftService: Processing uploaded image..."
        ImageHandler.process_uploaded_image(image_file) do |processed_image_details|
          # This block is executed if image processing is successful.
          # The temporary file created by ImageHandler is available at processed_image_details[:file_path]
          # and will be cleaned up automatically after this block.

          # LOGGER.info "SiftService: Image processed successfully. Path: #{processed_image_details[:file_path]}"
          service_args[:image_file_details] = processed_image_details

          # Call AI service from within the block to ensure temp file is still valid
          AIService.generate_sift_stream(**service_args, &block)
        end
      else
        # No image or invalid image_file hash, proceed without image details
        # LOGGER.info "SiftService: No image provided or image_file data incomplete."
        service_args[:image_file_details] = nil
        AIService.generate_sift_stream(**service_args, &block)
      end
    rescue StandardError => e
      # LOGGER.error "SiftService: Error during analysis initiation: #{e.class.name} - #{e.message}"
      # LOGGER.error e.backtrace.join("
  ")
      # Yield a generic error to the client if one hasn't been yielded by AIService already
      # This is a fallback. AIService should ideally handle its own errors and stream them.
      error_json = { error: "An unexpected error occurred in SiftService: #{e.message}", type: e.class.name }.to_json
      block.call("event: error
data: #{error_json}

")
    end
  end
end
