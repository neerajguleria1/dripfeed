export default function PersistentBg() {
  return (
    <>
      {/* Ambient gradient background */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-white/70 via-[#C9A96E]/80 to-[#C9A96E]" />

      {/* Noise Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none noise-overlay" />
    </>
  );
}

