import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Prog — Training, measured.',
    short_name: 'Prog',
    description: 'Your personal training log.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f7f4',
    theme_color: '#f8f7f4',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
