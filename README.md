# SIFT-Toolbox

SIFT-Toolbox is a full-stack application designed to assist users in fact-checking and contextualizing information using the SIFT (Stop, Investigate the source, Find better coverage, Trace claims) methodology, enhanced with AI capabilities.

## Features

* **AI-Powered SIFT Analysis:** Leverages various AI models to guide users through the SIFT process.
* **Dynamic Model Configuration:** Fetches available AI models and their configurations dynamically from the backend.
* **Image Upload and Analysis:** Supports image uploads for analysis, including validation for file type and size.
* **Structured AI Prompts:** Utilizes detailed YAML-based prompt configurations for tailored AI responses.
* **Client-Server Architecture:** React/TypeScript frontend with a Ruby/Sinatra backend.
* **Real-time AI Responses:** Uses Server-Sent Events (SSE) for streaming AI outputs.
* **Database Integration:** PostgreSQL backend for data persistence.
* **Docker Support:** Includes [`docker-compose.yml`](docker-compose.yml:1) for easy setup and deployment.

## Architecture

* **Frontend (`client/`):** Built with React, TypeScript, and Vite. Handles user interaction and displays AI-generated SIFT analysis.
* **Backend (`server/`):** A Ruby Sinatra application. Manages AI model interactions, SIFT logic, API key handling, and database operations.

## Project Structure

The project is organized into two main directories:

* `client/`: Contains all frontend code (React, TypeScript).
* `server/`: Contains all backend code (Ruby, Sinatra).
* [`docker-compose.yml`](docker-compose.yml:1): For running the application using Docker.
* [`.env.example`](.env.example:1): Template for environment variables required by the backend (located at project root).

## Getting Started

### Prerequisites

* Node.js and npm (for the frontend)
* Ruby and Bundler (for the backend)
* Docker and Docker Compose (optional, for running with Docker)

### Backend Setup (`server/`)

1. **Navigate to the server directory:**

    ```bash
    cd server
    ```

2. **Install dependencies:**

    ```bash
    bundle install
    ```

3. **Environment Variables:**
    Copy the [`.env.example`](.env.example:1) file from the project root to `server/.env` and fill in your API keys and other necessary configurations.

    ```bash
    # When inside the server/ directory:
    cp ../.env.example .env
    ```

    The `dotenv` gem, used by the backend, will load `server/.env` in development.
    The following "API Key Management" section details this further.
4. **Database Setup:**
    Ensure PostgreSQL is running and configured as per your `server/.env` file. Then, run migrations:

    ```bash
    bundle exec rake db:migrate
    ```

5. **Running the Backend Server:**

    ```bash
    bundle exec ruby app.rb
    ```

    The server will typically start on `http://localhost:4567`.

### Frontend Setup (`client/`)

1. **Navigate to the client directory:**

    ```bash
    cd client
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Running the Frontend Development Server:**

    ```bash
    npm run dev
    ```

    The frontend will typically be available at `http://localhost:5173` and will proxy API requests to the backend.

### Using Docker Compose (Alternative)

1. Ensure Docker and Docker Compose are installed.
2. **Environment Variables for Docker Compose:**
    Copy the root [`.env.example`](.env.example:1) to a root `.env` file and populate it with your API keys.

    ```bash
    # Run from the project root directory
    cp .env.example .env
    ```

    The [`docker-compose.yml`](docker-compose.yml:1) is configured to use this root `.env` file to provide environment variables to the services.
3. Start the application:

    ```bash
    docker-compose up --build
    ```

    This will build the images and start the frontend and backend services.

## Development

Common development commands (refer to [`CLAUDE.md`](CLAUDE.md:1) for more details):

### Frontend (`client/`)

```bash
cd client
npm run dev       # Development server
npm run build     # Production build
npm run preview   # Preview production build
npx tsc --noEmit  # TypeScript checking
```

### Backend (`server/`)

```bash
cd server
bundle install            # Install dependencies
bundle exec rake db:migrate # Database migrations
bundle exec ruby app.rb   # Run server (development)
bundle exec rubocop       # Linting
bundle exec rubocop -a    # Auto-fix linting issues
```

***

## API Key Management for the Sinatra Backend

This section provides guidance on how to securely manage API keys for external services like Google Gemini, OpenAI, and OpenRouter within the Ruby Sinatra backend (`server/`) of the SIFT-Toolbox application.

## 1. Why API Keys Should Never Be Hardcoded

Hardcoding API keys directly into your source code is a significant security risk. Here's why:

