require 'sinatra'
require 'logger'
require 'json'
require 'sinatra/cross_origin'
require 'dotenv/load' # Loads environment variables from .env
require 'securerandom' # For generating unique IDs
require_relative 'config/database' # Load database configuration
require_relative 'config/config' # Load API key configuration
require_relative 'config/initializers/ruby_llm' # Load AI service configuration
require_relative 'services/sift_service'
require_relative 'services/ai_service' # For AIService.continue_sift_chat
require_relative 'lib/image_handler'

class MyCustomError < StandardError; end

configure do
  enable :cross_origin

  # Logger configuration
  environment = ENV['RACK_ENV'] || 'development'
  set :environment, environment.to_sym

  if settings.environment == :production
    Dir.mkdir('log') unless File.exist?('log')
    # Log Rotation:
    # In a production environment, log files can grow very large over time.
    # Log rotation is a process that automatically archives or deletes old log
    # files and starts new ones. This prevents disk space issues and makes
    # logs easier to manage.
    # Log rotation is typically handled by external utilities like 'logrotate'
    # on Linux systems or other platform-specific logging services. It's an
    # important operational consideration for production deployments.
    set :logger, Logger.new('log/production.log')
    settings.logger.level = Logger::INFO
  else
    set :logger, Logger.new(STDOUT)
    settings.logger.level = Logger::DEBUG
  end

  settings.logger.info "Logger initialized for #{settings.environment} environment"
end

# CORS Configuration
# For development, allow requests from the frontend development server.
# In production, this should be set to the actual frontend domain.
set :allow_origin, ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
set :allow_methods, %i[get post put delete options]
set :allow_headers, %w[Content-Type Authorization X-Requested-With]
set :expose_headers, ['Content-Type'] # Optional: Add any other headers you want to expose

# Centralized Error Handling
# Provides consistent JSON error responses and logs issues.

# Explanation: Sinatra's `error` blocks allow you to define specific handlers
# for different types of exceptions that occur during request processing.
# When an exception is raised, Sinatra searches for an `error` block that
# matches the exception's class. If a match is found, the block is executed.
# If no specific handler is found, Sinatra falls back to more generic handlers
# (like `StandardError`) or its default error page.

# Custom Application Error
error MyCustomError do |e|
  status 400 # Bad Request (or a more specific code like 422 if appropriate)
  content_type :json

  error_details = { type: e.class.name, message: e.message }
  settings.logger.error "MyCustomError: #{e.message}"
  settings.logger.debug e.backtrace.join("\n") if settings.development? # Log backtrace in development

  { error: error_details }.to_json
end

# Sinatra::NotFound (404) Handler
# This handler catches errors raised when a route is not found.
error Sinatra::NotFound do
  status 404
  content_type :json

  error_details = { type: 'Sinatra::NotFound', message: "Endpoint not found: #{request.path_info}" }
  settings.logger.warn "404 Not Found: #{request.path_info}" # Log as warning, less severe than an error

  { error: error_details }.to_json
end

# Generic StandardError Handler (Catch-all)
# This should generally be the last error handler defined, to catch any
# exceptions not handled by more specific blocks.
error StandardError do |e|
  status 500 # Internal Server Error
  content_type :json

  error_message = if settings.development?
                    "Internal Server Error: #{e.message}"
                  else
                    'An unexpected error occurred. Please try again later.'
                  end
  error_details = { type: e.class.name, message: error_message }

  settings.logger.error "StandardError: #{e.message}"
  settings.logger.error e.backtrace.join("\n") # Log full backtrace for StandardError

  { error: error_details }.to_json
end

# Support for preflight requests
# The OPTIONS method is used by browsers to send a "preflight" request to the server
# to determine if the actual request (e.g., a POST with a JSON body) is safe to send.
# This is a crucial part of the CORS mechanism.
options '*' do
  response.headers['Allow'] = 'GET, POST, PUT, DELETE, OPTIONS'
  response.headers['Access-Control-Allow-Origin'] = settings.allow_origin
  response.headers['Access-Control-Allow-Headers'] = settings.allow_headers.join(', ')
  response.headers['Access-Control-Allow-Methods'] = settings.allow_methods.map(&:to_s).map(&:upcase).join(', ')
  200 # HTTP 200 OK
end

