# frozen_string_literal: true

require 'ruby_llm'

# EmbeddingService handles text embedding generation for semantic search
module EmbeddingService
  class EmbeddingError < StandardError; end

  class << self
    # Generate embeddings for text using ruby_llm
    #
    # @param text [String] The text to generate embeddings for
    # @param model [String] The embedding model to use (optional)
    # @return [Array<Float>] The generated embedding vector
    def generate_embedding(text:, model: default_embedding_model)
      return nil if text.nil? || text.strip.empty?

      begin
        # Use ruby_llm to generate embeddings
        # Try different API patterns for ruby_llm
        result = nil
        
        # Pattern 1: Direct embed call
        if RubyLLM.respond_to?(:embed)
          result = RubyLLM.embed(text.strip, model: model)
        elsif RubyLLM.respond_to?(:embedding)
          result = RubyLLM.embedding(text.strip, model: model)
        else
          # Pattern 2: Client-based approach
          client = RubyLLM.client
          result = client.embed(text: text.strip, model: model)
        end

        if result.is_a?(Hash) && result['embedding']
          result['embedding']
        elsif result.is_a?(Array)
          result
        elsif result.respond_to?(:embedding)
          result.embedding
        elsif result.respond_to?(:values)
          result.values
        elsif result.instance_variable_defined?(:@vectors)
          result.instance_variable_get(:@vectors)
        else
          raise EmbeddingError, "Unexpected embedding result format: #{result.class}"
        end
      rescue StandardError => e
        raise EmbeddingError, "Failed to generate embedding: #{e.message}"
      end
    end

    # Generate embeddings for multiple texts in batch
    #
    # @param texts [Array<String>] Array of texts to embed
    # @param model [String] The embedding model to use (optional)
    # @return [Array<Array<Float>>] Array of embedding vectors
    def generate_embeddings_batch(texts:, model: default_embedding_model)
      return [] if texts.nil? || texts.empty?

      texts.map do |text|
        generate_embedding(text: text, model: model)
      end.compact
    end

    # Calculate cosine similarity between two embedding vectors
    #
    # @param embedding1 [Array<Float>] First embedding vector
    # @param embedding2 [Array<Float>] Second embedding vector
    # @return [Float] Cosine similarity score (-1 to 1)
    def cosine_similarity(embedding1, embedding2)
      return 0.0 if embedding1.nil? || embedding2.nil? || embedding1.empty? || embedding2.empty?
      return 0.0 if embedding1.length != embedding2.length

      dot_product = embedding1.zip(embedding2).map { |a, b| a * b }.sum
      magnitude1 = Math.sqrt(embedding1.map { |x| x * x }.sum)
      magnitude2 = Math.sqrt(embedding2.map { |x| x * x }.sum)

      return 0.0 if magnitude1.zero? || magnitude2.zero?

      dot_product / (magnitude1 * magnitude2)
    end

    # Chunk text into manageable pieces for embedding
    #
    # @param text [String] The text to chunk
    # @param max_chunk_size [Integer] Maximum characters per chunk
    # @param overlap [Integer] Character overlap between chunks
    # @return [Array<String>] Array of text chunks
    def chunk_text(text, max_chunk_size: 1000, overlap: 100)
      return [] if text.nil? || text.strip.empty?

      text = text.strip
      return [text] if text.length <= max_chunk_size

      chunks = []
      start_pos = 0

      while start_pos < text.length
        end_pos = start_pos + max_chunk_size

        # If we're not at the end of the text, try to break at a sentence or word boundary
        if end_pos < text.length
          # Look for sentence boundary (. ! ?) within the last 200 characters
          sentence_break = text.rindex(/[.!?]\s+/, end_pos)
          if sentence_break && sentence_break > start_pos + (max_chunk_size * 0.5)
            end_pos = sentence_break + 1
          else
            # Look for word boundary within the last 100 characters
            word_break = text.rindex(/\s+/, end_pos)
            if word_break && word_break > start_pos + (max_chunk_size * 0.7)
              end_pos = word_break
            end
          end
        end

        chunk = text[start_pos...end_pos].strip
        chunks << chunk unless chunk.empty?

        # Move start position, accounting for overlap
        start_pos = end_pos - overlap
        start_pos = [start_pos, text.length].min
        break if start_pos >= text.length
      end

      chunks
    end

    private

    # Get the default embedding model from configuration
    #
    # @return [String] The default embedding model name
    def default_embedding_model
      # Use Gemini embedding model as default since we have that API key
      ENV.fetch('EMBEDDING_MODEL', 'text-embedding-004')
    end
  end
end