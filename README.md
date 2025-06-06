# Securely Managing API Keys in a Sinatra Application

This document provides guidance on how to securely manage API keys for external services like Google Gemini, OpenAI, and OpenRouter in a Ruby Sinatra application.

## 1. Why API Keys Should Never Be Hardcoded

Hardcoding API keys directly into your source code is a significant security risk. Here's why:

*   **Exposure in Version Control:** If your code is hosted on a platform like GitHub or GitLab, hardcoded keys become part of your repository's history. Even if you remove them later, they can still be found in previous commits.
*   **Accidental Leaks:** Keys can be accidentally leaked through shared code snippets, error messages, or logs if they are present directly in the codebase.
*   **Difficult to Rotate:** If a key is compromised, changing it becomes a cumbersome process. You'd need to modify the code, re-deploy the application, and ensure all previous versions with the old key are no longer accessible.
*   **Unauthorized Access:** Anyone who gains access to your source code (e.g., a disgruntled employee, a compromised developer account, or a public repository) will also gain access to your API keys. This can lead to unauthorized use of paid services, resulting in financial loss or data breaches.
*   **Environment-Specific Keys:** Often, you'll use different API keys for development, staging, and production environments. Hardcoding makes managing these different keys impractical and error-prone.

Storing keys outside the codebase, typically in environment variables, is the recommended best practice.

## 2. Loading API Keys from Environment Variables

Ruby provides easy access to environment variables through the `ENV` object. This is the standard way to supply sensitive information like API keys to your application.

For example, if you have an environment variable named `GEMINI_API_KEY`, you can access it in your Ruby code like this:

```ruby
gemini_key = ENV['GEMINI_API_KEY']
openai_key = ENV['OPENAI_API_KEY']
openrouter_key = ENV['OPENROUTER_API_KEY']

if gemini_key.nil?
  puts "GEMINI_API_KEY is not set."
  # Handle missing key, perhaps by exiting or logging an error
end

# Use the keys to interact with the respective services
# puts "Using Gemini Key: #{gemini_key}"
```

**To make these variables available to your application:**

*   **In Production/Staging (e.g., Heroku, AWS, Docker):** You'll typically set these environment variables through your hosting platform's dashboard, configuration files (e.g., Docker Compose), or command-line interface.
*   **In Local Development:** You can set them in your shell before running the application (e.g., `export GEMINI_API_KEY="your_key_here"`), or use a tool like `dotenv` to load them from a file, which we'll cover next.

## 3. Using the `dotenv` Gem for Local Development

The `dotenv` gem is very useful for managing environment variables in your local development environment. It loads variables from a `.env` file into `ENV` when your application starts.

**Steps to use `dotenv`:**

1.  **Add `dotenv` to your `Gemfile`:**
    If you haven't already, add it to your `Gemfile`:
    ```ruby
    gem 'dotenv'
    ```
    And then run `bundle install` in your terminal.

2.  **Create a `.env` file:**
    Create a file named `.env` in the root of your project. **This file should never be committed to version control.** Add it to your `.gitignore` file.
    You can copy the provided `.env.example` to `.env` and replace the placeholder values with your actual keys:
    ```bash
    cp .env.example .env
    ```
    Your `.env` file would look something like this:
    ```
    GEMINI_API_KEY="actual_gemini_key_value"
    OPENAI_API_KEY="actual_openai_key_value"
    OPENROUTER_API_KEY="actual_openrouter_key_value"
    ```

3.  **Load `dotenv` in your application:**
    Require `dotenv` early in your application's lifecycle, typically in your main application file (e.g., `app.rb`) or an environment setup file (e.g., `config/environment.rb` or `Rakefile` if used with tasks).

    For a Sinatra application, you might add this to the top of your `app.rb`:

    ```ruby
    require 'sinatra'
    require 'dotenv/load' # Loads .env file automatically

    # Your application code follows
    # API keys are now available via ENV['API_KEY_NAME']
    # puts "Gemini Key from .env: #{ENV['GEMINI_API_KEY']}"
    ```
    Or, if you prefer to control when it loads (e.g., only in development):
    ```ruby
    require 'sinatra'

    if Sinatra::Base.development?
      require 'dotenv/load'
    end
    ```

