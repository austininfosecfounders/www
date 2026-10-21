// Text + select filtering for directory tables/lists.
// Markup: <div class="ai-filter" data-target="#id"> with input[type=search] and optional select[data-field].
// Rows: elements matching [data-row] inside the target, with data-<field> attributes and searchable text.
(function () {
  // Hide job postings past their expiry date (build may be older than today).
  var today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('[data-expires]').forEach(function (el) {
    if (el.getAttribute('data-expires') < today) el.remove();
  });

  document.querySelectorAll('.ai-filter').forEach(function (bar) {
    var target = document.querySelector(bar.getAttribute('data-target'));
    if (!target) return;
    var rows = Array.prototype.slice.call(target.querySelectorAll('[data-row]'));
    var search = bar.querySelector('input[type=search]');
    var selects = Array.prototype.slice.call(bar.querySelectorAll('select[data-field]'));
    var count = document.querySelector(bar.getAttribute('data-count'));

    function apply() {
      var q = (search ? search.value : '').trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (row) {
        var ok = !q || row.textContent.toLowerCase().indexOf(q) !== -1;
        selects.forEach(function (s) {
          if (ok && s.value && row.getAttribute('data-' + s.getAttribute('data-field')) !== s.value) ok = false;
        });
        row.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      if (count) count.textContent = shown + ' of ' + rows.length + ' shown';
    }

    var params = new URLSearchParams(window.location.search);
    selects.forEach(function (s) {
      var v = params.get(s.getAttribute('data-field'));
      if (v !== null) s.value = v;
    });
    if (search && params.get('q')) search.value = params.get('q');

    if (search) search.addEventListener('input', apply);
    selects.forEach(function (s) { s.addEventListener('change', apply); });
    apply();
  });

})();
