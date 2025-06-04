#!/bin/sh
set -e

echo "Starting Docker entrypoint script..."

# Function to inject runtime configuration
inject_runtime_config() {
    # Check if GEMINI_API_KEY is set
    if [ -z "$GEMINI_API_KEY" ]; then
        echo "Warning: GEMINI_API_KEY is not set. The application may not function properly."
        GEMINI_API_KEY=""
    else
        echo "GEMINI_API_KEY is set, injecting runtime configuration..."
        echo "API Key length: ${#GEMINI_API_KEY}"
    fi

    # Create a runtime configuration script
    cat > /usr/share/nginx/html/runtime-config.js << EOF
// Runtime configuration injected by Docker entrypoint
(function() {
    console.log('Loading runtime configuration...');
    window.RUNTIME_CONFIG = window.RUNTIME_CONFIG || {};
    window.RUNTIME_CONFIG.VITE_GEMINI_API_KEY = "$GEMINI_API_KEY";
    console.log('Runtime configuration loaded');
    console.log('API Key configured:', !!(window.RUNTIME_CONFIG.VITE_GEMINI_API_KEY && window.RUNTIME_CONFIG.VITE_GEMINI_API_KEY.trim()));
    
    // Dispatch event to notify app that config is ready
    if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('runtime-config-loaded'));
    }
})();
EOF

    # Inject the script into index.html - make sure it loads FIRST
    if [ -f "/usr/share/nginx/html/index.html" ]; then
        # Create a backup
        cp /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.backup
        
        # Insert the runtime config script at the very beginning of the head section
        sed -i '/<head>/a\    <script src="/runtime-config.js"></script>' /usr/share/nginx/html/index.html
        
        echo "✓ Runtime configuration script injected into index.html"
        
        # Verify the injection
        if grep -q 'runtime-config.js' /usr/share/nginx/html/index.html; then
            echo "✓ Verified: runtime-config.js reference found in index.html"
        else
            echo "⚠ Warning: runtime-config.js reference not found in index.html"
        fi
    else
        echo "⚠ Warning: index.html not found"
    fi
    
    # Verify the runtime config file was created
    if [ -f "/usr/share/nginx/html/runtime-config.js" ]; then
        echo "✓ Runtime configuration file created"
        echo "File size: $(wc -c < /usr/share/nginx/html/runtime-config.js) bytes"
    else
        echo "⚠ Warning: Runtime configuration file was not created"
    fi
}

# Call the function to inject runtime configuration
inject_runtime_config

echo "Runtime configuration setup complete."

# Start nginx
echo "Starting nginx..."
exec nginx -g "daemon off;"