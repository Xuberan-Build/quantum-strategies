'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { readApi, type ReadApi } from './api';

const ReadApiContext = createContext<ReadApi>(readApi);

/** Lets tests inject a mock client. Production code never wraps this. */
export function ReadApiProvider({ api, children }: { api: ReadApi; children: ReactNode }) {
  return <ReadApiContext.Provider value={api}>{children}</ReadApiContext.Provider>;
}

export function useReadApi(): ReadApi {
  return useContext(ReadApiContext);
}
