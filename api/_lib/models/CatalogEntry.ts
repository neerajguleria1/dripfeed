/**
 * CatalogEntry.ts
 *
 * Persisted enriched product record produced by the catalog intelligence pipeline.
 *
 * Decoupled from SearchCache (ephemeral, TTL-based) and Product (legacy, scraper-specific).
 * CatalogEntry is the canonical enriched store with completeness tracking.
 *
 * ── Indexes ───────────────────────────────────────────────────────────────────
 *   - canonicalId:  unique (primary key, matches SearchCache.canonicalIds entry)
 *   - lastEnrichedAt: for incremental batch queries ("enrich oldest first")
 *   - completenessScore: for dashboard queries ("products below threshold")
 *   - needsEnrichment: boolean flag for fast filter
 */

import mongoose from 'mongoose';

/** Which normalisation fields have been applied */
export interface EnrichmentFlags {
  titleNormalized:    boolean;
  brandNormalized:    boolean;
  colorExtracted:     boolean;
  sizeExtracted:      boolean;
  genderExtracted:    boolean;
  categoryInferred:   boolean;
  keywordsGenerated:  boolean;
}

/** Breakdown of how completeness score was computed */
export interface CompletenessBreakdown {
  hasTitle:          number;   // 0–15
  hasImage:          number;   // 0–15
  hasBrand:          number;   // 0–15
  hasCategory:       number;   // 0–10
  hasColor:          number;   // 0–5
  hasSize:           number;   // 0–5
  hasGender:         number;   // 0–5
  hasOriginalPrice:  number;   // 0–10
  hasRating:         number;   // 0–5
  retailerCoverage:  number;   // 0–15 (proportional to offer count)
}

export interface ICatalogEntry {
  /** Canonical ID — matches SearchCache.canonicalIds / CanonicalProduct.id */
  canonicalId:        string;
  /** Normalised title (output of normalizer.normalizeTitle) */
  normalizedTitle:    string;
  /** Raw display title from the best-quality offer */
  displayTitle:       string;
  /** Normalised brand (output of normalizer.normalizeBrand) */
  normalizedBrand?:   string;
  /** Inferred category slug (e.g. "kurta", "sneakers") */
  category?:          string;
  /** Best image URL across all offers */
  imageUrl?:          string;
  /** Extracted color */
  color?:             string;
  /** Extracted size */
  size?:              string;
  /** Extracted gender */
  gender?:            string;
  /** Searchable keyword tokens (sorted, deduped) */
  keywords:           string[];
  /** Platform names present in the source canonical */
  platforms:          string[];
  /** Number of platform offers */
  offerCount:         number;
  /** Lowest price across all offers */
  lowestPrice?:       number;
  /** Has any offer with an original/MRP price */
  hasOriginalPrice:   boolean;
  /** Average rating across offers that have one */
  avgRating?:         number;
  /** Confidence from the canonical matcher (0–1) */
  matchConfidence:    number;
  /** Completeness score 0–100 */
  completenessScore:  number;
  /** Per-signal breakdown */
  breakdown:          CompletenessBreakdown;
  /** Which enrichment steps have been applied */
  flags:              EnrichmentFlags;
  /** When this entry was first created */
  createdAt:          Date;
  /** When the last enrichment pass ran */
  lastEnrichedAt:     Date;
  /** Whether this entry still needs a full enrichment pass */
  needsEnrichment:    boolean;
  /** Source query that produced the SearchCache document */
  sourceQuery?:       string;
}

const flagsSchema = new mongoose.Schema<EnrichmentFlags>({
  titleNormalized:    { type: Boolean, default: false },
  brandNormalized:    { type: Boolean, default: false },
  colorExtracted:     { type: Boolean, default: false },
  sizeExtracted:      { type: Boolean, default: false },
  genderExtracted:    { type: Boolean, default: false },
  categoryInferred:   { type: Boolean, default: false },
  keywordsGenerated:  { type: Boolean, default: false },
}, { _id: false });

const breakdownSchema = new mongoose.Schema<CompletenessBreakdown>({
  hasTitle:         { type: Number, default: 0 },
  hasImage:         { type: Number, default: 0 },
  hasBrand:         { type: Number, default: 0 },
  hasCategory:      { type: Number, default: 0 },
  hasColor:         { type: Number, default: 0 },
  hasSize:          { type: Number, default: 0 },
  hasGender:        { type: Number, default: 0 },
  hasOriginalPrice: { type: Number, default: 0 },
  hasRating:        { type: Number, default: 0 },
  retailerCoverage: { type: Number, default: 0 },
}, { _id: false });

const catalogEntrySchema = new mongoose.Schema<ICatalogEntry>(
  {
    canonicalId:       { type: String, required: true, unique: true, index: true },
    normalizedTitle:   { type: String, required: true },
    displayTitle:      { type: String, required: true },
    normalizedBrand:   { type: String },
    category:          { type: String },
    imageUrl:          { type: String },
    color:             { type: String },
    size:              { type: String },
    gender:            { type: String },
    keywords:          { type: [String], default: [] },
    platforms:         { type: [String], default: [] },
    offerCount:        { type: Number, default: 1 },
    lowestPrice:       { type: Number },
    hasOriginalPrice:  { type: Boolean, default: false },
    avgRating:         { type: Number },
    matchConfidence:   { type: Number, default: 0 },
    completenessScore: { type: Number, default: 0, index: true },
    breakdown:         { type: breakdownSchema, default: () => ({}) },
    flags:             { type: flagsSchema,    default: () => ({}) },
    needsEnrichment:   { type: Boolean, default: true, index: true },
    sourceQuery:       { type: String },
    lastEnrichedAt:    { type: Date, default: () => new Date(0), index: true },
  },
  { timestamps: true },
);

// Compound index for incremental batch: find oldest un-enriched entries
catalogEntrySchema.index({ needsEnrichment: 1, lastEnrichedAt: 1 });
// Text search on keywords
catalogEntrySchema.index({ keywords: 1 });

export default (mongoose.models.CatalogEntry as mongoose.Model<ICatalogEntry>) ||
  mongoose.model<ICatalogEntry>('CatalogEntry', catalogEntrySchema);
