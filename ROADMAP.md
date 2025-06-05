# SIFT Toolbox Report Builder - Development Roadmap

## Phase 1: Export Functionality

**Timeline: 2-3 weeks**

### 1.1 Markdown Export

- [ ] Add "Export as Markdown" button to ReportDisplay component
- [ ] Preserve all formatting, tables, and links
- [ ] Include metadata (date generated, report type, sources used)
- [ ] Implement file download with proper naming convention: `SIFT_Report_[Type]_[Date].md`

### 1.2 PDF Export with Smart Formatting

- [ ] Integrate PDF generation library (recommend: `@react-pdf/renderer` or `jsPDF` with `html2canvas`)
- [ ] Implement intelligent page break logic:
  - [ ] Keep tables intact on single pages where possible
  - [ ] Avoid breaking sections mid-paragraph
  - [ ] Maintain header/section hierarchy
  - [ ] Add page numbers and report metadata in footer
- [ ] Custom PDF styling:
  - [ ] Professional layout with proper margins
  - [ ] Clickable hyperlinks in PDF
  - [ ] Table of contents for Full Check reports
  - [ ] Color-coded sections matching web UI theme

### Technical Considerations

```typescript
interface ExportOptions {
  format: 'markdown' | 'pdf';
  includeGroundingSources: boolean;
  includeMetadata: boolean;
  pageBreakRules?: {
    avoidBreakInside: string[]; // CSS selectors
    preferBreakBefore: string[]; // Section identifiers
  };
}
```

---

## Phase 2: Persistent Storage & RAG System

**Timeline: 4-6 weeks**

### 2.1 Local Storage Implementation

- [ ] IndexedDB for client-side storage of:
  - [ ] Generated reports
  - [ ] User inputs (text + image references)
  - [ ] Report metadata and timestamps
- [ ] Session management UI:
  - [ ] List view of past analyses
  - [ ] Search/filter capabilities
  - [ ] Delete/archive functionality

### 2.2 RAG (Retrieval-Augmented Generation) Design

- [ ] Vector database integration (options):
  - **Client-side**: Use `vectra` or similar for in-browser vector search
  - **Server-side**: Integrate Pinecone, Weaviate, or Qdrant
- [ ] Embedding generation:
  - [ ] Use Gemini embeddings API or
  - [ ] Lightweight client-side model (e.g., Universal Sentence Encoder via TensorFlow.js)
- [ ] Context retrieval strategy:
  - [ ] Embed report sections separately for granular retrieval
  - [ ] Implement similarity threshold for relevant context
  - [ ] Allow users to reference previous analyses in new queries

### 2.3 Backend Infrastructure (if needed)

- [ ] Optional backend API for:
  - [ ] Cloud storage sync
  - [ ] Cross-device access
  - [ ] Collaborative features
- [ ] Authentication system
- [ ] Data privacy considerations

---

## Phase 3: Multi-Provider Support

**Timeline: 3-4 weeks**

### 3.1 Provider Abstraction Layer

```typescript
interface AIProvider {
  name: string;
  generateReport(params: ReportParams): Promise<ReportResponse>;
  supportsGrounding: boolean;
  supportsImages: boolean;
  maxTokens: number;
}
```

### 3.2 Provider Implementations

- [ ] **OpenRouter Integration**
  - [ ] API key management
  - [ ] Model selection UI
  - [ ] Fallback for grounding (use web search API separately)
  
- [ ] **Hugging Face Integration**
  - [ ] Support for Inference API
  - [ ] Model recommendations for fact-checking tasks
  - [ ] Handle rate limits and queuing
  
- [ ] **Mistral Integration**
  - [ ] Direct API integration
  - [ ] Optimize prompts for Mistral models
  - [ ] Cost estimation display

### 3.3 Provider-Specific Optimizations

- [ ] Prompt engineering per provider
- [ ] Response parsing adaptations
- [ ] Feature parity mapping (handle missing capabilities)
- [ ] Provider comparison tool for users

---

## Phase 4: Enhanced UI/UX with Cognitive Load Management

**Timeline: 3-4 weeks**

### 4.1 Multi-Panel Layout

- [ ] Implement collapsible sections with smooth animations
- [ ] Side-by-side view option for comparing sections
- [ ] Progressive disclosure pattern:
  - [ ] Summary view (key findings only)
  - [ ] Detailed view (current full report)
  - [ ] Expert view (additional metadata and confidence scores)

