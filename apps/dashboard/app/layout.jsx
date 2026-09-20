import "./globals.css";
import "./rpg.css";
import "./rpg-office.css";
import "./live-command-deck.css";
import "./command-room-3d.css";

export const metadata = {
  title: "Riven-Starlance Live Command Room",
  description: "Live multi-agent research orchestration command room",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="rpg-shell">{children}</body>
    </html>
  );
}
