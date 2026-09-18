import "./globals.css";

export const metadata = {
  title: "Riven-Starlance Research Control Center",
  description: "Live multi-agent research orchestration dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
