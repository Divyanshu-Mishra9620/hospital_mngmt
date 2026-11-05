import type { Metadata } from "next";
import type { ComponentProps } from "react";
import View from "./page-view";

export const metadata: Metadata = { title: "Doctors" };

// Data is loaded in the browser from local storage — see ./page-view.tsx
export default function Page(props: ComponentProps<typeof View>) {
  return <View {...props} />;
}
