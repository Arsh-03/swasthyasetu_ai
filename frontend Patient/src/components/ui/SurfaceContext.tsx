import { createContext, useContext } from 'react';

/**
 * What a component is drawn on. Glass surfaces set 'glass'; opaque neumorphic
 * panels, wells and cards reset it to 'opaque'. AppText uses it to enforce
 * "ink text only on glass" (inkMuted fails 4.5:1 over sheets + ambient blobs).
 */
export type Surface = 'opaque' | 'glass';

export const SurfaceContext = createContext<Surface>('opaque');

export const useSurface = () => useContext(SurfaceContext);
