import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import "antd/dist/reset.css";
import App from "./App";
import useIllustrationTheme from "./illustrationTheme";
import "./styles.css";

function Root() {
  const illustrationTheme = useIllustrationTheme();

  return (
    <ConfigProvider locale={zhCN} {...illustrationTheme}>
      <App />
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
