# my_streaming_service.rb
require 'json'

class MyStreamingService
  # Performs work and yields data chunks formatted as SSE messages.
  # This simulates a long-running process or a service that provides data incrementally.
  def self.perform_work
    # SSE Message Formatting Guide:
    # Each piece of data sent to the client must be a string ending with two newline characters ("\n\n").
    #
    # 1. Simple Data Message:
    #    "data: your data string here\n\n"
    #    The client receives this as a 'message' event by default.
    #
    # 2. Named Event Message:
    #    "event: <event_name>\ndata: your data string here\n\n"
    #    The client can listen for '<event_name>' specifically. Useful for different types of updates.
    #
    # 3. Message ID:
    #    "id: <unique_id>\ndata: your data string here\n\n"
    #    Sets a unique ID for an event. If the connection drops, the client can send the last received ID
    #    to the server (via the 'Last-Event-ID' header) to potentially resume the stream. This is not
    #    explicitly implemented in this example's client/server logic for simplicity but is a key SSE feature.
    #
    # 4. Comments in SSE stream:
    #    Lines starting with a colon (':') are ignored by the client and can be used for comments or keep-alives.
    #    Example: ":this is a comment\n\n" (though typically keep-alives don't need the double newline if not part of data).

    yield "data: Starting work... The server time is #{Time.now}\n\n" # Simple data
    sleep 1 # Simulate work

    # Sending JSON data: It's common to send structured data as JSON.
    yield "data: #{ { progress: 25, message: "Gathering initial data..." }.to_json }\n\n"
    sleep 1

    # Simulate a potential error. In a real application, this could be an external API call failing.
    if rand(4) == 0 # ~25% chance
      raise "Simulated critical error during streaming!"
    end

    # Named event 'update' with JSON data
    yield "event: update\ndata: #{ { progress: 50, status: "Processing dependencies", details: "Halfway there!" }.to_json }\n\n"
    sleep 1

    if rand(3) == 0 # ~33% chance
      # Example of a custom 'warning' event, could be used for non-critical issues.
      yield "event: warning\ndata: #{ { code: 'TEMP_HIGH', message: 'Temperature threshold exceeded slightly.'}.to_json }\n\n"
      sleep 0.5
    end

    yield "data: #{ { progress: 75, message: "Finalizing process..." }.to_json }\n\n"
    sleep 1

    # Named event 'complete' indicating the end of the process.
    yield "event: complete\ndata: #{ { message: "Work finished successfully at #{Time.now}" }.to_json }\n\n"
    # After this, the block in sinatra_app.rb will finish, and Sinatra will close the stream.
  end
end
