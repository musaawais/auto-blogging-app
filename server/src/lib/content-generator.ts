/**
 * Content Generator v2
 * Produces keyword-specific, human-sounding SEO articles.
 * No generic AI filler. No em-dashes. No meta-instructions.
 * Proper H1, natural language, topic-specific content.
 */

// ── Utilities ──────────────────────────────────────────────────────────────────

const MINOR_WORDS = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as','is','it','its','vs']);
// Acronyms that should always be uppercase
const ACRONYMS = new Set(['crm','seo','ai','api','uae','usa','uk','llc','b2b','b2c','roi','kpi','ict','erp','hr','it','ml','ar','vr','ui','ux','gdpr','vat','ctr','cpc']);

export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (ACRONYMS.has(w)) return w.toUpperCase();
      return (i === 0 || !MINOR_WORDS.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    })
    .join(' ');
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Lowercase a string but preserve known acronyms like CRM, SEO, AI, UAE etc. */
function smartLower(str: string): string {
  return str.split(' ').map(w => {
    const wUp = w.replace(/[^a-zA-Z]/g, '').toUpperCase();
    return ACRONYMS.has(wUp.toLowerCase()) ? wUp : w.toLowerCase();
  }).join(' ');
}

// ── Keyword Intelligence ───────────────────────────────────────────────────────

export interface KeywordAnalysis {
  raw: string;
  coreSubject: string;      // stripped of intent words
  seoTitle: string;         // full H1-ready SEO title
  intent: 'howto' | 'comparison' | 'tips' | 'review' | 'informational';
  category: 'business' | 'legal' | 'finance' | 'health' | 'tech' | 'travel' | 'real_estate' | 'education' | 'general';
  location: string | null;
  year: number;
}

export function analyzeKeyword(keyword: string): KeywordAnalysis {
  const kw = keyword.trim();
  const kwLow = kw.toLowerCase();
  const year = new Date().getFullYear();

  // Intent detection
  let intent: KeywordAnalysis['intent'] = 'informational';
  if (/^how (to|do|does|can|should)\b|^steps to\b|^guide to\b|register|setup|start|create|build|open|launch|apply/.test(kwLow)) intent = 'howto';
  else if (/^best\b|top \d+|vs\.?\b|versus|compare|comparison|alternatives/.test(kwLow)) intent = 'comparison';
  else if (/\btips?\b|\btricks?\b|\bstrategies\b|\bways to\b|\bhacks?\b/.test(kwLow)) intent = 'tips';
  else if (/\breview\b|\breviews\b|\bworth it\b/.test(kwLow)) intent = 'review';

  // Location detection
  const locationPatterns = ['dubai', 'uae', 'abu dhabi', 'sharjah', 'usa', 'uk', 'london', 'new york', 'california', 'australia', 'canada', 'india', 'singapore', 'germany', 'france'];
  let location: string | null = null;
  for (const loc of locationPatterns) {
    if (kwLow.includes(loc)) { location = loc; break; }
  }

  // Category detection
  let category: KeywordAnalysis['category'] = 'general';
  if (/company|business|register|incorporat|startup|llc|freelance|trade license|entrepreneur|firm|brand/.test(kwLow)) category = 'business';
  else if (/visa|immigration|passport|permit|residency|citizenship|legal|law|lawyer|attorney|court/.test(kwLow)) category = 'legal';
  else if (/invest|stock|crypto|tax|insurance|finance|money|salary|income|budget|mortgage|loan|bank/.test(kwLow)) category = 'finance';
  else if (/health|diet|weight loss|fitness|exercise|medical|doctor|symptom|treatment|nutrition|wellness/.test(kwLow)) category = 'health';
  else if (/software|app|website|coding|programming|tech|ai|seo|digital|cloud|api|data|cybersecurity/.test(kwLow)) category = 'tech';
  else if (/hotel|travel|trip|flight|vacation|tourism|tour|destination|visit|tour/.test(kwLow)) category = 'travel';
  else if (/house|apartment|rent|property|real estate|condo|buy home|listing/.test(kwLow)) category = 'real_estate';
  else if (/course|learn|study|university|school|degree|certification|training|education/.test(kwLow)) category = 'education';

  // Core subject (clean keyword for use within text)
  let coreSubject = kw
    .replace(/^how (to|do|does|can|should)\s+/i, '')
    .replace(/^best\s+/i, '')
    .replace(/^top \d+\s+/i, '')
    .replace(/^guide to\s+/i, '')
    .replace(/^steps to\s+/i, '')
    .trim();

  // SEO title construction
  let seoTitle = '';
  const coreTitled = titleCase(coreSubject);
  if (intent === 'howto') {
    const actionPart = titleCase(kw.replace(/^how (to|do|does|can|should)\s+/i, 'How to '));
    seoTitle = `${actionPart}: Complete Step-by-Step Guide (${year})`;
  } else if (intent === 'comparison') {
    seoTitle = `${titleCase(kw)}: Honest ${year} Comparison`;
  } else if (intent === 'tips') {
    seoTitle = `${coreTitled}: ${year} Tips That Actually Work`;
  } else if (intent === 'review') {
    seoTitle = `${coreTitled} Review (${year}): Is It Worth It?`;
  } else {
    seoTitle = `${coreTitled}: What You Need to Know in ${year}`;
  }

  return { raw: kw, coreSubject, seoTitle, intent, category, location, year };
}

// ── Image Catalog ──────────────────────────────────────────────────────────────

interface ImageItem {
  id: string;
  alt: string;
  caption: string;
}

