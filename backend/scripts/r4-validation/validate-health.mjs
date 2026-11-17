const serviceUrls = process.env.R4_SERVICE_URLS?.trim();
if (!serviceUrls) throw new Error('R4_SERVICE_URLS is required (name=url,name=url)');

const entries = serviceUrls.split(',').map((entry) => {
  const separator = entry.indexOf('=');
  if (separator <= 0) throw new Error(`Invalid service URL entry: ${entry}`);
  return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
});

for (const [service, baseUrl] of entries) {
  for (const endpoint of ['/health', '/ready']) {
    const response = await fetch(new URL(endpoint, `${baseUrl}/`));
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`${service}${endpoint} returned ${response.status}: ${body.slice(0, 500)}`);
    }
    console.log(`${service}${endpoint}: ${response.status}`);
  }
}
