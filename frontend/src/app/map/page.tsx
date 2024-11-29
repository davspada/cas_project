  // pages/index.js
import Head from 'next/head';
import MapComponent from './dashboard';
import Layout from '@/components/layout';

export default function Home() {
  return (
    <Layout>
    <main>
      <div>
          <MapComponent />
        </div>
    </main>
    </Layout>
  );
}
