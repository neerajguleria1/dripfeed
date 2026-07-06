export default function PersistentBg() {
  return (
    <>
      {/* Ambient gradient background */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-white/70 via-[#F2C4CD]/80 to-[#F2C4CD]" />

      {/* Noise Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none noise-overlay" />
    </>
  );
}
