const Busboy = require('busboy');
const { Errors } = require('../http/errors');

/** multer/busboy normally read the request as a live stream — but the Cloud Functions
 * emulator/runtime already buffers the whole body into req.rawBody before Express ever sees
 * the request, which leaves the stream drained ("Unexpected end of form" from busboy). Feeding
 * req.rawBody into busboy directly (bb.end(rawBody) instead of req.pipe(bb)) sidesteps that.
 *
 * Parses a single file field into req.file = {buffer, mimetype, originalname, size}, matching
 * the shape multer's `.single(fieldName)` would have set — routes don't need to know this isn't
 * multer under the hood. */
function parseMultipart(fieldName, { maxSizeBytes = 10 * 1024 * 1024 } = {}) {
  return (req, res, next) => {
    if (!req.rawBody) return next(Errors.validation({ file: 'Multipart form data is required.' }));

    const bb = Busboy({ headers: req.headers, limits: { fileSize: maxSizeBytes } });
    let fileFound = false;
    let tooLarge = false;

    bb.on('file', (name, stream, info) => {
      if (name !== fieldName) {
        stream.resume();
        return;
      }
      fileFound = true;
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => {
        tooLarge = true;
      });
      stream.on('end', () => {
        if (tooLarge) return;
        req.file = { buffer: Buffer.concat(chunks), mimetype: info.mimeType, originalname: info.filename, size: chunks.reduce((n, c) => n + c.length, 0) };
      });
    });

    bb.on('finish', () => {
      if (tooLarge) return next(Errors.validation({ file: 'File exceeds the size limit.' }));
      if (!fileFound) return next(Errors.validation({ file: 'A file is required.' }));
      next();
    });

    bb.on('error', (err) => next(err));
    bb.end(req.rawBody);
  };
}

module.exports = { parseMultipart };
