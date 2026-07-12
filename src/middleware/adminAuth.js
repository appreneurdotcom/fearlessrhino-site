const crypto = require('crypto');

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;
    return next();
  }
  const next_param = encodeURIComponent(req.originalUrl || '/admin');
  return res.redirect(`/admin/login?next=${next_param}`);
}

// Blocks cross-site form submissions to admin actions (delete/upload/edit/
// logout) from a page that isn't this app — e.g. a malicious link that
// auto-submits a "delete this domain" form while an admin is logged in
// elsewhere in the same browser.
function verifyCsrf(req, res, next) {
  const submitted = req.body && req.body._csrf;
  if (submitted && req.session && submitted === req.session.csrfToken) return next();
  return res.status(403).redirect('/admin?flashType=error&flash=' + encodeURIComponent('Your session expired — please try that again.'));
}

module.exports = { requireAdmin, verifyCsrf };
