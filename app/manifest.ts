import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Prog — Training, measured.',
    short_name: 'Prog',
    description: 'Your personal training log.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f7f4',
    theme_color: '#f8f7f4',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
    shortcuts: [
      { name: 'Start workout', short_name: 'Workout', url: '/?start=workout', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] },
      { name: 'Progress', short_name: 'Progress', url: '/?tab=progress', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] },
    ],
  };
}
