import './globals.css'
export const metadata = { title: 'MotionLab — Motion Graphics Studio', description: 'Keyframe-based motion graphics editor in the browser' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
