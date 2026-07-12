(function () {
  var nav = document.getElementById('site-nav');
  var toggle = document.getElementById('nav-toggle');
  if (!nav || !toggle) return;

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('nav-locked', open); // stop background scroll behind the open menu
  }

  toggle.addEventListener('click', function () {
    setOpen(!nav.classList.contains('is-open'));
  });

  // Close the mobile menu if the viewport grows back past the breakpoint.
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 1080 && nav.classList.contains('is-open')) {
      setOpen(false);
    }
  });

  // Close the menu after tapping a link.
  nav.querySelectorAll('.site-nav__mobile a').forEach(function (link) {
    link.addEventListener('click', function () {
      setOpen(false);
    });
  });
})();
