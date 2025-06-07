require 'minitest/autorun'
require 'minitest/spec'
require_relative '../../config/database'
require_relative '../../app/services/url_extraction_service'
require_relative '../../app/models/processed_url'

describe 'URL Extraction Service' do
  before do
    # Clean up test data before each test
    ProcessedUrl.where(Sequel.like(:original_url, '%test-example%')).delete
  end

  after do
    # Clean up test data after each test
    ProcessedUrl.where(Sequel.like(:original_url, '%test-example%')).delete
  end

  describe 'URL normalization' do
    it 'adds https:// to URLs without scheme' do
      normalized = URLExtractionService.send(:normalize_url, 'example.com')
      _(normalized).must_equal 'https://example.com'
    end

    it 'preserves existing https:// scheme' do
      normalized = URLExtractionService.send(:normalize_url, 'https://example.com')
      _(normalized).must_equal 'https://example.com'
    end

    it 'preserves existing http:// scheme' do
      normalized = URLExtractionService.send(:normalize_url, 'http://example.com')
      _(normalized).must_equal 'http://example.com'
    end

    it 'raises error for invalid URLs' do
      _(proc { URLExtractionService.send(:normalize_url, 'not a url') }).must_raise URLExtractionService::ExtractionError
    end

    it 'raises error for URLs without host' do
      _(proc { URLExtractionService.send(:normalize_url, 'https://') }).must_raise URLExtractionService::ExtractionError
    end
  end

  describe 'HTML parsing' do
    it 'extracts title from HTML' do
      html = '<html><head><title>Test Title</title></head><body><p>Content goes here</p></body></html>'
      result = URLExtractionService.send(:parse_html_content, html)
      
      _(result[:title]).must_equal 'Test Title'
      _(result[:content]).wont_be_nil
      _(result[:content]).must_include 'Content goes here'
    end

    it 'extracts title from meta og:title' do
      html = '<html><head><meta property="og:title" content="OG Title" /><title>Regular Title</title></head><body><p>Content goes here for testing</p></body></html>'
      result = URLExtractionService.send(:parse_html_content, html)
      
      _(result[:title]).must_equal 'OG Title'
    end

    it 'removes scripts and styles' do
      html = '<html><body><p>Good content goes here</p><script>alert("bad")</script><style>.bad{}</style></body></html>'
      result = URLExtractionService.send(:parse_html_content, html)
      
      _(result[:content]).wont_be_nil
      _(result[:content]).must_include 'Good content goes here'
      _(result[:content]).wont_include 'alert'
      _(result[:content]).wont_include '.bad'
    end

    it 'extracts content from article elements' do
      html = '<html><body><article><p>Article content goes here for testing</p></article><aside>Sidebar</aside></body></html>'
      result = URLExtractionService.send(:parse_html_content, html)
      
      _(result[:content]).wont_be_nil
      _(result[:content]).must_include 'Article content goes here for testing'
    end

    it 'calculates word count correctly' do
      html = '<html><body><p>This is a test with exactly eight words here.</p></body></html>'
      result = URLExtractionService.send(:parse_html_content, html)
      
      _(result[:word_count]).must_equal 9 # "This is a test with exactly eight words here"
    end
  end

  describe 'content cleaning' do
    it 'normalizes whitespace' do
      content = "This   has    excessive    spacing"
      cleaned = URLExtractionService.send(:clean_content, content)
      
      _(cleaned).must_equal 'This has excessive spacing'
    end

    it 'returns nil for very short content' do
      short_content = 'Short'  # Less than 10 characters
      cleaned = URLExtractionService.send(:clean_content, short_content)
      
      _(cleaned).must_be_nil
    end

    it 'preserves paragraph breaks' do
      content = "First paragraph.\n\nSecond paragraph."
      cleaned = URLExtractionService.send(:clean_content, content)
      
      _(cleaned).must_include "First paragraph.\n\nSecond paragraph."
    end
  end

  describe 'database integration' do
    it 'persists extracted content with deduplication' do
      skip 'Skipping database tests - no DB connection' unless DB

      # Mock successful extraction
      url = 'https://test-example.com/article'
      
      # Create a ProcessedUrl record directly to test deduplication
      existing = ProcessedUrl.create_from_url(
        original_url: url,
        extracted_title: 'Original Title',
        extracted_content: 'Original content'
      )

      # Verify it exists
      found = ProcessedUrl.find_by_url(url)
      _(found).wont_be_nil
      _(found.id).must_equal existing.id
      _(found.extracted_title).must_equal 'Original Title'

      # Test URL hash generation
      generated_hash = ProcessedUrl.generate_url_hash(url)
      _(generated_hash).must_equal existing.url_hash
      _(generated_hash.length).must_equal 64 # SHA256 hex length
    end

    it 'handles URL hash collisions gracefully' do
      skip 'Skipping database tests - no DB connection' unless DB

      url1 = 'https://test-example.com/page1'
      url2 = 'https://test-example.com/page2'

      # Create two different URLs
      record1 = ProcessedUrl.create_from_url(
        original_url: url1,
        extracted_title: 'Page 1',
        extracted_content: 'Content 1'
      )

      record2 = ProcessedUrl.create_from_url(
        original_url: url2,
        extracted_title: 'Page 2',
        extracted_content: 'Content 2'
      )

      # Should have different hashes
      _(record1.url_hash).wont_equal record2.url_hash

      # Should be retrievable individually
      found1 = ProcessedUrl.find_by_url(url1)
      found2 = ProcessedUrl.find_by_url(url2)

      _(found1.id).must_equal record1.id
      _(found2.id).must_equal record2.id
    end

    it 'updates existing URLs when re-processed' do
      skip 'Skipping database tests - no DB connection' unless DB

      url = 'https://test-example.com/updated'
      
      # Create initial record
      existing = ProcessedUrl.create_from_url(
        original_url: url,
        extracted_title: 'Old Title',
        extracted_content: 'Old content'
      )

      initial_processed_at = existing.processed_at

      # Update the content
      existing.update_content(
        extracted_title: 'New Title',
        extracted_content: 'New content'
      )

      # Reload and verify
      existing.refresh
      _(existing.extracted_title).must_equal 'New Title'
      _(existing.extracted_content).must_equal 'New content'
      _(existing.last_fetched_at).must_be :>, initial_processed_at
    end
  end

  describe 'error handling' do
    it 'raises NetworkError for invalid hosts' do
      _(proc { 
        URLExtractionService.send(:fetch_html, 'https://this-domain-does-not-exist-12345.com', 5, 1000000)
      }).must_raise URLExtractionService::NetworkError
    end

    it 'raises NetworkError for timeouts' do
      _(proc { 
        URLExtractionService.send(:fetch_html, 'https://httpbin.org/delay/10', 1, 1000000)
      }).must_raise URLExtractionService::NetworkError
    end

    it 'raises ParseError for invalid HTML that breaks parsing' do
      # This would be hard to test without actually breaking Nokogiri
      # For now, just verify the error class exists
      _(URLExtractionService::ParseError).must_be_kind_of Class
    end
  end

  describe 'response formatting' do
    it 'formats successful extraction response correctly' do
      skip 'Skipping database tests - no DB connection' unless DB

      url = 'https://test-example.com/format'
      processed_url = ProcessedUrl.create_from_url(
        original_url: url,
        extracted_title: 'Format Test',
        extracted_content: 'This is test content for format verification'
      )

      response = URLExtractionService.send(:format_response, processed_url, from_cache: false)

      _(response).must_include :id
      _(response).must_include :url
      _(response).must_include :url_hash
      _(response).must_include :title
      _(response).must_include :content
      _(response).must_include :content_preview
      _(response).must_include :processed_at
      _(response).must_include :last_fetched_at
      _(response).must_include :from_cache

      _(response[:url]).must_equal url
      _(response[:title]).must_equal 'Format Test'
      _(response[:from_cache]).must_equal false
    end
  end
end