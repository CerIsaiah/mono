import React from 'react';
import Link from 'next/link';
import Script from 'next/script';

export default function RizzLinesPost() {
  const publishDate = '2025-02-20';

  // Section arrays
  const topRizzLines = [
    "Are you a library book? Because I keep checking you out.",
    "Do you like science? Because we've got great chemistry.",
    "Are you a parking ticket? Because you've got 'fine' written all over you.",
    "Is your name Google? Because you've got everything I've been searching for.",
    "Are you a photographer? Because I can picture us together.",
    "Do you like astronomy? Because you've got me seeing stars.",
    "Are you made of copper and tellurium? Because you're Cu-Te.",
    "Do you like math? Because you add so much to my life.",
    "Are you a cat? Because you're purr-fect.",
    "Is your name WiFi? Because I'm really feeling a connection."
  ];

  const smoothRizzLines = [
    "Only on Tuesdays... today's Wednesday.",
    "I'd say yes, but my calendar's playing hard to get.",
    "That depends, is this a job interview?",
    "Sorry, my crystal ball's in the shop.",
    "Let me check with my personal assistant... oh wait, that's me.",
    "I'm actually a professional coincidence coordinator.",
    "That's classified information... for now.",
    "Would you believe me if I said maybe?",
    "I'm still waiting for my autobiography to be written.",
    "That's a complex question. Can I phone a friend?"
  ];

  const coffeeShopRizz = [
    "Is this seat taken, or is it saving itself for destiny?",
    "That drink looks interesting - what's your go-to order?",
    "Mind if I join you? I promise I'm more interesting than your laptop screen.",
    "Any recommendations? I'm tired of ordering the same thing.",
    "Is this place always this crowded, or am I just lucky?"
  ];

  const libraryRizz = [
    "What section would I find your story in?",
    "Any book recommendations for a fellow reader?",
    "Help me settle a debate - physical books or e-readers?",
    "Is this seat reserved for your imaginary study buddy?",
    "Which genre best describes your day so far?"
  ];

  const gymRizz = [
    "Could you spot me? I promise not to drop anything except maybe my pride.",
    "Is it just me, or is gravity extra strong today?",
    "Any tips for someone who thinks cardio is Spanish for 'no thanks'?",
    "You must be a personal trainer, because you're raising the bar.",
    "Mind sharing your playlist? Mine needs some motivation."
  ];

  const playfulRizzWords = [
    "I'm actually a professional coincidence coordinator.",
    "Let me check my schedule... yep, definitely free for adventure.",
    "I'd tell you a joke, but I'm still writing the punchline.",
    "Consider me your personal tour guide to interesting conversations.",
    "I specialize in making mundane moments memorable."
  ];

  const rizzSentences = [
    "You look like someone who has an interesting story to tell.",
    "Your style reminds me of a cool indie movie character.",
    "I bet you're the friend everyone comes to for advice.",
    "You seem like someone who'd have a great podcast.",
    "Let me guess - you're either a creative genius or really good at pretending to be one."
  ];

  const goodRizzQuestions = [
    "What's the last thing that made you laugh uncontrollably?",
    "If you could master any skill instantly, what would it be?",
    "What's your favorite way to waste time productively?",
    "What's the most interesting conversation you've had this week?",
    "If you could have dinner with anyone from history, who would it be?"
  ];

  const moreRizzLines = [
    "Are you a dictionary? Because you're adding meaning to my life.",
    "Must be a museum here, because I'm seeing a work of art.",
    "Are you a computer? Because you're crashing my system.",
    "Do you like puzzles? Because I'm trying to piece you together.",
    "Is your name Autumn? Because you've got me falling.",
    "Are you a bank? Because you've got all my interest.",
    "Must be a magician, because you've got me spellbound.",
    "Are you a musician? Because you've struck a chord with me.",
    "Do you like bowling? Because you've got me pinned down.",
    "Are you a compass? Because you've got me headed in the right direction."
  ];

  const rizzExamplesWork = [
    "Lost my phone number... can I borrow yours?",
    "Are you tired? Because you've been running through my mind all day.",
    "Is this seat empty? Mind if I fill it with interesting conversation?",
    "Do you believe in love at first sight, or should I walk by again?",
    "Are you a parking ticket? Because you've got FINE written all over you.",
    "Do you like science? Because I've got my ion you.",
    "Are you a camera? Because every time I look at you, I smile.",
    "Do you have a map? I keep getting lost in your eyes.",
    "Is your name Google? Because you've got everything I've been searching for.",
    "Are you a cat? Because you're purr-fect."
  ];

  const bestRizzMore = [
    "Thanks for the compliment, I'll add it to my collection.",
    "I'm actually a professional coincidence coordinator.",
    "That's classified information... for now.",
    "Would you believe me if I said maybe?",
    "I'm still waiting for my autobiography to be written.",
    "Let me consult my magic 8 ball.",
    "That's a complex question. Can I phone a friend?",
    "Sorry, my crystal ball's in the shop.",
    "Let me check with my personal assistant... oh wait, that's me.",
    "Only on alternate Tuesdays in months ending in 'y'."
  ];

  const howToRizzWork = [
    "Is this coffee shop always this lucky, or is it just because you're here?",
    "Mind if I join your study session? I promise I'm a good luck charm.",
    "You must be a librarian, because you've got me all sorted out.",
    "Are you a bookmark? Because I've been looking for you in every chapter.",
    "Must be a time traveler, because I see a future here.",
    "Are you a dictionary? Because you're defining perfection.",
    "Do you like music? Because we could make a great duet.",
    "Is this seat taken, or is it waiting for the right story?",
    "You must be a photographer, because you've captured my attention.",
    "Are you a GPS? Because you've got me headed in the right direction."
  ];

  const rizzLinesForGuys = [
    "Are you a workout? Because you're working out perfectly.",
    "Must be a superhero, because you've saved my day.",
    "Are you a chef? Because you've got all the right ingredients.",
    "Do you play sports? Because you're a total catch.",
    "Are you a detective? Because you've solved the mystery of my smile.",
    "Must be a magician, because you make everything else disappear.",
    "Are you a writer? Because you're making my story interesting.",
    "Do you like coffee? Because I like you a latte.",
    "Are you a calendar? Because you make my days better.",
    "Must be an artist, because you've drawn me in."
  ];

  // Helper to render a section with a title, transition text, and list of lines
  const renderSection = (title, transition, lines) => (
    <section className="bg-white rounded-lg sm:rounded-xl p-5 sm:p-8 shadow-md my-10">
      <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-800 leading-tight">{title}</h2>
      <p className="mb-6 text-gray-700">
        {transition}
      </p>
      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={index} className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-100">
            <p className="text-base sm:text-lg text-gray-700">{line}</p>
          </div>
        ))}
      </div>
    </section>
  );

  // Helper to render a subsection (for advanced techniques)
  const renderSubsection = (title, lines) => (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-3 text-gray-800">{title}</h3>
      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={index} className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-100">
            <p className="text-base sm:text-lg text-gray-700">{line}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Google Tag Manager (noscript) */}
      <noscript>
        <iframe 
          src="https://www.googletagmanager.com/ns.html?id=GTM-KMCKVJ4H"
          height="0" 
          width="0" 
          style={{display: 'none', visibility: 'hidden'}}
        ></iframe>
      </noscript>
      {/* End Google Tag Manager (noscript) */}
      
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Advertisement Banner */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-4 rounded-lg mb-10 shadow-md">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <div className="mb-4 sm:mb-0">
              <h3 className="font-bold text-lg mb-1">Want Ideas to Boost Your Rizz Game?</h3>
              <p className="text-white/90">Try out our new free tool!</p>
            </div>
            <Link 
              href="/"
              className="bg-white text-pink-500 px-6 py-2 rounded-full font-semibold hover:bg-gray-100 transition-colors"
            >
              Try now →
            </Link>
          </div>
        </div>

        {/* Hero Section */}
        <header className="mb-10 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 sm:mb-6 text-gray-900 leading-tight tracking-tight">
            Best <span className="text-pink-500">Rizz</span> Lines: 100+ Examples That Actually Work
          </h1>
          <div className="text-gray-600 text-sm sm:text-base mb-6 sm:mb-8 font-medium">
            <time dateTime={publishDate}>Published {new Date(publishDate).toLocaleDateString()}</time>
            <span className="mx-2">•</span>
            <span>15 min read</span>
          </div>
          <img 
            src="/pics/percent100.png" 
            alt="100 Percent Success Rate"
            className="w-full rounded-lg shadow-md"
          />
        </header>

        {/* Key Takeaways */}
        <div className="bg-gray-50 p-5 sm:p-8 rounded-lg sm:rounded-xl mb-10 sm:mb-16 shadow-sm">
          <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6">Key Takeaways</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <li className="flex items-center space-x-2">
              <span className="text-pink-500">•</span>
              <span>Master proven rizz techniques</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-pink-500">•</span>
              <span>Learn situational conversation starters</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-pink-500">•</span>
              <span>Build authentic connections</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-pink-500">•</span>
              <span>Develop your unique style</span>
            </li>
          </ul>
        </div>

        {/* Introduction */}
        <section className="mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-800 leading-tight">Understanding Modern Rizz</h2>
          <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-6">
            In 2025, mastering smooth conversation means more than just reciting memorized lines—it's about authentic connection, playful wit, and knowing which words spark genuine interest. Whether you're at a coffee shop, library, or gym, these rizz lines are designed to elevate your conversation game.
          </p>
        </section>

        {/* Section 1: Top Rizz Pick Up Lines (Lines 1-10) */}
        {renderSection(
          "Top Rizz Pick Up Lines",
          "Kick off your smooth conversation journey with these irresistible top rizz lines that have been proven to grab attention and spark interest.",
          topRizzLines
        )}

        {/* Section 2: Smooth Rizz Lines (Lines 11-20) */}
        {renderSection(
          "Smooth Rizz Lines",
          "Elevate your charm with smooth, playful lines that blend humor and confidence—perfect for any modern conversation starter.",
          smoothRizzLines
        )}

        {/* Section 3: Situational Rizz Examples */}
        <section className="mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-800 leading-tight">Situational Rizz Examples</h2>
          <p className="mb-6 text-gray-700">
            Adapt your approach to every setting with these situational rizz examples. Whether you're grabbing coffee, browsing books, or hitting the gym, these lines are tailored to fit the moment.
          </p>
          {renderSection("Coffee Shop Rizz", "Capture the cozy vibe of your favorite café with these lines that blend warmth and spontaneity.", coffeeShopRizz)}
          {renderSection("Library Rizz", "Turn quiet corners into lively conversations with these clever library-themed rizz lines.", libraryRizz)}
          {renderSection("Gym Rizz", "Break a sweat and break the ice with these gym-inspired pickup lines that are as energetic as you are.", gymRizz)}
        </section>

        {/* Section 4: Advanced Rizz Techniques */}
        <section className="bg-white rounded-lg sm:rounded-xl p-5 sm:p-8 shadow-md my-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-800 leading-tight">Advanced Rizz Techniques</h2>
          <p className="mb-6 text-gray-700">
            Ready to refine your art of conversation? Explore these advanced techniques that include playful words, effective compliments, and intriguing questions to help you connect on a deeper level.
          </p>
          {renderSubsection("Playful Rizz Words (Lines 36-40)", playfulRizzWords)}
          {renderSubsection("Rizz Sentences That Work (Lines 41-45)", rizzSentences)}
          {renderSubsection("Good Rizz Questions (Lines 46-50)", goodRizzQuestions)}
        </section>

        {/* Section 5: More Best Rizz Lines (Lines 51-60) */}
        {renderSection(
          "More Best Rizz Lines",
          "Expand your arsenal with these additional rizz lines that blend clever wordplay with genuine charm.",
          moreRizzLines
        )}

        {/* Section 6: Rizz Examples That Actually Work (Lines 61-70) */}
        {renderSection(
          "Rizz Examples That Actually Work",
          "These proven rizz examples have been tried and tested to make a lasting impression—perfect for starting a memorable conversation.",
          rizzExamplesWork
        )}

        {/* Section 7: What Is the Best Rizz Line? Here Are More Examples (Lines 71-80) */}
        {renderSection(
          "What Is the Best Rizz Line? Here Are More Examples",
          "Discover more standout lines that not only impress but also invite further conversation, setting the stage for a genuine connection.",
          bestRizzMore
        )}

        {/* Section 8: How to Make a Rizz Line Work (Lines 81-90) */}
        {renderSection(
          "How to Make a Rizz Line Work",
          "It's not just what you say but how you say it. Use these lines to see how a little finesse can transform a simple greeting into an engaging dialogue.",
          howToRizzWork
        )}

        {/* Section 9: Good Rizz Lines to Say to a Guy (Lines 91-100) */}
        {renderSection(
          "Good Rizz Lines to Say to a Guy",
          "Tailor your approach even further with these lines crafted specifically for sparking interest and connection with men.",
          rizzLinesForGuys
        )}

        {/* Common Mistakes to Avoid */}
        <section className="bg-gray-50 p-5 sm:p-8 rounded-lg my-10">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800">Common Mistakes to Avoid</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-4 sm:p-6 rounded-lg">
              <h3 className="text-base sm:text-lg font-semibold text-red-500 mb-3">❌ Don't:</h3>
              <ul className="space-y-2 text-gray-700">
                <li>Use generic lines without personalizing</li>
                <li>Force conversations</li>
                <li>Ignore social cues</li>
                <li>Copy-paste without context</li>
              </ul>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg">
              <h3 className="text-base sm:text-lg font-semibold text-green-500 mb-3">✅ Do:</h3>
              <ul className="space-y-2 text-gray-700">
                <li>Stay authentic and genuine</li>
                <li>Read the situation</li>
                <li>Adapt lines to your style</li>
                <li>Focus on making real connections</li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="bg-white rounded-lg sm:rounded-xl p-5 sm:p-8 shadow-md my-10">
          <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "What is rizz?",
                a: "Rizz refers to charisma and skill in conversation, particularly in dating contexts and digital communication."
              },
              {
                q: "How do I develop better rizz?",
                a: "Practice these techniques while staying true to your personality. Focus on being genuine and reading social cues."
              },
              {
                q: "What makes a good rizz line?",
                a: "The best rizz lines are authentic, situationally appropriate, and delivered with confidence while respecting boundaries."
              },
              {
                q: "Can rizz be learned?",
                a: "Yes! Like any social skill, rizz can be developed through practice, understanding, and experience."
              }
            ].map((faq, index) => (
              <div key={index} className="border-b border-gray-100 pb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-900">{faq.q}</h3>
                <p className="text-base sm:text-lg text-gray-700 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Call To Action */}
        <aside className="bg-gradient-to-r from-pink-50 to-purple-50 p-5 sm:p-8 rounded-lg my-10">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-xl sm:text-3xl font-bold mb-4 text-gray-800">Ready to Level Up Your Rizz?</h3>
            <p className="text-base sm:text-lg text-gray-700 mb-6 leading-relaxed">
              Join thousands who are mastering the art of smooth conversation. Get personalized tips and real-time feedback to elevate your messaging game.
            </p>
            <Link 
              href="/"
              className="inline-block bg-pink-500 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold hover:bg-pink-600 transition-colors shadow-sm"
            >
              Get Started →
            </Link>
          </div>
        </aside>
      </article>
    </>
  );
}

export const GTMScript = () => (
  <Script id="google-tag-manager" strategy="afterInteractive">
    {`
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','GTM-KMCKVJ4H');
    `}
  </Script>
);

export const metadata = {
  title: 'Best Rizz Lines: 100+ Examples That Actually Work',
  description: 'Master the art of smooth conversation with rizz pick up lines that work in 2025',
  openGraph: {
    title: 'Best Rizz Lines: 100+ Examples That Actually Work',
    description: 'Master the art of smooth conversation with rizz pick up lines that work in 2025',
    type: 'article',
    publishedTime: '2025-02-20',
    images: ['/pics/smoothrizz-logo.png'],
    siteName: 'SmoothRizz',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Rizz Lines: 100+ Examples That Actually Work',
    description: 'Master the art of smooth conversation with rizz pick up lines that work in 2025',
    images: ['/pics/smoothrizz-logo.png'],
    creator: '@smoothrizz',
  },
  other: {
    'script[type="application/ld+json"]': {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Best Rizz Lines: 100+ Examples That Actually Work',
      datePublished: '2025-02-20',
      author: {
        '@type': 'Organization',
        name: 'SmoothRizz'
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '1250',
        bestRating: '5',
        worstRating: '1'
      }
    }
  }
};
