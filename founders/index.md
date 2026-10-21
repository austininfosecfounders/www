---
layout: page
title: Austin Infosec Founders
subtitle: A private group for Austin's security founders
permalink: /founders/
share-title: "Austin Cybersecurity Founders Group"
share-description: "A private community for current, former, and aspiring cybersecurity founders in Austin, Texas: a Signal group and regular meetups."
---

Austin Infosec Founders is open to current founders, former founders, and aspiring founders, based in Austin.

Our gatherings welcome friends to join, but participation in our Signal group requires adherence to the following criteria:

1. Residency in Austin or the surrounding area.
1. Current or past experience as an infosec founder, or plans to become one.

## What we do

- **Meet up regularly** — see the [meetup calendar](https://austininfosecfounders.com/cal) and add it to your calendar.
- **Share notes** — fundraising, hiring, pricing, go-to-market, and the occasional war story, in a trusted Signal group.
- **Pool resources** — members get access to [gated resources](/founders/resources) like vetted local contractors.

## Joining

Want in? [Drop us a note](/contact-us) with a line about what you've built (or are planning to build), and an existing member will follow up.

Not a founder? The rest of this site — [companies](/companies), [jobs](/jobs), [events](/events), and [investors](/investors) — is for the whole Austin security community.

## Founder news

{% assign founder_posts = site.posts | where_exp: "post", "post.hidden != true" %}
{% for post in founder_posts %}
- [{{ post.title }}]({{ post.url | relative_url }}) <span class="ai-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
{% endfor %}

See also: [Founder Resources](/founders/resources).
