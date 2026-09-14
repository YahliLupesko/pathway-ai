'use strict';

// Phase 1 smoke-test handler. Confirms the Lambda runs, sees its env, and — on the
// protected /hello route — receives the Cognito JWT claims injected by the authorizer.
exports.handler = async (event) => {
  const rc = event.requestContext || {};
  const claims = rc.authorizer && rc.authorizer.jwt && rc.authorizer.jwt.claims;
  const path = rc.http && rc.http.path;

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Pathway AI API is alive',
      path,
      table: process.env.TABLE_NAME || null,
      user: claims ? { sub: claims.sub, email: claims.email } : null,
      time: new Date().toISOString(),
    }),
  };
};
