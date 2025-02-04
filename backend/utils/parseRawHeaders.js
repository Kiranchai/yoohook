export default function parseRawHeaders(rawHeaders) {
  const headers = {};

  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i];
    const value = rawHeaders[i + 1];

    //Multiple values for the same header
    if (headers[key]) {
      headers[key] = Array.isArray(headers[key])
        ? [...headers[key], value]
        : [headers[key], value];
    } else {
      headers[key] = value;
    }
  }

  return headers;
}
