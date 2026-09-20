import "./globals.css";
import "./rpg.css";
import "./rpg-office.css";
import "./live-command-deck.css";

export const metadata = {
  title: "Riven-Starlance Live AI Command Deck",
  description: "Live multi-agent RPG-style research orchestration command center",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="rpg-shell">{children}</body>
    </html>
  );
}
