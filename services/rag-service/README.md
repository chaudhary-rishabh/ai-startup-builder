# rag-service

## Pinecone Index Setup

Before running rag-service, create the Pinecone index:

1. Go to [https://app.pinecone.io](https://app.pinecone.io).
2. Create an index with:
   - Name: `PINECONE_INDEX_NAME` from your env
   - Dimensions: `3072`
   - Metric: `dotproduct` (required for hybrid BM25 + dense search)
   - Type: `Serverless` (recommended)
3. Copy the API key to `PINECONE_API_KEY`.

`dotproduct` is required for Pinecone hybrid search. If you use `cosine`, sparse BM25 values are ignored.

## Contextual RAG Pipeline

This service implements Anthropic contextual retrieval:

- At indexing time, Claude Haiku generates short contextual prefixes per chunk.
- Dense embeddings and BM25 sparse vectors are generated on enriched chunks.
- At query time, dense and sparse retrieval are fused with Reciprocal Rank Fusion (`k=60`) and reranked with Cohere.

This produces significantly better retrieval quality than naive vector search while keeping query-time latency bounded.
