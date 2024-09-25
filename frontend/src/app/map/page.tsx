  // pages/index.js
import Head from 'next/head';
import MapComponent from './dashboard';

export default function Home() {
  return (
    <div>
      <Head>
        <title>OpenLayers Map in Next.js</title>
        <meta name="description" content="Simple OpenLayers Map in a Next.js project" />
      </Head>

      <main>
        <h1>Welcome to Next.js with OpenLayers!</h1>
        <MapComponent />
      </main>
    </div>
  );
}
