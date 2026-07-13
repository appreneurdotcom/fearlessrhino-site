/* ============================================================
   FEARLESS RHINO — APPLICATIONS & BLOG CONTENT
   ------------------------------------------------------------
   This is the content source for the Applications and Blog
   sections (everything except the Domain Names inventory, which
   is managed separately through /admin).

   HOW TO ADD AN APP:
     Copy one { ... } block inside `apps`, give it a unique `id`,
     fill in the fields, and it appears on /apps instantly.
     The "Read more" link points to /apps/<your id>.

   HOW TO ADD A BLOG POST:
     Same idea inside `posts`. Link is /blog/<your id>.

   Fields:
     status   : "Live" | "Beta" | "Coming soon"
     initials : 1–2 letters shown in the app tile
     body     : array of blocks — { h: "Heading" } or { p: "Paragraph text" }
     features : array of short strings
     platforms: array of { label, url } download buttons
   ============================================================ */

module.exports = {
  apps: [
    {
      id: 'rhino-rank',
      name: 'RhinoRank',
      initials: 'RR',
      tagline: 'Track your brand across every answer engine.',
      category: 'AI Visibility',
      status: 'Live',
      blurb: 'Monitor how often ChatGPT, Perplexity, Gemini, and Google AI Overviews mention, cite, and recommend your brand — with prompt-level detail and daily tracking.',
      body: [
        { p: "RhinoRank watches the AI answer layer the way rank trackers used to watch Google. Feed it the prompts your buyers actually ask, and it reports where you show up, which URLs get cited, and how you stack up against competitors — across seven engines in parallel." },
        { h: 'Why it matters' },
        { p: "In AI search there is no page two. Either your brand is part of the answer or it isn't. RhinoRank turns that invisible battleground into a dashboard you can act on, so you always know your share of voice and where the citation gaps are." },
        { h: 'What you get' },
        { p: 'Daily monitoring, prompt-level breakdowns, competitor benchmarking, sentiment on every mention, and alerts the moment your visibility moves.' },
      ],
      features: ['7 answer engines tracked in parallel', 'Prompt-level citation reporting', 'Competitor share-of-voice', 'Daily change alerts'],
      platforms: [
        { label: 'Web App', url: '#' },
        { label: 'iOS', url: '#' },
        { label: 'Android', url: '#' },
      ],
    },
    {
      id: 'citation-forge',
      name: 'CitationForge',
      initials: 'CF',
      tagline: 'Turn your content into citable, answer-ready sources.',
      category: 'GEO Tooling',
      status: 'Beta',
      blurb: 'Paste a page and CitationForge scores it for machine-readability, then rewrites structure, schema, and entity signals so answer engines can extract and cite it.',
      body: [
        { p: 'Answer engines cite what they can parse. CitationForge grades any page on the signals that make content citable — clear structure, schema coverage, entity clarity — then hands you the exact fixes.' },
        { h: 'From invisible to cited' },
        { p: 'Upload a URL, get a retrievability score, and apply one-click improvements: FAQ blocks, comparison tables, structured data, and entity markup engineered for extraction.' },
      ],
      features: ['Retrievability scoring', 'Auto schema + entity markup', 'Answer-block generator', 'Before/after citation preview'],
      platforms: [{ label: 'Web App', url: '#' }],
    },
    {
      id: 'herd-signals',
      name: 'Herd Signals',
      initials: 'HS',
      tagline: 'Find the third-party sources AI actually trusts.',
      category: 'Authority',
      status: 'Coming soon',
      blurb: "Discover the Reddit threads, publications, and community pages answer engines pull from in your category — and get a prioritized outreach plan to earn placements there.",
      body: [
        { p: "A 2026 study of 30 million sources confirmed Reddit, YouTube, and LinkedIn are the 'big three' of AI citations. Herd Signals maps the exact sources cited for your category's buyer prompts and ranks where a mention would move your visibility most." },
        { h: 'Built-in outreach' },
        { p: "Every opportunity comes with a domain rating, topical-fit score, and a ready-to-send angle — so your authority-building goes where the engines are already looking." },
      ],
      features: ['Source-of-citation mapping', 'Prioritized outreach targets', 'Domain + topical-fit scoring', 'Placement impact tracking'],
      platforms: [{ label: 'Join the waitlist', url: '/contact' }],
    },
  ],

  posts: [
    {
      id: 'in-the-answer',
      title: 'There is no page two in AI search',
      lead: "In AI search, buyers ask one question and act on one synthesized answer, so there is no second page of results to rank on. Either your brand is part of the answer or it is invisible. This piece explains what that shift changes about being found, and how to earn a place in the answer.",
      excerpt: "Buyers stopped scrolling ten blue links. They ask one question and act on one synthesized answer. Here's what that changes about being found.",
      date: 'June 2026',
      category: 'GEO',
      readTime: '5 min read',
      body: [
        { p: "Search behavior changed — not gradually, and not slightly. A growing share of searches now return an AI-generated answer instead of a list of links, and that share is only moving one way." },
        { h: 'The old game is over' },
        { p: "In classic SEO you competed for ranked positions on a results page. In AI search you compete to be cited, mentioned, or recommended inside a generated answer. There's no page two. There's no ad slot next to the result. Either your brand is part of the answer, or it isn't." },
        { h: 'New metrics that matter' },
        { p: 'Keyword rankings and click-through rates give way to brand mention rate, citation frequency, and share of voice — how your presence compares to competitors across the same set of prompts.' },
        { p: "The brands winning this shift aren't treating AI search as a feature of Google. They're treating it as a channel in its own right — and building the citable, authoritative content ecosystem that answer engines reward." },
      ],
    },
    {
      id: 'geo-vs-aeo-vs-seo',
      title: 'GEO vs AEO vs SEO: what actually differs',
      lead: "SEO ranks you in a list of links. AEO structures your content so engines can extract and cite it. GEO shapes how AI models describe and recommend you across prompts. All three share one goal, being the answer, but they work at different layers. This piece breaks down where they overlap and where they diverge.",
      excerpt: 'Three acronyms, one goal — being the answer. A plain-language breakdown of where they overlap and where they diverge.',
      date: 'May 2026',
      category: 'Strategy',
      readTime: '6 min read',
      body: [
        { p: 'The good news: the fundamentals agencies have sold for years — clean architecture, strong content, technical health, real authority — still matter for AI visibility. The bad news: how you apply them, and how you measure them, is different.' },
        { h: 'SEO' },
        { p: 'Getting pages to rank in ranked search results, where users see a list and choose what to click.' },
        { h: 'AEO' },
        { p: 'Answer Engine Optimization: structuring pages, schema, and entity signals so an engine can extract and cite you inside a single answer.' },
        { h: 'GEO' },
        { p: 'Generative Engine Optimization goes further — influencing how models talk about your brand across a wide range of prompts and contexts, not just capturing one answer slot.' },
        { p: 'All three overlap more than they conflict. The brands doing this well manage them in parallel rather than treating any one as sufficient on its own.' },
      ],
    },
    {
      id: 'measure-ai-visibility',
      title: 'How to actually measure AI visibility',
      lead: "You measure AI visibility by tracking three things across the answer engines your buyers use: how often you are mentioned, how often you are cited as a source, and how you compare to competitors. This piece covers the three numbers that tell you whether AI engines are on your side, and how to move them.",
      excerpt: "If you can't see it, you can't grow it. The three numbers that tell you whether AI engines are on your side.",
      date: 'April 2026',
      category: 'Measurement',
      readTime: '4 min read',
      body: [
        { p: "Traditional analytics often misses AI's influence because answer engines frequently act as zero-click sources. That doesn't mean the impact isn't real — it means you need the right instruments." },
        { h: 'Brand mention rate' },
        { p: 'How often your brand appears in responses to the prompts your buyers actually use.' },
        { h: 'Citation frequency' },
        { p: 'Which of your URLs models pull from when they generate answers.' },
        { h: 'Share of voice' },
        { p: 'How your presence compares to competitors across the same prompt set. Track it model by model — the answer differs by engine, and so should your strategy.' },
      ],
    },
  ],
};
