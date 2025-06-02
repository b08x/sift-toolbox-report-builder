#!/bin/sh
set -e

# Function to replace environment variables in JavaScript files
replace_env_vars() {
    # Check if GEMINI_API_KEY is set
    if [ -z "$GEMINI_API_KEY" ]; then
        echo "Warning: GEMINI_API_KEY is not set. The application may not function properly."
        echo "Please ensure the GEMINI_API_KEY environment variable is set."
        echo "Note: You need to enable 'Grounding with Google Search' in your API settings."
    else
        echo "Injecting API key into application..."
        # Replace placeholder in all JS files
        # Note: The app uses process.env.API_KEY internally
        find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|VITE_GEMINI_API_KEY_PLACEHOLDER|$GEMINI_API_KEY|g" {} +
        echo "API key injection complete."
    fi
}

# Call the function to replace environment variables
replace_env_vars

# Start nginx
echo "Starting SIFT Toolbox Report Builder..."
exec nginx -g "daemon off;"