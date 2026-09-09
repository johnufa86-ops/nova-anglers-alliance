import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,

  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/admin', destination: '/admin.html' },
      { source: '/organizer', destination: '/admin.html' },
      { source: '/admin/applications', destination: '/admin-applications.html' },
      { source: '/admin/application', destination: '/admin-application.html' },
      { source: '/admin/competition/:slug', destination: '/admin-competition.html?slug=:slug' },
      { source: '/admin/payment-details', destination: '/admin-payment-details.html' },
      { source: '/admin/content', destination: '/admin-content.html' },
      { source: '/register', destination: '/register.html' },
      { source: '/login', destination: '/login.html' },
      { source: '/cabinet', destination: '/cabinet.html' },
      { source: '/cabinet/applications', destination: '/cabinet-applications.html' },
      { source: '/cabinet/profile', destination: '/cabinet-profile.html' },
      { source: '/cabinet/documents', destination: '/cabinet-documents.html' },
      { source: '/cabinet/results', destination: '/cabinet-results.html' },
      { source: '/competitions', destination: '/competitions.html' },
      { source: '/competition/:slug', destination: '/competition.html?id=:slug' },
      { source: '/rating', destination: '/rating.html' },
      { source: '/athletes', destination: '/athletes.html' },
      { source: '/athlete/:id', destination: '/athlete.html?id=:id' },
      { source: '/teams', destination: '/teams.html' },
      { source: '/team/:id', destination: '/team.html?id=:id' },
      { source: '/news', destination: '/news.html' },
      { source: '/media', destination: '/media.html' },
      { source: '/alliance', destination: '/alliance.html' },
      { source: '/partners', destination: '/partners.html' },
      { source: '/contacts', destination: '/contacts.html' },
    ];
  },
};

export default nextConfig;