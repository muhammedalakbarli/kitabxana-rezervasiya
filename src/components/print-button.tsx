"use client";

import type { ReactNode } from "react";
import { btn } from "./ui";

export function PrintButton({ children }: { children: ReactNode }) {
  return <button type="button" onClick={() => window.print()} className={btn("primary")}>{children}</button>;
}