#
# Security Note on CORS Configuration:
# It is crucial to be very careful with CORS settings in a production environment.
# - Avoid using `*` (wildcard) for `Access-Control-Allow-Origin` if your application handles sensitive data or credentials.
#   Allowing any origin to make requests can expose your application to cross-site request forgery (CSRF) like attacks
#   if combined with `Access-Control-Allow-Credentials: true`.
# - Always specify the exact, trusted domains that should be allowed to access your API.
#   For example: `set :allow_origin, 'https://your-trusted-frontend.com'`
#   Or manage a list of allowed origins dynamically based on your application's needs.
#

# In a more complex application, you would require route files here:
# Dir[File.join(__dir__, 'app', 'routes', '*.rb')].each { |file| require file }

# Placeholder for global configurations or helpers
# configure do
#   # Example: set :public_folder, File.expand_path('../public', __FILE__)
# end

# Helper method for SSE streaming
helpers do
  def send_sse_event(out, event_type, data)
    return if out.closed?
    
    sse_message = case event_type
                  when :data
                    "data: #{data.to_json}\n\n"
                  when :event
                    "event: #{data[:event]}\ndata: #{data[:data].to_json}\n\n"
                  else
                    "#{event_type}: #{data}\n\n"
                  end
    
    out << sse_message
    out.flush if out.respond_to?(:flush) # Ensure immediate transmission
  rescue StandardError => e
    settings.logger.error "Error sending SSE event: #{e.message}"
  end
end

# Basic health check route
get '/api/health' do
  settings.logger.info "Received #{request.request_method} request for #{request.path_info}"
  content_type :json
  { message: 'OK', timestamp: Time.now.iso8601 }.to_json
end

# Model configuration endpoint - serves AI model configurations
# derived from ruby_llm.models merged with SIFT UI parameters
get '/api/models/config' do
  settings.logger.info "Received #{request.request_method} request for #{request.path_info}"
  content_type :json

  begin
    models = RubyLLM.models.map do |model|
      # Map RubyLLM model to frontend format
      provider = case model.provider
                 when 'anthropic' then 'OPENROUTER' # Anthropic models via OpenRouter
                 when 'openai' then 'OPENAI'
                 when 'google' then 'GOOGLE_GEMINI'
                 when 'bedrock' then 'OPENROUTER' # AWS Bedrock models via OpenRouter
                 else 'OPENROUTER' # Default fallback
                 end

      # Determine vision support based on modalities
      supports_vision = model.modalities.input.include?('image')

      # Standard SIFT parameters based on model capabilities
      parameters = []

      # Temperature parameter (most models support this)
      parameters << {
        key: 'temperature',
        label: 'Temperature',
        type: 'slider',
        min: 0,
        max: model.provider == 'openai' ? 2 : 1,
        step: 0.01,
        defaultValue: 0.7,
        description: 'Controls randomness. Lower for more predictable, higher for more creative.'
      }

      # Top-P parameter
      parameters << {
        key: 'topP',
        label: 'Top-P',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.95,
        description: 'Nucleus sampling. Considers tokens with probability mass adding up to topP.'
      }

      # Add max_tokens for OpenAI/OpenRouter models
      if %w[openai openrouter].include?(model.provider.downcase)
        max_tokens = model.max_output_tokens || 4096
        parameters << {
          key: 'max_tokens',
          label: 'Max Tokens',
          type: 'slider',
          min: 50,
          max: [max_tokens, 32_000].min, # Cap at reasonable UI limit
          step: 50,
          defaultValue: [max_tokens / 4, 1024].max,
          description: 'Maximum number of tokens to generate in the completion.'
        }
      end

      # Add Top-K for Google models
      if model.provider == 'google' || model.family&.include?('gemini')
        parameters << {
          key: 'topK',
          label: 'Top-K',
          type: 'slider',
          min: 1,
          max: 100,
          step: 1,
          defaultValue: 40,
          description: 'Considers the top K most probable tokens.'
        }
      end

      {
        id: model.id,
        name: model.name,
        provider: provider,
        supportsGoogleSearch: model.provider == 'google' && supports_vision, # Heuristic
        supportsVision: supports_vision,
        parameters: parameters,
        # Additional metadata for debugging/development
        metadata: {
          original_provider: model.provider,
          context_window: model.context_window,
          max_output_tokens: model.max_output_tokens,
          capabilities: model.capabilities,
          family: model.family
        }
      }
    end

    # Filter to only models that have required API keys configured
    available_models = models.select do |model_config|
      case model_config[:metadata][:original_provider]
      when 'google'
        # Google models need Gemini API key
        begin
          Config.gemini_api_key
          true
        rescue Config::MissingKeyError
          false
        end
      when 'openai'
        # OpenAI models need OpenAI API key
        begin
          Config.openai_api_key
          true
        rescue Config::MissingKeyError
          false
        end
      else
        # Anthropic, Bedrock, and other models via OpenRouter
        begin
          Config.openrouter_api_key
          true
        rescue Config::MissingKeyError
          false
        end
      end
    end

    { models: available_models }.to_json
  rescue StandardError => e
    settings.logger.error "Error generating model config: #{e.message}"
    settings.logger.error e.backtrace.join("\n")
    status 500
    { error: { type: 'ModelConfigError', message: "Failed to load model configurations: #{e.message}" } }.to_json
  end
