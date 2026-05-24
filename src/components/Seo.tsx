import { Helmet } from "react-helmet-async";

type Props = {
  title: string;
  description: string;
  path: string; // e.g. "/about" — leading slash, no domain
};

const SITE_URL = "https://frenchwithyves.com";

/**
 * Per-route head tags. Sets <title>, <meta description>, canonical and og:* so
 * each route gets the right SEO + social preview. The static fallback head in
 * index.html still ships for non-JS social crawlers.
 */
export function Seo({ title, description, path }: Props) {
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
