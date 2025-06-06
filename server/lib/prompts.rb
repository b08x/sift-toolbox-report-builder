# sift_backend/lib/prompts.rb

module Prompts
  PROMPT_TEMPLATES = {
    sift_chat_system_prompt: 'You are a helpful assistant for the SIFT application. Be concise and helpful.',
    sift_full_check_prompt: 'Perform a full check on the following input: %<user_input>s'
    # Add other report types here as needed
    # e.g., sift_summary_prompt: "Summarize this: %{user_input}"
  }.freeze

  # Fetches a prompt template and interpolates values if provided.
  #
  # @param prompt_key [Symbol] The key for the prompt template (e.g., :sift_full_check_prompt).
  # @param values [Hash] A hash of values to interpolate into the prompt string.
  # @return [String] The processed prompt string.
  def self.get_prompt(prompt_key, values = {})
    template = PROMPT_TEMPLATES[prompt_key]
    return "Prompt not found for key: #{prompt_key}" unless template

    if values.any?
      template % values
    else
      template
    end
  end
end

# Example Usage:
# puts Prompts.get_prompt(:sift_chat_system_prompt)
# puts Prompts.get_prompt(:sift_full_check_prompt, user_input: "some text here")
