import { config } from '../config.js';
import { mockProvider } from './mockProvider.js';
import { mlProvider } from './mlProvider.js';

// Same interface either way, so routes never care where the data comes from.
export const provider = config.mock ? mockProvider : mlProvider;
