# frozen_string_literal: true

require "date"

# Turns _data/conferences.yml editions into calendar data:
#   site.data["conference_events"]  flattened, sorted editions for the events page
#   /events/conferences.ics         subscribable feed of every edition
#   /events/ics/<id>.ics            one-event file behind each "Add to calendar" link
module AustinInfosec
  module ConferenceCalendar
    TZID = "America/Chicago"
    HOST = "austininfosecfounders.com"

    VTIMEZONE = <<~ICS.split("\n")
      BEGIN:VTIMEZONE
      TZID:America/Chicago
      BEGIN:DAYLIGHT
      TZOFFSETFROM:-0600
      TZOFFSETTO:-0500
      TZNAME:CDT
      DTSTART:19700308T020000
      RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
      END:DAYLIGHT
      BEGIN:STANDARD
      TZOFFSETFROM:-0500
      TZOFFSETTO:-0600
      TZNAME:CST
      DTSTART:19701101T020000
      RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
      END:STANDARD
      END:VTIMEZONE
    ICS

    module_function

    def slug(text)
      text.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-\z/, "")
    end

    def events(conferences)
      conferences.flat_map do |conf|
        Array(conf["editions"]).map do |ed|
          start = Date.parse(ed["start"].to_s)
          finish = ed["end"] ? Date.parse(ed["end"].to_s) : start
          id = "#{slug(conf['name'])}-#{start.year}"
          {
            "id" => id,
            "name" => conf["name"],
            "description" => conf["description"],
            "url" => ed["url"] || conf["url"],
            "start" => start.iso8601,
            "end" => finish.iso8601,
            "start_time" => ed["start_time"],
            "end_time" => ed["end_time"],
            "venue" => ed["venue"],
            "address" => ed["address"],
            "note" => ed["note"],
            "ics" => "/events/ics/#{id}.ics",
          }
        end
      end.sort_by { |e| [e["start"], e["name"]] }
    end

    # Single-day editions with published hours are timed; everything else is all-day.
    def timed?(event)
      event["start_time"] && event["end_time"] && event["start"] == event["end"]
    end

    def calendar(events, name: nil)
      lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Austin Infosec//Conferences//EN",
               "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
      lines += ["X-WR-CALNAME:#{escape(name)}", "X-WR-TIMEZONE:#{TZID}"] if name
      lines += VTIMEZONE
      stamp = Time.now.utc.strftime("%Y%m%dT%H%M%SZ")
      events.each { |e| lines += vevent(e, stamp) }
      lines << "END:VCALENDAR"
      lines.map { |l| fold(l) }.join("\r\n") + "\r\n"
    end

    def vevent(event, stamp)
      start = Date.parse(event["start"])
      finish = Date.parse(event["end"])
      when_lines =
        if timed?(event)
          from, to = hhmm(event["start_time"]), hhmm(event["end_time"])
          finish += 1 if to <= from # e.g. 18:00 until midnight
          ["DTSTART;TZID=#{TZID}:#{start.strftime('%Y%m%d')}T#{from}00",
           "DTEND;TZID=#{TZID}:#{finish.strftime('%Y%m%d')}T#{to}00"]
        else
          # DTEND is exclusive for all-day events.
          ["DTSTART;VALUE=DATE:#{start.strftime('%Y%m%d')}",
           "DTEND;VALUE=DATE:#{(finish + 1).strftime('%Y%m%d')}"]
        end
      location = [event["venue"], event["address"]].compact.join(", ")
      details = [event["description"], event["note"], event["url"]].compact.join("\n\n")
      lines = ["BEGIN:VEVENT", "UID:#{event['id']}@#{HOST}", "DTSTAMP:#{stamp}", *when_lines,
               "SUMMARY:#{escape(event['name'])}", "DESCRIPTION:#{escape(details)}"]
      lines << "LOCATION:#{escape(location)}" unless location.empty?
      lines << "URL:#{event['url']}" if event["url"]
      lines + ["TRANSP:TRANSPARENT", "END:VEVENT"]
    end

    def hhmm(time)
      h, m = time.to_s.split(":")
      format("%02d%02d", h.to_i, m.to_i)
    end

    def escape(text)
      text.to_s.gsub("\\", "\\\\\\\\").gsub(";", "\\;").gsub(",", "\\,").gsub(/\r?\n/, "\\n")
    end

    # RFC 5545: lines longer than 75 octets continue on the next line after a space.
    def fold(line)
      out = +""
      len = 0
      line.each_char do |ch|
        size = ch.bytesize
        if len + size > 75
          out << "\r\n "
          len = 1
        end
        out << ch
        len += size
      end
      out
    end
  end

  class IcsPage < Jekyll::PageWithoutAFile
    def initialize(site, dir, name, body)
      super(site, site.source, dir, name)
      self.content = body
      self.data = { "layout" => nil, "sitemap" => false }
    end

    def render_with_liquid?
      false
    end
  end

  class ConferenceCalendarGenerator < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      events = ConferenceCalendar.events(site.data["conferences"] || [])
      site.data["conference_events"] = events
      feed = ConferenceCalendar.calendar(events, name: "Austin Security Conferences")
      site.pages << IcsPage.new(site, "events", "conferences.ics", feed)
      events.each do |e|
        site.pages << IcsPage.new(site, "events/ics", "#{e['id']}.ics", ConferenceCalendar.calendar([e]))
      end
    end
  end
end
