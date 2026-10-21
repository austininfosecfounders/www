// Conference calendar for /events/: month grid + list view, event details
// dialog and add-to-calendar links. Data comes from _plugins/conference_calendar.rb.
(function () {
  var root = document.getElementById("conf-calendar");
  if (!root) return;

  var TZ = "America/Chicago";
  var DAY = 864e5;
  var MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var events = JSON.parse(
    document.getElementById("conference-events").textContent,
  );
  var conferences = JSON.parse(
    document.getElementById("conference-list").textContent,
  );
  var dialog = document.querySelector(".cal-dialog");
  var baseUrl = root.getAttribute("data-site-url").replace(/\/$/, "");

  // ---- Dates as whole-day numbers (days since epoch) so time zones never shift them ----
  function dayNum(iso) {
    var p = iso.split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / DAY;
  }
  function fromDay(n) {
    return new Date(n * DAY);
  }
  function isoDay(n) {
    return fromDay(n).toISOString().slice(0, 10);
  }
  function fmt(n, opts) {
    opts.timeZone = "UTC";
    return fromDay(n).toLocaleDateString("en-US", opts);
  }
  // Today in Austin, regardless of the viewer's time zone.
  var today = dayNum(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()),
  );

  events.forEach(function (e) {
    e.s = dayNum(e.start);
    e.e = dayNum(e.end);
  });
  var byId = {};
  events.forEach(function (e) {
    byId[e.id] = e;
  });

  // ---- Formatting ----
  function time12(t) {
    var p = t.split(":"),
      h = +p[0],
      m = p[1];
    if (h === 0 && m === "00") return "midnight";
    return (
      (h % 12 || 12) +
      (m === "00" ? "" : ":" + m) +
      " " +
      (h < 12 ? "AM" : "PM")
    );
  }
  function dateRange(e, long) {
    var month = long ? "long" : "short";
    var weekday = long ? { weekday: "long" } : {};
    function o(extra) {
      return Object.assign({}, weekday, extra);
    }
    if (e.s === e.e)
      return fmt(e.s, o({ month: month, day: "numeric", year: "numeric" }));
    var sameMonth = isoDay(e.s).slice(0, 7) === isoDay(e.e).slice(0, 7);
    if (sameMonth && !long) {
      return (
        fmt(e.s, { month: month, day: "numeric" }) +
        "–" +
        fmt(e.e, { day: "numeric", year: "numeric" })
      );
    }
    return (
      fmt(e.s, o({ month: month, day: "numeric" })) +
      " – " +
      fmt(e.e, o({ month: month, day: "numeric", year: "numeric" }))
    );
  }
  function hours(e) {
    if (!e.start_time) return "";
    var span =
      time12(e.start_time) + (e.end_time ? " – " + time12(e.end_time) : "");
    return e.s === e.e ? span : span + " daily";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function status(e) {
    if (e.e < today) return "past";
    if (e.s <= today) return "now";
    return "upcoming";
  }

  // ---- Add-to-calendar links ----
  function compact(n) {
    return isoDay(n).replace(/-/g, "");
  }
  function timed(e) {
    return e.start_time && e.end_time && e.s === e.e;
  }
  function timedEnd(e) {
    // An end time at or before the start (e.g. "00:00") means the next day.
    return e.end_time.replace(":", "") <= e.start_time.replace(":", "")
      ? e.e + 1
      : e.e;
  }
  function place(e) {
    return [e.venue, e.address].filter(Boolean).join(", ");
  }
  function details(e) {
    return [e.description, e.note, e.url].filter(Boolean).join("\n\n");
  }

  function googleUrl(e) {
    var dates = timed(e)
      ? compact(e.s) +
        "T" +
        e.start_time.replace(":", "") +
        "00/" +
        compact(timedEnd(e)) +
        "T" +
        e.end_time.replace(":", "") +
        "00"
      : compact(e.s) + "/" + compact(e.e + 1);
    var q = new URLSearchParams({
      action: "TEMPLATE",
      text: e.name,
      dates: dates,
      details: details(e),
      location: place(e),
      ctz: TZ,
    });
    return "https://calendar.google.com/calendar/render?" + q.toString();
  }
  function outlookUrl(e) {
    var q = {
      rru: "addevent",
      subject: e.name,
      body: details(e),
      location: place(e),
    };
    if (timed(e)) {
      // Outlook wants an absolute instant; pass Austin local time with its UTC offset.
      q.startdt = isoDay(e.s) + "T" + e.start_time + ":00" + offset(e.s);
      q.enddt =
        isoDay(timedEnd(e)) + "T" + e.end_time + ":00" + offset(timedEnd(e));
    } else {
      q.allday = "true";
      q.startdt = isoDay(e.s);
      q.enddt = isoDay(e.e + 1);
    }
    return (
      "https://outlook.live.com/calendar/0/action/compose?" +
      new URLSearchParams(q).toString()
    );
  }
  function offset(n) {
    // Noon that day in Austin → "-05:00" (CDT) or "-06:00" (CST).
    var name = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date(n * DAY + 18 * 36e5))
      .filter(function (p) {
        return p.type === "timeZoneName";
      })[0].value; // "GMT-5"
    var h = parseInt(name.replace("GMT", ""), 10) || 0;
    return (h < 0 ? "-" : "+") + ("0" + Math.abs(h)).slice(-2) + ":00";
  }

  function addMenu(e) {
    return (
      '<details class="cal-menu cal-add">' +
      '<summary class="cal-btn">Add to calendar</summary>' +
      '<div class="cal-menu-list">' +
      '<a href="' +
      esc(googleUrl(e)) +
      '" target="_blank" rel="noopener">Google Calendar</a>' +
      '<a href="' +
      esc(baseUrl + e.ics) +
      '" download>Apple Calendar (.ics)</a>' +
      '<a href="' +
      esc(outlookUrl(e)) +
      '" target="_blank" rel="noopener">Outlook.com</a>' +
      '<a href="' +
      esc(baseUrl + e.ics) +
      '" download>Outlook desktop (.ics)</a>' +
      "</div></details>"
    );
  }

  // ---- State ----
  var t = fromDay(today);
  var view = { year: t.getUTCFullYear(), month: t.getUTCMonth() };
  var mode = "month";
  try {
    mode = localStorage.getItem("ai-cal-view") || null;
  } catch (err) {
    mode = null;
  }
  if (!mode)
    mode = window.matchMedia("(max-width: 640px)").matches ? "list" : "month";

  var title = root.querySelector(".cal-title");
  var strip = root.querySelector(".cal-strip");
  var grid = root.querySelector(".cal-month");
  var list = root.querySelector(".cal-list");
  var tba = root.querySelector(".cal-tba");

  // ---- Month strip: twelve chips with a dot for months that have events ----
  function renderStrip() {
    strip.innerHTML = "";
    for (var m = 0; m < 12; m++) {
      var first = Date.UTC(view.year, m, 1) / DAY,
        last = Date.UTC(view.year, m + 1, 0) / DAY;
      var count = events.filter(function (e) {
        return e.s <= last && e.e >= first;
      }).length;
      var b = el(
        "button",
        "cal-chip",
        MONTHS[m].slice(0, 3) +
          (count ? '<span class="cal-dot" aria-hidden="true"></span>' : ""),
      );
      b.type = "button";
      b.setAttribute("data-month", m);
      b.setAttribute("aria-pressed", m === view.month ? "true" : "false");
      b.setAttribute(
        "aria-label",
        MONTHS[m] +
          " " +
          view.year +
          (count ? ", " + count + (count === 1 ? " event" : " events") : ""),
      );
      strip.appendChild(b);
    }
  }

  // ---- Month grid: weeks as CSS grids; multi-day events span columns ----
  function renderMonth() {
    grid.innerHTML = "";
    var first = Date.UTC(view.year, view.month, 1) / DAY;
    var last = Date.UTC(view.year, view.month + 1, 0) / DAY;
    var start = first - fromDay(first).getUTCDay();
    var end = last + (6 - fromDay(last).getUTCDay());

    var head = el("div", "cal-weekdays");
    head.setAttribute("role", "row");
    WEEKDAYS.forEach(function (d) {
      var c = el("div", "cal-weekday", d);
      c.setAttribute("role", "columnheader");
      head.appendChild(c);
    });
    grid.appendChild(head);

    for (var ws = start; ws <= end; ws += 7) {
      var we = ws + 6;
      var segs = events
        .filter(function (e) {
          return e.s <= we && e.e >= ws;
        })
        .map(function (e) {
          return { e: e, a: Math.max(e.s, ws), b: Math.min(e.e, we) };
        })
        .sort(function (x, y) {
          return x.a - y.a || y.b - y.a - (x.b - x.a);
        });
      var lanes = [];
      segs.forEach(function (s) {
        var i = 0;
        while (lanes[i] != null && lanes[i] >= s.a) i++;
        lanes[i] = s.b;
        s.lane = i;
      });

      var week = el("div", "cal-week");
      week.setAttribute("role", "row");
      week.style.gridTemplateRows =
        "2rem repeat(" + lanes.length + ", 1.75rem) minmax(1rem, 1fr)";

      for (var d = ws; d <= we; d++) {
        var cell = el("div", "cal-day");
        cell.setAttribute("role", "gridcell");
        cell.style.gridColumn = String(d - ws + 1);
        cell.style.gridRow = "1 / span " + (lanes.length + 2);
        if (d < first || d > last) cell.classList.add("is-outside");
        if (d === today) cell.classList.add("is-today");
        var on = events.filter(function (e) {
          return e.s <= d && e.e >= d;
        });
        var label = fmt(d, { weekday: "long", month: "long", day: "numeric" });
        var num = fromDay(d).getUTCDate();
        if (on.length) {
          var btn = el("button", "cal-num", String(num));
          btn.type = "button";
          btn.setAttribute("data-day", d);
          btn.setAttribute(
            "aria-label",
            label +
              ": " +
              on
                .map(function (e) {
                  return e.name;
                })
                .join(", "),
          );
          cell.appendChild(btn);
          cell.classList.add("has-events");
        } else {
          var span = el("span", "cal-num", String(num));
          span.setAttribute("aria-label", label);
          cell.appendChild(span);
        }
        week.appendChild(cell);
      }

      segs.forEach(function (s) {
        var e = s.e;
        var bar = el("button", "cal-ev is-" + status(e), esc(e.name));
        bar.type = "button";
        bar.setAttribute("data-id", e.id);
        bar.setAttribute("aria-label", e.name + ", " + dateRange(e, true));
        bar.style.gridColumn = s.a - ws + 1 + " / span " + (s.b - s.a + 1);
        bar.style.gridRow = String(s.lane + 2);
        if (e.s < ws) bar.classList.add("cont-left");
        if (e.e > we) bar.classList.add("cont-right");
        week.appendChild(bar);
      });
      grid.appendChild(week);
    }

    var inMonth = events.filter(function (e) {
      return e.s <= last && e.e >= first;
    });
    if (!inMonth.length) {
      var next = events.filter(function (e) {
        return e.s > last;
      })[0];
      var prev = events
        .filter(function (e) {
          return e.e < first;
        })
        .slice(-1)[0];
      var target = next || prev;
      var msg = el(
        "p",
        "cal-empty",
        "No conferences in " + MONTHS[view.month] + ". ",
      );
      if (target) {
        var jump = el(
          "button",
          "cal-link",
          (next ? "Next up: " : "Most recent: ") +
            esc(target.name) +
            ", " +
            fmt(target.s, { month: "short", day: "numeric", year: "numeric" }) +
            " &rarr;",
        );
        jump.type = "button";
        jump.setAttribute("data-jump", target.id);
        msg.appendChild(jump);
      }
      grid.appendChild(msg);
    }
  }

  // ---- List view: upcoming agenda, past editions folded away ----
  function item(e) {
    var st = status(e);
    var mon = fmt(e.s, { month: "short" });
    var range =
      e.s === e.e
        ? ""
        : "–" +
          (isoDay(e.s).slice(0, 7) === isoDay(e.e).slice(0, 7)
            ? fmt(e.e, { day: "numeric" })
            : fmt(e.e, { month: "short", day: "numeric" }));
    var meta = [
      fmt(e.s, { weekday: "short" }) +
        (e.s === e.e ? "" : "–" + fmt(e.e, { weekday: "short" })),
      hours(e),
      e.venue,
    ]
      .filter(Boolean)
      .map(esc)
      .join(" · ");
    return (
      '<li class="cal-item is-' +
      st +
      '">' +
      '<button type="button" class="cal-date" data-id="' +
      e.id +
      '" aria-label="' +
      esc(e.name + ", " + dateRange(e, true)) +
      '">' +
      '<span class="cal-date-mon">' +
      mon +
      "</span>" +
      '<span class="cal-date-day">' +
      fromDay(e.s).getUTCDate() +
      "<small>" +
      range +
      "</small></span>" +
      '<span class="cal-date-yr">' +
      fromDay(e.s).getUTCFullYear() +
      "</span></button>" +
      '<div class="cal-item-body">' +
      (st === "now"
        ? '<span class="ai-tag cal-live">Happening now</span>'
        : "") +
      '<h4><button type="button" class="cal-name" data-id="' +
      e.id +
      '">' +
      esc(e.name) +
      "</button></h4>" +
      '<div class="ai-meta">' +
      meta +
      "</div>" +
      "<p>" +
      esc(e.description) +
      "</p></div>" +
      (st === "past"
        ? ""
        : '<div class="cal-item-actions">' + addMenu(e) + "</div>") +
      "</li>"
    );
  }

  function renderList() {
    var upcoming = events.filter(function (e) {
      return e.e >= today;
    });
    var past = events
      .filter(function (e) {
        return e.e < today;
      })
      .reverse();
    var html = upcoming.length
      ? '<ol class="cal-items">' + upcoming.map(item).join("") + "</ol>"
      : '<p class="cal-empty">No upcoming conferences on the calendar yet.</p>';
    if (past.length) {
      html +=
        '<details class="cal-past"><summary>Past conferences (' +
        past.length +
        ")</summary>" +
        '<ol class="cal-items">' +
        past.map(item).join("") +
        "</ol></details>";
    }
    list.innerHTML = html;
  }

  // Conferences with nothing upcoming: show when they usually happen.
  function renderTba() {
    var rows = conferences.filter(function (c) {
      return !events.some(function (e) {
        return e.name === c.name && e.e >= today;
      });
    });
    if (!rows.length) {
      tba.innerHTML = "";
      return;
    }
    tba.innerHTML =
      '<h3 class="cal-tba-title">Next dates not yet announced</h3><ul class="ai-list">' +
      rows
        .map(function (c) {
          return (
            '<li><a href="' +
            esc(c.url) +
            '" rel="noopener">' +
            esc(c.name) +
            "</a>" +
            '<div class="ai-meta">' +
            (c.typical_month ? "Usually " + esc(c.typical_month) : "") +
            "</div></li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function render() {
    title.textContent =
      mode === "month"
        ? MONTHS[view.month] + " " + view.year
        : "All conferences";
    root.querySelectorAll("[data-nav]").forEach(function (b) {
      b.hidden = mode !== "month";
    });
    strip.hidden = grid.hidden = mode !== "month";
    list.hidden = mode !== "list";
    root.querySelectorAll("[data-view]").forEach(function (b) {
      b.setAttribute(
        "aria-pressed",
        b.getAttribute("data-view") === mode ? "true" : "false",
      );
    });
    if (mode === "month") {
      renderStrip();
      renderMonth();
    } else {
      renderList();
    }
    renderTba();
  }

  function showMonthOf(n) {
    var d = fromDay(n);
    view.year = d.getUTCFullYear();
    view.month = d.getUTCMonth();
  }

  // ---- Details dialog ----
  var lastFocus = null;
  function openDetails(ids) {
    var evs = ids
      .map(function (id) {
        return byId[id];
      })
      .filter(Boolean);
    if (!evs.length) return;
    var body = dialog.querySelector(".cal-dialog-body");
    body.innerHTML =
      '<button type="button" class="cal-close" aria-label="Close">&times;</button>' +
      evs
        .map(function (e, i) {
          var st = status(e);
          var where = place(e);
          var map = where
            ? "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(where)
            : "";
          return (
            '<article class="cal-detail">' +
            '<p class="ai-eyebrow">Conference · ' +
            fromDay(e.s).getUTCFullYear() +
            (st === "now"
              ? " · happening now"
              : st === "past"
                ? " · past"
                : "") +
            "</p>" +
            "<h3" +
            (i === 0 ? ' id="cal-dialog-title"' : "") +
            ">" +
            esc(e.name) +
            "</h3>" +
            '<dl class="cal-facts">' +
            "<dt>When</dt><dd>" +
            esc(dateRange(e, true)) +
            (hours(e) ? "<br><span>" + esc(hours(e)) + " CT</span>" : "") +
            "</dd>" +
            (where
              ? "<dt>Where</dt><dd>" +
                (e.venue ? esc(e.venue) + "<br>" : "") +
                (e.address ? "<span>" + esc(e.address) + "</span><br>" : "") +
                '<a href="' +
                esc(map) +
                '" target="_blank" rel="noopener">Open in Maps</a></dd>'
              : "") +
            "</dl>" +
            "<p>" +
            esc(e.description) +
            "</p>" +
            (e.note ? '<p class="cal-note">' + esc(e.note) + "</p>" : "") +
            '<div class="cal-detail-actions">' +
            '<a class="ai-btn ai-btn-primary" href="' +
            esc(e.url) +
            '" target="_blank" rel="noopener">' +
            "Event website" +
            " &nearr;</a>" +
            (st === "past" ? "" : addMenu(e)) +
            "</div></article>"
          );
        })
        .join("");
    lastFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    try {
      history.replaceState(null, "", "#" + evs[0].id);
    } catch (err) {
      /* file:// etc. */
    }
  }
  function closeDetails() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener("close", function () {
    try {
      history.replaceState(null, "", "#conferences");
    } catch (err) {
      /* ignore */
    }
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  });
  dialog.addEventListener("click", function (ev) {
    if (ev.target === dialog || ev.target.closest(".cal-close")) closeDetails(); // backdrop or ×
  });

  // ---- Events ----
  root.addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b || !root.contains(b)) return;
    if (b.hasAttribute("data-nav")) {
      var n = b.getAttribute("data-nav");
      if (n === "today") showMonthOf(today);
      else {
        var m = view.month + +n;
        view.year += Math.floor(m / 12);
        view.month = (m + 12) % 12;
      }
      render();
    } else if (b.hasAttribute("data-view")) {
      mode = b.getAttribute("data-view");
      try {
        localStorage.setItem("ai-cal-view", mode);
      } catch (err) {
        /* ignore */
      }
      render();
    } else if (b.hasAttribute("data-month")) {
      view.month = +b.getAttribute("data-month");
      render();
    } else if (b.hasAttribute("data-jump")) {
      showMonthOf(byId[b.getAttribute("data-jump")].s);
      render();
    } else if (b.hasAttribute("data-day")) {
      var d = +b.getAttribute("data-day");
      openDetails(
        events
          .filter(function (e) {
            return e.s <= d && e.e >= d;
          })
          .map(function (e) {
            return e.id;
          }),
      );
    } else if (b.hasAttribute("data-id")) {
      openDetails([b.getAttribute("data-id")]);
    }
  });

  // Only one add/subscribe menu open at a time; close on outside click or Escape.
  document.addEventListener("click", function (ev) {
    document.querySelectorAll(".cal-menu[open]").forEach(function (m) {
      if (!m.contains(ev.target)) m.removeAttribute("open");
    });
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    var open = document.querySelectorAll(".cal-menu[open]");
    if (open.length) {
      ev.preventDefault();
      open.forEach(function (m) {
        m.removeAttribute("open");
        m.querySelector("summary").focus();
      });
    }
  });

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!byId[id]) return;
    showMonthOf(byId[id].s);
    render();
    openDetails([id]);
  }
  window.addEventListener("hashchange", openFromHash);

  root.hidden = false;
  render();
  openFromHash();
})();