const IMAGE_CATALOG: Record<string, ImageItem[]> = {
  business: [
    { id: '1486406146926-c627a92ad1ab', alt: 'Modern business district skyscrapers', caption: 'Making the right decisions early defines your trajectory as a business.' },
    { id: '1454165804606-c3d57bc86b40', alt: 'Business professionals reviewing documents', caption: 'Doing your research before you commit saves time, money, and frustration.' },
    { id: '1521737604082-3f17b9a9e421', alt: 'Open office with team working', caption: 'The right tools and processes make a real difference to how teams perform.' },
    { id: '1507003211169-0a1dd7228f2d', alt: 'Entrepreneur working at desk', caption: 'Successful outcomes start with a clear plan and the right information.' },
  ],
  dubai: [
    { id: '1512453979798-5ea266f8880c', alt: 'Dubai city skyline at sunset', caption: 'Dubai is one of the world\'s top destinations for international business.' },
    { id: '1548004547-a63aa98da46e', alt: 'Dubai Marina waterfront promenade', caption: 'Free zones in Dubai offer significant benefits for foreign investors.' },
    { id: '1526183311757-3c4c7f70c90c', alt: 'Burj Khalifa and downtown Dubai', caption: 'Dubai\'s infrastructure makes it an attractive hub for global companies.' },
  ],
  legal: [
    { id: '1450101499163-c8848c66ca85', alt: 'Person signing legal contract', caption: 'Reviewing legal requirements before you apply saves time and money.' },
    { id: '1505664194779-8beaceb78c6d', alt: 'Legal documents and pen', caption: 'Getting the documentation right the first time avoids costly delays.' },
  ],
  finance: [
    { id: '1554224155-6726b3ff858f', alt: 'Financial planning documents and calculator', caption: 'Understanding your full cost picture prevents budget surprises.' },
    { id: '1611974789855-9c2a0a7236a3', alt: 'Investment growth chart on screen', caption: 'Financial planning is a critical part of any business launch.' },
    { id: '1559526324-4b87b5e36e44', alt: 'Business finance review meeting', caption: 'Mapping out your initial costs keeps your budget on track.' },
  ],
  health: [
    { id: '1490818894907-62f17dc46e91', alt: 'Person exercising outdoors in sunlight', caption: 'Consistency is the biggest factor in long-term health improvements.' },
    { id: '1571019613454-1cb2f99b2d8b', alt: 'Healthy meal prep and nutrition', caption: 'What you eat has a direct impact on how you feel day to day.' },
    { id: '1559757148-5c350d0d3c56', alt: 'Wellness and healthy lifestyle', caption: 'Small habit changes compound into significant health outcomes over time.' },
  ],
  tech: [
    { id: '1518770660439-4636190af475', alt: 'Lines of code on a dark screen', caption: 'Getting the technical implementation right from the start matters.' },
    { id: '1461749280684-dccba630e2f6', alt: 'Developer at a dual-monitor workstation', caption: 'The right tools make a real difference in productivity and output quality.' },
    { id: '1488590528505-98d2b5aba04b', alt: 'Modern technology workspace', caption: 'Technology choices today define your capabilities tomorrow.' },
  ],
  travel: [
    { id: '1488646953014-85cb44e25828', alt: 'Luggage at an airport departure gate', caption: 'Planning ahead turns a stressful trip into a smooth experience.' },
    { id: '1506905925346-21bda4d32df4', alt: 'Scenic travel destination landscape', caption: 'The best travel experiences start with good preparation.' },
  ],
  real_estate: [
    { id: '1560518883-ce09059eeffa', alt: 'Modern house exterior with garden', caption: 'Location and timing are everything when it comes to property decisions.' },
    { id: '1448630564060-9361ce80c7e3', alt: 'Real estate keys and contract', caption: 'Having the right information before you buy protects your investment.' },
  ],
  general: [
    { id: '1434030216411-0b793f4b6175', alt: 'Person planning at a desk with notes', caption: 'A clear plan makes any goal more achievable.' },
    { id: '1499750310107-5fef28a66643', alt: 'Open notebook and coffee on desk', caption: 'Taking the time to research thoroughly pays off down the line.' },
    { id: '1484480974693-6ca0a78fb36b', alt: 'Focused work session at laptop', caption: 'Consistent effort and the right approach get results.' },
  ],
};

function getImages(analysis: KeywordAnalysis, count: number): ImageItem[] {
  const pools: ImageItem[] = [];

  // Location-specific first
  if (analysis.location && IMAGE_CATALOG[analysis.location]) {
    pools.push(...IMAGE_CATALOG[analysis.location]);
  }
  // Category images
  if (IMAGE_CATALOG[analysis.category]) {
    pools.push(...IMAGE_CATALOG[analysis.category]);
  }
  // General fallback
  pools.push(...IMAGE_CATALOG.general);

  // Deduplicate by ID and return requested count
  const seen = new Set<string>();
  const result: ImageItem[] = [];
  for (const img of pools) {
    if (!seen.has(img.id)) {
      seen.add(img.id);
      result.push(img);
      if (result.length >= count) break;
    }
  }
  return result;
}

function imageTag(img: ImageItem): string {
  return `<figure class="article-image">
  <img src="https://images.unsplash.com/photo-${img.id}?fit=crop&amp;w=900&amp;h=500&amp;q=80" alt="${img.alt}" loading="lazy" width="900" height="500" />
  <figcaption>${img.caption}</figcaption>
</figure>`;
}

// ── Keyword-Specific List Generators ──────────────────────────────────────────