* **Exposure in Version Control:** If your code is hosted on a platform like GitHub or GitLab, hardcoded keys become part of your repository's history. Even if you remove them later, they can still be found in previous commits.
* **Accidental Leaks:** Keys can be accidentally leaked through shared code snippets, error messages, or logs if they are present directly in the codebase.
* **Difficult to Rotate:** If a key is compromised, changing it becomes a cumbersome process. You'd need to modify the code, re-deploy the application, and ensure all previous versions with the old key are no longer accessible.
* **Unauthorized Access:** Anyone who gains access to your source code (e.g., a disgruntled employee, a compromised developer account, or a public repository) will also gain access to your API keys. This can lead to unauthorized use of paid services, resulting in financial loss or data breaches.
* **Environment-Specific Keys:** Often, you'll use different API keys for development, staging, and production environments. Hardcoding makes managing these different keys impractical and error-prone.

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

* **In Production/Staging (e.g., Heroku, AWS, Docker):** You'll typically set these environment variables through your hosting platform's dashboard, configuration files (e.g., Docker Compose), or command-line interface.
* **In Local Development:** You can set them in your shell before running the application (e.g., `export GEMINI_API_KEY="your_key_here"`), or use a tool like `dotenv` to load them from a file, which we'll cover next.

## 3. Using the `dotenv` Gem for Local Development

The `dotenv` gem is very useful for managing environment variables in your local development environment. It loads variables from a `.env` file into `ENV` when your application starts.

**Steps to use `dotenv`:**

1. **Add `dotenv` to your `server/Gemfile`:**
    If you haven't already, add it to your `server/Gemfile`:

    ```ruby
    gem 'dotenv'
    ```

    And then run `bundle install` in your `server/` directory.

2. **Create a `server/.env` file:**
    Create a file named `.env` in your `server/` directory (i.e., `server/.env`). **This file should never be committed to version control.** Ensure `server/.env` is listed in your root `.gitignore` file.
    You can copy the root [`.env.example`](.env.example:1) to `server/.env` and replace placeholder values:

    ```bash
    # Run from the project root directory:
    cp .env.example server/.env
    # Or, if you are already in the server/ directory:
    # cp ../.env.example .env
    ```

    Your `server/.env` file would look something like this:

    ```
    GEMINI_API_KEY="actual_gemini_key_value"
    OPENAI_API_KEY="actual_openai_key_value"
    OPENROUTER_API_KEY="actual_openrouter_key_value"
    ```

3. **Load `dotenv` in your application:**
    Require `dotenv` early in your application's lifecycle, typically in your main backend application file (`server/app.rb`) or an environment setup file (e.g., `server/config/environment.rb`).

    For the Sinatra application (`server/app.rb`), you might add this:

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

By following these steps, your API keys and other configurations in `server/.env` will be loaded into `ENV` automatically when you run your Sinatra app locally (within the `server/` directory), making them accessible just like any other environment variable. Remember, `server/.env` is for local development convenience; in production, you should set environment variables directly on your server or hosting platform.

## 4. Centralized Configuration Access

To make API keys and other settings easily accessible and consistently managed throughout your application, you can use a simple Ruby module or class. This approach centralizes how configuration is loaded and used.

**Example: `Config` Module**

Create a module, for instance, in `server/config/config.rb`:

```ruby
# server/config/config.rb

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

1. **Require the module** in your main application file (e.g., `app.rb`) or where needed:

    ```ruby
    # In app.rb or config/environment.rb
    require_relative 'config/config' # Path relative to files in server/ (e.g., server/app.rb)
    ```

2. **Access configuration values** anywhere in your application:

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

Let's say you have a service defined in `server/app/services/ai_service.rb` (example):

```ruby
# server/app/services/ai_service.rb (example)

# Ensure the Config module (server/config/config.rb) is loaded.
# This is often done in a central bootstrap file like server/app.rb or server/config/environment.rb

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
# require_relative 'app/services/ai_service' # Adjust path if used from server/app.rb
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

* The `AIServices::Gemini` class constructor fetches the `GEMINI_API_KEY` using `Config.gemini_api_key`.
* It includes a basic check for the key's presence.
* The `get_completion` method would then use this key to authenticate with the Gemini API.

This pattern keeps your service classes clean and decoupled from the specifics of how configuration is loaded. They simply request what they need from the `Config` module.

## 6. Error Handling for Missing Keys

It's crucial for your application to behave predictably if required API keys are not found in the environment. Instead of letting the application proceed with a `nil` key (which would likely cause cryptic errors later), it's better to fail fast.

**Strategy: Raise an Exception**

Modify the `Config` module to raise a custom error if a key is missing. This makes the problem immediately obvious.

Updated `server/config/config.rb`:

```ruby
# server/config/config.rb

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

* A custom error class `Config::MissingKeyError` is defined for clarity.
* Each API key accessor now uses the `|| raise(...)` pattern. If `ENV['API_KEY']` is `nil` (meaning the key is not set), it will raise a `MissingKeyError` with a descriptive message.

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
