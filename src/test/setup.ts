import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Lazy-loaded routes/tabs can exceed the 1s findBy/waitFor default on loaded machines.
configure({ asyncUtilTimeout: 10000 });
