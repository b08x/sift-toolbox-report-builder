# SIFT Toolbox Report Builder

An interactive web application that provides chat-based fact-checking and contextualization using the SIFT methodology and Google's Gemini AI. This tool helps users analyze claims, images, and artifacts through conversational interaction to determine their authenticity and provide proper context.

## About SIFT

This application is based on the SIFT methodology derived from [Check, Please!](https://checkplease.neocities.org/),created by Mike Caulfield, a resource for digital media literacy. SIFT stands for:

- **S**top
- **I**nvestigate the source
- **F**ind better coverage
- **T**race claims, quotes and media to the original context

The SIFT method is a quick, simple approach to evaluating information online, helping users determine the credibility of sources and claims they encounter.

## Features

### 🎯 Interactive Chat Interface

- **Conversational Analysis**: Engage in back-and-forth dialogue with the AI to refine your fact-checking
- **Streaming Responses**: See results as they're generated with the ability to stop generation mid-stream
- **Context Persistence**: The AI maintains conversation history for follow-up questions
- **Quick Commands**:
  - "Another Round" 🔁 - Request additional searches and sources
  - "Read the Room" 🧐 - Get expert consensus analysis on the topic

### 🔍 Three Report Types

1. **Full Check** - A comprehensive fact-checking report that includes:
   - ✅ Verified Facts Table
   - ⚠️ Errors and Corrections Table
   - 🛠️ Corrections Summary
   - 📌 Potential Leads for further investigation
   - 🔴 Source Reliability Assessment
   - 📜 Revised Summary with corrections
   - 🏆 Fact-Checker's Verdict
   - 💡 Research Tips

2. **Context Report** - A structured summary providing:
   - Core context with essential facts
   - How the artifact appears online
   - Audience interpretation and impact
   - Actual story and background
   - Visual description comparison
   - Larger discourse and topical context

3. **Community Note** - A concise Twitter-style community note (under 700 characters) with supporting sources

### 🎨 Enhanced User Interface

- **Split View Layout**: Current query panel on the left, chat interface on the right
- **Sectioned Report Display**: Full Check reports are automatically parsed into collapsible sections
- **Real-time Model Configuration**: Adjust AI parameters (temperature, top-p, top-k) via sidebar
- **Visual Query Reference**: Keep track of your original text and images while chatting
- **Copy Functionality**: Easy copying of individual messages or entire reports

### 🚀 Key Capabilities

- **Text Analysis**: Analyze claims, statements, URLs, or any text content
- **Image Verification**: Upload and analyze images for authenticity and context
- **Source Evaluation**: Automatic assessment of source credibility using a 1-5 rating scale
- **Evidence Categorization**: Classification of evidence types
- **Grounding Sources**: Integration with Google Search for real-time fact verification
- **Markdown Rendering**: Well-formatted responses with proper citations and hyperlinks
- **Stop Generation**: Cancel ongoing AI responses at any time
- **Restart Generation**: Retry the last AI response, useful after interruptions or for refining results.

## How It Works

1. **Initial Query**: Users provide text claims and/or upload images to analyze
2. **Choose Report Type**: Select from Full Check, Context Report, or Community Note
3. **Start Chat**: Begin the interactive SIFT analysis session
4. **Conversation**: Ask follow-up questions, request additional sources, or dive deeper
5. **Export**: Copy formatted reports for use elsewhere

## Setup Instructions

### Prerequisites

- Node.js (v20 or higher)
- Docker (optional, for containerized deployment)
- A Google Gemini API key with access to grounding/search features

### Local Development

1. Clone the repository:

   ```bash
   git clone [repository-url]
   cd sift-toolbox-report-builder
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:

   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   # Optional:
   # VITE_OPENAI_API_KEY=your_openai_api_key_here
   # VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

4. Run the development server:

   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

### Docker Deployment

1. Build and run with Docker Compose:

   ```bash
   # With environment variable
   # Example for one key:
   # GEMINI_API_KEY=your_api_key_here docker-compose up
   # Example for multiple keys (if using OpenAI and/or OpenRouter):
   GEMINI_API_KEY=your_gemini_api_key OPENAI_API_KEY=your_openai_key OPENROUTER_API_KEY=your_openrouter_key docker-compose up

   # Or using .env file
   # Create or update your .env file in the project root with lines like:
   # GEMINI_API_KEY=your_gemini_api_key_here
   # # Optional:
   # # OPENAI_API_KEY=your_openai_api_key_here
   # # OPENROUTER_API_KEY=your_openrouter_api_key_here
   #
   # Then run:
   docker-compose up
   ```

2. Access the application at `http://localhost:3000`

### Manual Docker Build

```bash
# Build the image
docker build -f docker/Dockerfile -t sift-toolbox .

# Run the container
docker run -p 3000:80 -e GEMINI_API_KEY=your_gemini_api_key_here -e OPENAI_API_KEY=your_openai_key -e OPENROUTER_API_KEY=your_openrouter_key sift-toolbox
```

## Technical Stack

- **Frontend**: React 19 with TypeScript
- **Styling**: Tailwind CSS (via CDN)
- **AI Integration**: Google Gemini API, OpenAI API, and OpenRouter (accessing a diverse range of models including Google's Gemini series, OpenAI's GPT series, Anthropic's Claude, Microsoft's Phi, and more).
- **Build Tool**: Vite
- **Containerization**: Docker with Nginx
- **Chat Management**: Custom implementation with streaming support
- **Markdown Rendering**: react-markdown with GitHub Flavored Markdown
- **State Management**: React hooks with local state
- **Unique IDs**: UUID v4 for message tracking

## Configuration Options

### Model Parameters (Adjustable via Sidebar)

- **Temperature** (0-1): Controls randomness in responses
- **Top-P** (0-1): Nucleus sampling parameter
- **Top-K** (1-100): Limits token selection pool

### Environment Variables

- `VITE_GEMINI_API_KEY`: Your Google Gemini API key (development)
- `VITE_OPENAI_API_KEY`: Your OpenAI API key (development, optional)
- `VITE_OPENROUTER_API_KEY`: Your OpenRouter API key (development, optional)
- `GEMINI_API_KEY`: Your Google Gemini API key (Docker runtime)
- `OPENAI_API_KEY`: Your OpenAI API key (Docker runtime, optional)
- `OPENROUTER_API_KEY`: Your OpenRouter API key (Docker runtime, optional)

## Evidence Evaluation Framework

The app uses a sophisticated evidence evaluation system:

| Evidence Type | Credibility Rating | Key Questions |
|--------------|-------------------|---------------|
| Documentation | Based on direct artifacts | Is it authentic and unaltered? |
| Personal Testimony | Based on direct experience | Was the person present? Are they reliable? |
| Statistics | Based on method and representativeness | Is the method sound? Is the sample representative? |
| Analysis | Based on expertise | Does the person have relevant expertise? |
| Reporting | Based on journalistic method | Does the source cite sources? Is it corroborated? |
| Common Knowledge | Based on widespread agreement | Is this actually common knowledge? |

## Chat Commands

- **"another round"**: Requests additional searches with potentially conflicting viewpoints
- **"read the room"**: Analyzes expert consensus and different schools of thought
- **Clear Chat & Reset**: Start a fresh analysis session

## Docker Runtime Configuration

The Docker deployment uses a special runtime configuration system that injects the API key at container startup, avoiding the need to rebuild the image for different API keys. This is handled through the `docker-entrypoint.sh` script.

## Credits & Attribution

This application implements the SIFT methodology from [Check, Please!](https://checkplease.neocities.org/), created by Mike Caulfield. Check, Please! is an essential resource for digital media literacy and fact-checking education.

The SIFT method and educational materials are used with acknowledgment to the original creators and their work in promoting information literacy.

## Limitations

- Requires a valid Gemini API key with grounding/search capabilities
- API usage is subject to Google's rate limits and quotas
- The accuracy of reports depends on the quality of available online sources
- Generated reports should be treated as one input into a human-checked process
- Supports models from Google Gemini, OpenAI, and various providers via OpenRouter. (Support for direct Hugging Face and Mistral integration coming soon).

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests to improve the tool.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned features including:

- Export to PDF with smart formatting
- Persistent storage with RAG retrieval
- Multi-provider support (Hugging Face, Mistral)
- Document and URL analysis
- Enhanced UI with cognitive load management

## License

[Your License Here]

---

**Note**: This tool is designed to assist in fact-checking and information verification. Always apply critical thinking and verify important information through multiple sources. The AI-generated reports may contain errors and should be treated as a starting point for further investigation rather than definitive conclusions.