### 4.2 Interactive Report Navigation

- [ ] Sticky table of contents sidebar
- [ ] Section highlighting on scroll
- [ ] Quick jump buttons
- [ ] Breadcrumb navigation for deep reports

### 4.3 Real-time Generation Display

- [ ] Stream responses section by section
- [ ] Show progress indicators per section
- [ ] Allow early interaction with completed sections
- [ ] Cancel/regenerate individual sections

### 4.4 Responsive Panel System

```typescript
interface PanelConfig {
  id: string;
  title: string;
  content: ReactNode;
  priority: 'high' | 'medium' | 'low';
  defaultState: 'expanded' | 'collapsed' | 'hidden';
  dependencies?: string[]; // Other panel IDs
}
```

---

## Phase 5: Extended Input Support

**Timeline: 4-5 weeks**

### 5.1 URL Analysis

- [ ] Web scraping integration:
  - [ ] Use Playwright/Puppeteer service or
  - [ ] Client-side fetch with CORS proxy
- [ ] Automatic content extraction:
  - [ ] Article text via Readability.js
  - [ ] Metadata parsing (Open Graph, Twitter Cards)
  - [ ] Screenshot capture for visual reference

### 5.2 Document Processing

- [ ] PDF parsing:
  - [ ] Extract text with `pdf.js`
  - [ ] Maintain formatting and structure
  - [ ] Handle multi-column layouts
  
- [ ] Academic paper analysis:
  - [ ] Parse paper structure (abstract, methods, results)
  - [ ] Extract citations and references
  - [ ] Integrate with academic APIs (Semantic Scholar, arXiv)
  
- [ ] General document support:
  - [ ] `.docx`, `.txt`, `.rtf` parsing
  - [ ] Presentation files (`.pptx`)
  - [ ] Spreadsheet data extraction

### 5.3 Batch Processing

- [ ] Queue system for multiple inputs
- [ ] Comparative analysis mode
- [ ] Bulk export options

---

## Technical Architecture Considerations

### State Management Evolution

- Migrate from local state to a more robust solution:
  - **Redux Toolkit** for complex state
  - **Zustand** for simpler implementation
  - **Jotai** for atomic state management

### Performance Optimizations

- Implement lazy loading for report sections
- Use React.memo and useMemo strategically
- Consider virtual scrolling for long reports
- Optimize image handling and caching

### Testing Strategy

- Unit tests for core logic
- Integration tests for provider implementations
- E2E tests for critical user journeys
- Accessibility testing for all new features

### Monitoring & Analytics

- Error tracking (Sentry integration)
- Performance monitoring
- Usage analytics (privacy-respecting)
- User feedback collection system

---

## Prioritization Matrix

| Feature | User Impact | Technical Complexity | Dependencies |
|---------|------------|---------------------|--------------|
| Export (MD/PDF) | High | Medium | None |
| Multi-provider | High | Medium | Provider APIs |
| Storage/RAG | Medium | High | Backend (optional) |
| Enhanced UI | High | Medium | None |
| Doc/URL Support | Medium | Medium | Processing libs |

## Suggested Development Order

1. **Start with Export** - Immediate user value, builds on existing functionality
2. **Then Enhanced UI** - Improves user experience without external dependencies
3. **Next Multi-provider** - Expands accessibility and reduces vendor lock-in
4. **Follow with Doc/URL** - Extends input capabilities
5. **Finish with Storage/RAG** - Most complex but enables powerful new workflows

---

## Future Considerations

- **Mobile App**: React Native version for on-the-go fact-checking
- **Browser Extension**: Quick SIFT analysis of any webpage
- **API Service**: Allow other tools to integrate SIFT methodology
- **Collaboration Features**: Team-based fact-checking workflows
- **Custom Prompts**: User-defined report templates
- **Multilingual Support**: Fact-checking in multiple languages

---

## Version History

- **v0.1.0** (Current): Basic chat interface with Gemini integration
- **v0.2.0** (Planned): Export functionality
- **v0.3.0** (Planned): Enhanced UI with cognitive load management
- **v0.4.0** (Planned): Multi-provider support
- **v0.5.0** (Planned): Document/URL analysis
- **v1.0.0** (Planned): Full feature set with storage and RAG
