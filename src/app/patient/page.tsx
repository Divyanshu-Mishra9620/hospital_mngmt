import type { ComponentProps } from "react";
import View from "./page-view";

// Data is loaded in the browser from local storage — see ./page-view.tsx
export default function Page(props: ComponentProps<typeof View>) {
  return <View {...props} />;
}