end

# New route for testing logging
get '/api/test_log' do
  settings.logger.info "Received #{request.request_method} request for #{request.path_info}"
  settings.logger.warn 'This is a test warning message.'
  settings.logger.error 'This is a test error message.'
  content_type :json
  { message: 'Test log messages created. Check your logs.' }.to_json
end

# --- Example Routes for Error Handling Testing ---

# Route to test MyCustomError handler
get '/api/test_custom_error' do
  settings.logger.info 'Triggering MyCustomError...'
  raise MyCustomError, 'This is a test of the custom error handling.'
end

# Route to test StandardError handler
get '/api/test_standard_error' do
  settings.logger.info 'Triggering a StandardError...'
  raise StandardError, 'This is a test of the generic StandardError handling.'
end

post '/api/sift/initiate' do
  settings.logger.info 'POST /api/sift/initiate - Received request'

  # Parameter extraction
  user_input_text = params['userInputText']
  # When a file is uploaded, params['userImageFile'] is a hash, e.g.:
  # { :filename => "my_image.png", :type => "image/png",
  #   :name => "userImageFile", :tempfile => #<File:/tmp/RackMultipart2023...>,
  #   :head => "Content-Disposition: form-data; name="userImageFile"; filename="my_image.png"\r\nContent-Type: image/png\r\n" }
  user_image_file_data = params['userImageFile']
  report_type = params['reportType']
  selected_model_id = params['selectedModelId']
  model_config_params_json = params['modelConfigParams']

  settings.logger.debug "Raw params: #{params.inspect}" # For detailed debugging
  settings.logger.debug "userInputText: #{user_input_text.nil? || user_input_text.empty? ? 'empty' : user_input_text[0..50]}"
  settings.logger.debug "userImageFile: #{user_image_file_data.inspect if user_image_file_data}"
  settings.logger.debug "reportType: #{report_type}"
  settings.logger.debug "selectedModelId: #{selected_model_id}"
  settings.logger.debug "modelConfigParams_json: #{model_config_params_json}"

  # Validation
  has_text = user_input_text && !user_input_text.strip.empty?
  has_image = user_image_file_data && user_image_file_data[:tempfile] && user_image_file_data[:filename]

  unless has_text || has_image
    settings.logger.warn 'Validation failed: userInputText or userImageFile is required.'
    halt 400, { 'Content-Type' => 'application/json' },
         { error: { type: 'MissingParameterError', message: 'Either userInputText or userImageFile must be provided and contain data.' } }.to_json
  end

  if report_type.nil? || report_type.strip.empty?
    settings.logger.warn 'Validation failed: reportType is required.'
    halt 400, { 'Content-Type' => 'application/json' },
         { error: { type: 'MissingParameterError', message: 'reportType is a required parameter.' } }.to_json
  end

  if selected_model_id.nil? || selected_model_id.strip.empty?
    settings.logger.warn 'Validation failed: selectedModelId is required.'
    halt 400, { 'Content-Type' => 'application/json' },
         { error: { type: 'MissingParameterError', message: 'selectedModelId is a required parameter.' } }.to_json
  end

  model_config_params = {}
  if model_config_params_json && !model_config_params_json.strip.empty?
    begin
      model_config_params = JSON.parse(model_config_params_json)
      unless model_config_params.is_a?(Hash)
        settings.logger.warn 'Validation failed: modelConfigParams is not a valid JSON object string.'
        halt 400, { 'Content-Type' => 'application/json' },
             { error: { type: 'InvalidParameterError', message: 'modelConfigParams must be a string representing a valid JSON object.' } }.to_json
      end
    rescue JSON::ParserError => e
      settings.logger.warn "JSON Parsing Error for modelConfigParams: #{e.message}"
      halt 400, { 'Content-Type' => 'application/json' },
           { error: { type: 'InvalidParameterError', message: "Invalid JSON format for modelConfigParams: #{e.message}" } }.to_json
    end
  else
    # If modelConfigParams is not provided or is an empty string, use an empty hash
    model_config_params = {}
  end

  content_type 'text/event-stream'
  headers 'Cache-Control' => 'no-cache',
          'Connection' => 'keep-alive',
          'X-Accel-Buffering' => 'no' # Disable nginx buffering for immediate streaming
  stream(:keep_open) do |out|
    settings.logger.info "SSE stream opened for /api/sift/initiate. Client: #{request.ip}"
    begin
      called_service = false
      if has_image
        processed_image_successfully = false
        ImageHandler.process_uploaded_image(user_image_file_data) do |image_details|
          processed_image_successfully = true
          settings.logger.info('Image processed successfully.')
          settings.logger.info("Calling AIService.generate_sift_stream with user_input_text: #{has_text ? user_input_text : '[no text provided]'} and image.")
          result = AIService.generate_sift_stream(
            user_input_text: has_text ? user_input_text : nil,
            image_file_details: image_details,
            report_type: report_type,
            selected_model_id: selected_model_id,
            model_config_params: model_config_params,
            chat_history: []
          ) do |content_or_event|
            if out.closed?
              settings.logger.warn('Stream closed by client during AIService.generate_sift_stream with image')
              break # Exit the loop if client disconnected
            end

            if content_or_event.start_with?('event:')
              # This is an error event already formatted by AIService
              settings.logger.debug("Streaming pre-formatted event from AIService: #{content_or_event.strip}")
              out << content_or_event
              out.flush if out.respond_to?(:flush)
            elsif content_or_event.is_a?(String) && !content_or_event.strip.empty?
              # This is raw content from AIService, needs formatting
              send_sse_event(out, :data, { delta: content_or_event })
              settings.logger.debug("Streaming data chunk to client: #{content_or_event.length} chars")
            else
              # Potentially empty string or unexpected content, log it but don't send
              settings.logger.debug("Received empty or unexpected content from AIService: '#{content_or_event}' - not sending.")
            end
          end
          
          # Send analysis_id if available for follow-up messages
          if result && result[:persistence_result] && result[:persistence_result][:analysis_id]
            analysis_id = result[:persistence_result][:analysis_id]
            settings.logger.info("Sending analysis_id to client: #{analysis_id}")
            send_sse_event(out, :event, { event: 'analysis_id', data: { analysis_id: analysis_id } })
          end
          called_service = true
        end
        unless processed_image_successfully
          settings.logger.error('Failed to process uploaded image.')
          raise MyCustomError, 'Failed to process uploaded image.'
        end
      else
        settings.logger.info("Calling AIService.generate_sift_stream with user_input_text: #{user_input_text} and no image.")
        result = AIService.generate_sift_stream(
          user_input_text: user_input_text,
          image_file_details: nil,
          report_type: report_type,
          selected_model_id: selected_model_id,
          model_config_params: model_config_params,
          chat_history: []
        ) do |content_or_event|
          if out.closed?
            settings.logger.warn('Stream closed by client during AIService.generate_sift_stream without image')
            break # Exit the loop if client disconnected
          end

          if content_or_event.start_with?('event:')
            # This is an error event already formatted by AIService
            settings.logger.debug("Streaming pre-formatted event from AIService: #{content_or_event.strip}")
            out << content_or_event
            out.flush if out.respond_to?(:flush)
          elsif content_or_event.is_a?(String) && !content_or_event.strip.empty?
            # This is raw content from AIService, needs formatting
            send_sse_event(out, :data, { delta: content_or_event })
            settings.logger.debug("Streaming data chunk to client: #{content_or_event.length} chars")
          else
            # Potentially empty string or unexpected content, log it but don't send
            settings.logger.debug("Received empty or unexpected content from AIService: '#{content_or_event}' - not sending.")
          end
        end
        
        # Send analysis_id if available for follow-up messages
        if result && result[:persistence_result] && result[:persistence_result][:analysis_id]
          analysis_id = result[:persistence_result][:analysis_id]
          settings.logger.info("Sending analysis_id to client: #{analysis_id}")
          send_sse_event(out, :event, { event: 'analysis_id', data: { analysis_id: analysis_id } })
        end
        called_service = true
      end

      if called_service && !out.closed?
        settings.logger.info("AIService.generate_sift_stream completed. Sending 'complete' event.")
        send_sse_event(out, :event, { event: 'complete', data: { message: 'Stream finished' } })
      end
    rescue MyCustomError => e
      settings.logger.error("MyCustomError in /api/sift/initiate: #{e.message}")
      unless out.closed?
        send_sse_event(out, :event, { event: 'error', data: { type: e.class.name, message: e.message } })
      end
    rescue RubyLLM::Error => e
      settings.logger.error("RubyLLM::Error in /api/sift/initiate: #{e.message} - Details: #{e.try(:response)&.body}")
      unless out.closed?
        send_sse_event(out, :event, { event: 'error', data: { type: e.class.name, message: e.message, details: e.try(:response)&.body } })
      end
    rescue StandardError => e
      settings.logger.error("Error in /api/sift/initiate: #{e.message}\n#{e.backtrace.join("\n")}")
      unless out.closed?
        send_sse_event(out, :event, { event: 'error', data: { type: 'StreamingError', message: "An error occurred while processing your request: #{e.message}" } })
      end
    ensure
      settings.logger.info("Closing stream for /api/sift/initiate for client: #{request.ip}")
      # Sinatra's stream(:keep_open) handles closing the stream when the block exits.
    end
    settings.logger.info "SSE stream block finished for client: #{request.ip}"
  end
