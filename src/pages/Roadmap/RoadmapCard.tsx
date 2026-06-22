import Box from '@mui/material/Box'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { ROADMAP_STEPS, type RoadmapStatus } from '@/constants/roadmap'

/**
 * FAB 구축 로드맵 — Claude Design 시안 "FAB Construction Roadmap" 재현.
 * 가로 단일행 타임라인(완료/진행중/예정), 현재 단계 글로우 + 펄스 링.
 * 자체 다크 그라데이션 카드라 시안 색을 그대로 사용(앱도 다크).
 */

interface StatusStyle {
  badge: string
  badgeColor: string
  badgeBg: string
  nodeBorder: string
  nodeColor: string
  nodeBg: string
  nodeShadow: string
}

const STATUS: Record<RoadmapStatus, StatusStyle> = {
  done: {
    badge: '완료',
    badgeColor: '#35d39a',
    badgeBg: 'rgba(53,211,154,.14)',
    nodeBorder: '#35d39a',
    nodeColor: '#35d39a',
    nodeBg: '#13202a',
    nodeShadow: 'inset 0 0 0 48px rgba(53,211,154,.10)',
  },
  current: {
    badge: '진행중',
    badgeColor: '#cfe0ff',
    badgeBg: 'rgba(63,125,246,.30)',
    nodeBorder: '#4f8bff',
    nodeColor: '#fff',
    nodeBg: 'linear-gradient(158deg,#5a93ff,#2f6ae0)',
    nodeShadow: '0 0 0 6px rgba(63,125,246,.16),0 8px 18px -4px rgba(47,106,224,.55)',
  },
  plan: {
    badge: '예정',
    badgeColor: '#9fb0c4',
    badgeBg: 'rgba(148,163,184,.13)',
    nodeBorder: '#35465a',
    nodeColor: '#5d6f86',
    nodeBg: '#161f2b',
    nodeShadow: 'none',
  },
}

export interface RoadmapCardProps {
  /** 현재 단계 펄스 링 표시 (기본 true) */
  pulse?: boolean
  /** 헤더 우측 범례 표시 (기본 true) */
  showLegend?: boolean
}

function LegendDot({ color, ring, border }: { color: string; ring?: string; border?: string }) {
  return (
    <Box
      component="span"
      sx={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: color,
        boxShadow: ring,
        border,
        flex: 'none',
      }}
    />
  )
}

export default function RoadmapCard({ pulse = true, showLegend = true }: RoadmapCardProps) {
  return (
    <Box
      sx={{
        maxWidth: 940,
        mx: 'auto',
        background: 'linear-gradient(160deg,#141d2b,#0e151f)',
        border: '1px solid #243245',
        borderRadius: '22px',
        p: '26px 30px 24px',
        color: '#e2e8f0',
        boxSizing: 'border-box',
        boxShadow: '0 18px 44px -22px rgba(0,0,0,.55)',
      }}
    >
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', mb: '24px', flexWrap: 'wrap' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '14px',
            background: 'linear-gradient(155deg,#2a4a86,#1a2740)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7eb0ff',
            flex: '0 0 auto',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07)',
            '& svg': { fontSize: 24 },
          }}
        >
          <TrendingUpIcon fontSize="inherit" />
        </Box>
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <Box sx={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
            FAB 구축 로드맵
          </Box>
          <Box sx={{ fontSize: 13, color: '#94a3b8', mt: '4px' }}>
            GIST 첨단AI반도체팹센터 구축 단계별 진행 현황
          </Box>
        </Box>
        {showLegend && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '0 0 auto' }}>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 11.5, color: '#9fb0c4' }}>
              <LegendDot color="#35d39a" />
              완료
            </Box>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 11.5, color: '#9fb0c4' }}>
              <LegendDot color="#4f8bff" ring="0 0 0 3px rgba(79,139,255,.22)" />
              진행중
            </Box>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 11.5, color: '#9fb0c4' }}>
              <LegendDot color="#2a3645" border="1.5px solid #45566b" />
              예정
            </Box>
          </Box>
        )}
      </Box>

      {/* 타임라인 */}
      <Box sx={{ overflowX: 'auto', p: '4px 2px 8px' }}>
        <Box sx={{ position: 'relative', minWidth: 780 }}>
          {/* 진행 커넥터 */}
          <Box
            sx={{
              position: 'absolute',
              left: '6%',
              right: '6%',
              top: 23,
              height: 3,
              borderRadius: '3px',
              background:
                'linear-gradient(90deg,#35d39a 0%,#35d39a 40%,#4f8bff 50%,#3a4d63 60%,#2a3645 100%)',
              opacity: 0.75,
              zIndex: 0,
            }}
          />
          {/* 단계 컬럼들 */}
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            {ROADMAP_STEPS.map((step) => {
              const s = STATUS[step.status]
              const isCurrent = step.status === 'current'
              return (
                <Box
                  key={step.label}
                  sx={{
                    flex: step.wide ? '1.2 1 0' : '1 1 0',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  {/* 노드 */}
                  <Box sx={{ position: 'relative', width: 48, height: 48 }}>
                    {isCurrent && pulse && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          border: '2px solid #4f8bff',
                          animation: 'ringPulse 2.2s ease-out infinite',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    <Box
                      sx={{
                        position: 'relative',
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: `2px solid ${s.nodeBorder}`,
                        color: s.nodeColor,
                        background: s.nodeBg,
                        boxShadow: s.nodeShadow,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '& svg': { fontSize: 20 },
                      }}
                    >
                      {step.icon}
                    </Box>
                  </Box>

                  {/* 상태 배지 */}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      fontSize: 11,
                      fontWeight: 700,
                      p: '3px 10px',
                      borderRadius: '999px',
                      letterSpacing: '0.2px',
                      mt: '13px',
                      color: s.badgeColor,
                      background: s.badgeBg,
                    }}
                  >
                    {s.badge}
                  </Box>

                  {/* 제목 */}
                  <Box
                    sx={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: isCurrent ? '#f8fafc' : '#eef3f9',
                      mt: '9px',
                      lineHeight: 1.3,
                      textWrap: 'balance',
                    }}
                  >
                    {step.label}
                  </Box>

                  {/* 기간 */}
                  <Box sx={{ fontSize: 12, color: '#8195a9', mt: '5px', fontVariantNumeric: 'tabular-nums' }}>
                    {step.period}
                  </Box>

                  {/* 현재 단계 마커 */}
                  {isCurrent && (
                    <Box
                      sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#7eb0ff',
                        mt: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        justifyContent: 'center',
                      }}
                    >
                      <Box component="span" sx={{ width: 5, height: 5, borderRadius: '50%', background: '#7eb0ff' }} />
                      현재 단계
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
