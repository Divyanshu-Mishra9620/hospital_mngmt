import type { Metadata } from "next";
import View from "./page-view";

export const metadata: Metadata = { title: "Add doctor" };

// Data is loaded in the browser from local storage — see ./page-view.tsx
export default function Page() {
  return <View />;
}
