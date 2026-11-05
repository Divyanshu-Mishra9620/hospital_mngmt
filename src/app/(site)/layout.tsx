import type { ComponentProps } from "react";
import View from "./layout-view";

// Data is loaded in the browser from local storage — see ./layout-view.tsx
export default function Layout(props: ComponentProps<typeof View>) {
  return <View {...props} />;
}
