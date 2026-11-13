/**
 * Entry point: the first JavaScript the browser runs.
 *
 * It loads the global styles, checks that the browser can store data, and
 * hands control to React, which renders <App /> into <div id="root"> in
 * index.html.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/emotions.css";
import "./styles/features.css";
import App from "./App.jsx";
import { db, isIndexedDbAvailable } from "./db/database.js";

const rootElement = document.getElementById("root");

/** Plain-HTML message for when the app cannot run at all. */
function renderFatalError(title, message) {
  rootElement.innerHTML = "";
  const box = document.createElement("div");
  box.className = "page";
  const card = document.createElement("div");
  card.className = "card stack";
  const heading = document.createElement("h1");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = message;
  card.append(heading, text);
  box.append(card);
  rootElement.append(box);
}

async function start() {
  if (!isIndexedDbAvailable()) {
    renderFatalError(
      "Storage isn't available",
      "This browser is blocking local storage (this can happen in private browsing). The app needs it to keep your entries on this device.",
    );
    return;
  }

  try {
    // Open the database up front so a problem shows a clear message instead
    // of a half-working app. This is also when schema upgrades run.
    await db.open();
  } catch (error) {
    console.error(error);
    renderFatalError(
      "The local database couldn't be opened",
      "Close any other tabs of this app and reload. If you are in private browsing, open it in a normal window. Your existing entries have not been deleted.",
    );
    return;
  }

  // StrictMode runs extra checks during development only (it renders some
  // components twice to surface bugs). It has no effect in the built app.
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

start();
