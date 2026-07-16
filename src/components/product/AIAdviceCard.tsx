import { motion } from 'framer-motion';
import { fadeIn } from '../../design-system/animations';

export interface AIAdvice {
  summary: string;
  pros: string[];
  cons: string[];
  recommendation: string;
  bestPlatform: string;
  confidence?: string;
  /** true when this came from the real Groq model; false/undefined when it's
   * the client-side rule-based fallback used because the AI call failed. */
  isAiGenerated?: boolean;
}

export interface AIAdviceCardProps {
  advice: AIAdvice | null;
  loading?: boolean;
  error?: boolean;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
      <span className="text-xs text-gray-400 ml-2">Analyzing prices…</span>
    </div>
  );
}

export function AIAdviceCard({ advice, loading = false, error = false }: AIAdviceCardProps) {
  if (error || (!loading && !advice)) return null;

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="bg-amber-50/30 rounded-2xl border border-amber-200/50 p-5 sm:p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,0.05) 0%, rgba(245,158,11,0.08) 100%)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🤖</span>
        <div>
          <h3 className="font-bold text-gray-900 text-base">AI Shopping Advisor</h3>
          <p className="text-[10px] text-gray-400">
            {advice?.isAiGenerated === false
              ? 'Quick price-based tips (AI insights unavailable right now)'
              : 'Powered by TagCheck AI'}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loading && <TypingDots />}

      {/* Content */}
      {advice && (
        <div className="space-y-4">
          {/* Summary */}
          <p className="text-sm font-semibold text-gray-800 leading-relaxed">
            {advice.summary}
          </p>

          {/* Pros */}
          {advice.pros.length > 0 && (
            <div>
              <ul className="space-y-1">
                {advice.pros.map((pro, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cons */}
          {advice.cons.length > 0 && (
            <div>
              <ul className="space-y-1">
                {advice.cons.map((con, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendation */}
          {advice.recommendation && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {advice.recommendation}
            </p>
          )}

          {/* Best platform callout */}
          {advice.bestPlatform && (
            <div className="bg-white/70 rounded-xl p-3 border border-amber-100">
              <p className="text-sm font-medium text-gray-800">
                🏆 Best buy: <span className="font-bold capitalize">{advice.bestPlatform}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default AIAdviceCard;
