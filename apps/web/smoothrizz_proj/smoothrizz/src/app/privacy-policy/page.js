import Head from 'next/head'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>Privacy Policy | SmoothRizz</title>
        <meta
          name="description"
          content="Learn how SmoothRizz protects your data and privacy. Read our detailed privacy policy covering data collection, usage, and your rights."
        />
      </Head>

      {/* Navigation */}
      <nav className="flex justify-between items-center p-4 md:p-6 lg:p-8">
        <div className="text-2xl md:text-3xl font-bold" style={{ color: '#FE3C72' }}>
          SmoothRizz
        </div>
      </nav>

      {/* Main Content */}
      <main className="px-4 md:px-6 lg:px-8 max-w-4xl mx-auto pb-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-8" style={{ color: '#121418' }}>
          Privacy Policy
        </h1>

        <div className="prose prose-lg max-w-none">
          <p>
            This Privacy Policy describes how Smooth Rizz ("we", "our", or "us") collects, uses, stores, and shares your information when you use our Service. By using the Service, you agree to the collection and use of information in accordance with this policy.
          </p>

          <h2>Information Collection and Use</h2>
          <p>
            We collect several types of information for various purposes to provide and improve our Service to you:
          </p>

          <h3>Personal Data</h3>
          <p>
            While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you. This may include, but is not limited to:
          </p>
          <ul>
            <li>Email address</li>
            <li>First name and last name</li>
            <li>Usage Data</li>
          </ul>

          <h3>Google User Data</h3>
          <p>Our Service requires access to your Google account to interact with YouTube. This includes:</p>
          <ul>
            <li>Email</li>
            <li>Name Data</li>
          </ul>

          <h2>How We Use Your Data</h2>
          <p>Smooth Rizz uses the collected data for the following specific purposes:</p>
          <ul>
            <li>User Authentication: Your Google account information is used to authenticate you and provide access to our services.</li>
            <li>Service Improvement: We analyze usage patterns to improve our service and user experience. This analysis is done on aggregated, anonymized data.</li>
            <li>Communication: We may use your email address to send you important updates about our service or respond to your inquiries.</li>
            <li>Error Tracking: We collect error logs to identify and fix technical issues in our service.</li>
          </ul>

          <h2>Contact Us</h2>
          <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
          <p>By email: <a href="mailto:icisaiahcerven@gmail.com" className="text-pink-500 hover:text-pink-600">icisaiahcerven@gmail.com</a></p>
        </div>
      </main>
    </div>
  )
} 