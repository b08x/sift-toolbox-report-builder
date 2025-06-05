# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2025-06-05

### 💼 Other

- Generalize report parsing function
- Enable segmented rendering for all initial SIFT reports
- Update SIFT_CONTEXT_REPORT_PROMPT to use Markdown headers
- Generalize report parsing regex

## [0.2.0] - 2025-06-04

### 🚀 Features

- Added .dockerignore file, created .env.production file, updated Dockerfile to include package-lock.json, install runtime dependencies, and use entrypoint script, and deleted Dockerfile.alt
- Added stop generation functionality to the App component
- Added stop generation functionality to ChatInputArea, ChatInterface, and InputForm components, allowing users to cancel ongoing SIFT analysis generation, and updated the UI to reflect the new functionality, including changes to button behavior, labels, and disabled states.
- Moved .env.production to docker directory, updated Dockerfile to copy .env.production and build application with placeholder, and modified docker-entrypoint.sh to inject runtime configuration into index.html
- Updated vite.config.ts to include global constants, environment variable configuration, build configuration, development server configuration, and preview server configuration
- Added functionality to restart generation in App.tsx, including the ability to store and retrieve last generation input, and handle restarts for both initial SIFT reports and follow-up messages.

### ⚙️ Miscellaneous Tasks

- Updated docker-compose.yml to use correct Dockerfile and environment variables, and updated entrypoint.sh to remove unnecessary warnings and start nginx

## [0.1.0] - 2025-06-02

### ⚙️ Miscellaneous Tasks

- Removed GEMINI_MODEL_NAME constant from constants.ts and added uuid and @/App dependencies to package.json
- Removed @/App from package.json and added sift-toolbox.json to .gitignore