By following these steps, your API keys and other configurations in `.env` will be loaded into `ENV` automatically when you run your Sinatra app locally, making them accessible just like any other environment variable. Remember, `.env` is for local development convenience; in production, you should set environment variables directly on your server or hosting platform.

## 4. Centralized Configuration Access

To make API keys and other settings easily accessible and consistently managed throughout your application, you can use a simple Ruby module or class. This approach centralizes how configuration is loaded and used.

**Example: `Config` Module**

Create a module, for instance, in `config/config.rb`:

```ruby
# config/config.rb

module Config
  class MissingKeyError < StandardError; end

  # Fetches the Gemini API Key from environment variables.
  # Raises MissingKeyError if not found.
  def self.gemini_api_key
    ENV['GEMINI_API_KEY'] || raise(MissingKeyError, "GEMINI_API_KEY is not set in the environment. Please add it to your .env file or environment variables.")
  end

  # Fetches the OpenAI API Key from environment variables.
  # Raises MissingKeyError if not found.
  def self.openai_api_key
    ENV['OPENAI_API_KEY'] || raise(MissingKeyError, "OPENAI_API_KEY is not set in the environment. Please add it to your .env file or environment variables.")
  end

  # Fetches the OpenRouter API Key from environment variables.
  # Raises MissingKeyError if not found.
  def self.openrouter_api_key
    ENV['OPENROUTER_API_KEY'] || raise(MissingKeyError, "OPENROUTER_API_KEY is not set in the environment. Please add it to your .env file or environment variables.")
  end

  # You can add other configuration methods here, for example:
  # def self.database_url
  #   ENV['DATABASE_URL'] || raise(MissingKeyError, "DATABASE_URL is not set.")
  # end

  # def self.default_items_per_page
  #   ENV.fetch('DEFAULT_ITEMS_PER_PAGE', 25).to_i # Using fetch with a default for optional values
  # end
end
```

**How to Use the `Config` Module:**

1.  **Require the module** in your main application file (e.g., `app.rb`) or where needed:
    ```ruby
    # In app.rb or config/environment.rb
    require_relative 'config/config' # Adjust path based on your project structure
    ```

2.  **Access configuration values** anywhere in your application:
    ```ruby
    # Example usage:
    # api_key = Config.gemini_api_key
    # if api_key
    #   puts "Using Gemini API Key: #{api_key}"
    # else
    #   puts "Gemini API Key is not set."
    # end
    ```
This `Config` module provides a single, clear point of entry for all environment-driven configurations. If you later decide to change how configuration is loaded (e.g., move to a more complex configuration library), you only need to update this module.

## 5. Usage in a Service (Example)

Here's how a service class, responsible for interacting with an external AI, might use the `Config` module to retrieve an API key.

Let's say you have a service defined in `services/ai_service.rb`:

```ruby
# services/ai_service.rb

# Ensure the Config module is loaded, e.g., via require_relative '../config/config'
# This is often done in a central bootstrap file like app.rb or config/environment.rb

module AIServices
  class Gemini
    def initialize
      # Access the API key through the Config module
      @api_key = Config.gemini_api_key

      # It's good practice to check if the key exists when the service is initialized.
      # We'll cover more robust error handling in the next section.
      if @api_key.nil? || @api_key.empty?
        raise ArgumentError, "Gemini API Key is not configured. Please set GEMINI_API_KEY environment variable."
      end
      puts "Gemini Service Initialized."
    end

    def get_completion(prompt)
      # For demonstration, we'll just print the key (masked) and a message.
      # In a real application, you would use a library like HTTParty or Faraday
      # to make the actual API call.
      masked_key = @api_key.gsub(/.(?=.{4})/, '*') # Mask most of the key for logging
      puts "Gemini Service: Calling API with key #{masked_key} for prompt: '#{prompt}'"

      # Simulate an API call
      # response = HTTParty.post("https://api.gemini.example.com/v1/complete",
      #   headers: {
      #     "Authorization" => "Bearer #{@api_key}",
      #     "Content-Type" => "application/json"
      #   },
      #   body: { prompt: prompt }.to_json
      # )
      # return response.parsed_response

      "Simulated response for prompt: '#{prompt}'"
    end
  end

  # You could have other services for OpenAI, OpenRouter, etc.
  # class OpenAIService
  #   def initialize
  #     @api_key = Config.openai_api_key
  #     # ...
  #   end
  #   # ...
  # end
end

# How you might use this service in your application:
#
# require_relative 'config/config' # Or ensure it's loaded globally
# require_relative 'services/ai_service'
#
# begin
#   gemini_client = AIServices::Gemini.new
#   response = gemini_client.get_completion("Translate 'hello' to Spanish.")
#   puts "Response from Gemini: #{response}"
# rescue ArgumentError => e
#   $stderr.puts "Error: #{e.message}"
#   # Potentially exit or disable features that rely on this service
# end
```

