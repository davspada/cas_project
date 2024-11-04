  // pages/index.js
import Head from 'next/head';
import MapComponent from './dashboard';
import Layout from '@/components/layout';

export default function Home() {
  return (
    <Layout>
    <main>
      <Head>
        <title>OpenLayers Map in Next.js</title>
        <meta name="description" content="Simple OpenLayers Map in a Next.js project" />
      </Head>

      <div>
          <h1>Welcome to Next.js with OpenLayers!</h1>
          <MapComponent />
        </div>
    </main>
    </Layout>
  );
}