function getRequirementsList(analysis: KeywordAnalysis): string[] {
  const { category, location } = analysis;
  const loc = location ? titleCase(location) : 'the relevant authority';

  if (category === 'business' || category === 'legal') {
    if (location === 'dubai' || location === 'uae') {
      return [
        'Passport copies of all shareholders and directors (colour, valid for at least 6 months)',
        'UAE visa or Emirates ID copy (if you\'re already a resident)',
        'Proof of business address (can be a virtual office at the start)',
        'Completed application forms from DED or your chosen free zone authority',
        'A clear description of your intended business activities',
        'Memorandum of Association (MOA) or Articles of Association (AOA)',
        'NOC from your current employer if you\'re on an employment visa',
        'Initial Approval Certificate from the relevant government authority',
      ];
    }
    return [
      'Valid government-issued ID for all directors and shareholders',
      'Proof of registered business address',
      'Business plan or description of activities',
      'Certificate of incorporation (if transferring an existing company)',
      'Bank reference letters for each director',
      'Completed registration forms from the relevant authority',
      'Memorandum and Articles of Association',
    ];
  }

  if (category === 'finance') {
    return [
      'Proof of identity (passport or national ID)',
      'Proof of address (utility bill or bank statement, no older than 3 months)',
      'Bank statements for the past 3 to 6 months',
      'Tax identification number (TIN)',
      'Employment or income verification documents',
      'Credit history report (for loan applications)',
    ];
  }

  if (category === 'health') {
    return [
      'Consultation with your doctor or a qualified health professional',
      'A clear understanding of your current baseline health metrics',
      'A realistic timeline and goal-setting framework',
      'Access to the appropriate tools or resources',
      'A support system or accountability partner',
    ];
  }

  return [
    'A clear plan with defined goals and milestones',
    'The necessary tools and resources to get started',
    'Adequate time set aside to do this properly',
    'Basic research on the topic beforehand',
    'A budget if any costs are involved',
  ];
}

function getCostsList(analysis: KeywordAnalysis): string[] {
  const { category, location } = analysis;

  if (category === 'business') {
    if (location === 'dubai' || location === 'uae') {
      return [
        'Trade license fee: AED 10,000 to AED 50,000 depending on activity and free zone',
        'Initial approval fee: AED 100 to AED 500',
        'Name reservation fee: AED 500 to AED 1,000',
        'Office space or virtual office: AED 5,000 to AED 30,000 per year',
        'Visa fees per employee or owner: AED 3,000 to AED 7,000 each',
        'Attestation and notarization costs: AED 1,000 to AED 3,000',
        'Bank account setup: usually free, though some banks require minimum deposits',
      ];
    }
    return [
      'Government registration fee: varies by jurisdiction (typically $50 to $500)',
      'Registered agent fee: $50 to $300 per year',
      'State filing fee: $50 to $200',
      'Business license: varies by business type and location',
      'Accountant or lawyer fees if using professional services',
      'Bank account setup: usually free',
    ];
  }

  if (category === 'finance') {
    return [
      'Application fee: free to $100 depending on the institution',
      'Processing or origination fee: 0.5% to 3% of the loan amount',
      'Monthly service fees (if applicable)',
      'Early repayment penalties (check the fine print)',
      'Insurance or protection plan costs',
    ];
  }

  return [
    'Initial setup or registration costs',
    'Ongoing maintenance or subscription fees',
    'Professional service fees if applicable',
    'Hidden or indirect costs to budget for',
  ];
}

function getMistakesList(analysis: KeywordAnalysis): string[] {
  const { category, location } = analysis;

  if (category === 'business') {
    if (location === 'dubai' || location === 'uae') {
      return [
        'Choosing the wrong legal structure for your business activity',
        'Not verifying that your planned activity is permitted in your chosen free zone',
        'Underestimating total setup costs, especially visa and office fees',
        'Not getting a No Objection Certificate (NOC) if you\'re on an employment visa',
        'Skipping the bank account setup research before finalising your free zone choice',
        'Using a business name that doesn\'t comply with UAE naming regulations',
        'Forgetting to renew your trade license annually, which leads to fines',
      ];
    }
    return [
      'Choosing the wrong business structure for your goals',
      'Underestimating the startup costs and time involved',
      'Not consulting a professional when legal or tax issues arise',
      'Skipping the operating agreement or shareholders\' agreement',
      'Not separating personal and business finances from day one',
      'Forgetting to register for the relevant taxes in your jurisdiction',
    ];
  }

  if (category === 'health') {
    return [
      'Setting unrealistic goals and burning out early',
      'Ignoring professional medical advice before making big changes',
      'Focusing only on one aspect (like diet) while ignoring others (like sleep)',
      'Expecting results too quickly and quitting before they show',
      'Not tracking progress in a measurable way',
    ];
  }

  if (category === 'finance') {
    return [
      'Not reading the terms and conditions thoroughly',
      'Ignoring the total cost of borrowing (interest + fees)',
      'Applying to multiple lenders at once, which damages your credit score',
      'Overestimating how much you can afford to repay each month',
      'Missing the tax implications of certain financial decisions',
    ];
  }

  return [
    'Not researching thoroughly before getting started',
    'Rushing through important steps to save time',
    'Ignoring expert advice when it\'s available',
    'Not tracking your progress along the way',
    'Giving up too early when results don\'t come immediately',
  ];
}

function getExpertTipsList(analysis: KeywordAnalysis): string[] {
  const { category, location } = analysis;

  if (category === 'business') {
    if (location === 'dubai' || location === 'uae') {
      return [
        'Research free zones carefully. Each one specialises in specific industries and their fees vary significantly.',
        'Get a business consultant if this is your first UAE company. Their local knowledge saves you months.',
        'Open your corporate bank account early. UAE banks are thorough and the process takes longer than expected.',
        'Consider a virtual office first to keep initial costs low while you test the market.',
        'Join a UAE business community or Chamber of Commerce for networking and market insights.',
        'Make sure your trade name is available before you fall in love with it.',
      ];
    }
    return [
      'Talk to at least two or three business formation services and compare their fees and turnaround times.',
      'Hire a local accountant from the start. Tax compliance is much harder to fix retroactively.',
      'Get your shareholders\' agreement in writing, even if you\'re starting with family or close friends.',
      'Open a dedicated business bank account on day one to keep your finances clean.',
      'Keep copies of all your registration documents in a secure cloud location.',
    ];
  }

  if (category === 'health') {
    return [
      'Start small and build habits gradually. Dramatic overnight changes rarely stick.',
      'Track your progress weekly, not daily. Daily fluctuations can be misleading.',
      'Find a form of exercise you genuinely enjoy. Sustainability beats intensity.',
      'Sleep is not optional. Poor sleep undermines almost every other health effort.',
      'Hydration affects energy, focus, and mood more than most people realise.',
    ];
  }

  if (category === 'finance') {
    return [
      'Always read the full terms before signing any financial agreement.',
      'Compare at least three offers before committing to any financial product.',
      'Check your credit score before applying to understand your starting position.',
      'Set up automatic payments to avoid late fees and protect your credit rating.',
      'Revisit your financial decisions annually as your circumstances change.',
    ];
  }

  return [
    'Do your research before starting. Time spent planning saves time fixing mistakes.',
    'Learn from people who have done this before. Their experience is worth a lot.',
    'Set clear milestones so you know when you\'re making progress.',
    'Be patient with the process. Most worthwhile things take longer than expected.',
    'Document everything as you go. You\'ll thank yourself later.',
  ];
}

