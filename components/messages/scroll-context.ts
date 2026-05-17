import { createContext, type RefObject } from "react";

export const ScrollContext = createContext<{
    hasUserScrolledRef: RefObject<boolean>;
    isProgrammaticScrollRef: RefObject<boolean>;
} | null>(null);
