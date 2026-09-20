import "./globals.css";
import "./rpg.css";

export const metadata = {
  title: "Riven-Starlance RPG Command Center",
  description: "Live multi-agent research orchestration command center",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