end

# This route provides Server-Sent Events (SSE) for chat responses.
# AIService.continue_sift_chat is responsible for yielding SSE-formatted data chunks and errors.
post '/api/sift/chat' do
  settings.logger.info "POST /api/sift/chat - Received request from #{request.ip}"
  params_json_string = nil
  begin
    request.body.rewind
    params_json_string = request.body.read
    settings.logger.debug "Raw JSON payload: #{params_json_string}"
    params = JSON.parse(params_json_string)
  rescue JSON::ParserError => e
    settings.logger.error "Invalid JSON format in request body: #{e.message}"
    settings.logger.debug "Problematic JSON string: #{params_json_string}" # Log the problematic string
    halt 400, { 'Content-Type' => 'application/json' },
         { error: { type: 'InvalidJSONError', message: "Invalid JSON format in request body: #{e.message}" } }.to_json
  end

  # Parameter extraction
  new_user_message_text = params['newUserMessageText']
  chat_history = params['chatHistory'] # Expecting Array of Hashes
  selected_model_id = params['selectedModelId']
  model_config_params = params['modelConfigParams'] || {} # Default to empty hash
  preprocessing_output_text = params['preprocessingOutputText'] # Optional
  system_instruction_override = params['systemInstructionOverride'] # Optional
  analysis_id = params['analysisId'] # Optional - for follow-up message persistence

  settings.logger.info "Extracted params: newUserMessageText present: #{!new_user_message_text.to_s.empty?}, chatHistory items: #{chat_history.is_a?(Array) ? chat_history.length : 'N/A'}, selectedModelId: #{selected_model_id}"
  settings.logger.debug "ModelConfigParams: #{model_config_params.inspect}"
  settings.logger.debug "PreprocessingOutputText present: #{!preprocessing_output_text.to_s.empty?}"
  settings.logger.debug "SystemInstructionOverride present: #{!system_instruction_override.to_s.empty?}"
  settings.logger.debug "AnalysisId: #{analysis_id || 'Not provided'}"

  # Validation of required parameters
  if new_user_message_text.to_s.strip.empty?
    settings.logger.warn 'Validation failed: newUserMessageText is required.'
    halt 400, { 'Content-Type' => 'application/json' },
         { error: { type: 'MissingParameterError', message: 'newUserMessageText is required.' } }.to_json
  end

  if chat_history.nil? || !chat_history.is_a?(Array)
    settings.logger.warn "Validation failed: chatHistory is required and must be an array. Received: #{chat_history.class}"
    halt 400, { 'Content-Type' => 'application/json' },
         { error: { type: 'InvalidParameterError', message: 'chatHistory is required and must be an array.' } }.to_json
  end

  # Further validation for chat_history elements can be added here if needed, e.g., checking for role/content keys.

  if selected_model_id.to_s.strip.empty?
    settings.logger.warn 'Validation failed: selectedModelId is required.'
    halt 400, { 'Content-Type' => 'application/json' },
         { error: { type: 'MissingParameterError', message: 'selectedModelId is required.' } }.to_json
  end

  unless model_config_params.is_a?(Hash)
    settings.logger.warn "Validation failed: modelConfigParams, if provided, must be a JSON object (Hash). Received: #{model_config_params.class}"
    halt 400, { 'Content-Type' => 'application/json' },
         { error: { type: 'InvalidParameterError', message: 'modelConfigParams, if provided, must be a JSON object.' } }.to_json
  end

  content_type 'text/event-stream'
  headers 'Cache-Control' => 'no-cache',
          'Connection' => 'keep-alive',
          'X-Accel-Buffering' => 'no' # Disable nginx buffering for immediate streaming
  stream(:keep_open) do |out|
    settings.logger.info "SSE stream opened for /api/sift/chat. Client: #{request.ip}"
    begin
      # Ensure AIService is available. If it's in a different module/file, it needs to be required.
      # Assuming AIService is loaded, similar to SiftService.
      unless defined?(AIService)
        settings.logger.error "AIService is not defined. Ensure it's loaded."
        # This is a server configuration error, so we might not be able to send an SSE error gracefully.
        # However, we try.
        unless out.closed?
          send_sse_event(out, :event, { event: 'error', data: { type: 'ServerError', message: 'AIService is not available. Configuration issue.' } })
        end
        next # or break, as the stream cannot proceed
      end

      AIService.continue_sift_chat(
        new_user_message_text: new_user_message_text,
        chat_history: chat_history,
        selected_model_id: selected_model_id,
        model_config_params: model_config_params,
        system_instruction_override: system_instruction_override,
        analysis_id: analysis_id,
        persist_conversation: true
      ) do |content_or_event|
        if out.closed?
          settings.logger.warn('SSE stream for /api/sift/chat closed by client.')
          break # Exit the loop if client disconnected
        end

        if content_or_event.start_with?('event:')
          # This is an error event already formatted by AIService
          settings.logger.debug("Streaming pre-formatted event from AIService for /api/sift/chat: #{content_or_event.strip}")
          out << content_or_event
          out.flush if out.respond_to?(:flush)
        elsif content_or_event.is_a?(String) && !content_or_event.strip.empty?
          # This is raw content from AIService, needs formatting
          send_sse_event(out, :data, { delta: content_or_event })
          settings.logger.debug("Streaming data chunk to client for /api/sift/chat: #{content_or_event.length} chars")
        else
          # Potentially empty string or unexpected content, log it but don't send
          settings.logger.debug("Received empty or unexpected content from AIService for /api/sift/chat: '#{content_or_event}' - not sending.")
        end
      end
      settings.logger.info "AIService.continue_sift_chat stream completed for client: #{request.ip}"

      # Send a completion event to signal the end of the stream
      unless out.closed?
        settings.logger.info("AIService.continue_sift_chat completed. Sending 'complete' event.")
        send_sse_event(out, :event, { event: 'complete', data: { message: 'Chat stream finished' } })
      end
    rescue StandardError => e
      settings.logger.error "Error during SSE streaming or AIService.continue_sift_chat execution: #{e.class.name} - #{e.message}"
      settings.logger.error e.backtrace.join("\n")
      unless out.closed?
        send_sse_event(out, :event, { event: 'error', data: { type: 'StreamingError', message: "An error occurred: #{e.message}" } })
      end
    ensure
      settings.logger.info "SSE stream ensure block reached for /api/sift/chat. Closing stream for client: #{request.ip}"
      # Sinatra's stream(:keep_open) handles closing the stream when the block exits.
    end
    settings.logger.info "SSE stream block finished for /api/sift/chat for client: #{request.ip}"
  end
end

# NOTE: To test Sinatra::NotFound, simply try to access any undefined route,
# for example: /api/this-route-does-not-exist

# Placeholder for future API routes
# namespace '/api/v1' do
#   before do
#     content_type 'application/json'
#   end
#
#   # Example route
#   get '/items' do
#     { message: 'This will be a list of items' }.to_json
#   end
# end

# You can also define routes directly without a class:
# get '/' do
#   'Hello SIFT Toolbox API!'
# end

#
# Manual CORS Configuration (Alternative to using sinatra-cross_origin gem)
#
# before do
#   headers['Access-Control-Allow-Origin'] = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
#   headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
#   headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
# end
#
# options '*' do
#   response.headers['Allow'] = 'GET, POST, PUT, DELETE, OPTIONS'
#   response.headers['Access-Control-Allow-Origin'] = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
#   response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
#   response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
#   halt 200
# end
#

# If you prefer a modular (classic) style Sinatra app:
# class App < Sinatra::Base
#   configure do
#     # settings
#   end
#
#   get '/' do
#     'Hello from modular app!'
#   end
#
#   # more routes...
# end
