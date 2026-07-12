/**
 * Generic progressive-enhancement handler for the contact form and the two
 * domain-inquiry forms. Markup contract, per `[data-async-endpoint]` wrapper:
 *
 *   <div data-async-endpoint="/contact">
 *     <div data-form-error class="form-error"></div>
 *     <form data-form-block>...fields... <button type="submit">Send</button></form>
 *     <div data-form-success hidden>...success message... <button data-reset-form>Send another</button></div>
 *   </div>
 */
(function () {
  document.querySelectorAll('[data-async-endpoint]').forEach(function (wrap) {
    var endpoint = wrap.getAttribute('data-async-endpoint');
    var form = wrap.querySelector('[data-form-block]');
    var success = wrap.querySelector('[data-form-success]');
    var errorEl = wrap.querySelector('[data-form-error]');
    var resetBtn = wrap.querySelector('[data-reset-form]');
    if (!form) return;

    var submitBtn = form.querySelector('[type="submit"]');
    var submitDefaultText = submitBtn ? submitBtn.textContent : '';

    function showError(message) {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.classList.add('is-visible');
    }
    function clearError() {
      if (!errorEl) return;
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }

      // Send as application/x-www-form-urlencoded (via URLSearchParams) rather
      // than a raw FormData body — fetch would otherwise encode FormData as
      // multipart/form-data, which the server's express.urlencoded()
      // middleware does not parse, silently dropping every field.
      fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams(new FormData(form)),
        headers: { Accept: 'application/json' },
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            form.hidden = true;
            if (success) success.hidden = false;
          } else {
            showError((result.data && result.data.error) || 'Something went wrong sending that. Please try again, or email hello@fearlessrhino.com directly.');
          }
        })
        .catch(function () {
          showError('Something went wrong sending that. Please try again, or email hello@fearlessrhino.com directly.');
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitDefaultText;
          }
        });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        form.reset();
        form.hidden = false;
        if (success) success.hidden = true;
      });
    }
  });
})();
