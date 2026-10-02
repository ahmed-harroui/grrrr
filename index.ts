import { registerRootComponent } from "expo";
import App from "./App";
import { registerWidgets } from "@/widgets/native";

registerRootComponent(App);
// Android redraws the home-screen widgets through this handler, even when the app is closed.
registerWidgets();
