# SIFT Toolbox API Backend

This is the backend API for the SIFT Toolbox, built with Sinatra.

## Prerequisites

*   Ruby (check `.ruby-version` if it exists, otherwise use a recent version like 3.x)
*   Bundler (`gem install bundler`)

## Setup

1.  **Navigate to the project directory:**
    ```bash
    cd sift_backend
    ```

2.  **Install dependencies:**
    This command will install all the gems specified in the `Gemfile`.
    ```bash
    bundle install
    ```

3.  **(Optional) Create a `.env` file:**
    If you need to manage environment-specific variables (like API keys or database URLs), create a `.env` file in the `sift_backend` root directory. The `dotenv` gem will automatically load these variables in development and test environments.
    Example `.env` content:
    ```
    RACK_ENV=development
    DATABASE_URL="your_database_connection_string_here"
    ```

## Running the Server

To run the Sinatra application locally using the Puma web server:

```bash
bundle exec puma
```

By default, Puma might start the server on `http://localhost:9292`. Check your terminal output for the exact address.

You can test the basic health check endpoint by navigating to `http://localhost:9292/health` in your browser or using a tool like `curl`.

## Development

*   **Linting:** This project uses RuboCop for linting. To check your code:
    ```bash
    bundle exec rubocop
    ```
    To automatically fix some offenses:
    ```bash
    bundle exec rubocop -A
    ```

*   **Running Tests (Placeholder):**
    (Instructions for running tests will be added here once test files are created in the `spec/` directory.)

## Project Structure

*   `app/`: Contains the core application logic.
    *   `routes/`: For route definitions (e.g., `users_routes.rb`, `items_routes.rb`).
    *   `models/`: For database models or business logic objects.
    *   `services/`: For service objects that encapsulate specific pieces of business logic.
*   `config/`: For configuration files (e.g., database connections, initializers).
*   `config.ru`: Rackup file to start the application.
*   `db/`: For database-related files.
    *   `migrations/`: For database schema migrations (if using a database).
*   `lib/`: For custom libraries or modules.
*   `spec/`: For RSpec tests.
*   `Gemfile`: Lists project dependencies.
*   `Gemfile.lock`: Records the exact versions of installed gems.
*   `README.md`: This file.
*   `.env`: (Optional, create manually) For environment variables.

## Logging

**Configuration**:

The logger is initialized in `sift_backend/app.rb` within the `configure` block. The behavior of the logger is determined by the `RACK_ENV` environment variable:

*   **Development** (if `RACK_ENV` is `development` or not set):
    *   Logs are sent to `STDOUT` (your console).
    *   The log level is set to `DEBUG`, which is verbose and useful for development.
*   **Production** (if `RACK_ENV` is `production`):
    *   Logs are written to the file `sift_backend/log/production.log`.
    *   The log level is set to `INFO`, capturing important events but less verbose than debug.

The `RACK_ENV` variable can be set in your `.env` file or directly in your shell environment before starting the server.

**Usage in Routes**:

You can access the logger instance within your Sinatra routes using `settings.logger`.

Example:
```ruby
# Inside a Sinatra route
get '/some_route' do
  settings.logger.debug "This is a debug message for: #{request.path_info}"
  settings.logger.info "Informational message from /some_route"
  settings.logger.warn "A warning occurred in /some_route"
  settings.logger.error "An error was encountered in /some_route"
  # ...
  "Route completed"
end
```

**Log Levels**:

The logger supports several levels to categorize the severity and importance of messages:

*   `DEBUG`: Detailed information, typically of interest only when diagnosing problems.
*   `INFO`: Confirmation that things are working as expected.
*   `WARN`: An indication that something unexpected happened, or indicative of some problem in the near future (e.g., ‘disk space low’). The software is still working as expected.
*   `ERROR`: Due to a more serious problem, the software has not been able to perform some function.
*   `FATAL`: A severe error, indicating that the application will likely terminate.

**Log Rotation (Production)**:

When logging to files in a production environment (like `log/production.log`), it's crucial to manage log file sizes to prevent them from consuming excessive disk space. Log rotation is the process of archiving old log files and starting new ones.

This is typically an operational concern handled by system utilities like `logrotate` on Linux or other platform-specific logging services. It is not directly managed by the application code but should be configured as part of the server deployment process.
