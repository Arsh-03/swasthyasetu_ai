import React from 'react';

export const AMBIENT_PEAK = { ice: 0, primarySoft: 0, sand: 0 } as const;

/**
 * Ambient background blobs have been removed in the clean surface system.
 * The canvas is pure clean #F2F5F8.
 */
export const AmbientBackground: React.FC = () => null;