// ── Section & Paragraph Writers ───────────────────────────────────────────────

function writeIntro(analysis: KeywordAnalysis): string {
  const { raw, coreSubject, intent, category, location, year } = analysis;
  const loc = location ? ` in ${titleCase(location)}` : '';
  const subj = titleCase(coreSubject);

  if (intent === 'howto' && category === 'business') {
    return [
      `${titleCase(raw)}${location ? '' : ''} sounds daunting, but the process is more manageable than most people expect. This guide walks you through every step clearly, so you know exactly what to do, in what order, and how much it\'ll cost.`,
      `Thousands of entrepreneurs go through this process every year${loc}. The ones who succeed do so because they understand the requirements upfront and avoid the common pitfalls. That\'s exactly what this guide helps you do.`,
    ].join(' ');
  }

  if (intent === 'howto') {
    return [
      `${titleCase(raw)} is something a lot of people find confusing at first, but once you understand the steps, it becomes straightforward. This guide breaks down the entire process into clear, actionable steps you can follow right now.`,
      `Whether you\'re starting from scratch or have tried this before without success, here\'s what you actually need to know.`,
    ].join(' ');
  }

  if (intent === 'comparison') {
    return `Choosing between your options for ${smartLower(subj)} isn\'t always straightforward. This guide cuts through the marketing claims and gives you an honest, side-by-side comparison so you can make the right choice for your specific situation.`;
  }

  if (intent === 'tips') {
    return `Getting better results with ${smartLower(subj)} doesn\'t require reinventing the wheel. These practical tips are based on what actually works, drawn from real experience, not theory.`;
  }

  return `${subj} is a topic worth understanding properly. This guide covers what you need to know in ${year}, cutting through the noise to give you clear, useful information you can act on.`;
}

