# sift_backend/lib/image_handler.rb
require 'fileutils'
require 'securerandom'
require 'tempfile' # Ensure Tempfile class is explicitly available

module ImageHandler
  # Processes an uploaded image file from Sinatra params.
  #
  # If a block is provided, it yields a hash containing the path to a
  # securely copied temporary file and its original MIME type.
  # This temporary file is automatically cleaned up after the block executes.
  # The method then returns the value yielded by the block.
  #
  # If no block is provided, it returns the hash with the file path and MIME type.
  # In this case, the CALLER IS RESPONSIBLE for deleting the file at `file_path`.
  #
  # Returns `nil` if the input is invalid, file processing fails, or
  # (if a block is given and an error occurs outside the block's execution but before it returns)
  # the block's own return value in other cases.
  #
  # @param sinatra_file_param [Hash] The Sinatra file upload hash.
  #   Expected keys: `:tempfile` (a Tempfile object), `:type` (String), `:filename` (String).
  # @yield [Hash] `{ file_path: String, original_mime_type: String }` if block is given.
  # @return [Object, nil] The result of the block if a block is given,
  #   or a Hash `{ file_path: String, original_mime_type: String }` if no block,
  #   or `nil` on failure or invalid input.
  def self.process_uploaded_image(sinatra_file_param)
    # Input validation
    unless sinatra_file_param.is_a?(Hash) &&
           sinatra_file_param[:tempfile].is_a?(Tempfile) &&
           sinatra_file_param[:type].is_a?(String) && !sinatra_file_param[:type].empty? &&
           sinatra_file_param[:filename].is_a?(String) && !sinatra_file_param[:filename].empty?
      # Consider logging this invalid input if a logger is available
      # puts "ImageHandler: Invalid sinatra_file_param provided: #{sinatra_file_param.inspect}"
      return nil
    end

    tempfile = sinatra_file_param[:tempfile]
    original_mime_type = sinatra_file_param[:type]
    original_filename = sinatra_file_param[:filename]

    # Construct path for the new temporary file
    # Using File.extname(original_filename) is generally safer than tempfile.path for extension
    new_persistent_path = File.join(
      Dir.tmpdir,
      "sift_image_#{SecureRandom.hex(8)}#{File.extname(original_filename)}"
    )

    begin
      # Copy the uploaded tempfile to the new persistent path
      FileUtils.copy_file(tempfile.path, new_persistent_path)

      payload = { file_path: new_persistent_path, original_mime_type: original_mime_type }

      if block_given?
        block_result = nil
        begin
          # Yield the payload to the block and store its result
          block_result = yield(payload)
        ensure
          # Always clean up the new_persistent_path if a block was executed,
          # regardless of whether an error occurred within the block or not.
          FileUtils.rm_f(new_persistent_path)
        end
        return block_result # Return what the block returned
      else
        # No block given: return the payload directly. Caller is responsible for cleanup.
        return payload
      end
    rescue StandardError => e
      # Log error if a logger was available
      # puts "ImageHandler: Error processing file: #{e.class} - #{e.message}
# Backtrace: #{e.backtrace.join("\n")}"

      # If the file was copied before an error occurred (e.g., error in yield),
      # try to clean it up.
      if new_persistent_path && File.exist?(new_persistent_path)
          # If a block was not given, this file was intended for the caller to manage,
          # but an error here means the caller won't get the path, so clean up.
          # If a block was given, the inner ensure should have cleaned it.
          # This acts as a fallback cleanup for the case where no block is given
          # and an error happens after copy but before return.
          FileUtils.rm_f(new_persistent_path) unless block_given?
      end
      return nil # Indicate failure by returning nil
    end
  end
end
