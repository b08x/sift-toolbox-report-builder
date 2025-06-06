# sinatra_app.rb
require 'sinatra'
require 'json'
require_relative 'my_streaming_service'

# Configure Sinatra settings
set :public_folder, File.dirname(__FILE__) + '/public'
# Optional: Enable logging for development. Sinatra logs to $stdout by default.
# configure :development do
#   set :logging, Logger::DEBUG
# end

# Root path serves the HTML page for testing the SSE client
get '/' do
  send_file File.join(settings.public_folder, 'index.html')
end

# SSE Streaming Endpoint: /stream-data
# This route demonstrates Server-Sent Events (SSE).
get '/stream-data' do
  # 1. Set Content-Type for SSE
  # The 'text/event-stream' Content-Type is essential. It tells the browser
  # that this endpoint will stream events, not send a single, complete response.
  content_type 'text/event-stream'

  # 2. Use Sinatra's stream helper with :keep_open
  # The `stream` helper is Sinatra's mechanism for sending data chunk by chunk.
  # - `:keep_open`: This option is crucial for SSE. It prevents Sinatra from closing
  #   the connection after the first `out << data` operation or when the route block's
  #   main execution path finishes if there's still work happening in, for example, a loop
  #   or an event-driven source. The stream remains open until `out.close` is called
  #   or the stream block itself completes.
  # The block yields an `out` object, which is an instance of `Sinatra::Stream`.
  # You use `out << "some data"` to send data to the client.
  stream(:keep_open) do |out|
    begin
      # 3. Calling a Service that Yields Data
      # The `MyStreamingService.perform_work` method is designed to `yield` data chunks.
      # Each yielded chunk is a pre-formatted SSE message string.
      MyStreamingService.perform_work do |data_chunk|
        # Before writing to the stream, check if the client has disconnected.
        # `out.closed?` returns true if the client has closed the connection.
        # This prevents writing to a closed stream, which could raise an error.
        if out.closed?
          logger.info "Client disconnected, stopping stream."
          break # Exit the loop/block if client is gone
        end

        out << data_chunk # Send the formatted SSE message to the client
        logger.info "Sent chunk: #{data_chunk.strip}" # Log for debugging, strip newlines for conciseness
      end
    rescue StandardError => e
      # 4. Error Handling within the Stream
      # If `MyStreamingService.perform_work` raises an exception (like our simulated error),
      # this block catches it.
      # It's important to:
      #   a. Log the error on the server-side for diagnostics.
      #   b. Inform the client about the error using a formatted SSE event.
      logger.error "Streaming error in /stream-data: #{e.class} - #{e.message}"
      logger.error e.backtrace.join("\n")

      # Send a custom 'error' event to the client.
      # The client-side JavaScript should have an event listener for 'error' events.
      # The payload is typically JSON, providing structured error information.
      error_payload = { type: 'STREAM_FAILURE', message: "A critical error occurred: #{e.message}" }.to_json

      # Check if stream is still open before attempting to write the error.
      out << "event: error\ndata: #{error_payload}\n\n" unless out.closed?
    ensure
      # 5. Closing the Stream
      # - With `stream(:keep_open)`, Sinatra automatically closes the stream (`out.close`)
      #   when the `stream` block finishes execution (i.e., when this `ensure` block is reached
      #   after normal completion or after an error has been handled and not re-raised).
      # - If you `break` out of a loop that's feeding the stream, or if the service
      #   stops yielding data, the block will naturally end, and Sinatra handles closure.
      # - Explicit `out.close` is generally not needed here unless you have specific logic
      #   to terminate the stream prematurely from within the `begin` block but *not* due to an error
      #   that would naturally lead to the block's end.
      #
      # Example: if you had `loop do ... if condition then out.close; break; end ... end`
      #
      # For this pattern, relying on Sinatra's automatic closure upon block completion is standard.
      logger.info "SSE stream block for /stream-data finished for a client. Stream will be closed if not already."
      # `out.close unless out.closed?` could be used if you need to be absolutely certain,
      # but it's typically redundant when the block is exiting.
    end
  end
end

# To run this application:
# 1. Make sure you have 'bundler' installed: `gem install bundler`
# 2. Install dependencies: `bundle install`
# 3. Start the server (Puma is recommended, listed in Gemfile): `bundle exec puma`
#    Alternatively, for simple cases or other Rack servers: `bundle exec rackup config.ru`
#
# Then, open your browser and navigate to http://localhost:9292 (Puma default) or http://localhost:PORT
# (the port will be shown when the server starts). The `index.html` page will connect to the stream.