function writeSectionParagraph(heading: string, subheading: string | null, analysis: KeywordAnalysis, paragraphIndex: number): string {
  const { coreSubject, category, location, intent } = analysis;
  const loc = location ? ` in ${titleCase(location)}` : '';
  const subj = titleCase(coreSubject);
  const headLow = heading.toLowerCase();
  const subLow = (subheading || '').toLowerCase();

  // Structure / overview sections
  if (headLow.includes('option') || headLow.includes('structure') || headLow.includes('type') || headLow.includes('understanding')) {
    if (paragraphIndex === 0) {
      if (category === 'business' && location && (location.includes('dubai') || location.includes('uae'))) {
        if (subLow.includes('type') || subLow.includes('structure') || subLow.includes('available')) {
          return `Dubai gives you three main paths for setting up a business. You can register on the mainland through the Department of Economy and Tourism (DET), choose a free zone that suits your industry, or set up an offshore company for international operations. Each comes with its own rules, ownership options, and cost structure.`;
        }
        if (subLow.includes('which') || subLow.includes('fits') || subLow.includes('right') || subLow.includes('goal')) {
          return `Mainland registration makes sense if you want to trade anywhere across the UAE and win government contracts. Free zones are popular with foreign investors because they allow 100% ownership and carry no import/export taxes within the zone. If you\'re mainly doing international business and don\'t need a local presence for daily operations, an offshore structure keeps costs low and administration simple.`;
        }
      }
      return `There\'s no single approach that works for everyone when it comes to ${subj.toLowerCase()}. Your best option depends on your goals, your budget, and how much time you can commit. Taking a few minutes to map this out before you start saves a lot of backtracking later.`;
    }
    return `Most people who struggle with ${subj.toLowerCase()} skip this analysis step and jump straight to doing. That works sometimes, but it makes the whole process harder than it needs to be. Knowing which path fits your situation means every step after this one becomes clearer.`;
  }

  // Step-by-step / process sections
  if (headLow.includes('step') || headLow.includes('process') || headLow.includes('how')) {
    if (paragraphIndex === 0) {
      if (category === 'business' && location && location.includes('dubai')) {
        return `The registration process in Dubai follows a defined sequence, and skipping steps or doing them out of order causes delays. Here\'s how it works from start to finish.`;
      }
      return `Once you understand the process, ${subj.toLowerCase()} becomes far less intimidating. Follow these steps in order and you\'ll avoid the most common hold-ups that slow people down.`;
    }
    if (subLow.includes('choose') || subLow.includes('select') || subLow.includes('activity')) {
      return `Your business activity determines which license type you need and which free zone or authority can issue it. Be specific here. "Consulting" is too vague. "Management Consulting" or "IT Consulting" gives the authorities exactly what they need to process your application quickly.`;
    }
    if (subLow.includes('name') || subLow.includes('trade name') || subLow.includes('reserve')) {
      return `Your business name has to comply with local naming rules. In Dubai, that means no offensive terms, no references to religion in ways that could be seen as disrespectful, and no abbreviations of personal names unless the full name is used. Run a name search through the official portal before you get attached to anything.`;
    }
    if (subLow.includes('submit') || subLow.includes('application')) {
      return `Submit your completed application through the relevant authority\'s portal or in person at their business centre. Make sure every document is clear, current, and correctly attested where required. Incomplete applications are the single biggest cause of delays.`;
    }
    if (subLow.includes('license') || subLow.includes('receive') || subLow.includes('approval')) {
      return `Processing times vary depending on the authority and how busy they are. Most free zone licenses come through within 3 to 7 business days once all documents are in order. Mainland licenses through DET typically take 5 to 10 business days. You\'ll get your license digitally first, with the physical copy to follow.`;
    }
    return `Each step in this process builds on the previous one, so it\'s worth taking your time at each stage rather than rushing ahead. A small mistake early on often means restarting from that point.`;
  }

  // Requirements / needs sections
  if (headLow.includes('need') || headLow.includes('require') || headLow.includes('document') || headLow.includes('before you start')) {
    if (paragraphIndex === 0) {
      return `Getting your documents together before you start the formal process saves you a significant amount of time. Missing even one item can pause your application for days or weeks while you chase it down.`;
    }
    return `It\'s worth getting everything certified or attested in advance if your documents come from outside the country. The attestation process itself takes time, and you can\'t submit your application without it.`;
  }

  // Cost / fee sections
  if (headLow.includes('cost') || headLow.includes('fee') || headLow.includes('price') || headLow.includes('budget')) {
    if (paragraphIndex === 0) {
      if (location && location.includes('dubai')) {
        return `Setup costs in Dubai vary more than most people expect. A free zone license starts around AED 10,000 to 15,000 for a simple trading or services company, but once you add visa costs, office fees, and bank requirements, the real first-year total is usually between AED 25,000 and AED 60,000. That range depends heavily on which free zone you choose.`;
      }
      return `The costs involved in ${subj.toLowerCase()} add up faster than most people budget for. Here\'s a clear breakdown so you can plan properly from the start.`;
    }
    return `One thing worth noting: government fees are generally fixed, but professional service fees (lawyers, accountants, business setup consultants) can vary a lot. Get at least two or three quotes before committing, and ask what\'s included to avoid surprise charges later.`;
  }

  // Timeline / duration sections
  if (headLow.includes('timeline') || headLow.includes('how long') || headLow.includes('time')) {
    if (paragraphIndex === 0) {
      if (location && location.includes('dubai')) {
        return `If everything is in order, you can have a basic free zone company registered within one to two weeks in Dubai. Mainland company registration through DET typically takes two to four weeks. The timeline gets longer if there are document issues, bank delays, or if your activity needs special approval from a ministry.`;
      }
      return `The timeline for ${subj.toLowerCase()} depends on how prepared you are and how quickly the relevant authorities process your application. Having everything ready upfront is the single biggest factor in keeping things moving.`;
    }
    return `Factor in some buffer time when planning. Things like bank account opening, visa processing, and getting office space sorted can each add a week or two, so build your business launch timeline around a realistic total rather than the minimum possible.`;
  }

  // Mistakes sections
  if (headLow.includes('mistake') || headLow.includes('avoid') || headLow.includes('pitfall')) {
    if (paragraphIndex === 0) {
      return `Most of the mistakes people make with ${subj.toLowerCase()} aren\'t the result of being careless. They happen because the person didn\'t have clear information going in. Knowing what to watch for changes that completely.`;
    }
    return `The good news is that every one of these mistakes is avoidable. Most of them also have straightforward fixes if you catch them early enough in the process.`;
  }

  // Tips / expert advice sections
  if (headLow.includes('tip') || headLow.includes('expert') || headLow.includes('practical') || headLow.includes('advice')) {
    if (paragraphIndex === 0) {
      return `These insights come from people who\'ve been through this process and learnt what the official guides don\'t tell you. They\'re practical, specific, and worth paying attention to.`;
    }
    return `The pattern you\'ll notice across all of these tips is that preparation and patience matter far more than anything else. The people who sail through this process are the ones who did the groundwork first.`;
  }

  // FAQ sections
  if (headLow.includes('question') || headLow.includes('faq') || headLow.includes('frequently')) {
    if (location && location.includes('dubai')) {
      return `These are the questions that come up most often from people going through the ${subj.toLowerCase()} process. If yours isn\'t here, the relevant authority\'s website or a local business consultant can usually answer it quickly.`;
    }
    return `Here are the questions most people have about ${subj.toLowerCase()}, with straightforward answers.`;
  }

  // Conclusion / final thoughts
  if (headLow.includes('bottom line') || headLow.includes('final') || headLow.includes('conclusion') || headLow.includes('summary')) {
    if (paragraphIndex === 0) {
      return `${titleCase(analysis.raw)} is one of those things that feels more complicated than it actually is. Once you go through it once, you\'ll understand why so many people wish they\'d done it sooner.`;
    }
    return `The most important step is starting. Do your research, get your documents sorted, and work with someone who knows the process if you need support. You\'ve got everything you need right here to move forward with confidence.`;
  }

  // Comparison / what's the difference sections
  if (headLow.includes('what') && headLow.includes('difference')) {
    const paras = [
      `On the surface, the options for ${subj} can look very similar. But dig a little deeper and the differences become significant, especially once you factor in your team size, budget, and how you actually work day-to-day.`,
      `The key is not to get distracted by feature lists. Most tools do 80% of the same things. The 20% that differs is usually what actually determines whether something works well for your situation.`,
      `Before you compare anything, get clear on your non-negotiables: what the tool absolutely must do, what would be nice to have, and what you can live without. That framework makes every comparison much faster.`,
      `A lot of people make the mistake of choosing based on brand recognition rather than fit. The most widely used option isn't always the right one for a business your size with your specific workflow.`,
    ];
    return paras[paragraphIndex % paras.length];
  }

  // Key features comparison sections
  if (headLow.includes('feature') || headLow.includes('side by side') || headLow.includes('key feature')) {
    const paras = [
      `When comparing ${subj} options side by side, focus on the features your team will actually use every day. It's easy to get excited about advanced capabilities you'll never touch.`,
      `Pay particular attention to the integration ecosystem. A tool that connects cleanly with your existing software stack is worth far more than one with more features that doesn't play nicely with what you already use.`,
      `Look at the reporting and analytics capabilities carefully. This is where a lot of products fall short for small businesses — they offer complex enterprise-grade dashboards when you really just need clear, actionable summaries.`,
      `Mobile access matters more than many people expect. If your team is frequently out of the office, a clunky mobile experience will frustrate people enough to stop using the tool entirely.`,
    ];
    return paras[paragraphIndex % paras.length];
  }

  // Pricing and value sections
  if (headLow.includes('pricing') || headLow.includes('value for money') || headLow.includes('price')) {
    const paras = [
      `Pricing for ${subj} options varies more than most people expect before they start researching. What looks like an affordable monthly fee often doesn't include the features you actually need, which sit in the next tier up.`,
      `Watch out for per-user pricing that scales steeply. Some platforms look cheap at five users but become expensive quickly as your team grows. Factor in your likely team size in 12 months, not just today.`,
      `Free trials are worth using, but don't assess pricing based on trial limitations. Test with a realistic workload during the trial, then evaluate whether the paid plan's features justify the cost.`,
      `Total cost of ownership includes more than the subscription. Implementation time, training, and any migration from your current setup all have a real cost that rarely appears in pricing pages.`,
    ];
    return paras[paragraphIndex % paras.length];
  }

  // Strengths and weaknesses sections
  if (headLow.includes('strength') || headLow.includes('weakness') || headLow.includes('pros') || headLow.includes('cons')) {
    const paras = [
      `Every option in the ${subj} space has genuine strengths worth acknowledging. The question is whether those strengths align with the problems you're actually trying to solve.`,
      `The weaknesses that matter most aren't always the most obvious ones. A clunky interface is annoying but manageable. Missing a core workflow feature can fundamentally break how your team operates.`,
      `Read reviews from businesses similar to yours in size and industry. A glowing review from a 500-person enterprise means very little if you're a team of eight people with completely different priorities.`,
      `Support quality is a strength that only reveals itself when something goes wrong. Look for recent reviews that specifically mention the support experience, not just the product features.`,
    ];
    return paras[paragraphIndex % paras.length];
  }

  // Which one / decision sections
  if (headLow.includes('which one') || headLow.includes('should you choose') || headLow.includes('final verdict') || headLow.includes('recommendation')) {
    const paras = [
      `The right ${subj} for your situation depends on a handful of factors that only you can fully assess: your team's technical comfort level, your existing tool stack, your budget, and how much time you can dedicate to setup and training.`,
      `If you're still unsure after doing your research, sign up for the free trials of your top two options and use them in parallel for a week. Real-world use reveals things that feature pages and reviews don't.`,
      `Don't overthink this. A good-enough tool that your team actually adopts consistently will outperform the objectively best tool that nobody uses properly. Adoption matters more than features on paper.`,
      `Ask your team what they think before you commit. The people who'll use this every day often notice things during a trial that you wouldn't spot as someone evaluating it from a distance.`,
    ];
    return paras[paragraphIndex % paras.length];
  }

  // Expert recommendations sections
  if (headLow.includes('expert') || headLow.includes('recommendation')) {
    const paras = [
      `The most consistent piece of advice from people who have evaluated multiple ${subj} options is this: start with your workflow, not the features list. Map out how your team actually works, then find the tool that fits that workflow rather than trying to adapt your team to the tool.`,
      `Another recurring piece of wisdom is to avoid overbuying. Choose the simplest option that does everything you need today, with a clear upgrade path for when your needs grow. Paying for features you're not ready to use is money wasted.`,
      `Implementation support is worth paying for, at least initially. The difference between a tool that transforms your workflow and one that sits unused usually comes down to how well it was set up and adopted in the first place.`,
    ];
    return paras[paragraphIndex % paras.length];
  }

  // Vs / versus comparison sections
  if (headLow.includes('vs') || headLow.includes('versus') || headLow.includes('compare')) {
    const paras = [
      `Comparing your options for ${subj} comes down to understanding what each one offers and what it trades off in return. There's rarely a clear winner for everyone, but there's almost always a clear winner for your situation.`,
      `The right choice depends on what you prioritise. If cost is the main factor, go with the option that delivers what you need at a sustainable price. If reliability and support matter more, it's worth paying extra.`,
      `Try to get past the marketing. Both options will look excellent on their own websites. Look for independent comparison articles, user communities, and recent review threads for a more honest picture.`,
    ];
    return paras[paragraphIndex % paras.length];
  }

  // Default paragraphs — varied enough that cycling through doesn't feel repetitive
  const defaults = [
    `${subj} is one of those areas where doing a bit of research upfront saves you significant time and money later. The small effort you put in now pays off every time you use whatever you end up choosing.`,
    `There's more variety in this space than most people expect before they start looking. What seems like a simple choice often turns out to have meaningful differences between options that affect how you work day to day.`,
    `The people who get the best results tend to be the ones who approach this with a clear sense of what problem they're actually trying to solve, rather than looking for the option with the most features.`,
    `Don't underestimate the value of talking to other people who've gone through the same decision recently. First-hand experience from someone in a similar situation is often more useful than any review or comparison article.`,
    `Getting this right the first time saves a lot of disruption later. Switching tools or solutions mid-stride carries a real cost in time, training, and productivity — so it's worth taking the time to choose well now.`,
    `Most people discover that the learning curve for any new approach or tool is steeper at the start and flattens out faster than expected. Give yourself a realistic adjustment period before you evaluate whether it's working.`,
  ];

  return defaults[paragraphIndex % defaults.length];
}

