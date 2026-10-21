---
layout: page
title: Contribute
subtitle: Help keep the Austin security map current
permalink: /contribute/
---

Everything on this site lives in plain YAML files in our [GitHub repo](https://github.com/austininfosecfounders/www). A pull request is the fastest way to add or fix something. Not a GitHub person? Email hello -a-t- austininfosecfounders.com with the same details.

## Add or update a company

Edit [`_data/companies.yml`](https://github.com/austininfosecfounders/www/edit/master/_data/companies.yml):

```yaml
- name: Example Security
  url: https://example.com
  careers_url: https://example.com/careers   # optional
  category: Cloud        # Identity, Endpoint, Network, Cloud, AppSec, Threat Intel, Data Security, GRC, Services, Offensive, Fraud, Other
  stage: Early           # Public, Late-stage, Growth, Early, Acquired
  hq: true               # true if headquartered in Austin, false for a major Austin office
  description: One short, factual line about what the company does.
  featured: true         # optional; maintainers pick the companies shown on the home page
  acquired_by: Acme (2026)  # optional; for stage: Acquired
```

We list security companies headquartered in Austin or with a real team here (not just a sales rep).

## Post a job

Edit [`_data/jobs.yml`](https://github.com/austininfosecfounders/www/edit/master/_data/jobs.yml):

```yaml
- title: Senior Detection Engineer
  company: Example Security
  url: https://example.com/careers/123
  location: Austin, TX (hybrid)
  type: Full-time
  posted: 2026-10-20
  expires: 2026-12-20     # postings disappear after this date; max 90 days
  description: Optional one-liner.
```

Roles should be security-focused and open to people in Austin (on-site, hybrid, or remote-friendly).

## Add an event, meetup, or investor

- Meetups: [`_data/meetups.yml`](https://github.com/austininfosecfounders/www/edit/master/_data/meetups.yml)
- Conferences: [`_data/conferences.yml`](https://github.com/austininfosecfounders/www/edit/master/_data/conferences.yml)
- Investors: [`_data/investors.yml`](https://github.com/austininfosecfounders/www/edit/master/_data/investors.yml)
