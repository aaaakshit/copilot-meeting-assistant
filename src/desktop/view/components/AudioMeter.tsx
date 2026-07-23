interface AudioMeterProps {
  level: number
}

export function AudioMeter({ level }: AudioMeterProps) {
  return (
    <div
      className="audio-meter"
      aria-label={`Audio level ${Math.round(level * 100)}%`}
    >
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className={level * 8 > index ? 'active' : ''}
          style={{ height: `${6 + index * 1.5}px` }}
        />
      ))}
    </div>
  )
}
