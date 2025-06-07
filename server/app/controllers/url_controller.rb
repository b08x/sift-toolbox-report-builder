# frozen_string_literal: true

require_relative '../services/url_extraction_service'
require_relative '../models/processed_url'

# URLController handles URL extraction and management endpoints
class URLController
  class << self
    # Extract content from a URL
    # POST /api/url/extract
    def extract(params, logger)
      logger.info 'POST /api/url/extract - Extracting URL content'

      # Parameter extraction and validation
      url = params['url']&.strip
      force_refresh = ['true', true].include?(params['forceRefresh'])
      timeout = (params['timeout'] || 10).to_i

      logger.debug "URL: #{url}"
      logger.debug "Force refresh: #{force_refresh}"
      logger.debug "Timeout: #{timeout}"

      # Validation
      if url.nil? || url.empty?
        logger.warn 'Validation failed: URL is required'
        return {
          status: 400,
          body: { error: { type: 'MissingParameterError', message: 'URL is required' } }
        }
      end

      # Validate timeout
      if timeout <= 0 || timeout > 30
        logger.warn "Invalid timeout value: #{timeout}"
        return {
          status: 400,
          body: { error: { type: 'InvalidParameterError', message: 'Timeout must be between 1 and 30 seconds' } }
        }
      end

      begin
        # Extract URL content
        result = URLExtractionService.extract_and_persist(
          url: url,
          force_refresh: force_refresh,
          timeout: timeout
        )

        logger.info "Successfully extracted content from URL: #{url}"
        logger.debug "Content length: #{result[:content]&.length || 0} characters"

        {
          status: 200,
          body: {
            success: true,
            data: result
          }
        }
      rescue URLExtractionService::ExtractionError => e
        logger.error "URL extraction error: #{e.message}"
        {
          status: 422,
          body: { error: { type: 'ExtractionError', message: e.message } }
        }
      rescue StandardError => e
        logger.error "Unexpected error during URL extraction: #{e.message}"
        logger.debug e.backtrace.join("\n")
        {
          status: 500,
          body: { error: { type: 'InternalError', message: 'Failed to extract URL content' } }
        }
      end
    end

    # Get recent processed URLs
    # GET /api/url/recent
    def recent(params, logger)
      logger.info 'GET /api/url/recent - Retrieving recent URLs'

      begin
        limit = [(params['limit'] || 20).to_i, 100].min # Cap at 100
        limit = 20 if limit <= 0

        processed_urls = ProcessedUrl.recent(limit).map(&:to_hash)

        logger.info "Retrieved #{processed_urls.length} recent URLs"

        {
          status: 200,
          body: {
            success: true,
            data: {
              urls: processed_urls,
              count: processed_urls.length
            }
          }
        }
      rescue StandardError => e
        logger.error "Error retrieving recent URLs: #{e.message}"
        {
          status: 500,
          body: { error: { type: 'DatabaseError', message: 'Failed to retrieve URLs' } }
        }
      end
    end

    # Get specific processed URL by ID or hash
    # GET /api/url/:identifier
    def show(identifier, logger)
      logger.info "GET /api/url/#{identifier} - Retrieving URL details"

      begin
        # Try to find by ID first (if numeric), then by hash
        processed_url = if identifier.match?(/^\d+$/)
                          ProcessedUrl[identifier.to_i]
                        else
                          ProcessedUrl.where(url_hash: identifier).first
                        end

        unless processed_url
          logger.warn "URL not found: #{identifier}"
          return {
            status: 404,
            body: { error: { type: 'NotFoundError', message: 'URL not found' } }
          }
        end

        logger.info "Found URL: #{processed_url.original_url}"

        {
          status: 200,
          body: {
            success: true,
            data: processed_url.to_hash.merge(
              full_content: processed_url.extracted_content # Include full content for detail view
            )
          }
        }
      rescue StandardError => e
        logger.error "Error retrieving URL #{identifier}: #{e.message}"
        {
          status: 500,
          body: { error: { type: 'DatabaseError', message: 'Failed to retrieve URL' } }
        }
      end
    end

    # Search processed URLs by content
    # GET /api/url/search
    def search(params, logger)
      logger.info 'GET /api/url/search - Searching URLs'

      query = params['q']&.strip
      limit = [(params['limit'] || 10).to_i, 50].min

      if query.nil? || query.empty?
        logger.warn 'Search query is required'
        return {
          status: 400,
          body: { error: { type: 'MissingParameterError', message: 'Search query (q) is required' } }
        }
      end

      begin
        # Simple text search for now (can be enhanced with vector search later)
        results = ProcessedUrl.where(
          Sequel.ilike(:extracted_content, "%#{query}%") |
          Sequel.ilike(:extracted_title, "%#{query}%") |
          Sequel.ilike(:original_url, "%#{query}%")
        ).limit(limit).map(&:to_hash)

        logger.info "Found #{results.length} URLs matching query: #{query}"

        {
          status: 200,
          body: {
            success: true,
            data: {
              query: query,
              urls: results,
              count: results.length
            }
          }
        }
      rescue StandardError => e
        logger.error "Error searching URLs: #{e.message}"
        {
          status: 500,
          body: { error: { type: 'DatabaseError', message: 'Search failed' } }
        }
      end
    end
  end
end
