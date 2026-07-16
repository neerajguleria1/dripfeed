import { Helmet } from 'react-helmet-async';

export interface SEOHeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  canonical?: string;
  /** JSON-LD structured data object(s) — Product, BreadcrumbList, FAQPage, etc. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Set to true on error/empty pages to keep them out of the index */
  noindex?: boolean;
}

const SITE_NAME = 'DripFeed India';
const SITE_URL = 'https://dripfeed-v21.vercel.app';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;
const DEFAULT_DESCRIPTION =
  'Compare fashion prices across Myntra, Ajio, Amazon & Flipkart. Find the lowest price instantly — free, no signup.';

export function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  canonical,
  jsonLd,
  noindex = false,
}: SEOHeadProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = canonical || url || SITE_URL;
  const jsonLdArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Structured data */}
      {jsonLdArray.map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
}

export default SEOHead;
