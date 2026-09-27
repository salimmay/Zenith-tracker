const { badRequest } = require('../lib/errors');

// validate({ body: schema, query: schema, params: schema }) — parsed values
// replace the raw ones so handlers only ever see clean, typed input.
function validate(schemas) {
  return (req, _res, next) => {
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue.path.join('.');
        return next(badRequest(field ? `${field}: ${issue.message}` : issue.message));
      }
      // Express 5 exposes req.query as a getter, so store parsed values separately.
      req.valid = { ...req.valid, [part]: result.data };
    }
    next();
  };
}

module.exports = { validate };
