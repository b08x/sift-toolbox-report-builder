# sift_backend/services/ai_service.rb

require 'json'
require 'ruby_llm' # Assuming ruby_llm is loaded via Bundler or accessible
require_relative '../lib/prompts' # Adjust path if necessary
require_relative '../lib/image_handler' # Adjust path if necessary

module AIService
  class << self
    # Unified streaming method to generate responses from an AI model via ruby_llm.
    #
    # @param chat_session_id [String, nil] Optional, for logging or future use.
    # @param user_input_text [String, nil] The user's text query.
    # @param image_file_details [Hash, nil] Processed image data (e.g., { path: "/path/to/image.jpg" }).
    # @param report_type [String] Type of report/prompt to use (e.g., "FULL_CHECK").
    # @param selected_model_id [String] The ID of the model to use (e.g., "gemini-1.5-pro-latest").
    # @param model_config_params [Hash] Configuration for the model (e.g., { temperature: 0.7 }).
    # @param chat_history [Array<Hash>] Array of previous messages [{role: :user, content: "..."}, ...].
    # @param block [Proc] Block to yield SSE formatted chunks to.
    # @return [RubyLLM::Message, nil] The final AI message object for persistence, or nil if setup fails.
    def generate_sift_stream(
      chat_session_id: nil,
      user_input_text: nil,
      image_file_details: nil,
      report_type:,
      selected_model_id:,
      model_config_params: {},
      chat_history: [],
      &block
    )
      unless block_given?
        puts "AIService: Error - No block provided for streaming."
        # Or raise ArgumentError, "A block is required for streaming."
        return nil
      end

      puts "AIService: Generating SIFT stream with model #{selected_model_id}"
      puts "AIService: Report Type: #{report_type}, Session ID: #{chat_session_id || 'N/A'}"
      puts "AIService: Model Config: #{model_config_params}"

      begin
        chat = RubyLLM.chat(model: selected_model_id)

        # 1. Apply model configurations
        if model_config_params[:temperature]
          chat.with_temperature(model_config_params[:temperature].to_f)
        end
        # Add other common params like max_tokens, top_p, etc. as needed
        # chat.with_max_tokens(model_config_params[:max_tokens]) if model_config_params[:max_tokens]

        # 2. Set system instructions (applies to the whole conversation)
        # This should ideally be set once if the chat object is long-lived.
        # For stateless calls, set it every time.
        system_prompt = Prompts.get_prompt(:sift_chat_system_prompt)
        chat.with_instructions(system_prompt)

        # 3. Load chat history if provided
        if chat_history && !chat_history.empty?
          puts "AIService: Loading chat history (#{chat_history.length} messages)"
          chat_history.each do |msg|
            # Ensure role is a symbol as ruby_llm might expect
            chat.messages.build(role: msg[:role].to_sym, content: msg[:content])
          end
        end

        # 4. Prepare image if present
        image_path = nil
        if image_file_details && image_file_details[:file_path]
          image_path = image_file_details[:file_path]
          # We can keep the log line, or adjust it if :original_mime_type is also useful to log
          puts "AIService: Using image file provided at path: #{image_path} (MIME: #{image_file_details[:original_mime_type]})"
        else
          puts "AIService: No image file details provided or path is missing."
        end

        # 5. Construct the current user prompt
        current_user_prompt_text = ""
        if chat_history && !chat_history.empty?
          # If there's history, the new user_input_text is the current prompt
          current_user_prompt_text = user_input_text
        else
          # For an initial request, use the report_type to format the prompt
          # The SIFT_FULL_CHECK_PROMPT might include a placeholder for the image description
          # or we might need to append a standard "Image is attached" message.
          # For now, we assume the prompt template handles user_input_text.
          prompt_key = "sift_#{report_type.downcase}_prompt".to_sym
          current_user_prompt_text = Prompts.get_prompt(prompt_key, user_input: user_input_text)
        end

        unless current_user_prompt_text && !current_user_prompt_text.strip.empty?
          # Handle cases where prompt might be empty if user_input_text is nil and not handled by Prompts module
          error_message = "AIService: Error - User input text is empty or could not form a valid prompt."
          puts error_message
          yield "event: error
data: #{ {error: "Prompt generation failed", type: "PromptError"}.to_json }

