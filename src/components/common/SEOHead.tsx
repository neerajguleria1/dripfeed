import { Helmet } from 'react-helmet-async';

export interface SEOHeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  canonical?: string;
}

export function SEOHead({ title, description, image, url, canonical }: SEOHeadProps) {
  const fullTitle = `${title} | DripFeed India`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      {url && <meta property="og:url" content={url} />}
      {canonical && <link rel="canonical" href={canonical} />}
    </Helmet>
  );
}

export default SEOHead;
