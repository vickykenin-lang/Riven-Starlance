import "./globals.css";
import "./command-room-3d.css";
import "./command-room-2d.css";
import "./riven-cinematic-overrides.css";

export const metadata = {
  title: "Riven-Starlance Live RPG Command Room",
  description: "Live multi-agent research orchestration command room",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
