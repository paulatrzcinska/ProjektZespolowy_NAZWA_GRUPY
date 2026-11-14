// CloudFront Function (viewer-request) dla warstwy web.
// Trasy React Routera (np. /products/3, /admin) nie istnieją w S3 jako pliki,
// więc wracają do index.html. Żądania plików (ostatni segment z rozszerzeniem,
// np. /assets/index-abc123.js, /manifest.json) przechodzą bez zmian.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (uri !== '/' && !lastSegment.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}
