'use client'

import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

export function ValidationScoreCircle({ score, size = 120 }: { score: number; size?: number }): JSX.Element {
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const [dashoffset, setDashoffset] = useState(circumference)
  const scoreCircleRef = useRef<SVGCircleElement | null>(null)

  const stroke = useMemo(() => {
    if (score >= 70) return '#16A34A'
    if (score >= 40) return '#D97706'
    return '#DC2626'
  }, [score])

  useEffect(() => {
    requestAnimationFrame(() => {
      const next = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference
      setDashoffset(next)
    })
  }, [score, circumference])

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="inline-flex flex-col items-center justify-center"
      role="img"
      aria-label={`Validation score: ${score} out of 100`}
    >
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={radius} stroke="#D0C8C0" strokeWidth="8" fill="none" />
        <circle
          ref={scoreCircleRef}
          cx="60"
          cy="60"
          r={radius}
          stroke={stroke}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <text x="60" y="60" dominantBaseline="middle" textAnchor="middle" className="fill-heading font-display text-[28px] font-bold">
          {score}
        </text>
      </svg>
      <span className="-mt-3 text-[10px] text-muted">out of 100</span>
    </motion.div>
  )
}
