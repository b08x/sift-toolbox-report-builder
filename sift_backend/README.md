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
