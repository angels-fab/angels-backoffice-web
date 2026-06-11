import { ROADMAP_STEPS } from '@/constants/roadmap'

const STATUS_LABEL = { done: '완료', current: '진행중', plan: '예정' } as const
const STATUS_CLS = { done: 'done-s', current: 'ing-s', plan: 'plan-s' } as const

// FAB 구축 로드맵 타임라인 (PC 전용)
export default function RoadmapTimeline() {
  return (
    <div className="dashboard d-only">
      <div className="dash-header">
        <span className="dash-title">FAB 구축 로드맵</span>
      </div>
      <div className="rm-timeline-wrap">
        <div className="rm-timeline-track" />
        <div className="rm-steps">
          {ROADMAP_STEPS.map(step => (
            <div key={step.label} className={`rm-step${step.status !== 'plan' ? ' ' + (step.status === 'done' ? 'done' : 'current') : ''}`}>
              <div className={`rm-step-icon${step.status !== 'plan' ? ' ' + (step.status === 'done' ? 'done' : 'current') : ''}`}>
                {step.icon}
              </div>
              <div className="rm-step-label">{step.label}</div>
              <div className="rm-step-period">{step.period}</div>
              <div className={`rm-step-status ${STATUS_CLS[step.status]}`}>{STATUS_LABEL[step.status]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