In this example:
*   The `AIServices::Gemini` class constructor fetches the `GEMINI_API_KEY` using `Config.gemini_api_key`.
*   It includes a basic check for the key's presence.
*   The `get_completion` method would then use this key to authenticate with the Gemini API.

This pattern keeps your service classes clean and decoupled from the specifics of how configuration is loaded. They simply request what they need from the `Config` module.

## 6. Error Handling for Missing Keys

It's crucial for your application to behave predictably if required API keys are not found in the environment. Instead of letting the application proceed with a `nil` key (which would likely cause cryptic errors later), it's better to fail fast.

**Strategy: Raise an Exception**

Modify the `Config` module to raise a custom error if a key is missing. This makes the problem immediately obvious.

Updated `config/config.rb`:
```ruby
# config/config.rb

module Config
  class MissingKeyError < StandardError; end

  def self.gemini_api_key
    ENV['GEMINI_API_KEY'] || raise(MissingKeyError, "GEMINI_API_KEY is not set in the environment. Please add it to your .env file or environment variables.")
  end

  def self.openai_api_key
    ENV['OPENAI_API_KEY'] || raise(MissingKeyError, "OPENAI_API_KEY is not set in the environment. Please add it to your .env file or environment variables.")
  end

  def self.openrouter_api_key
    ENV['OPENROUTER_API_KEY'] || raise(MissingKeyError, "OPENROUTER_API_KEY is not set in the environment. Please add it to your .env file or environment variables.")
  end

  # Example for an optional key with a default using .fetch
  # def self.optional_setting
  #   ENV.fetch('OPTIONAL_SETTING', 'default_value')
  # end
end
```

**Explanation:**

*   A custom error class `Config::MissingKeyError` is defined for clarity.
*   Each API key accessor now uses the `|| raise(...)` pattern. If `ENV['API_KEY']` is `nil` (meaning the key is not set), it will raise a `MissingKeyError` with a descriptive message.

**Handling the Error:**

When you call these configuration methods, you should be prepared to handle this error, especially at application startup or when a service is initialized.

```ruby
# Conceptual example in app.rb or an initializer

# Ensure Config and services are loaded
# require_relative 'config/config'
# require_relative 'services/ai_service'

begin
  # Attempt to initialize services that depend on API keys
  # This might implicitly call the Config methods
  $gemini_service = AIServices::Gemini.new # Assuming Gemini service constructor calls Config.gemini_api_key
  # $openai_service = AIServices::OpenAI.new
  # ... other initializations
  puts "Application configured successfully with necessary API keys."

rescue Config::MissingKeyError => e
  $stderr.puts "CRITICAL ERROR: #{e.message}"
  $stderr.puts "The application cannot start without this configuration."
  # Depending on the application, you might:
  # - Log the error to a monitoring service.
  # - Exit the application gracefully.
  # - Disable features that rely on the missing key(s).
  exit(1) # Exit if the key is absolutely critical for startup
rescue => e # Catch other potential errors during startup
  $stderr.puts "An unexpected error occurred during startup: #{e.message}"
  exit(1)
end

# Application continues if all checks pass...
```

By raising an error, you prevent the application from running in an improperly configured state. The error message clearly indicates which key is missing, aiding in quick troubleshooting. For keys that are truly optional, you can use `ENV.fetch('KEY_NAME', 'default_value')` within the `Config` module to provide defaults instead of raising errors.