"
          return nil
        end

        puts "AIService: Asking LLM with prompt: "#{current_user_prompt_text.lines.first.strip}...""
        puts "AIService: With image: #{image_path || 'No'}"

        # 6. Make the streaming call
        final_message = chat.ask(current_user_prompt_text, with: image_path) do |chunk|
          if chunk&.content&.is_a?(String) && !chunk.content.strip.empty?
            # Yield raw content instead of formatted SSE
            block.call(chunk.content)
          elsif chunk&.tool_calls # Handle potential tool calls if the model supports/returns them
            # puts "AIService: Received tool calls: #{chunk.tool_calls}"
            # Handle tool calls if necessary, possibly yielding a specific format or ignoring
          end
        end

        puts "AIService: Streaming complete. Final message role: #{final_message&.role}"
        return final_message # Return the complete message object for persistence

      rescue RubyLLM::Error => e
        error_message = "AIService: RubyLLM Error - #{e.message}"
        puts error_message
        error_json = { error: e.message, type: e.class.name, details: e.try(:response)&.body }.to_json
        block.call("event: error
data: #{error_json}

")
        return nil # Indicate failure
      rescue StandardError => e
        error_message = "AIService: Standard Error - #{e.class.name}: #{e.message}
Backtrace: #{e.backtrace.join("
  ")}"
        puts error_message
        error_json = { error: e.message, type: e.class.name }.to_json
        block.call("event: error
data: #{error_json}

")
        return nil # Indicate failure
      end
    end

    # Method to continue a chat session, streaming the response.
    #
    # @param new_user_message_text [String] The new message text from the user.
    # @param chat_history [Array<Hash>] Array of previous messages [{role: "user", content: "..."}, ...].
    # @param selected_model_id [String] The ID of the model to use.
    # @param model_config_params [Hash] Configuration for the model (e.g., { temperature: 0.7 }).
    # @param system_instruction_override [String, nil] Optional override for system instructions.
    # @param block [Proc] Block to yield SSE formatted chunks to.
    # @return [RubyLLM::Message, nil] The final AI message object for persistence, or nil if an error occurs.
    def continue_sift_chat(
      new_user_message_text:,
      chat_history:,
      selected_model_id:,
      model_config_params: {},
      system_instruction_override: nil,
      &block
    )
      unless block_given?
        puts "AIService: Error (continue_sift_chat) - No block provided for streaming."
        return nil
      end

      puts "AIService: Continuing SIFT chat with model #{selected_model_id}"
      puts "AIService: Model Config: #{model_config_params}"
      puts "AIService: System Instruction Override: #{system_instruction_override.nil? ? 'No' : 'Yes'}"

      begin
        chat = RubyLLM.chat(model: selected_model_id)

        # 1. Apply model configurations
        model_config_params.each do |k, v|
          chat.send("with_#{k}", v) if chat.respond_to?("with_#{k}")
        end

        # 2. Set system instructions
        if system_instruction_override && !system_instruction_override.strip.empty?
          puts "AIService: Using system instruction override."
          chat.with_instructions(system_instruction_override, replace: true)
        else
          puts "AIService: Using default SIFT chat system prompt."
          chat.with_instructions(Prompts.get_prompt(:sift_chat_system_prompt), replace: true)
        end

        # 3. Load chat history
        if chat_history && !chat_history.empty?
          puts "AIService: Loading chat history (#{chat_history.length} messages)"
          chat_history.each do |msg|
            role = msg["role"] || msg[:role] # Handle string or symbol keys
            content = msg["content"] || msg[:content]

            if role && content
              processed_role = role.to_sym
              chat.messages.build(role: processed_role, content: content)
            else
              puts "AIService: Warning - Skipping chat history message with missing role or content: #{msg.inspect}"
            end
          end
        end

        # 4. Add the new user message
        if new_user_message_text.nil? || new_user_message_text.strip.empty?
          error_message = "AIService: Error (continue_sift_chat) - New user message text is empty."
          puts error_message
          yield "event: error\ndata: #{ {error: "User message is empty", type: "UserInputError"}.to_json }\n\n"
          return nil
        end

        puts "AIService: Asking LLM with new user message: \"#{new_user_message_text.lines.first.strip}...\""

        final_message = chat.ask(new_user_message_text) do |chunk|
          if chunk&.content&.is_a?(String) && !chunk.content.strip.empty?
            # Yield raw content instead of formatted SSE
            block.call(chunk.content)
          elsif chunk&.tool_calls
            # TODO: Consider logging or handling chunk.tool_calls if applicable for chat continuations
            # puts "AIService: Received tool calls in continue_sift_chat: #{chunk.tool_calls}"
          end
        end

        puts "AIService: Streaming complete (continue_sift_chat). Final message role: #{final_message&.role}"
        return final_message

      rescue RubyLLM::Error => e
        error_message = "AIService: RubyLLM Error (continue_sift_chat) - #{e.message}"
        puts error_message
        error_details = e.try(:response)&.body # Safely access response body
        error_json = { error: e.message, type: e.class.name, details: error_details }.to_json
        block.call("event: error\ndata: #{error_json}\n\n")
        return nil
      rescue StandardError => e
        error_message = "AIService: Standard Error (continue_sift_chat) - #{e.class.name}: #{e.message}\nBacktrace: #{e.backtrace.join("\n  ")}"
        puts error_message
        error_json = { error: e.message, type: e.class.name }.to_json
        block.call("event: error\ndata: #{error_json}\n\n")
        return nil
      end
    end
  end
end

# Example (conceptual, not run directly here):
#
# if __FILE__ == $PROGRAM_NAME
#   # This is just for testing the structure; won't run in a real app context like this.
#   # Setup mock ruby_llm and ENV vars if you were to run this standalone.
#   puts "Example AIService call (conceptual):"
#
#   # Mock ENV for initializer (if it were run)
#   # ENV['GEMINI_API_KEY'] = 'fake_gemini_key'
#
#   # Mock configuration for ruby_llm if not using the initializer directly
#   # RubyLLM.configure do |config|
#   #   config.gemini_api_key = "fake_key"
#   # end
#
#   # Example call
#   AIService.generate_sift_stream(
#     chat_session_id: "session123",
#     user_input_text: "Tell me about cats.",
#     # image_file_details: { path: "path/to/cat.jpg", mime_type: "image/jpeg" },
#     report_type: "FULL_CHECK",
#     selected_model_id: "gemini-1.5-pro-latest", # Or your preferred model
#     model_config_params: { temperature: 0.7 },
#     chat_history: [{role: :user, content: "What are common pets?"}, {role: :assistant, content: "Dogs and cats are common pets."}]
#   ) do |chunk|
#     print chunk # Expect SSE formatted output
#   end
#
#   # Example with an image
#   # AIService.generate_sift_stream(
#   #   user_input_text: "What is in this image?",
#   #   image_file_details: { path: "test_image.png", mime_type: "image/png" }, # Create a dummy test_image.png
#   #   report_type: "IMAGE_ANALYSIS", # Assuming a prompt key like :sift_image_analysis_prompt
#   #   selected_model_id: "gemini-1.5-pro-latest",
#   #   &block
#   # )
# end
