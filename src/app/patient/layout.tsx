import type { Metadata } from "next";
import type { ComponentProps } from "react";
import View from "./layout-view";

export const metadata: Metadata = { title: { default: "Patient portal", template: "%s · Medora Patient" } };

// Data is loaded in the browser from local storage — see ./layout-view.tsx
export default function Layout(props: ComponentProps<typeof View>) {
  return <View {...props} />;
}
