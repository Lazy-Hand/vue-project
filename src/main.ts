import { createApp } from "vue";

import App from "./App.vue";
import "./styles/index.css";
import {setupRouter} from "./router";
import {setupPinia} from "@/stores";

const app = createApp(App);
app.use(setupRouter);
app.use(setupPinia)
app.mount("#app");