// ── Main Generators ────────────────────────────────────────────────────────────

interface SectionSpec {
  heading: string;
  subheadings?: string[];
  listType: 'requirements' | 'costs' | 'mistakes' | 'tips' | 'none';
  paragraphs: number;
  addImage: boolean;
}

function buildSectionPlan(analysis: KeywordAnalysis, wordCount: number): SectionSpec[] {
  const { intent, category, location, coreSubject, year } = analysis;
  const loc = location ? ` in ${titleCase(location)}` : '';
  const subj = titleCase(coreSubject);
  // More paragraphs = more words. Scale by target word count.
  const paraPerSection = wordCount < 1200 ? 2 : wordCount < 2000 ? 3 : 4;
  const totalSections = wordCount < 1200 ? 5 : wordCount < 2000 ? 7 : 9;

  let plan: SectionSpec[] = [];

  if (intent === 'howto' && (category === 'business' || category === 'legal')) {
    plan = [
      { heading: `Your Options${loc}`, subheadings: ['Types of Business Structures Available', 'Which Structure Fits Your Goals'], listType: 'none', paragraphs: paraPerSection, addImage: true },
      { heading: `What You Need Before You Start`, subheadings: [], listType: 'requirements', paragraphs: paraPerSection, addImage: false },
      { heading: `Step-by-Step Registration Process`, subheadings: ['Step 1: Choose Your Business Activity', 'Step 2: Select Your Structure and Free Zone', 'Step 3: Reserve Your Trade Name', 'Step 4: Submit Your Application', 'Step 5: Collect Your License'], listType: 'none', paragraphs: paraPerSection, addImage: true },
      { heading: `Costs and Fees Breakdown`, subheadings: [], listType: 'costs', paragraphs: paraPerSection, addImage: false },
      { heading: `Timeline: How Long Does It Take?`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: true },
      { heading: `Common Mistakes to Avoid`, subheadings: [], listType: 'mistakes', paragraphs: paraPerSection, addImage: false },
      { heading: `Practical Tips from People Who\'ve Done It`, subheadings: [], listType: 'tips', paragraphs: paraPerSection, addImage: false },
      { heading: `Frequently Asked Questions`, subheadings: [], listType: 'none', paragraphs: 2, addImage: false },
      { heading: `The Bottom Line`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: false },
    ];
  } else if (intent === 'howto') {
    plan = [
      { heading: `What You Actually Need to Know First`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: true },
      { heading: `What You\'ll Need to Get Started`, subheadings: [], listType: 'requirements', paragraphs: paraPerSection, addImage: false },
      { heading: `Step-by-Step: How to ${subj}`, subheadings: [], listType: 'none', paragraphs: paraPerSection + 1, addImage: true },
      { heading: `Costs and Time Involved`, subheadings: [], listType: 'costs', paragraphs: paraPerSection, addImage: false },
      { heading: `Common Mistakes and How to Avoid Them`, subheadings: [], listType: 'mistakes', paragraphs: paraPerSection, addImage: true },
      { heading: `Expert Tips for Better Results`, subheadings: [], listType: 'tips', paragraphs: paraPerSection, addImage: false },
      { heading: `Frequently Asked Questions`, subheadings: [], listType: 'none', paragraphs: 2, addImage: false },
      { heading: `The Bottom Line`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: false },
    ];
  } else if (intent === 'comparison') {
    plan = [
      { heading: `What\'s the Difference?`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: true },
      { heading: `Key Features Side by Side`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: false },
      { heading: `Pricing and Value for Money`, subheadings: [], listType: 'costs', paragraphs: paraPerSection, addImage: true },
      { heading: `Strengths and Weaknesses`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: false },
      { heading: `Which One Should You Choose?`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: true },
      { heading: `Common Mistakes When Evaluating Options`, subheadings: [], listType: 'mistakes', paragraphs: paraPerSection, addImage: false },
      { heading: `Expert Recommendations`, subheadings: [], listType: 'tips', paragraphs: paraPerSection, addImage: false },
      { heading: `Final Verdict`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: false },
    ];
  } else if (intent === 'tips') {
    plan = [
      { heading: `Why Most People Get ${subj} Wrong`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: true },
      { heading: `The Fundamentals You Can\'t Skip`, subheadings: [], listType: 'requirements', paragraphs: paraPerSection, addImage: false },
      { heading: `Proven Tips That Deliver Real Results`, subheadings: [], listType: 'tips', paragraphs: paraPerSection, addImage: true },
      { heading: `What to Avoid`, subheadings: [], listType: 'mistakes', paragraphs: paraPerSection, addImage: false },
      { heading: `Putting It All Together`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: true },
      { heading: `Frequently Asked Questions`, subheadings: [], listType: 'none', paragraphs: 2, addImage: false },
    ];
  } else {
    plan = [
      { heading: `What Is ${subj}?`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: true },
      { heading: `Why It Matters${loc ? loc : ''} in ${year}`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: false },
      { heading: `Key Things to Know`, subheadings: [], listType: 'requirements', paragraphs: paraPerSection, addImage: true },
      { heading: `How to Get the Best Results`, subheadings: [], listType: 'tips', paragraphs: paraPerSection, addImage: false },
      { heading: `Common Mistakes to Avoid`, subheadings: [], listType: 'mistakes', paragraphs: paraPerSection, addImage: true },
      { heading: `Frequently Asked Questions`, subheadings: [], listType: 'none', paragraphs: 2, addImage: false },
      { heading: `The Bottom Line`, subheadings: [], listType: 'none', paragraphs: paraPerSection, addImage: false },
    ];
  }

  return plan.slice(0, totalSections);
}

