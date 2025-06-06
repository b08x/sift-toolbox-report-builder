# frozen_string_literal: true

require 'sequel'
require 'digest'
require_relative '../../config/database'

# ProcessedUrl model for storing extracted URL content with vector embeddings
class ProcessedUrl < Sequel::Model(:processed_urls)
  # Validations
  plugin :validation_helpers
  
  def validate
    super
    validates_presence [:url_hash, :original_url]
    validates_unique :url_hash, message: 'URL has already been processed'
    validates_max_length 64, :url_hash
  end

  # Hooks
  def before_create
    super
    self.processed_at ||= Time.now
    self.last_fetched_at ||= Time.now
  end

  # Class methods
  def self.create_from_url(original_url:, extracted_title: nil, extracted_content: nil, embedding: nil)
    url_hash = generate_url_hash(original_url)
    
    create(
      url_hash: url_hash,
      original_url: original_url,
      extracted_title: extracted_title,
      extracted_content: extracted_content,
      content_embedding: embedding
    )
  end

  def self.find_by_url(url)
    url_hash = generate_url_hash(url)
    where(url_hash: url_hash).first
  end

  def self.search_similar(query_embedding, limit = 10)
    # Using pgvector cosine similarity
    # This requires the pgvector extension and proper indexing
    where(Sequel.lit('content_embedding IS NOT NULL'))
      .order(Sequel.lit('content_embedding <=> ?', query_embedding))
      .limit(limit)
  end

  def self.recent(limit = 50)
    order(Sequel.desc(:processed_at)).limit(limit)
  end

  def self.generate_url_hash(url)
    Digest::SHA256.hexdigest(url.strip.downcase)
  end

  # Instance methods
  def update_content(extracted_title: nil, extracted_content: nil, embedding: nil)
    update(
      extracted_title: extracted_title,
      extracted_content: extracted_content,
      content_embedding: embedding,
      last_fetched_at: Time.now
    )
  end

  def has_embedding?
    !content_embedding.nil?
  end

  def content_preview(length = 200)
    return nil unless extracted_content
    
    extracted_content.length > length ? "#{extracted_content[0...length]}..." : extracted_content
  end

  def similarity_to(other_embedding)
    return nil unless has_embedding? && other_embedding
    
    # Calculate cosine similarity using pgvector operator
    # This would typically be done in a database query for efficiency
    db.fetch('SELECT content_embedding <=> ? AS similarity FROM processed_urls WHERE id = ?', 
             other_embedding, id).first[:similarity]
  end

  def to_hash
    {
      id: id,
      url_hash: url_hash,
      original_url: original_url,
      extracted_title: extracted_title,
      content_preview: content_preview,
      has_embedding: has_embedding?,
      processed_at: processed_at,
      last_fetched_at: last_fetched_at
    }
  end
end