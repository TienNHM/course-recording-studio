import React from "react";
import { BrandMark } from "./components/AppHeader";

/**
 * App logo. Kept for older imports; prefer <AppHeader>, which already shows
 * the brand mark (readable in every palette and mode).
 */
export const Logo: React.FC<{ readonly compact?: boolean }> = ({ compact }) => {
  return <BrandMark compact={compact} />;
};
