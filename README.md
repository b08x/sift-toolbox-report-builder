# SIFT Toolbox Report Builder

A web application that generates comprehensive fact-checking and contextualization reports using the SIFT methodology and Google's Gemini AI. This tool helps users analyze claims, images, and artifacts to determine their authenticity and provide proper context.

## About SIFT

This application is based on the SIFT methodology derived from [Check, Please!](https://checkplease.neocities.org/), a resource for digital media literacy. SIFT stands for:

- **S**top
- **I**nvestigate the source
- **F**ind better coverage
- **T**race claims, quotes and media to the original context

The SIFT method is a quick, simple approach to evaluating information online, helping users determine the credibility of sources and claims they encounter.

## Features

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

### 🎯 Key Capabilities

- **Text Analysis**: Analyze claims, statements, URLs, or any text content
- **Image Verification**: Upload and analyze images for authenticity and context
- **Source Evaluation**: Automatic assessment of source credibility using a 1-5 rating scale
- **Evidence Categorization**: Classification of evidence types (Documentation, Personal Testimony, Statistics, Analysis, Reporting, Common Knowledge)
- **Grounding Sources**: Integration with Google Search for real-time fact verification
- **Markdown Reports**: Well-formatted reports with proper citations and hyperlinks

## How It Works

1. **Input**: Users provide text claims and/or upload images to analyze
2. **Processing**: The Gemini AI model analyzes the content using SIFT methodology
3. **Verification**: Google Search grounding provides real-time fact-checking
4. **Output**: A structured report based on the selected report type

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- A Google Gemini API key with access to grounding/search features

### Installation

1. Clone the repository:

   ```bash
   git clone [repository-url]
   cd sift-toolbox-report-builder
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add your Gemini API key:

   ```
   GEMINI_API_KEY=your_api_key_here
   ```

4. Run the development server:

   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173` (or the port shown in terminal)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Technical Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: Google Gemini API (gemini-2.5-flash-preview-04-17)
- **Build Tool**: Vite
- **Markdown Rendering**: react-markdown with GitHub Flavored Markdown support

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

## Source Reliability Ratings

Sources are evaluated on a 1-5 scale:

- **5**: Primary documents, official records, academic sources
- **4**: Contemporary accounts, reputable news outlets, photographic evidence with provenance
- **3**: Wikipedia (as starting point), expert analysis
- **2**: Second-hand accounts, some news outlets
- **1**: Uncorroborated social media, forums (useful for discourse analysis)

## Credits & Attribution

This application implements the SIFT methodology from [Check, Please!](https://checkplease.neocities.org/), created by Mike Caulfield. Check, Please! is an essential resource for digital media literacy and fact-checking education.

The SIFT method and educational materials are used with acknowledgment to the original creators and their work in promoting information literacy.

## Limitations

- Requires a valid Gemini API key with grounding/search capabilities
- API usage is subject to Google's rate limits and quotas
- The accuracy of reports depends on the quality of available online sources
- Generated reports should be treated as one input into a human-checked process

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests to improve the tool.

## License

[Your License Here]

---

**Note**: This tool is designed to assist in fact-checking and information verification. Always apply critical thinking and verify important information through multiple sources. The AI-generated reports may contain errors and should be treated as a starting point for further investigation rather than definitive conclusions.