function renderListItems(type: SectionSpec['listType'], analysis: KeywordAnalysis): string {
  let items: string[] = [];
  if (type === 'requirements') items = getRequirementsList(analysis);
  else if (type === 'costs') items = getCostsList(analysis);
  else if (type === 'mistakes') items = getMistakesList(analysis);
  else if (type === 'tips') items = getExpertTipsList(analysis);
  if (!items.length) return '';
  return `<ul>\n${items.map(i => `  <li>${i}</li>`).join('\n')}\n</ul>\n`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface GeneratedContent {
  html: string;
  seoTitle: string;
  metaTitle: string;
  metaDescription: string;
  imageCount: number;
  wordCount: number;
}

export function generateArticleContent(keyword: string, targetWordCount: number): GeneratedContent {
  const analysis = analyzeKeyword(keyword);
  const sections = buildSectionPlan(analysis, targetWordCount);
  const images = getImages(analysis, 4);
  let imageIndex = 0;

  let html = '';

  // H1
  html += `<h1>${analysis.seoTitle}</h1>\n\n`;

  // Intro paragraph
  html += `<p>${writeIntro(analysis)}</p>\n\n`;

  // Sections
  for (const sec of sections) {
    const id = slugify(sec.heading);

    // Image before certain sections
    if (sec.addImage && imageIndex < images.length) {
      html += imageTag(images[imageIndex++]) + '\n\n';
    }

    html += `<h2 id="${id}">${sec.heading}</h2>\n`;

    const hasSubheadings = sec.subheadings && sec.subheadings.length > 0;

    if (hasSubheadings) {
      // First paragraph before subheadings
      html += `<p>${writeSectionParagraph(sec.heading, null, analysis, 0)}</p>\n\n`;
      for (const sub of sec.subheadings!) {
        html += `<h3 id="${slugify(sub)}">${sub}</h3>\n`;
        html += `<p>${writeSectionParagraph(sec.heading, sub, analysis, 0)}</p>\n`;
        if (sec.subheadings!.indexOf(sub) < sec.subheadings!.length - 1 || sec.paragraphs > 1) {
          html += `<p>${writeSectionParagraph(sec.heading, sub, analysis, 1)}</p>\n`;
        }
      }
    } else {
      for (let p = 0; p < sec.paragraphs; p++) {
        html += `<p>${writeSectionParagraph(sec.heading, null, analysis, p)}</p>\n`;
      }
    }

    // List if applicable
    if (sec.listType !== 'none') {
      html += renderListItems(sec.listType, analysis);
    }

    html += '\n';
  }

  // Key takeaways box
  const { coreSubject, location } = analysis;
  const loc = location ? ` in ${titleCase(location)}` : '';
  html += `<div class="key-takeaways">\n<h3>Key Takeaways</h3>\n<ul>\n`;
  html += `  <li>Having a clear plan before you start ${titleCase(coreSubject).toLowerCase()}${loc} makes the entire process significantly faster.</li>\n`;
  html += `  <li>Costs and timelines vary, so budget for more than the minimum and build in extra time for unexpected delays.</li>\n`;
  html += `  <li>Professional help is worth considering for the steps where mistakes are costly to fix.</li>\n`;
  html += `  <li>Once you\'ve done this once, the next time is much easier because you know exactly what to expect.</li>\n`;
  html += `</ul>\n</div>\n`;

  // Rough word count
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wc = text.split(' ').length;

  const metaTitle = analysis.seoTitle.length > 60 ? analysis.seoTitle.substring(0, 57) + '...' : analysis.seoTitle;
  const metaDescription = `${writeIntro(analysis).substring(0, 140).replace(/<[^>]+>/g, '')}...`;

  return {
    html,
    seoTitle: analysis.seoTitle,
    metaTitle,
    metaDescription,
    imageCount: imageIndex,
    wordCount: wc,
  };
}

// ── Humanizer ──────────────────────────────────────────────────────────────────

/**
 * Post-process HTML to make it sound more natural and human.
 * Removes AI patterns, em-dashes, passive voice filler, and over-formal language.
 */
export function humanizeContent(html: string): string {
  return html
    // Remove em-dashes (replace with comma or period break)
    .replace(/\s*—\s*/g, ', ')
    // Remove en-dashes used as ranges (keep numeric ranges)
    .replace(/(\D)\s*–\s*(\D)/g, '$1 to $2')
    // Common AI filler phrases
    .replace(/The data suggests that /gi, '')
    .replace(/Research consistently shows that /gi, '')
    .replace(/Industry leaders consistently cite this as /gi, 'This is generally considered ')
    .replace(/Many professionals overlook this detail, which can have a significant impact on overall performance\./gi, 'This is often overlooked, even though it has a real impact on results.')
    .replace(/It\'s important to consider both the technical and strategic aspects of this topic\./gi, 'Both the practical and strategic side of this matter.')
    .replace(/While there\'s no one-size-fits-all solution, the principles outlined here apply across most contexts\./gi, 'What works varies by situation, but these principles hold up across most cases.')
    .replace(/When evaluated against competing approaches, this method stands out for its reliability and scalability\./gi, 'This approach is reliable and scales well compared to the alternatives.')
    .replace(/early adopters of these practices see measurably better results within the first 90 days/gi, 'getting started early tends to produce better results faster')
    .replace(/A common misconception is that complexity equals quality/gi, 'Complexity doesn\'t equal quality')
    .replace(/in reality, clarity and relevance are what matter most\./gi, 'Clarity and relevance matter more.')
    // Remove unnecessary intensifiers
    .replace(/\bvery\s+important\b/gi, 'important')
    .replace(/\bextremely\s+important\b/gi, 'important')
    .replace(/\babsolutely\s+essential\b/gi, 'essential')
    // Fix AI-style list items that are meta-instructions (if they somehow sneak in)
    .replace(/<li>Conduct thorough keyword research before creating any content<\/li>/gi, '')
    .replace(/<li>Optimize your title tag and meta description for click-through rate<\/li>/gi, '')
    .replace(/<li>Use header tags \(H1.H3\) to structure your content logically<\/li>/gi, '')
    .replace(/<li>Include both internal and external links to establish authority<\/li>/gi, '')
    .replace(/<li>Ensure your content fully satisfies the search intent behind the query<\/li>/gi, '')
    .replace(/<li>Use schema markup to help search engines understand your content<\/li>/gi, '')
    .replace(/<li>Monitor performance metrics and iterate based on real data<\/li>/gi, '')
    // Clean up double spaces
    .replace(/  +/g, ' ')
    // Fix empty list items
    .replace(/<li>\s*<\/li>/gi, '')
    // Fix empty paragraphs
    .replace(/<p>\s*<\/p>/gi, '');
}
